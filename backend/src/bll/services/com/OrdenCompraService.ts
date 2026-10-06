/**
 * Capa 3 - Logica de Negocio / compras.
 *
 * Caso de uso: Orden de compra al proveedor.
 *
 * Patron Facade: una sola operacion (`crear`) coordina varios subsistemas:
 *   resolucion de precio (Strategy) + alta cabecera/detalle (HeaderDetailRepository)
 *   + avance de estado de la solicitud origen + evento de dominio.
 * El llamador no necesita conocer ese detalle.
 *
 * Otros conceptos: herencia (TransactionalService), composicion (PriceResolver
 * inyectable), StateMachine para ESTADO, bloqueo optimista en cabecera y
 * detalle, columna VIRTUAL SUBTOTAL_CALCULADO tratada como solo lectura.
 */

import { SoloValidacionExitosa } from "../../../common/errors/SoloValidacion.js";
import type { Connection } from "oracledb";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
  type ErrorDetail,
} from "../../../common/errors/AppError.js";
import { normalizePageQuery, type PageQuery, type Paginated } from "../../../common/types/Query.js";
import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import type {
  OrdenCompra,
  OrdenCompraDetalle,
  OrdenCompraEstado,
  SolicitudCompra,
} from "../../../entities/com/models.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
import { Validacion } from "../../../common/validation/reglas.js";
import { aDia, formatoDia } from "../../../common/util/fechas.js";
import {
  ofertaVigente,
  validarEntregaOrden,
  validarLineasOrden,
  validarTasaCambio,
} from "../../compras/reglasDocumentos.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import type { WithDetails } from "../../../dal/contracts/IHeaderDetailRepository.js";
import {
  ordenCompraRepository,
  solicitudRepository,
} from "../../../dal/repositories/com/index.js";
import { PriceResolver, defaultPriceResolver } from "../../pricing/PriceResolver.js";
import { ComEvents } from "../../events/domainEvents.js";
import { ordenCompraStateMachine, solicitudStateMachine } from "../../compras/stateMachines.js";
import { TransactionalService } from "../../support/TransactionalService.js";

interface LineaInput {
  readonly idArticulo?: number | null;
  readonly descripcion: string;
  readonly cantidad: number;
  readonly idUnidadMedida: number;
  readonly idCotizacionDetalle?: number;
  readonly precioUnitario?: number;
  readonly porcentajeDescuento?: number;
  readonly porcentajeImpuesto?: number;
  readonly toleranciaPorcentaje?: number;
}

export interface CrearOrdenInput {
  readonly idProveedor: number;
  readonly idEmpleadoGerenteFinanciero: number;
  readonly idMoneda: number;
  readonly tasaCambio: number;
  readonly fechaEntregaEsperada: string;
  readonly numeroReferencia?: string;
  readonly idSolicitud?: number;
  readonly lineas: readonly LineaInput[];
}

export class OrdenCompraService extends TransactionalService {
  private readonly repo = ordenCompraRepository();

  private readonly solicitudRepo = solicitudRepository();

  constructor(private readonly precios: PriceResolver = defaultPriceResolver) {
    super();
  }

  public async listar(query: PageQuery): Promise<Paginated<OrdenCompra>> {
    return this.repo.findAll(query) as Promise<Paginated<OrdenCompra>>;
  }

  public async obtener(
    id: number,
  ): Promise<WithDetails<OrdenCompra, OrdenCompraDetalle>> {
    const found = (await this.repo.findByIdWithDetails(id)) as WithDetails<
      OrdenCompra,
      OrdenCompraDetalle
    > | null;
    if (found === null) throw new NotFoundError("COM_ORDEN_COMPRA", id);
    return found;
  }

  public async crear(
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<OrdenCompra, OrdenCompraDetalle>> {
    const input = this.parseCrear(body);

    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      const hoy = new Date().toISOString();
      await this.validarContexto(input, conn);
      const fkProp = this.repo.detailForeignKeyProp();
      const lineasResueltas: Record<string, unknown>[] = [];

      for (const [i, linea] of input.lineas.entries()) {
        const precio = await this.resolverPrecio(input, linea, hoy, conn, i);
        lineasResueltas.push(
          validateAgainstDescriptor(
            COM_DESCRIPTORS.ordenCompraDetalle,
            {
              idArticulo: linea.idArticulo ?? null,
              idCotizacionDetalle: linea.idCotizacionDetalle ?? null,
              descripcion: linea.descripcion,
              cantidad: linea.cantidad,
              idUnidadMedida: linea.idUnidadMedida,
              precioUnitario: precio.precioUnitario,
              porcentajeDescuento: precio.porcentajeDescuento,
              porcentajeImpuesto: precio.porcentajeImpuesto,
              toleranciaPorcentaje: linea.toleranciaPorcentaje ?? 0,
            },
            "create",
            [fkProp],
          ),
        );
      }

      const cabecera = validateAgainstDescriptor(
        COM_DESCRIPTORS.ordenCompra,
        {
          idProveedor: input.idProveedor,
          idEmpleadoGerenteFinanciero: input.idEmpleadoGerenteFinanciero,
          idMoneda: input.idMoneda,
          tasaCambio: input.tasaCambio,
          estado: "EMITIDA",
          numeroReferencia: input.numeroReferencia ?? null,
          fechaEntregaEsperada: input.fechaEntregaEsperada,
        },
        "create",
      );

      if (ctx.soloValidar === true) throw new SoloValidacionExitosa();
      const created = (await this.repo.createWithDetails(
        cabecera,
        lineasResueltas,
        ctx,
        conn,
      )) as WithDetails<OrdenCompra, OrdenCompraDetalle>;

      if (input.idSolicitud !== undefined) {
        await this.marcarSolicitudGenerada(input.idSolicitud, ctx, conn);
      }

      enqueueEvent(ComEvents.OrdenCompraEmitida, {
        idOrdenCompra: created.header.idOrdenCompra,
        idProveedor: created.header.idProveedor,
        lineas: created.details.length,
        userId: ctx.userId,
      });
      return created;
    });
  }

  public async cambiarEstado(
    id: number,
    body: unknown,
    ctx: AuditContext,
  ): Promise<OrdenCompra> {
    const destino = this.parseEstado(body);
    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      const actual = (await this.repo.findById(id, conn)) as OrdenCompra | null;
      if (actual === null) throw new NotFoundError("COM_ORDEN_COMPRA", id);
      ordenCompraStateMachine.assertTransition(actual.estado, destino);
      const updated = (await this.repo.update(
        id,
        { estado: destino },
        actual.version,
        ctx,
        conn,
      )) as OrdenCompra;
      enqueueEvent(ComEvents.OrdenCompraEstadoCambiado, {
        idOrdenCompra: id,
        estadoAnterior: actual.estado,
        estadoNuevo: destino,
        userId: ctx.userId,
      });
      return updated;
    });
  }

  /**
   * Edita la cabecera de la OC. Cerrojo: solo mientras esta EMITIDA (aun no se
   * envio al proveedor). No toca lineas ni precios.
   */
  public async actualizar(
    id: number,
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<OrdenCompra, OrdenCompraDetalle>> {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    const b = body as Record<string, unknown>;
    return this.runInTransaction(async ({ conn }) => {
      const actual = (await this.repo.findById(id, conn)) as OrdenCompra | null;
      if (actual === null) throw new NotFoundError("COM_ORDEN_COMPRA", id);
      if (actual.estado !== "EMITIDA") {
        throw new BusinessRuleError(
          `No se puede editar: la orden ya está ${actual.estado.toLowerCase()}.`,
        );
      }
      const reglas = new Validacion();
      if (b["fechaEntregaEsperada"] !== undefined) {
        // Cambiar la entrega: hoy o despues, y nunca antes de la propia emision de la orden.
        validarEntregaOrden(reglas, b["fechaEntregaEsperada"], {
          emision: aDia((actual as OrdenCompra & { fechaEmision?: unknown }).fechaEmision),
        });
      }
      if (b["tasaCambio"] !== undefined) validarTasaCambio(reglas, b["tasaCambio"]);
      if (b["idMoneda"] !== undefined) reglas.id("idMoneda", "La moneda", b["idMoneda"]);
      reglas.lanzarSiHay("Orden de compra inválida");

      const patch: Record<string, unknown> = {};
      if (b["fechaEntregaEsperada"] !== undefined) {
        patch["fechaEntregaEsperada"] = String(b["fechaEntregaEsperada"]).trim();
      }
      if (b["numeroReferencia"] !== undefined) {
        patch["numeroReferencia"] =
          b["numeroReferencia"] === null || b["numeroReferencia"] === ""
            ? null
            : String(b["numeroReferencia"]);
      }
      if (b["idMoneda"] !== undefined) patch["idMoneda"] = Number(b["idMoneda"]);
      if (b["tasaCambio"] !== undefined) patch["tasaCambio"] = Number(b["tasaCambio"]);
      if (Object.keys(patch).length > 0) {
        const dto = validateAgainstDescriptor(
          COM_DESCRIPTORS.ordenCompra,
          patch,
          "update",
        );
        await this.repo.update(id, dto, actual.version, ctx, conn);
      }
      const out = (await this.repo.findByIdWithDetails(id, conn)) as WithDetails<
        OrdenCompra,
        OrdenCompraDetalle
      > | null;
      if (out === null) throw new NotFoundError("COM_ORDEN_COMPRA", id);
      return out;
    });
  }

  /** Borrado logico de la OC (cabecera + lineas). Cerrojo: EMITIDA / CANCELADA / RECHAZADA. */
  public async eliminar(id: number, ctx: AuditContext): Promise<{ idOrdenCompra: number }> {
    return this.runInTransaction(async ({ conn }) => {
      const actual = (await this.repo.findById(id, conn)) as OrdenCompra | null;
      if (actual === null) throw new NotFoundError("COM_ORDEN_COMPRA", id);
      if (!["EMITIDA", "CANCELADA", "RECHAZADA"].includes(actual.estado)) {
        throw new BusinessRuleError(
          `No se puede eliminar: la orden está ${actual.estado.toLowerCase()} ` +
            "(ya tiene movimiento). Cancélala primero si aplica.",
        );
      }
      await this.repo.softDeleteWithDetails(id, ctx, conn);
      return { idOrdenCompra: id };
    });
  }

  // ------------------------------------------------------------------------

  /**
   * Reglas que necesitan leer la base: la entrega no puede ser anterior a la
   * solicitud de origen, el proveedor debe estar activo y cada oferta
   * referenciada debe estar adjudicada, ser de ESE proveedor y seguir vigente.
   */
  private async validarContexto(input: CrearOrdenInput, conn: Connection): Promise<void> {
    const reglas = new Validacion();

    let diaSolicitud: string | null = null;
    if (input.idSolicitud !== undefined) {
      const sol = (await this.solicitudRepo.findById(input.idSolicitud, conn)) as
        | (SolicitudCompra & { fechaCreacion?: unknown })
        | null;
      if (sol === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", input.idSolicitud);
      diaSolicitud = aDia(sol.fechaCreacion);
    }
    validarEntregaOrden(reglas, input.fechaEntregaEsperada, { solicitud: diaSolicitud });
    reglas.lanzarSiHay("Fecha de entrega inválida");

    const proveedor = (await repositoryFactory()
      .get<{ razonSocial: string; estado: string | null }, object, object>("proveedor")
      .findById(input.idProveedor, conn)) as { razonSocial: string; estado: string | null } | null;
    if (proveedor === null) throw new NotFoundError("COM_PROVEEDOR", input.idProveedor);
    if (proveedor.estado === "I") {
      throw new BusinessRuleError(
        `El proveedor ${proveedor.razonSocial} está inactivo; no se le pueden emitir órdenes.`,
      );
    }

    const detalleRepo = repositoryFactory().get<
      { idCotizacion: number; adjudicado: boolean },
      object,
      object
    >("cotizacionDetalle");
    // Bloquea las lineas de oferta (en orden de id: sin interbloqueos) y verifica que
    // ninguna este ya consumida por otra orden viva. Sin el bloqueo, dos usuarios
    // emitian simultaneamente la misma oferta dos veces.
    const ocLineaRepo = repositoryFactory().get<
      { idOrdenCompra: number; idCotizacionDetalle: number | null },
      object,
      object
    >("ordenCompraDetalle");
    const ids = input.lineas
      .map((l) => l.idCotizacionDetalle)
      .filter((x): x is number => x !== undefined)
      .sort((a, b) => a - b);
    for (const idCd of ids) {
      await detalleRepo.lockById(idCd, conn);
      const usos = await ocLineaRepo.findAll(
        normalizePageQuery({ page: 1, pageSize: 50, filters: [{ prop: "idCotizacionDetalle", operator: "eq", value: idCd }] }),
        conn,
      );
      for (const u of usos.data) {
        const oc = (await this.repo.findById(u.idOrdenCompra, conn)) as OrdenCompra | null;
        if (oc !== null && oc.estado !== "CANCELADA" && oc.estado !== "RECHAZADA") {
          throw new BusinessRuleError(
            `La oferta ${idCd} ya está en la orden de compra OC-${u.idOrdenCompra}; una oferta adjudicada se emite una sola vez.`,
          );
        }
      }
    }
    const cotRepo = repositoryFactory().get<
      { idProveedor: number; fechaVencimiento: unknown },
      object,
      object
    >("cotizacionProveedor");
    for (const [i, linea] of input.lineas.entries()) {
      if (linea.idCotizacionDetalle === undefined) continue;
      const det = await detalleRepo.findById(linea.idCotizacionDetalle, conn);
      if (det === null) {
        throw new NotFoundError("COM_COTIZACION_DETALLE", linea.idCotizacionDetalle);
      }
      const cot = await cotRepo.findById(det.idCotizacion, conn);
      if (cot !== null && cot.idProveedor !== input.idProveedor) {
        throw new BusinessRuleError(
          `Línea ${i + 1}: la oferta ${linea.idCotizacionDetalle} es de otro proveedor, no del de esta orden.`,
        );
      }
      const vence = cot === null ? null : aDia(cot.fechaVencimiento);
      if (!ofertaVigente(vence)) {
        throw new BusinessRuleError(
          `Línea ${i + 1}: la oferta ${linea.idCotizacionDetalle} venció el ${formatoDia(vence ?? "")}; ` +
            "pida al proveedor una cotización vigente antes de emitir la orden.",
        );
      }
    }
  }

  private async resolverPrecio(
    input: CrearOrdenInput,
    linea: LineaInput,
    fecha: string,
    conn: Connection,
    indice: number,
  ): Promise<{
    precioUnitario: number;
    porcentajeDescuento: number;
    porcentajeImpuesto: number;
  }> {
    if (linea.precioUnitario !== undefined) {
      return {
        precioUnitario: linea.precioUnitario,
        porcentajeDescuento: linea.porcentajeDescuento ?? 0,
        porcentajeImpuesto: linea.porcentajeImpuesto ?? 0,
      };
    }
    const query: {
      idArticulo: number | null;
      idProveedor: number;
      cantidad: number;
      fecha: string;
      idCotizacionDetalle?: number;
    } = {
      idArticulo: linea.idArticulo ?? null,
      idProveedor: input.idProveedor,
      cantidad: linea.cantidad,
      fecha,
    };
    if (linea.idCotizacionDetalle !== undefined) {
      query.idCotizacionDetalle = linea.idCotizacionDetalle;
    }
    try {
      const r = await this.precios.resolve(query, conn);
      return {
        precioUnitario: r.precioUnitario,
        porcentajeDescuento: r.porcentajeDescuento,
        porcentajeImpuesto: r.porcentajeImpuesto,
      };
    } catch (e) {
      if (e instanceof BusinessRuleError) {
        throw new ValidationError(
          `Línea ${indice + 1}: ${e.message}`,
          [{ field: `lineas[${indice}].precioUnitario`, message: "no resuelto" }],
        );
      }
      throw e;
    }
  }

  private async marcarSolicitudGenerada(
    idSolicitud: number,
    ctx: AuditContext,
    conn: Connection,
  ): Promise<void> {
    const sol = (await this.solicitudRepo.findById(
      idSolicitud,
      conn,
    )) as SolicitudCompra | null;
    if (sol === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", idSolicitud);
    if (sol.estado === "ORDEN_GENERADA") return;
    solicitudStateMachine.assertTransition(sol.estado, "ORDEN_GENERADA");
    await this.solicitudRepo.update(
      idSolicitud,
      { estado: "ORDEN_GENERADA" },
      sol.version,
      ctx,
      conn,
    );
  }

  private parseCrear(body: unknown): CrearOrdenInput {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    const b = body as Record<string, unknown>;
    const lineasRaw = Array.isArray(b["lineas"]) ? (b["lineas"] as unknown[]) : [];
    const lineasObj = lineasRaw.map((l) =>
      l !== null && typeof l === "object" ? (l as Record<string, unknown>) : {},
    );

    const v = new Validacion();
    const idProveedor = v.id("idProveedor", "El proveedor", b["idProveedor"]);
    const idEmpleadoGerenteFinanciero = v.id(
      "idEmpleadoGerenteFinanciero",
      "El gerente financiero",
      b["idEmpleadoGerenteFinanciero"],
    );
    const idMoneda = v.id("idMoneda", "La moneda", b["idMoneda"]);
    const tasaCambio = validarTasaCambio(v, b["tasaCambio"]);
    if (typeof b["fechaEntregaEsperada"] !== "string" || b["fechaEntregaEsperada"].trim() === "") {
      v.error("fechaEntregaEsperada", "La fecha de entrega esperada es obligatoria");
    }
    if (typeof b["numeroReferencia"] === "string" && b["numeroReferencia"].trim().length > 50) {
      v.error("numeroReferencia", "El número de referencia no puede superar 50 caracteres");
    }
    validarLineasOrden(v, lineasObj);
    lineasObj.forEach((l, i) => {
      v.texto(`lineas[${i}].descripcion`, `Línea ${i + 1}: la descripción`, l["descripcion"], { max: 255 });
      v.id(`lineas[${i}].idUnidadMedida`, `Línea ${i + 1}: la unidad de medida`, l["idUnidadMedida"]);
    });
    v.lanzarSiHay("Orden de compra inválida");

    const lineas: LineaInput[] = lineasObj.map((l) => {
      const out: LineaInput = {
        descripcion: String(l["descripcion"]).trim(),
        cantidad: Number(l["cantidad"]),
        idUnidadMedida: Number(l["idUnidadMedida"]),
      };
      const opt: Partial<Record<keyof LineaInput, number | null>> = {};
      if (l["idArticulo"] !== undefined && l["idArticulo"] !== null) opt.idArticulo = Number(l["idArticulo"]);
      if (l["idCotizacionDetalle"] !== undefined) opt.idCotizacionDetalle = Number(l["idCotizacionDetalle"]);
      if (l["precioUnitario"] !== undefined) opt.precioUnitario = Number(l["precioUnitario"]);
      if (l["porcentajeDescuento"] !== undefined) opt.porcentajeDescuento = Number(l["porcentajeDescuento"]);
      if (l["porcentajeImpuesto"] !== undefined) opt.porcentajeImpuesto = Number(l["porcentajeImpuesto"]);
      if (l["toleranciaPorcentaje"] !== undefined) opt.toleranciaPorcentaje = Number(l["toleranciaPorcentaje"]);
      return { ...out, ...opt } as LineaInput;
    });

    const result: CrearOrdenInput = {
      idProveedor: idProveedor as number,
      idEmpleadoGerenteFinanciero: idEmpleadoGerenteFinanciero as number,
      idMoneda: idMoneda as number,
      tasaCambio: tasaCambio as number,
      fechaEntregaEsperada: String(b["fechaEntregaEsperada"]).trim(),
      lineas,
    };
    const extra: { numeroReferencia?: string; idSolicitud?: number } = {};
    if (typeof b["numeroReferencia"] === "string" && b["numeroReferencia"].trim() !== "") {
      extra.numeroReferencia = b["numeroReferencia"].trim();
    }
    if (b["idSolicitud"] !== undefined && b["idSolicitud"] !== null) {
      extra.idSolicitud = Number(b["idSolicitud"]);
    }
    return { ...result, ...extra };
  }

  private parseEstado(body: unknown): OrdenCompraEstado {
    const estado =
      body !== null && typeof body === "object"
        ? String((body as Record<string, unknown>)["estado"] ?? "")
        : "";
    const valido = COM_DESCRIPTORS.ordenCompra.columns
      .find((c) => c.prop === "estado")
      ?.enumValues?.includes(estado);
    if (valido !== true) {
      throw new ValidationError("Estado de orden de compra inválido", [
        { field: "estado", message: "valor no permitido" },
      ]);
    }
    return estado as OrdenCompraEstado;
  }
}

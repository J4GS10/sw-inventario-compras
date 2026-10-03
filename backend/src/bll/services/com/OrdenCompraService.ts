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

import type { Connection } from "oracledb";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
  type ErrorDetail,
} from "../../../common/errors/AppError.js";
import type { PageQuery, Paginated } from "../../../common/types/Query.js";
import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import type {
  OrdenCompra,
  OrdenCompraDetalle,
  OrdenCompraEstado,
  SolicitudCompra,
} from "../../../entities/com/models.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
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
          `No se puede editar: la orden ya esta ${actual.estado.toLowerCase()}.`,
        );
      }
      const patch: Record<string, unknown> = {};
      if (b["fechaEntregaEsperada"] !== undefined) {
        patch["fechaEntregaEsperada"] = String(b["fechaEntregaEsperada"]);
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
          `No se puede eliminar: la orden esta ${actual.estado.toLowerCase()} ` +
            "(ya tiene movimiento). Cancelala primero si aplica.",
        );
      }
      await this.repo.softDeleteWithDetails(id, ctx, conn);
      return { idOrdenCompra: id };
    });
  }

  // ------------------------------------------------------------------------

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
          `Linea ${indice + 1}: ${e.message}`,
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
    const details: ErrorDetail[] = [];
    const numRequired = (key: string): number => {
      const v = Number(b[key]);
      if (!Number.isFinite(v)) details.push({ field: key, message: "requerido" });
      return v;
    };
    const idProveedor = numRequired("idProveedor");
    const idEmpleadoGerenteFinanciero = numRequired("idEmpleadoGerenteFinanciero");
    const idMoneda = numRequired("idMoneda");
    const tasaCambio = numRequired("tasaCambio");
    const fechaEntregaEsperada = String(b["fechaEntregaEsperada"] ?? "");
    if (fechaEntregaEsperada === "") {
      details.push({ field: "fechaEntregaEsperada", message: "requerido" });
    }
    const lineasRaw = Array.isArray(b["lineas"]) ? b["lineas"] : [];
    if (lineasRaw.length === 0) {
      details.push({ field: "lineas", message: "al menos una linea" });
    }
    if (details.length > 0) {
      throw new ValidationError("Datos de orden de compra invalidos", details);
    }

    const lineas: LineaInput[] = lineasRaw.map((raw, i) => {
      const l = raw as Record<string, unknown>;
      const descripcion = String(l["descripcion"] ?? "");
      const cantidad = Number(l["cantidad"]);
      const idUnidadMedida = Number(l["idUnidadMedida"]);
      if (descripcion === "" || !Number.isFinite(cantidad) || !Number.isInteger(idUnidadMedida)) {
        throw new ValidationError(`Linea ${i + 1} incompleta`, [
          { field: `lineas[${i}]`, message: "descripcion, cantidad e idUnidadMedida son obligatorios" },
        ]);
      }
      const out: LineaInput = { descripcion, cantidad, idUnidadMedida };
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
      idProveedor,
      idEmpleadoGerenteFinanciero,
      idMoneda,
      tasaCambio,
      fechaEntregaEsperada,
      lineas,
    };
    const extra: { numeroReferencia?: string; idSolicitud?: number } = {};
    if (typeof b["numeroReferencia"] === "string") extra.numeroReferencia = b["numeroReferencia"];
    if (b["idSolicitud"] !== undefined) extra.idSolicitud = Number(b["idSolicitud"]);
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
      throw new ValidationError("Estado de orden de compra invalido", [
        { field: "estado", message: "valor no permitido" },
      ]);
    }
    return estado as OrdenCompraEstado;
  }
}

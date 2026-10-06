/**
 * Capa 3 - Logica de Negocio / compras.
 * Caso de uso: registro de cotizaciones de proveedor (multi-moneda) y
 * adjudicacion de lineas. Al adjudicar una linea, se des-adjudican las demas
 * cotizaciones de la misma linea de solicitud (regla de negocio).
 */

import { SoloValidacionExitosa } from "../../../common/errors/SoloValidacion.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../../common/errors/AppError.js";
import {
  normalizePageQuery,
  type FilterCondition,
  type PageQuery,
  type Paginated,
} from "../../../common/types/Query.js";
import { CompraReadRepository } from "../../../dal/repositories/com/CompraReadRepository.js";
import { rfqIdsEnAlcance } from "./alcanceDocumentos.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
import { Validacion } from "../../../common/validation/reglas.js";
import { aDia, formatoDia } from "../../../common/util/fechas.js";
import {
  rfqAceptaCotizaciones,
  validarLineasCotizacion,
  validarTasaCambio,
  validarVencimientoCotizacion,
} from "../../compras/reglasDocumentos.js";
import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import type { CotizacionDetalle } from "../../../entities/com/models.js";
import type { WithDetails } from "../../../dal/contracts/IHeaderDetailRepository.js";
import {
  cotizacionRepository,
  rfqRepository,
  solicitudRepository,
} from "../../../dal/repositories/com/index.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import { ComEvents } from "../../events/domainEvents.js";
import { TransactionalService } from "../../support/TransactionalService.js";

interface CotizacionHeader {
  readonly idCotizacion: number;
  readonly idRfq: number;
  readonly idProveedor: number;
}

interface RfqFila {
  readonly estado: string;
  readonly idSolicitud: number;
  readonly fechaLimite: unknown;
}

type Conn = import("oracledb").Connection;

export class CotizacionService extends TransactionalService {
  private readonly repo = cotizacionRepository();

  private readonly rfqRepo = rfqRepository();

  private readonly solicitudRepo = solicitudRepository();

  private readonly rfqProveedorRepo = repositoryFactory().get<
    { idRfq: number; idProveedor: number },
    object,
    object
  >("rfqProveedor");

  private readonly readRepo = new CompraReadRepository();

  private readonly detalleRepo = repositoryFactory().get<
    CotizacionDetalle,
    object,
    object
  >("cotizacionDetalle");

  public async listar(
    query: PageQuery,
    ctx?: AuditContext,
  ): Promise<Paginated<CotizacionHeader>> {
    const rfqIds = await rfqIdsEnAlcance(ctx, this.readRepo);
    const efectiva: PageQuery =
      rfqIds === null
        ? query
        : {
            ...query,
            filters: [
              ...(query.filters ?? []),
              { prop: "idRfq", operator: "in", value: [...rfqIds] } as FilterCondition,
            ],
          };
    return this.repo.findAll(efectiva) as Promise<Paginated<CotizacionHeader>>;
  }

  public async obtener(
    id: number,
    ctx?: AuditContext,
  ): Promise<WithDetails<CotizacionHeader, CotizacionDetalle>> {
    const found = (await this.repo.findByIdWithDetails(id)) as WithDetails<
      CotizacionHeader,
      CotizacionDetalle
    > | null;
    if (found === null) throw new NotFoundError("COM_COTIZACION_PROVEEDOR", id);
    const rfqIds = await rfqIdsEnAlcance(ctx, this.readRepo);
    if (rfqIds !== null && !rfqIds.includes(found.header.idRfq)) {
      throw new NotFoundError("COM_COTIZACION_PROVEEDOR", id);
    }
    return found;
  }

  public async registrar(
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<CotizacionHeader, CotizacionDetalle>> {
    const b = this.asObject(body);
    const lineasRaw = Array.isArray(b["lineas"]) ? b["lineas"] : [];
    if (lineasRaw.length === 0) {
      throw new ValidationError("La cotización debe incluir al menos una línea");
    }
    const lineasIn = this.normalizarLineas(lineasRaw);

    // Datos de la cabecera: tipos, rangos y vencimiento no pasado.
    const reglas = new Validacion();
    reglas.id("idRfq", "El RFQ", b["idRfq"]);
    reglas.id("idProveedor", "El proveedor", b["idProveedor"]);
    reglas.id("idCondicionPago", "La condición de pago", b["idCondicionPago"]);
    reglas.id("idMoneda", "La moneda", b["idMoneda"]);
    validarTasaCambio(reglas, b["tasaCambio"] === undefined ? 1 : b["tasaCambio"]);
    validarVencimientoCotizacion(reglas, b["fechaVencimiento"]);
    reglas.lanzarSiHay("Cotización inválida");

    const cabecera = validateAgainstDescriptor(
      COM_DESCRIPTORS.cotizacionProveedor,
      {
        idRfq: Number(b["idRfq"]),
        idProveedor: Number(b["idProveedor"]),
        idCondicionPago: Number(b["idCondicionPago"]),
        idMoneda: Number(b["idMoneda"]),
        tasaCambio: b["tasaCambio"] === undefined ? 1 : Number(b["tasaCambio"]),
        fechaVencimiento: String(b["fechaVencimiento"] ?? "").trim(),
      },
      "create",
    );

    return this.runInTransaction(async ({ conn }) => {
      // Mismo cerrojo que actualizar/eliminar: una cotizacion nueva solo
      // entra mientras el RFQ sigue ABIERTO (CERRADO/CANCELADO ya no admite
      // ofertas tardias; hay que reabrir el RFQ primero si hace falta).
      const idRfq = cabecera["idRfq"] as number;
      const idProveedor = cabecera["idProveedor"] as number;
      // Serializa las ofertas de este RFQ: "una cotizacion por proveedor" se verifica y se inserta bajo el mismo bloqueo.
      await this.rfqRepo.lockById(idRfq, conn);
      const rfq = (await this.rfqRepo.findById(idRfq, conn)) as RfqFila | null;
      if (rfq === null) {
        throw new NotFoundError("COM_RFQ_CABECERA", idRfq);
      }
      if (rfq.estado !== "ABIERTO") {
        throw new BusinessRuleError(
          `No se puede registrar la cotización: el RFQ está ${rfq.estado.toLowerCase()}, no ABIERTO.`,
        );
      }
      this.assertPlazoVigente(idRfq, rfq);
      await this.assertProveedorInvitado(idRfq, idProveedor, conn);
      await this.assertSinCotizacionPrevia(idRfq, idProveedor, null, conn);

      const detalles = await this.construirDetalles(rfq, lineasIn, conn);
      if (ctx.soloValidar === true) throw new SoloValidacionExitosa();
      return this.repo.createWithDetails(cabecera, detalles, ctx, conn) as Promise<
        WithDetails<CotizacionHeader, CotizacionDetalle>
      >;
    });
  }

  /**
   * Edita la cabecera de una cotizacion y, si se envian, reemplaza sus lineas.
   * Cerrojo: solo mientras el RFQ sigue ABIERTO y ninguna linea esta adjudicada.
   */
  public async actualizar(
    id: number,
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<CotizacionHeader, CotizacionDetalle>> {
    const b = this.asObject(body);
    return this.runInTransaction(async ({ conn }) => {
      const actual = (await this.repo.findById(id, conn)) as
        | (CotizacionHeader & Record<string, unknown>)
        | null;
      if (actual === null) throw new NotFoundError("COM_COTIZACION_PROVEEDOR", id);
      await this.assertEditable(id, actual.idRfq, conn);
      const rfq = (await this.rfqRepo.findById(actual.idRfq, conn)) as RfqFila | null;
      if (rfq === null) throw new NotFoundError("COM_RFQ_CABECERA", actual.idRfq);
      this.assertPlazoVigente(actual.idRfq, rfq);

      const reglas = new Validacion();
      if (b["tasaCambio"] !== undefined) validarTasaCambio(reglas, b["tasaCambio"]);
      if (b["fechaVencimiento"] !== undefined) validarVencimientoCotizacion(reglas, b["fechaVencimiento"]);
      for (const campo of ["idCondicionPago", "idMoneda"] as const) {
        if (b[campo] !== undefined) {
          reglas.id(campo, campo === "idMoneda" ? "La moneda" : "La condición de pago", b[campo]);
        }
      }
      reglas.lanzarSiHay("Cotización inválida");

      const patch: Record<string, unknown> = {};
      for (const campo of ["idCondicionPago", "idMoneda"] as const) {
        if (b[campo] !== undefined) patch[campo] = Number(b[campo]);
      }
      if (b["tasaCambio"] !== undefined) patch["tasaCambio"] = Number(b["tasaCambio"]);
      if (b["fechaVencimiento"] !== undefined) {
        patch["fechaVencimiento"] = String(b["fechaVencimiento"]).trim();
      }
      if (Object.keys(patch).length > 0) {
        const dto = validateAgainstDescriptor(
          COM_DESCRIPTORS.cotizacionProveedor,
          patch,
          "update",
        );
        await this.repo.update(id, dto, null, ctx, conn);
      }

      if (Array.isArray(b["lineas"]) && b["lineas"].length > 0) {
        const detalles = await this.construirDetalles(rfq, this.normalizarLineas(b["lineas"]), conn);
        await this.repo.replaceDetails(id, detalles, ctx, conn);
      }

      const out = (await this.repo.findByIdWithDetails(id, conn)) as WithDetails<
        CotizacionHeader,
        CotizacionDetalle
      > | null;
      if (out === null) throw new NotFoundError("COM_COTIZACION_PROVEEDOR", id);
      return out;
    });
  }

  /** Borrado logico de la cotizacion (cabecera + lineas). Mismo cerrojo que editar. */
  public async eliminar(id: number, ctx: AuditContext): Promise<{ idCotizacion: number }> {
    return this.runInTransaction(async ({ conn }) => {
      const actual = (await this.repo.findById(id, conn)) as
        | (CotizacionHeader & Record<string, unknown>)
        | null;
      if (actual === null) throw new NotFoundError("COM_COTIZACION_PROVEEDOR", id);
      await this.assertEditable(id, actual.idRfq, conn);
      await this.repo.softDeleteWithDetails(id, ctx, conn);
      return { idCotizacion: id };
    });
  }

  /** Cerrojo comun: RFQ ABIERTO y sin ninguna linea adjudicada. */
  private async assertEditable(
    idCotizacion: number,
    idRfq: number,
    conn: import("oracledb").Connection,
  ): Promise<void> {
    const rfq = (await this.rfqRepo.findById(idRfq, conn)) as
      | { estado: string }
      | null;
    if (rfq !== null && rfq.estado !== "ABIERTO") {
      throw new BusinessRuleError(
        "No se puede modificar: el RFQ ya no está abierto (está " +
          `${rfq.estado.toLowerCase()}).`,
      );
    }
    const fkProp = this.repo.detailForeignKeyProp();
    const adjudicadas = await this.detalleRepo.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 1,
        filters: [
          { prop: fkProp, operator: "eq", value: idCotizacion },
          { prop: "adjudicado", operator: "eq", value: "S" },
        ],
      }),
      conn,
    );
    if (adjudicadas.data.length > 0) {
      throw new BusinessRuleError(
        "No se puede modificar: esta cotización tiene una línea adjudicada.",
      );
    }
  }

  /** Adjudica una linea de cotizacion y des-adjudica sus competidoras. */
  public async adjudicar(
    idCotizacionDetalle: number,
    ctx: AuditContext,
  ): Promise<CotizacionDetalle> {
    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      const linea = await this.detalleRepo.findById(idCotizacionDetalle, conn);
      if (linea === null) {
        throw new NotFoundError("COM_COTIZACION_DETALLE", idCotizacionDetalle);
      }

      const competidoras = await this.detalleRepo.findAll(
        normalizePageQuery({
          page: 1,
          pageSize: 200,
          filters: [
            {
              prop: "idSolicitudDetalle",
              operator: "eq",
              value: linea.idSolicitudDetalle,
            },
            { prop: "adjudicado", operator: "eq", value: "S" },
          ],
        }),
        conn,
      );
      for (const otra of competidoras.data) {
        if (otra.idCotizacionDetalle === idCotizacionDetalle) continue;
        await this.detalleRepo.update(
          otra.idCotizacionDetalle,
          { adjudicado: false },
          otra.version,
          ctx,
          conn,
        );
      }

      const updated = await this.detalleRepo.update(
        idCotizacionDetalle,
        { adjudicado: true },
        linea.version,
        ctx,
        conn,
      );

      enqueueEvent(ComEvents.CotizacionAdjudicada, {
        idCotizacionDetalle,
        idCotizacion: linea.idCotizacion,
        idSolicitudDetalle: linea.idSolicitudDetalle,
        userId: ctx.userId,
      });
      return updated;
    });
  }

  /** Cada linea como objeto; descuento/impuesto por defecto 0. */
  private normalizarLineas(raw: readonly unknown[]): Record<string, unknown>[] {
    return raw.map((l) => {
      const o = l !== null && typeof l === "object" ? (l as Record<string, unknown>) : {};
      return {
        ...o,
        porcentajeDescuento: o["porcentajeDescuento"] ?? 0,
        porcentajeImpuesto: o["porcentajeImpuesto"] ?? 0,
      };
    });
  }

  /** Valida las lineas contra los renglones de la solicitud del RFQ y las deja listas para insertar. */
  private async construirDetalles(
    rfq: RfqFila,
    lineas: readonly Record<string, unknown>[],
    conn: Conn,
  ): Promise<Record<string, unknown>[]> {
    const renglones = (await this.solicitudRepo.listDetails(rfq.idSolicitud, conn)) as readonly {
      idSolicitudDetalle: number;
    }[];
    const reglas = new Validacion();
    validarLineasCotizacion(reglas, lineas, new Set(renglones.map((r) => r.idSolicitudDetalle)));
    reglas.lanzarSiHay("Cotización inválida");

    const fkProp = this.repo.detailForeignKeyProp();
    return lineas.map((l) =>
      validateAgainstDescriptor(
        COM_DESCRIPTORS.cotizacionDetalle,
        {
          idSolicitudDetalle: Number(l["idSolicitudDetalle"]),
          precioUnitario: Number(l["precioUnitario"]),
          cantidad: Number(l["cantidad"]),
          idUnidadMedida: Number(l["idUnidadMedida"]),
          porcentajeDescuento: Number(l["porcentajeDescuento"]),
          porcentajeImpuesto: Number(l["porcentajeImpuesto"]),
          adjudicado: false,
        },
        "create",
        [fkProp],
      ),
    );
  }

  /** Una oferta solo entra mientras el RFQ no haya pasado su fecha limite. */
  private assertPlazoVigente(idRfq: number, rfq: RfqFila): void {
    const limite = aDia(rfq.fechaLimite);
    if (!rfqAceptaCotizaciones(limite)) {
      throw new BusinessRuleError(
        `El plazo del RFQ ${idRfq} venció el ${formatoDia(limite ?? "")}; ya no recibe ofertas. ` +
          "Si necesita aceptarla, amplíe primero la fecha límite del RFQ.",
      );
    }
  }

  /** Solo cotizan los proveedores invitados al RFQ. */
  private async assertProveedorInvitado(idRfq: number, idProveedor: number, conn: Conn): Promise<void> {
    const inv = await this.rfqProveedorRepo.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 1,
        filters: [
          { prop: "idRfq", operator: "eq", value: idRfq },
          { prop: "idProveedor", operator: "eq", value: idProveedor },
        ],
      }),
      conn,
    );
    if (inv.data.length === 0) {
      throw new BusinessRuleError(
        `El proveedor ${idProveedor} no fue invitado al RFQ ${idRfq}; solo cotizan los invitados.`,
      );
    }
  }

  /** Un proveedor tiene una sola cotizacion vigente por RFQ (se corrige editandola). */
  private async assertSinCotizacionPrevia(
    idRfq: number,
    idProveedor: number,
    excepto: number | null,
    conn: Conn,
  ): Promise<void> {
    const previas = await this.repo.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 5,
        filters: [
          { prop: "idRfq", operator: "eq", value: idRfq },
          { prop: "idProveedor", operator: "eq", value: idProveedor },
        ],
      }),
      conn,
    );
    const otra = (previas.data as readonly CotizacionHeader[]).find((c) => c.idCotizacion !== excepto);
    if (otra !== undefined) {
      throw new BusinessRuleError(
        `El proveedor ${idProveedor} ya cotizó este RFQ (cotización ${otra.idCotizacion}). ` +
          "Edite esa cotización en vez de registrar otra.",
      );
    }
  }

  private asObject(body: unknown): Record<string, unknown> {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    return body as Record<string, unknown>;
  }
}

/**
 * Capa 3 - Logica de Negocio / compras.
 * Caso de uso: RFQ (solicitud formal de cotizacion) + invitacion de proveedores.
 * Herencia de TransactionalService; StateMachine para ESTADO; Observer al cerrar.
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
import { solicitudIdsEnAlcance } from "./alcanceDocumentos.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
import { Validacion } from "../../../common/validation/reglas.js";
import { aDia } from "../../../common/util/fechas.js";
import { validarFechaLimiteRfq } from "../../compras/reglasDocumentos.js";
import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import type { RfqEstado, SolicitudCompra } from "../../../entities/com/models.js";
import type { WithDetails } from "../../../dal/contracts/IHeaderDetailRepository.js";
import {
  rfqRepository,
  solicitudRepository,
} from "../../../dal/repositories/com/index.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import { ComEvents } from "../../events/domainEvents.js";
import { rfqStateMachine } from "../../compras/stateMachines.js";
import { TransactionalService } from "../../support/TransactionalService.js";

interface RfqHeader {
  readonly idRfq: number;
  readonly idSolicitud: number;
  readonly estado: RfqEstado;
}

interface RfqProveedor {
  readonly idRfqProveedor: number;
  readonly idRfq: number;
  readonly idProveedor: number;
}

interface ProveedorFila {
  readonly idProveedor: number;
  readonly razonSocial: string;
  readonly estado: string | null;
}

interface LineaFecha {
  readonly fechaRequerida: unknown;
}

export class RfqService extends TransactionalService {
  /** El flujo de compras exige pedir tres cotizaciones a proveedores distintos. */
  public static readonly MIN_PROVEEDORES = 3;

  private readonly repo = rfqRepository();

  private readonly solicitudRepo = solicitudRepository();

  private readonly readRepo = new CompraReadRepository();

  private readonly rfqProveedorRepo = repositoryFactory().get<
    RfqProveedor,
    object,
    object
  >("rfqProveedor");

  private readonly proveedorRepo = repositoryFactory().get<ProveedorFila, object, object>(
    "proveedor",
  );

  /** Ultima fecha en que la solicitud necesita la mercaderia (tope de la fecha limite del RFQ). */
  private async ultimaFechaRequerida(
    idSolicitud: number,
    conn: import("oracledb").Connection,
  ): Promise<string | null> {
    const lineas = (await this.solicitudRepo.listDetails(idSolicitud, conn)) as readonly LineaFecha[];
    let ultima: string | null = null;
    for (const l of lineas) {
      const d = aDia(l.fechaRequerida);
      if (d !== null && (ultima === null || d > ultima)) ultima = d;
    }
    return ultima;
  }

  /** Cada proveedor invitado debe existir y estar activo. */
  private async assertProveedoresActivos(
    ids: readonly number[],
    conn: import("oracledb").Connection,
  ): Promise<void> {
    const problemas: string[] = [];
    for (const id of ids) {
      const prov = await this.proveedorRepo.findById(id, conn);
      if (prov === null) problemas.push(`el proveedor ${id} no existe`);
      else if (prov.estado === "I") problemas.push(`${prov.razonSocial} está inactivo`);
    }
    if (problemas.length > 0) {
      throw new ValidationError(
        `No se puede invitar: ${problemas.join("; ")}.`,
        problemas.map((m) => ({ field: "proveedores", message: m })),
      );
    }
  }

  public async listar(
    query: PageQuery,
    ctx?: AuditContext,
  ): Promise<Paginated<RfqHeader>> {
    const solIds = await solicitudIdsEnAlcance(ctx, this.readRepo);
    const efectiva: PageQuery =
      solIds === null
        ? query
        : {
            ...query,
            filters: [
              ...(query.filters ?? []),
              { prop: "idSolicitud", operator: "in", value: [...solIds] } as FilterCondition,
            ],
          };
    return this.repo.findAll(efectiva) as Promise<Paginated<RfqHeader>>;
  }

  public async obtener(
    id: number,
    ctx?: AuditContext,
  ): Promise<WithDetails<RfqHeader, RfqProveedor>> {
    const found = (await this.repo.findByIdWithDetails(id)) as WithDetails<
      RfqHeader,
      RfqProveedor
    > | null;
    if (found === null) throw new NotFoundError("COM_RFQ_CABECERA", id);
    const solIds = await solicitudIdsEnAlcance(ctx, this.readRepo);
    if (solIds !== null && !solIds.includes(found.header.idSolicitud)) {
      throw new NotFoundError("COM_RFQ_CABECERA", id); // fuera de alcance: no se revela
    }
    return found;
  }

  public async crear(
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<RfqHeader, RfqProveedor>> {
    const b = this.asObject(body);
    const idSolicitud = Number(b["idSolicitud"]);
    const fechaLimite = typeof b["fechaLimite"] === "string" ? b["fechaLimite"].trim() : "";
    const proveedores = [
      ...new Set(
        (Array.isArray(b["proveedores"]) ? (b["proveedores"] as unknown[]) : [])
          .map((p) => Number(p))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ];
    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0 || fechaLimite === "") {
      throw new ValidationError("Datos de RFQ inválidos", [
        { message: "idSolicitud y fechaLimite son obligatorios" },
      ]);
    }
    // El flujo exige solicitar tres cotizaciones a proveedores distintos.
    if (proveedores.length < RfqService.MIN_PROVEEDORES) {
      throw new ValidationError(
        `Debe invitar al menos ${RfqService.MIN_PROVEEDORES} proveedores distintos al RFQ`,
        [{ field: "proveedores", message: `mínimo ${RfqService.MIN_PROVEEDORES}` }],
      );
    }

    return this.runInTransaction(async ({ conn }) => {
      const sol = (await this.solicitudRepo.findById(
        idSolicitud,
        conn,
      )) as SolicitudCompra | null;
      if (sol === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", idSolicitud);
      if (["RECHAZADA", "ORDEN_GENERADA"].includes(sol.estado)) {
        throw new ValidationError(
          `La solicitud ${idSolicitud} (${sol.estado}) no admite RFQ`,
        );
      }
      if (sol.estado !== "EN_COTIZACION") {
        throw new BusinessRuleError(
          `La solicitud ${idSolicitud} aún está en aprobación (${sol.estado}); ` +
            "solo se pide cotización de una solicitud aprobada por jefe y gerente.",
        );
      }
      const reglas = new Validacion();
      validarFechaLimiteRfq(reglas, fechaLimite, await this.ultimaFechaRequerida(idSolicitud, conn));
      reglas.lanzarSiHay("Fecha límite inválida");
      await this.assertProveedoresActivos(proveedores, conn);

      const cabecera = validateAgainstDescriptor(
        COM_DESCRIPTORS.rfqCabecera,
        { idSolicitud, fechaLimite, estado: "ABIERTO" },
        "create",
      );
      const fkProp = this.repo.detailForeignKeyProp();
      const invitados = proveedores.map((idProveedor) =>
        validateAgainstDescriptor(
          COM_DESCRIPTORS.rfqProveedor,
          { idProveedor },
          "create",
          [fkProp],
        ),
      );
      if (ctx.soloValidar === true) throw new SoloValidacionExitosa();
      return this.repo.createWithDetails(cabecera, invitados, ctx, conn) as Promise<
        WithDetails<RfqHeader, RfqProveedor>
      >;
    });
  }

  /** Edita la fecha limite del RFQ. Solo mientras esta `ABIERTO`. */
  public async actualizar(
    id: number,
    body: unknown,
    ctx: AuditContext,
  ): Promise<RfqHeader> {
    const b = this.asObject(body);
    const fechaLimite = typeof b["fechaLimite"] === "string" ? b["fechaLimite"].trim() : "";
    if (fechaLimite === "") {
      throw new ValidationError("fechaLimite es obligatoria", [
        { field: "fechaLimite", message: "obligatorio" },
      ]);
    }
    return this.runInTransaction(async ({ conn }) => {
      const rfq = (await this.repo.findById(id, conn)) as RfqHeader | null;
      if (rfq === null) throw new NotFoundError("COM_RFQ_CABECERA", id);
      if (rfq.estado !== "ABIERTO") {
        throw new ValidationError(
          `El RFQ ${id} está ${rfq.estado}; solo se edita mientras está ABIERTO`,
        );
      }
      const reglas = new Validacion();
      validarFechaLimiteRfq(reglas, fechaLimite, await this.ultimaFechaRequerida(rfq.idSolicitud, conn));
      reglas.lanzarSiHay("Fecha límite inválida");
      const clean = validateAgainstDescriptor(
        COM_DESCRIPTORS.rfqCabecera,
        { fechaLimite },
        "update",
      );
      return this.repo.update(id, clean, null, ctx, conn) as Promise<RfqHeader>;
    });
  }

  public async invitar(
    id: number,
    body: unknown,
    ctx: AuditContext,
  ): Promise<RfqProveedor> {
    const idProveedor = Number(this.asObject(body)["idProveedor"]);
    if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
      throw new ValidationError("idProveedor es obligatorio");
    }
    return this.runInTransaction(async ({ conn }) => {
      const rfq = (await this.repo.findById(id, conn)) as RfqHeader | null;
      if (rfq === null) throw new NotFoundError("COM_RFQ_CABECERA", id);
      if (rfq.estado !== "ABIERTO") {
        throw new ValidationError(`El RFQ ${id} está ${rfq.estado}; no admite invitaciones`);
      }
      await this.assertProveedoresActivos([idProveedor], conn);
      const yaInvitado = await this.rfqProveedorRepo.findAll(
        normalizePageQuery({
          page: 1,
          pageSize: 1,
          filters: [
            { prop: "idRfq", operator: "eq", value: id },
            { prop: "idProveedor", operator: "eq", value: idProveedor },
          ],
        }),
        conn,
      );
      if (yaInvitado.data.length > 0) {
        throw new BusinessRuleError("Ese proveedor ya fue invitado a este RFQ.");
      }
      const dto = validateAgainstDescriptor(
        COM_DESCRIPTORS.rfqProveedor,
        { idRfq: id, idProveedor },
        "create",
      );
      return this.rfqProveedorRepo.create(dto, ctx, conn) as Promise<RfqProveedor>;
    });
  }

  public async cerrar(id: number, ctx: AuditContext): Promise<RfqHeader> {
    return this.cambiarEstado(id, "CERRADO", ctx, true);
  }

  public async cancelar(id: number, ctx: AuditContext): Promise<RfqHeader> {
    return this.cambiarEstado(id, "CANCELADO", ctx, false);
  }

  /**
   * Borrado logico del RFQ (cabecera + proveedores invitados). Cerrojo: solo
   * mientras esta ABIERTO y sin ninguna cotizacion registrada.
   */
  public async eliminar(id: number, ctx: AuditContext): Promise<{ idRfq: number }> {
    return this.runInTransaction(async ({ conn }) => {
      const rfq = (await this.repo.findById(id, conn)) as RfqHeader | null;
      if (rfq === null) throw new NotFoundError("COM_RFQ_CABECERA", id);
      if (rfq.estado !== "ABIERTO") {
        throw new BusinessRuleError(
          `No se puede eliminar: el RFQ está ${rfq.estado.toLowerCase()}.`,
        );
      }
      const cotizaciones = await repositoryFactory()
        .get("cotizacionProveedor")
        .findAll(
          normalizePageQuery({
            page: 1,
            pageSize: 1,
            filters: [{ prop: "idRfq", operator: "eq", value: id }],
          }),
          conn,
        );
      if (cotizaciones.data.length > 0) {
        throw new BusinessRuleError(
          "No se puede eliminar: el RFQ ya tiene cotizaciones registradas.",
        );
      }
      await this.repo.softDeleteWithDetails(id, ctx, conn);
      return { idRfq: id };
    });
  }

  private async cambiarEstado(
    id: number,
    destino: RfqEstado,
    ctx: AuditContext,
    emitir: boolean,
  ): Promise<RfqHeader> {
    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      const rfq = (await this.repo.findById(id, conn)) as RfqHeader | null;
      if (rfq === null) throw new NotFoundError("COM_RFQ_CABECERA", id);
      rfqStateMachine.assertTransition(rfq.estado, destino);
      const updated = (await this.repo.update(
        id,
        { estado: destino },
        null,
        ctx,
        conn,
      )) as RfqHeader;
      if (emitir) {
        enqueueEvent(ComEvents.RfqCerrado, {
          idRfq: id,
          idSolicitud: rfq.idSolicitud,
          userId: ctx.userId,
        });
      }
      return updated;
    });
  }

  private asObject(body: unknown): Record<string, unknown> {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    return body as Record<string, unknown>;
  }
}

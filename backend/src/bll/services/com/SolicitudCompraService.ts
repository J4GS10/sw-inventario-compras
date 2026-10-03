/**
 * Capa 3 - Logica de Negocio / compras.
 *
 * Caso de uso: Solicitud de compra + flujo de aprobacion jerarquico.
 *
 * POO / patrones aplicados aqui:
 *  - Herencia:      extiende TransactionalService (Template Method de la tx).
 *  - Composicion:   usa HeaderDetailRepository + repo de workflow (no hereda de ellos).
 *  - Encapsulacion: las reglas de transicion viven en solicitudStateMachine.
 *  - Observer:      publica ComEvents.SolicitudAprobada / SolicitudRechazada.
 *  - Bloqueo optimista: toda mutacion de cabecera viaja con `version`.
 */

import type { Connection } from "oracledb";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../../common/errors/AppError.js";
import type {
  FilterCondition,
  PageQuery,
  Paginated,
} from "../../../common/types/Query.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
import { ForbiddenError } from "../../../common/errors/AppError.js";
import { Permisos, hasPermiso } from "../../../common/auth/permissions.js";
import { CompraReadRepository } from "../../../dal/repositories/com/CompraReadRepository.js";
import { empleadosEnAlcance } from "./alcance.js";
import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import type {
  SolicitudCompra,
  SolicitudDetalle,
  SolicitudEstado,
} from "../../../entities/com/models.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import { solicitudRepository } from "../../../dal/repositories/com/index.js";
import type { WithDetails } from "../../../dal/contracts/IHeaderDetailRepository.js";
import { ComEvents } from "../../events/domainEvents.js";
import {
  SOLICITUD_NIVEL,
  solicitudStateMachine,
} from "../../compras/stateMachines.js";
import { TransactionalService } from "../../support/TransactionalService.js";

export interface CrearSolicitudInput {
  readonly cabecera: Record<string, unknown>;
  readonly detalles: readonly Record<string, unknown>[];
}

export interface AjusteRenglon {
  readonly idSolicitudDetalle: number;
  readonly cantidadAutorizada: number;
}

export interface DecisionInput {
  readonly idEmpleado: number;
  readonly comentario?: string;
  /** Ajuste de cantidades autorizadas (paso "jefe modifica cantidades"). */
  readonly ajustes?: readonly AjusteRenglon[];
}

export class SolicitudCompraService extends TransactionalService {
  private readonly repo = solicitudRepository();

  private readonly detalleRepo = repositoryFactory().get<
    SolicitudDetalle,
    object,
    object
  >("solicitudDetalle");

  private readonly workflowRepo = repositoryFactory().get(
    "workflowAprobacion",
  );

  private readonly readRepo = new CompraReadRepository();

  public async listar(
    query: PageQuery,
    ctx?: AuditContext,
  ): Promise<Paginated<SolicitudCompra>> {
    const visibles = await this.empleadosVisibles(ctx);
    const efectiva =
      visibles === null
        ? query
        : { ...query, filters: this.conAlcance(query.filters, visibles) };
    return this.repo.findAll(efectiva) as Promise<Paginated<SolicitudCompra>>;
  }

  public async obtener(
    id: number,
    ctx?: AuditContext,
  ): Promise<WithDetails<SolicitudCompra, SolicitudDetalle>> {
    const found = (await this.repo.findByIdWithDetails(id)) as WithDetails<
      SolicitudCompra,
      SolicitudDetalle
    > | null;
    if (found === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", id);

    const visibles = await this.empleadosVisibles(ctx);
    if (
      visibles !== null &&
      !visibles.includes(found.header.idEmpleadoSolicitante)
    ) {
      // Fuera del alcance del usuario: no se revela que existe.
      throw new NotFoundError("COM_SOLICITUD_COMPRA", id);
    }
    return found;
  }

  private empleadosVisibles(ctx?: AuditContext): Promise<readonly number[] | null> {
    return empleadosEnAlcance(ctx, this.readRepo);
  }

  private conAlcance(
    filtros: readonly FilterCondition[] | undefined,
    empleados: readonly number[],
  ): readonly FilterCondition[] {
    return [
      ...(filtros ?? []),
      { prop: "idEmpleadoSolicitante", operator: "in", value: [...empleados] },
    ];
  }

  public async crear(
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<SolicitudCompra, SolicitudDetalle>> {
    const input = this.parseCrear(body);
    const cabecera = validateAgainstDescriptor(
      COM_DESCRIPTORS.solicitudCompra,
      { ...input.cabecera, estado: "PENDIENTE_JEFE" },
      "create",
    );
    if (input.detalles.length === 0) {
      throw new ValidationError("La solicitud debe incluir al menos una linea");
    }
    const fkProp = this.repo.detailForeignKeyProp();
    const detalles = input.detalles.map((d) =>
      validateAgainstDescriptor(
        COM_DESCRIPTORS.solicitudDetalle,
        d,
        "create",
        [fkProp],
      ),
    );

    return this.runInTransaction(async ({ conn }) => {
      const created = (await this.repo.createWithDetails(
        cabecera,
        detalles,
        ctx,
        conn,
      )) as WithDetails<SolicitudCompra, SolicitudDetalle>;
      await this.registrarWorkflow(
        created.header.idSolicitud,
        null,
        "PENDIENTE_JEFE",
        SOLICITUD_NIVEL.PENDIENTE_JEFE,
        created.header.idEmpleadoSolicitante,
        "Solicitud creada",
        conn,
      );
      return created;
    });
  }

  /**
   * Edita la CABECERA de una solicitud. Solo mientras esta en `PENDIENTE_JEFE`
   * (antes de que nadie la apruebe) y solo el solicitante/creador o quien tenga
   * alcance sobre ella. Bloqueo optimista por `version`.
   */
  public async actualizar(
    id: number,
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<SolicitudCompra, SolicitudDetalle>> {
    const raw = (body ?? {}) as Record<string, unknown>;
    const cabeceraIn = (
      typeof raw["cabecera"] === "object" && raw["cabecera"] !== null
        ? raw["cabecera"]
        : raw
    ) as Record<string, unknown>;
    const { estado: _estado, version: versionRaw, detalles: _detalles, ...campos } =
      cabeceraIn;
    const expectedVersion =
      versionRaw === undefined || versionRaw === null ? null : Number(versionRaw);

    const visibles = await this.empleadosVisibles(ctx);

    return this.runInTransaction(async ({ conn }) => {
      const actual = (await this.repo.findById(id, conn)) as SolicitudCompra | null;
      if (actual === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", id);
      if (
        visibles !== null &&
        !visibles.includes(actual.idEmpleadoSolicitante)
      ) {
        throw new ForbiddenError(
          "Esta solicitud pertenece a otro departamento o equipo",
        );
      }
      if (actual.estado !== "PENDIENTE_JEFE") {
        throw new BusinessRuleError(
          `La solicitud (${actual.estado}) ya no se puede editar; solo mientras esta pendiente del jefe`,
        );
      }
      if (
        COM_DESCRIPTORS.solicitudCompra.version !== undefined &&
        expectedVersion === null
      ) {
        throw new ValidationError(
          'Falta el campo "version" para editar (bloqueo optimista)',
          [{ field: "version", message: "obligatorio" }],
        );
      }
      const clean = validateAgainstDescriptor(
        COM_DESCRIPTORS.solicitudCompra,
        campos,
        "update",
      );
      await this.repo.update(id, clean, expectedVersion, ctx, conn);
      return (await this.repo.findByIdWithDetails(id, conn)) as WithDetails<
        SolicitudCompra,
        SolicitudDetalle
      >;
    });
  }

  /**
   * Borrado logico de la solicitud (cabecera + lineas). Cerrojo: solo mientras
   * esta PENDIENTE_JEFE y dentro del alcance del usuario.
   */
  public async eliminar(id: number, ctx: AuditContext): Promise<{ idSolicitud: number }> {
    const visibles = await this.empleadosVisibles(ctx);
    return this.runInTransaction(async ({ conn }) => {
      const actual = (await this.repo.findById(id, conn)) as SolicitudCompra | null;
      if (actual === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", id);
      if (visibles !== null && !visibles.includes(actual.idEmpleadoSolicitante)) {
        throw new ForbiddenError(
          "Esta solicitud pertenece a otro departamento o equipo",
        );
      }
      if (actual.estado !== "PENDIENTE_JEFE") {
        throw new BusinessRuleError(
          `La solicitud (${actual.estado}) ya no se puede eliminar; solo mientras esta pendiente del jefe`,
        );
      }
      await this.repo.softDeleteWithDetails(id, ctx, conn);
      return { idSolicitud: id };
    });
  }

  /** Avanza la solicitud un nivel en el flujo de aprobacion. */
  public async aprobar(
    id: number,
    body: unknown,
    ctx: AuditContext,
  ): Promise<SolicitudCompra> {
    const decision = this.parseDecision(body);
    return this.transicionar(id, decision, ctx, (estado) => {
      const siguientes = solicitudStateMachine
        .nextStates(estado)
        .filter((e) => e !== "RECHAZADA");
      const next = siguientes[0];
      if (next === undefined) {
        throw new BusinessRuleError(
          `La solicitud en estado ${estado} no admite mas aprobaciones`,
        );
      }
      return next;
    });
  }

  public async rechazar(
    id: number,
    body: unknown,
    ctx: AuditContext,
  ): Promise<SolicitudCompra> {
    const decision = this.parseDecision(body);
    return this.transicionar(id, decision, ctx, () => "RECHAZADA");
  }

  // ------------------------------------------------------------------------

  private async transicionar(
    id: number,
    decision: DecisionInput,
    ctx: AuditContext,
    elegirDestino: (actual: SolicitudEstado) => SolicitudEstado,
  ): Promise<SolicitudCompra> {
    // Alcance por departamento/equipo: un jefe solo decide sobre solicitudes de
    // su gente; un gerente, solo las de su area. Se calcula fuera de la tx.
    const visibles = await this.empleadosVisibles(ctx);

    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      const actual = (await this.repo.findById(id, conn)) as SolicitudCompra | null;
      if (actual === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", id);

      this.autorizarDecision(ctx, actual.estado);
      if (
        visibles !== null &&
        !visibles.includes(actual.idEmpleadoSolicitante)
      ) {
        throw new ForbiddenError(
          "Esta solicitud pertenece a otro departamento o equipo; no puedes decidir sobre ella",
        );
      }

      const destino = elegirDestino(actual.estado);
      solicitudStateMachine.assertTransition(actual.estado, destino);

      // Paso "jefe/gerente modifica cantidades": ajusta CANTIDAD_AUTORIZADA.
      if (decision.ajustes !== undefined && decision.ajustes.length > 0 && destino !== "RECHAZADA") {
        await this.aplicarAjustes(id, decision.ajustes, ctx, conn);
      }

      const updated = (await this.repo.update(
        id,
        { estado: destino },
        actual.version,
        ctx,
        conn,
      )) as SolicitudCompra;

      await this.registrarWorkflow(
        id,
        actual.estado,
        destino,
        SOLICITUD_NIVEL[destino],
        decision.idEmpleado,
        decision.comentario ?? null,
        conn,
      );

      enqueueEvent(
        destino === "RECHAZADA"
          ? ComEvents.SolicitudRechazada
          : ComEvents.SolicitudAprobada,
        {
          idSolicitud: id,
          estadoAnterior: actual.estado,
          estadoNuevo: destino,
          nivelJerarquico: SOLICITUD_NIVEL[destino],
          idEmpleado: decision.idEmpleado,
          userId: ctx.userId,
        },
      );
      return updated;
    });
  }

  /** Autorizacion por estado: jefe en PENDIENTE_JEFE, gerente en PENDIENTE_GERENTE. */
  private autorizarDecision(ctx: AuditContext, estado: SolicitudEstado): void {
    if (estado === "PENDIENTE_JEFE") {
      if (!hasPermiso(ctx.permisos, Permisos.SOLICITUD_APROBAR_JEFE)) {
        throw new ForbiddenError(
          "Esta solicitud requiere aprobacion del jefe inmediato (COMPRAS_SOLICITUD_APROBAR_JEFE)",
        );
      }
      return;
    }
    if (estado === "PENDIENTE_GERENTE") {
      if (!hasPermiso(ctx.permisos, Permisos.SOLICITUD_APROBAR_GERENTE)) {
        throw new ForbiddenError(
          "Esta solicitud requiere aprobacion del gerente de area (COMPRAS_SOLICITUD_APROBAR_GERENTE)",
        );
      }
      return;
    }
    throw new BusinessRuleError(
      `La solicitud en estado ${estado} no admite decisiones de aprobacion`,
    );
  }

  private async aplicarAjustes(
    idSolicitud: number,
    ajustes: readonly AjusteRenglon[],
    ctx: AuditContext,
    conn: Connection,
  ): Promise<void> {
    const lineas = (await this.repo.listDetails(idSolicitud, conn)) as readonly SolicitudDetalle[];
    const validas = new Set(lineas.map((l) => l.idSolicitudDetalle));
    for (const aj of ajustes) {
      if (!validas.has(aj.idSolicitudDetalle)) {
        throw new ValidationError(
          `El renglon ${aj.idSolicitudDetalle} no pertenece a la solicitud ${idSolicitud}`,
        );
      }
      if (!(aj.cantidadAutorizada >= 0)) {
        throw new ValidationError("cantidadAutorizada debe ser >= 0");
      }
      await this.detalleRepo.update(
        aj.idSolicitudDetalle,
        { cantidadAutorizada: aj.cantidadAutorizada },
        null,
        ctx,
        conn,
      );
    }
  }

  private async registrarWorkflow(
    idSolicitud: number,
    estadoAnterior: string | null,
    estadoNuevo: string,
    nivel: number,
    idEmpleado: number,
    comentario: string | null,
    conn: Connection,
  ): Promise<void> {
    await this.workflowRepo.create(
      {
        idSolicitud,
        nivelJerarquico: nivel,
        idEmpleadoRealiza: idEmpleado,
        estadoAnterior,
        estadoNuevo,
        comentario,
      },
      { userId: 0, permisos: ["*"] },
      conn,
    );
  }

  private parseCrear(body: unknown): CrearSolicitudInput {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    const b = body as Record<string, unknown>;
    const detalles = Array.isArray(b["detalles"])
      ? (b["detalles"] as Record<string, unknown>[])
      : [];
    const cabecera =
      b["cabecera"] !== undefined && typeof b["cabecera"] === "object"
        ? (b["cabecera"] as Record<string, unknown>)
        : b;
    return { cabecera, detalles };
  }

  private parseDecision(body: unknown): DecisionInput {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    const b = body as Record<string, unknown>;
    const idEmpleado = Number(b["idEmpleado"]);
    if (!Number.isInteger(idEmpleado) || idEmpleado <= 0) {
      throw new ValidationError("idEmpleado es obligatorio", [
        { field: "idEmpleado", message: "entero positivo" },
      ]);
    }
    const extra: { comentario?: string; ajustes?: AjusteRenglon[] } = {};
    if (typeof b["comentario"] === "string") extra.comentario = b["comentario"];
    if (Array.isArray(b["ajustes"])) {
      extra.ajustes = (b["ajustes"] as Record<string, unknown>[]).map((a) => ({
        idSolicitudDetalle: Number(a["idSolicitudDetalle"]),
        cantidadAutorizada: Number(a["cantidadAutorizada"]),
      }));
    }
    return { idEmpleado, ...extra };
  }
}

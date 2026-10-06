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

import { delegacionService } from "./DelegacionService.js";
import { SoloValidacionExitosa } from "../../../common/errors/SoloValidacion.js";
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
import { Validacion } from "../../../common/validation/reglas.js";
import {
  validarCabeceraSolicitud,
  validarLineasSolicitud,
} from "../../compras/reglasDocumentos.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
import { ForbiddenError } from "../../../common/errors/AppError.js";
import { Permisos, hasPermiso } from "../../../common/auth/permissions.js";
import { CompraReadRepository, type HitoTrazabilidad } from "../../../dal/repositories/com/CompraReadRepository.js";
import { empleadosEnAlcance } from "./alcance.js";
import { SolicitudPdfService } from "./SolicitudPdfService.js";
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

  /**
   * Recorrido completo de la solicitud. Respeta la segregacion de funciones: cada rol ve SOLO los
   * hitos de los documentos que su trabajo toca (un solicitante ve su solicitud y sus aprobaciones,
   * no a que proveedor se le compro).
   */
  /** PDF de la solicitud (respeta el alcance y que decisiones puede ver quien lo pide). */
  public async pdf(id: number, ctx: AuditContext): Promise<{ buffer: Buffer; filename: string }> {
    const hitos = await this.trazabilidad(id, ctx); // 404 si no existe / fuera de alcance
    return new SolicitudPdfService().generar(id, hitos);
  }

  public async trazabilidad(id: number, ctx: AuditContext): Promise<readonly HitoTrazabilidad[]> {
    await this.obtener(id, ctx); // 404 si no existe o esta fuera de su alcance
    const todos = await this.readRepo.trazabilidadSolicitud(id);
    const ve = (...permisos: string[]): boolean => hasPermiso(ctx.permisos, "*") || permisos.some((p) => hasPermiso(ctx.permisos, p));
    return todos.filter((h) => {
      switch (h.tipo) {
        case "SOLICITUD":
        case "APROBACION":
          return true;
        case "RFQ":
          return ve(Permisos.RFQ_GESTIONAR);
        case "COTIZACION":
          return ve(Permisos.COTIZACION_GESTIONAR, Permisos.COTIZACION_ADJUDICAR);
        case "ORDEN":
          return ve(Permisos.OC_GESTIONAR);
        case "RECEPCION":
          return ve(Permisos.RECEPCION_GESTIONAR);
        case "DEVOLUCION":
          return ve(Permisos.DEVOLUCION_GESTIONAR);
        case "FACTURA":
        case "PAGO":
          return ve(Permisos.CATALOGO_ADMIN);
        default:
          return false;
      }
    });
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
    // La autoria no se delega por el cuerpo: quien tiene un empleado en sesion crea
    // la solicitud A SU NOMBRE (el admin del sistema, sin empleado, puede indicarlo).
    const solicitante = input.cabecera["idEmpleadoSolicitante"];
    if (ctx.empleadoId !== undefined && ctx.empleadoId > 0 && !hasPermiso(ctx.permisos, "*") && solicitante !== undefined && Number(solicitante) !== ctx.empleadoId) {
      throw new ForbiddenError("Solo puedes crear solicitudes a tu propio nombre");
    }
    // Reglas de negocio ANTES del descriptor: reportan todos los problemas de
    // una vez (fechas vencidas, cantidades <= 0, textos vacios) con mensajes de
    // negocio, en vez del primer "es obligatorio" generico.
    const reglas = new Validacion();
    validarCabeceraSolicitud(reglas, input.cabecera);
    validarLineasSolicitud(reglas, input.detalles);
    reglas.lanzarSiHay("Solicitud inválida");
    const cabecera = validateAgainstDescriptor(
      COM_DESCRIPTORS.solicitudCompra,
      { ...input.cabecera, estado: "PENDIENTE_JEFE" },
      "create",
    );
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
      if (ctx.soloValidar === true) throw new SoloValidacionExitosa();
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
          `La solicitud (${actual.estado}) ya no se puede editar; solo mientras está pendiente del jefe`,
        );
      }
      if (
        COM_DESCRIPTORS.solicitudCompra.version !== undefined &&
        expectedVersion === null
      ) {
        throw new ValidationError(
          'Falta el campo "versión" para editar (bloqueo optimista)',
          [{ field: "version", message: "obligatorio" }],
        );
      }
      const reglas = new Validacion();
      validarCabeceraSolicitud(reglas, campos, true);
      reglas.lanzarSiHay("Solicitud inválida");
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
          `La solicitud (${actual.estado}) ya no se puede eliminar; solo mientras está pendiente del jefe`,
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
          `La solicitud en estado ${estado} no admite más aprobaciones`,
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
    // Rechazar sin decir por que deja al solicitante sin saber que corregir.
    const motivo = (decision.comentario ?? "").trim();
    if (motivo.length < 3) {
      throw new ValidationError("Indica el motivo del rechazo (mínimo 3 caracteres)", [
        { field: "comentario", message: "El motivo del rechazo es obligatorio" },
      ]);
    }
    return this.transicionar(id, { ...decision, comentario: motivo }, ctx, () => "RECHAZADA");
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
      // Una sola decision a la vez por solicitud: la segunda ve el estado ya cambiado (409 limpio), no un conflicto de version.
      await this.repo.lockById(id, conn);
      const actual = (await this.repo.findById(id, conn)) as SolicitudCompra | null;
      if (actual === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", id);

      const porDelegacionDe = await this.autorizarDecision(ctx, actual.estado);
      if (porDelegacionDe !== null && ctx.empleadoId === actual.idEmpleadoSolicitante) {
        throw new ForbiddenError("Con una delegación no puedes decidir sobre tu propia solicitud");
      }
      // La decision se registra a nombre de QUIEN la toma: no se acepta un
      // idEmpleado ajeno al de la sesion (suplantacion en el historial).
      if (ctx.empleadoId !== undefined && ctx.empleadoId > 0 && decision.idEmpleado !== ctx.empleadoId) {
        throw new ForbiddenError("Solo puedes decidir a tu propio nombre");
      }
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

      const nota = porDelegacionDe === null ? null : `[por delegación de ${porDelegacionDe}]`;
      const comentario = nota === null ? (decision.comentario ?? null) : `${decision.comentario ?? ""} ${nota}`.trim();
      await this.registrarWorkflow(
        id,
        actual.estado,
        destino,
        SOLICITUD_NIVEL[destino],
        decision.idEmpleado,
        comentario,
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
          idEmpleadoSolicitante: actual.idEmpleadoSolicitante,
          comentario,
        },
      );
      return updated;
    });
  }

  /** Autorizacion por estado: jefe en PENDIENTE_JEFE, gerente en PENDIENTE_GERENTE. */
  private async autorizarDecision(ctx: AuditContext, estado: SolicitudEstado): Promise<string | null> {
    let requerido: string;
    let mensaje: string;
    if (estado === "PENDIENTE_JEFE") {
      requerido = Permisos.SOLICITUD_APROBAR_JEFE;
      mensaje = "Esta solicitud requiere aprobación del jefe inmediato (COMPRAS_SOLICITUD_APROBAR_JEFE)";
    } else if (estado === "PENDIENTE_GERENTE") {
      requerido = Permisos.SOLICITUD_APROBAR_GERENTE;
      mensaje = "Esta solicitud requiere aprobación del gerente de área (COMPRAS_SOLICITUD_APROBAR_GERENTE)";
    } else {
      throw new BusinessRuleError(`La solicitud en estado ${estado} no admite decisiones de aprobación`);
    }
    if (hasPermiso(ctx.permisos, requerido)) return null;
    // Sin permiso propio: vale si alguien con ese permiso le delego HOY (se verifica en la base: revocar es inmediato).
    const delegante = (await delegacionService.efectivas(ctx.empleadoId)).find((d) => hasPermiso(d.permisos, requerido));
    if (delegante === undefined) throw new ForbiddenError(mensaje);
    return delegante.nombreDelegante;
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
          `El renglón ${aj.idSolicitudDetalle} no pertenece a la solicitud ${idSolicitud}`,
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

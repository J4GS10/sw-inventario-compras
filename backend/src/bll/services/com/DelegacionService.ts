/**
 * Capa 3 - Logica de Negocio / aprobaciones.
 * Delegacion temporal de aprobaciones (ausencias, vacaciones): un jefe o gerente cede a otro empleado,
 * por un rango de fechas, su capacidad de aprobar/rechazar solicitudes de su equipo.
 *
 * Reglas:
 *  - Solo delega quien PUEDE aprobar (permiso de jefe o de gerente); nadie se delega a si mismo.
 *  - Hasta 60 dias, desde hoy en adelante; sin traslape con otra delegacion activa del mismo par.
 *  - El delegado actua con los permisos y el ALCANCE del delegante SOLO mientras la delegacion esta
 *    vigente (se verifica en la base en cada decision: revocar surte efecto al instante).
 *  - La decision queda registrada a nombre de quien la toma (el delegado), con la nota "por
 *    delegacion de ...": el historial nunca atribuye una decision a quien no la tomo.
 */

import type { AuditContext } from "../../../common/types/AuditContext.js";
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from "../../../common/errors/AppError.js";
import { hasPermiso, Permisos } from "../../../common/auth/permissions.js";
import { hoy, sumarDias } from "../../../common/util/fechas.js";
import { Validacion } from "../../../common/validation/reglas.js";
import { segAuthRepository } from "../../../dal/repositories/seg/SegAuthRepository.js";
import {
  delegacionRepository,
  type DelegacionRepository,
  type DelegacionRow,
} from "../../../dal/repositories/seg/DelegacionRepository.js";

export const MAX_DIAS_DELEGACION = 60;
const PERMISOS_APROBACION: readonly string[] = [Permisos.SOLICITUD_APROBAR_JEFE, Permisos.SOLICITUD_APROBAR_GERENTE];

export interface DelegacionEfectiva {
  readonly idDelegacion: number;
  readonly idEmpleadoDelegante: number;
  readonly nombreDelegante: string;
  readonly roles: readonly string[];
  /** Permisos efectivos del delegante (ya con la regla de administrador). */
  readonly permisos: readonly string[];
}

export class DelegacionService {
  constructor(private readonly repo: DelegacionRepository = delegacionRepository) {}

  public puedeAprobar(permisos: readonly string[]): boolean {
    return hasPermiso(permisos, "*") || PERMISOS_APROBACION.some((p) => permisos.includes(p));
  }

  public async listar(ctx: AuditContext): Promise<{ otorgadas: readonly DelegacionRow[]; recibidas: readonly DelegacionRow[] }> {
    const e = ctx.empleadoId ?? 0;
    if (e <= 0) return { otorgadas: [], recibidas: [] };
    const todas = await this.repo.listarDe(e);
    return {
      otorgadas: todas.filter((d) => d.idEmpleadoDelegante === e),
      recibidas: todas.filter((d) => d.idEmpleadoDelegado === e),
    };
  }

  public async crear(body: unknown, ctx: AuditContext): Promise<DelegacionRow> {
    const delegante = ctx.empleadoId ?? 0;
    if (delegante <= 0) throw new ForbiddenError("Tu usuario no tiene un empleado asociado");
    if (!this.puedeAprobar(ctx.permisos)) {
      throw new ForbiddenError("Solo quien puede aprobar solicitudes puede delegar sus aprobaciones");
    }
    const b = (body ?? {}) as Record<string, unknown>;
    const v = new Validacion();
    const delegado = Number(b["idEmpleadoDelegado"]);
    if (!Number.isInteger(delegado) || delegado <= 0) v.id("idEmpleadoDelegado", "El empleado delegado", b["idEmpleadoDelegado"]);
    const desde = v.dia("desde", "La fecha de inicio", b["desde"]);
    const hasta = v.dia("hasta", "La fecha de fin", b["hasta"]);
    const hoyDia = hoy();
    v.noAnteriorA("desde", "La fecha de inicio", desde, hoyDia, "hoy");
    v.noAnteriorA("hasta", "La fecha de fin", hasta, desde, "la fecha de inicio");
    if (desde !== null && hasta !== null && hasta > sumarDias(desde, MAX_DIAS_DELEGACION - 1)) {
      v.error("hasta", `Una delegación dura como máximo ${MAX_DIAS_DELEGACION} días`);
    }
    const motivo = typeof b["motivo"] === "string" ? b["motivo"].trim() : "";
    if (motivo.length > 200) v.error("motivo", "El motivo admite hasta 200 caracteres");
    v.lanzarSiHay("Delegación inválida");
    if (delegado === delegante) throw new ValidationError("No puedes delegarte a ti mismo", [{ field: "idEmpleadoDelegado", message: "Elige a otra persona" }]);

    if (await this.repo.haySolape(delegante, delegado, desde as string, hasta as string)) {
      throw new BusinessRuleError("Ya delegaste tus aprobaciones a esa persona en esas fechas; revoca la anterior o cambia el rango");
    }
    const id = await this.repo.crear({ delegante, delegado, desde: desde as string, hasta: hasta as string, motivo: motivo === "" ? null : motivo });
    const creada = await this.repo.obtener(id);
    if (creada === null) throw new NotFoundError("SEG_DELEGACION_APROBACION", id);
    return creada;
  }

  public async revocar(id: number, ctx: AuditContext): Promise<void> {
    const d = await this.repo.obtener(id);
    if (d === null) throw new NotFoundError("SEG_DELEGACION_APROBACION", id);
    const e = ctx.empleadoId ?? 0;
    if (d.idEmpleadoDelegante !== e && !hasPermiso(ctx.permisos, "*")) {
      throw new ForbiddenError("Solo quien delegó puede revocar la delegación");
    }
    await this.repo.revocar(id);
  }

  /** Delegaciones vigentes hoy a favor del empleado, con los roles y permisos de cada delegante. */
  public async efectivas(idEmpleado: number | undefined): Promise<readonly DelegacionEfectiva[]> {
    if (idEmpleado === undefined || idEmpleado <= 0) return [];
    const vigentes = await this.repo.vigentesPara(idEmpleado);
    const out: DelegacionEfectiva[] = [];
    for (const d of vigentes) {
      const acc = await segAuthRepository.loadAccesos(d.idUsuarioDelegante);
      const esAdmin = hasPermiso(acc.permisos, "*") || acc.roles.includes("ADMIN_COMPRAS");
      out.push({
        idDelegacion: d.idDelegacion,
        idEmpleadoDelegante: d.idEmpleadoDelegante,
        nombreDelegante: d.nombreDelegante,
        roles: acc.roles,
        permisos: esAdmin ? ["*"] : acc.permisos,
      });
    }
    return out;
  }

  /** Solo los permisos de APROBACION que el empleado tiene hoy por delegacion (para la interfaz). */
  public async permisosDeAprobacionDelegados(idEmpleado: number | undefined): Promise<readonly string[]> {
    const ef = await this.efectivas(idEmpleado);
    const out = new Set<string>();
    for (const d of ef) {
      for (const p of PERMISOS_APROBACION) if (hasPermiso(d.permisos, p)) out.add(p);
    }
    return [...out];
  }
}

export const delegacionService = new DelegacionService();

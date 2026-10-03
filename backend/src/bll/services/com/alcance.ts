/**
 * Capa 3 - Logica de Negocio / compras.
 * Alcance de visibilidad y de accion por rol/departamento (Fase 6.2 + 6.6).
 * Fuente unica: lo usan `SolicitudCompraService` (listar/obtener/aprobar) y
 * `NotificacionService`.
 *
 *   null            -> sin restriccion (ve/actua sobre TODO)
 *   number[]        -> solo empleados de esa lista (equipo o departamento)
 */

import { hasPermiso } from "../../../common/auth/permissions.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import type { CompraReadRepository } from "../../../dal/repositories/com/CompraReadRepository.js";

/** Roles que operan sobre TODO el modulo (no se acotan por departamento). */
export const ROLES_SIN_ALCANCE = [
  "ADMIN_COMPRAS",
  "COMPRADOR",
  "GERENTE_FINANCIERO",
  "AUDITOR",
] as const;

/**
 * Lista de ID_EMPLEADO cuyas solicitudes puede ver/gestionar el usuario, o
 * `null` si puede con todas.
 *  - GERENTE_AREA   -> empleados de su departamento
 *  - JEFE_INMEDIATO -> sus reportes directos + el mismo
 *  - SOLICITANTE    -> solo el mismo
 */
export async function empleadosEnAlcance(
  ctx: AuditContext | undefined,
  read: CompraReadRepository,
): Promise<readonly number[] | null> {
  if (ctx === undefined || hasPermiso(ctx.permisos, "*")) return null;
  const roles = ctx.roles ?? [];
  if (roles.some((r) => (ROLES_SIN_ALCANCE as readonly string[]).includes(r))) {
    return null;
  }
  const empleadoId = ctx.empleadoId;
  if (empleadoId === undefined || empleadoId <= 0) return null;

  if (roles.includes("GERENTE_AREA")) {
    const dep = await read.departamentoDeEmpleado(empleadoId);
    if (dep === null) return [empleadoId];
    const equipo = await read.empleadosDeDepartamento(dep);
    return equipo.length > 0 ? equipo : [empleadoId];
  }
  if (roles.includes("JEFE_INMEDIATO")) {
    const reportes = await read.empleadosBajoJefe(empleadoId);
    return [...new Set([empleadoId, ...reportes])];
  }
  if (roles.includes("SOLICITANTE")) return [empleadoId];
  return null;
}

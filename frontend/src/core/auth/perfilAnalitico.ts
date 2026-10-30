/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Perfil analitico de la sesion: que le interesa ver a cada rol en el Dashboard
 * y en Reportes. Se deriva de los permisos de GESTION (no del nombre del rol)
 * salvo Auditor, que no gestiona nada y solo se distingue por su rol.
 *
 * Es RELEVANCIA, no seguridad: el backend autoriza cada reporte con su propio
 * permiso (COMPRAS_REPORTE_*); aqui solo se decide que pestanas se ofrecen, en
 * que orden y con que enfoque por defecto.
 */

import { Permisos, grants } from "./permisos.js";
import type { PrioridadEvaluacion } from "../CompraServices.js";

export type PerfilAnalitico = "total" | "comprador" | "financiero" | "auditor" | "gerencia" | "bodega" | "solicitante";

export type ReporteId =
  | "evaluacion"
  | "gasto"
  | "pendientes"
  | "desempeno"
  | "riesgo"
  | "inventario"
  | "disponibilidad"
  | "area"
  | "auditoria";

export function perfilAnalitico(permisos: readonly string[], roles: readonly string[]): PerfilAnalitico {
  if (permisos.includes("*")) return "total";
  if (roles.includes("AUDITOR")) return "auditor";
  if (grants(permisos, Permisos.COTIZACION_ADJUDICAR)) return "financiero";
  if (grants(permisos, Permisos.RFQ_GESTIONAR)) return "comprador";
  if (
    grants(permisos, Permisos.SOLICITUD_APROBAR_GERENTE) ||
    grants(permisos, Permisos.SOLICITUD_APROBAR_JEFE)
  ) {
    return "gerencia";
  }
  if (grants(permisos, Permisos.RECEPCION_GESTIONAR)) return "bodega";
  return "solicitante";
}

/** Permiso (espejo del backend) que da acceso a cada reporte. */
export const PERMISO_DE_REPORTE: Record<ReporteId, string> = {
  evaluacion: Permisos.REPORTE_EVALUACION,
  gasto: Permisos.REPORTE_GASTO,
  pendientes: Permisos.REPORTE_ENTREGAS,
  desempeno: Permisos.REPORTE_DESEMPENO,
  riesgo: Permisos.REPORTE_RIESGO,
  inventario: Permisos.REPORTE_INVENTARIO,
  disponibilidad: Permisos.REPORTE_DISPONIBILIDAD,
  area: Permisos.REPORTE_GASTO_AREA,
  auditoria: Permisos.REPORTE_AUDITORIA,
};

/** Orden preferido de las pestanas por perfil; solo cambia el ORDEN, el acceso lo da el permiso. */
const ORDEN_POR_PERFIL: Record<PerfilAnalitico, readonly ReporteId[]> = {
  total: ["evaluacion", "gasto", "area", "pendientes", "disponibilidad", "desempeno", "riesgo", "auditoria", "inventario"],
  // Compras decide a quien comprarle, que reponer y vigila lo que esta por llegar.
  comprador: ["evaluacion", "disponibilidad", "pendientes", "desempeno", "riesgo", "gasto", "area", "auditoria", "inventario"],
  // Finanzas decide con base en costo: gasto (por proveedor y por area), riesgo y caja.
  financiero: ["gasto", "area", "riesgo", "inventario", "pendientes", "evaluacion", "desempeno", "disponibilidad", "auditoria"],
  // Auditoria revisa hallazgos de control, riesgo y cumplimiento.
  auditor: ["auditoria", "riesgo", "gasto", "area", "desempeno", "inventario", "pendientes", "evaluacion", "disponibilidad"],
  // Jefes y gerentes: cuanto gasta su area y si lo que aprueban ya existe.
  gerencia: ["area", "disponibilidad", "gasto", "pendientes", "desempeno", "riesgo", "evaluacion", "inventario", "auditoria"],
  // Bodega planifica la recepcion: que viene y que hay.
  bodega: ["pendientes", "disponibilidad", "inventario", "desempeno", "gasto", "area", "riesgo", "evaluacion", "auditoria"],
  // Antes de pedir: si ya hay, si viene en camino o si alguien ya lo pidio.
  solicitante: ["disponibilidad", "area", "pendientes", "gasto", "desempeno", "riesgo", "evaluacion", "inventario", "auditoria"],
};

/**
 * Reportes que la sesion PUEDE ver (por permiso, igual que lo impone el backend),
 * en el orden que le conviene a su perfil. Vacio = el rol no tiene reportes.
 */
export function reportesVisibles(permisos: readonly string[], roles: readonly string[]): readonly ReporteId[] {
  const perfil = perfilAnalitico(permisos, roles);
  return ORDEN_POR_PERFIL[perfil].filter((id) => grants(permisos, PERMISO_DE_REPORTE[id]));
}

/** Enfoque con el que cada perfil abre la evaluacion de proveedores. */
export const PRIORIDAD_POR_PERFIL: Record<PerfilAnalitico, PrioridadEvaluacion> = {
  total: "equilibrado",
  comprador: "equilibrado",
  financiero: "ahorro",
  auditor: "calidad",
  gerencia: "equilibrado",
  bodega: "rapidez",
  solicitante: "equilibrado",
};

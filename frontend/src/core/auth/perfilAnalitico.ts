/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Perfil analitico de la sesion: que le interesa ver a cada rol en el Dashboard
 * y en Reportes. Se deriva de los permisos de GESTION (no del nombre del rol)
 * salvo Auditor, que no gestiona nada y solo se distingue por su rol.
 *
 * Es RELEVANCIA, no seguridad: el backend autoriza todas las vistas agregadas
 * con `ANALISIS_VER`; aqui solo se decide que pestanas se ofrecen, en que orden
 * y con que enfoque por defecto.
 */

import { Permisos, grants } from "./permisos.js";
import type { PrioridadEvaluacion } from "../CompraServices.js";

export type PerfilAnalitico = "total" | "comprador" | "financiero" | "auditor" | "gerencia" | "solicitante";

export type ReporteId = "evaluacion" | "gasto" | "pendientes" | "desempeno" | "riesgo" | "inventario";

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
};

/** Orden preferido de las pestanas por perfil; solo cambia el ORDEN, el acceso lo da el permiso. */
const ORDEN_POR_PERFIL: Record<PerfilAnalitico, readonly ReporteId[]> = {
  total: ["evaluacion", "gasto", "pendientes", "desempeno", "riesgo", "inventario"],
  // Compras decide a quien comprarle y vigila lo que esta por llegar.
  comprador: ["evaluacion", "pendientes", "desempeno", "riesgo", "gasto", "inventario"],
  // Finanzas decide con base en costo: gasto, descuentos/fletes, riesgo y caja.
  financiero: ["inventario", "gasto", "riesgo", "pendientes", "evaluacion", "desempeno"],
  // Auditoria revisa cumplimiento y riesgo.
  auditor: ["riesgo", "desempeno", "gasto", "inventario", "pendientes", "evaluacion"],
  gerencia: ["gasto", "pendientes", "desempeno", "riesgo", "evaluacion", "inventario"],
  solicitante: ["gasto", "pendientes", "desempeno", "riesgo", "evaluacion", "inventario"],
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
  solicitante: "equilibrado",
};

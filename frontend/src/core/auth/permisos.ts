/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Catalogo de permisos del modulo de Compras (espejo de
 * backend/src/common/auth/permissions.ts). Se usa para filtrar la navegacion
 * y las acciones segun el rol de la sesion.
 *
 * Principio de acceso: quien no puede gestionar/accionar un recurso, no lo ve.
 */

export const Permisos = {
  SOLICITUD_CREAR: "COMPRAS_SOLICITUD_CREAR",
  SOLICITUD_VER: "COMPRAS_SOLICITUD_VER",
  SOLICITUD_APROBAR_JEFE: "COMPRAS_SOLICITUD_APROBAR_JEFE",
  SOLICITUD_APROBAR_GERENTE: "COMPRAS_SOLICITUD_APROBAR_GERENTE",
  RFQ_GESTIONAR: "COMPRAS_RFQ_GESTIONAR",
  COTIZACION_GESTIONAR: "COMPRAS_COTIZACION_GESTIONAR",
  COTIZACION_ADJUDICAR: "COMPRAS_COTIZACION_ADJUDICAR",
  OC_GESTIONAR: "COMPRAS_OC_GESTIONAR",
  RECEPCION_GESTIONAR: "COMPRAS_RECEPCION_GESTIONAR",
  DEVOLUCION_GESTIONAR: "COMPRAS_DEVOLUCION_GESTIONAR",
  CATALOGO_VER: "COMPRAS_CATALOGO_VER",
  CATALOGO_EDITAR: "COMPRAS_CATALOGO_EDITAR",
  CATALOGO_ADMIN: "COMPRAS_CATALOGO_ADMIN",
  ANALISIS_VER: "COMPRAS_ANALISIS_VER",
  /** Un permiso por reporte (espejo del backend): cada area ve solo los que le sirven para decidir. */
  REPORTE_EVALUACION: "COMPRAS_REPORTE_EVALUACION",
  REPORTE_GASTO: "COMPRAS_REPORTE_GASTO",
  REPORTE_ENTREGAS: "COMPRAS_REPORTE_ENTREGAS",
  REPORTE_DESEMPENO: "COMPRAS_REPORTE_DESEMPENO",
  REPORTE_RIESGO: "COMPRAS_REPORTE_RIESGO",
  REPORTE_INVENTARIO: "COMPRAS_REPORTE_INVENTARIO",
  REPORTE_DISPONIBILIDAD: "COMPRAS_REPORTE_DISPONIBILIDAD",
  REPORTE_GASTO_AREA: "COMPRAS_REPORTE_GASTO_AREA",
  REPORTE_AUDITORIA: "COMPRAS_REPORTE_AUDITORIA",
} as const;

/** Cualquiera de estos habilita la pantalla de Reportes. */
export const PERMISOS_REPORTE: readonly string[] = [
  Permisos.REPORTE_EVALUACION,
  Permisos.REPORTE_GASTO,
  Permisos.REPORTE_ENTREGAS,
  Permisos.REPORTE_DESEMPENO,
  Permisos.REPORTE_RIESGO,
  Permisos.REPORTE_INVENTARIO,
  Permisos.REPORTE_DISPONIBILIDAD,
  Permisos.REPORTE_GASTO_AREA,
  Permisos.REPORTE_AUDITORIA,
];

export type PermisoCodigo = (typeof Permisos)[keyof typeof Permisos];

/** Cualquiera de estos permisos habilita las LECTURAS del flujo de documentos. */
export const READ_FLUJO: readonly string[] = [
  Permisos.SOLICITUD_VER,
  Permisos.RFQ_GESTIONAR,
  Permisos.COTIZACION_GESTIONAR,
  Permisos.COTIZACION_ADJUDICAR,
  Permisos.OC_GESTIONAR,
  Permisos.RECEPCION_GESTIONAR,
  Permisos.DEVOLUCION_GESTIONAR,
  Permisos.ANALISIS_VER,
];

/**
 * Lectura POR DOCUMENTO — deben coincidir exactamente con
 * `backend/src/presentation/routes/com/transaccional.ts` (`READ_*`), que es
 * quien realmente autoriza el `GET`. `nav.ts` los usa para decidir qué ve el
 * menú de cada rol. Cada arreglo es solo el/los permiso(s) de GESTION del
 * propio recurso — quien no lo gestiona, no lo lee (sin permisos de "solo
 * trazabilidad"). `SOLICITUD_VER` es la unica excepcion historica, ampliamente
 * compartida porque todo el mundo necesita saber el estado de una solicitud
 * para saber si le toca actuar.
 */
export const READ_SOLICITUDES: readonly string[] = [
  Permisos.SOLICITUD_VER,
  Permisos.SOLICITUD_CREAR,
  Permisos.SOLICITUD_APROBAR_JEFE,
  Permisos.SOLICITUD_APROBAR_GERENTE,
  Permisos.ANALISIS_VER,
];
export const READ_RFQ: readonly string[] = [Permisos.RFQ_GESTIONAR];
export const READ_COTIZACIONES: readonly string[] = [
  Permisos.COTIZACION_GESTIONAR,
  Permisos.COTIZACION_ADJUDICAR,
];
export const READ_OC: readonly string[] = [Permisos.OC_GESTIONAR];
export const READ_RECEPCIONES: readonly string[] = [Permisos.RECEPCION_GESTIONAR];
export const READ_DEVOLUCIONES: readonly string[] = [Permisos.DEVOLUCION_GESTIONAR];

export function grants(permisos: readonly string[], code: string): boolean {
  return permisos.includes("*") || permisos.includes(code);
}

export function grantsAny(permisos: readonly string[], codes: readonly string[]): boolean {
  if (permisos.includes("*")) return true;
  return codes.some((c) => permisos.includes(c));
}

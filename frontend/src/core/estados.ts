/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Traduce los codigos de estado del dominio (COM_) a texto legible y a un tono
 * semantico. Una sola fuente para chips, dropdowns y el stepper de flujo, para
 * que el usuario nunca vea "RECIBIDA_PARCIAL" crudo.
 */

const LABEL: Record<string, string> = {
  // Solicitud de compra
  PENDIENTE_JEFE: "Pendiente del jefe",
  PENDIENTE_GERENTE: "Pendiente del gerente",
  EN_COTIZACION: "En cotización",
  ORDEN_GENERADA: "Orden generada",
  RECHAZADA: "Rechazada",
  // RFQ
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
  // Orden de compra
  EMITIDA: "Emitida",
  ENVIADA: "Enviada al proveedor",
  EN_TRANSITO: "En tránsito",
  RECIBIDA_PARCIAL: "Recibida parcial",
  RECIBIDA_COMPLETA: "Recibida completa",
  CANCELADA: "Cancelada",
  // Recepcion
  RECIBIDO: "Recibido",
  ALIMENTADO_CXP: "Enviado a CxP",
  // Factura de proveedor / Cuentas por Pagar
  PENDIENTE: "Pendiente de liquidar",
  PAGADA_PARCIAL: "Pagada parcial",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
  // Genericos catalogos
  A: "Activo",
  I: "Inactivo",
  S: "Sí",
  N: "No",
};

/** "PENDIENTE_JEFE" -> "Pendiente del jefe". Cae a Capitalizacion si no esta mapeado. */
export function estadoLabel(code: string | null | undefined): string {
  if (code === null || code === undefined || code === "") return "—";
  const key = String(code).toUpperCase();
  if (LABEL[key] !== undefined) return LABEL[key];
  return key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (m) => m.toUpperCase());
}

export type EstadoTono = "neutral" | "brand" | "success" | "warning" | "danger";

const TONO: Record<string, EstadoTono> = {
  PENDIENTE_JEFE: "brand",
  PENDIENTE_GERENTE: "brand",
  ABIERTO: "brand",
  EMITIDA: "brand",
  RECIBIDO: "brand",
  PENDIENTE: "warning",
  PAGADA_PARCIAL: "warning",
  PAGADA: "success",
  ANULADA: "danger",
  EN_COTIZACION: "warning",
  ENVIADA: "warning",
  EN_TRANSITO: "warning",
  RECIBIDA_PARCIAL: "warning",
  ORDEN_GENERADA: "success",
  RECIBIDA_COMPLETA: "success",
  ALIMENTADO_CXP: "success",
  CERRADO: "success",
  A: "success",
  S: "success",
  RECHAZADA: "danger",
  CANCELADA: "danger",
  CANCELADO: "danger",
  I: "danger",
};

export function estadoTono(code: string | null | undefined): EstadoTono {
  if (code == null) return "neutral";
  return TONO[String(code).toUpperCase()] ?? "neutral";
}

/* ---- Prioridad de solicitud (1-5) -> etiqueta + tono ------------------- */

const PRIORIDAD_LABEL: Record<number, string> = {
  1: "Muy baja",
  2: "Baja",
  3: "Media",
  4: "Alta",
  5: "Urgente",
};

const PRIORIDAD_TONO: Record<number, EstadoTono> = {
  1: "neutral",
  2: "neutral",
  3: "brand",
  4: "warning",
  5: "danger",
};

export function prioridadLabel(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return PRIORIDAD_LABEL[n] ?? `P${n}`;
}

export function prioridadTono(value: number | string | null | undefined): EstadoTono {
  const n = Number(value);
  return PRIORIDAD_TONO[n] ?? "neutral";
}

/* ---- Calificacion de proveedor (A+/A/B/C/Nuevo) -> estrellas (1-5) -----
 * Traduce la escala cualitativa existente (catalogosEstaticos.CALIFICACION_
 * PROVEEDOR) a un numero de estrellas para el "vistazo rápido" en tabla —
 * no reemplaza la escala, solo la muestra visualmente. */
const CALIFICACION_ESTRELLAS: Record<string, number> = {
  "A+": 5,
  A: 4,
  B: 3,
  C: 2,
  Nuevo: 0,
};

export function calificacionProveedorEstrellas(codigo: string | null | undefined): number {
  if (codigo === null || codigo === undefined || codigo === "") return 0;
  return CALIFICACION_ESTRELLAS[codigo] ?? 0;
}

/** Icono por estado: el significado se entiende sin leer (y sin depender solo del color). */
const ICONO_ESTADO: Record<string, string> = {
  PENDIENTE_JEFE: "clock",
  PENDIENTE_GERENTE: "clock",
  EN_COTIZACION: "tag",
  ORDEN_GENERADA: "cart",
  RECHAZADA: "x",
  ABIERTO: "send",
  CERRADO: "check",
  CANCELADO: "x",
  EMITIDA: "clipboard",
  ENVIADA: "send",
  EN_TRANSITO: "truck",
  RECIBIDA_PARCIAL: "package",
  RECIBIDA_COMPLETA: "check",
  CANCELADA: "x",
  RECIBIDO: "package",
  ALIMENTADO_CXP: "wallet",
  PENDIENTE: "clock",
  PAGADA_PARCIAL: "coins",
  PAGADA: "check",
  ANULADA: "x",
};

export function estadoIcono(code: string | null | undefined): string | undefined {
  return code === null || code === undefined ? undefined : ICONO_ESTADO[String(code).toUpperCase()];
}

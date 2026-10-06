/**
 * Capa 6 - Componentes Comunes.
 * Traduce los codigos de ESTADO del dominio (COM_) a texto legible en espanol,
 * para que los mensajes de error de negocio (StateMachine, BusinessRuleError)
 * nunca muestren un codigo crudo tipo "RECIBIDA_PARCIAL" al usuario final.
 * Espejo intencional de `frontend/src/core/estados.ts::estadoLabel` — mismo
 * catalogo, cada lado lo usa donde le corresponde (el backend en mensajes de
 * error, el frontend en chips/badges).
 */

const ESTADO_LABEL: Record<string, string> = {
  // Solicitud de compra
  PENDIENTE_JEFE: "pendiente del jefe",
  PENDIENTE_GERENTE: "pendiente del gerente",
  EN_COTIZACION: "en cotización",
  ORDEN_GENERADA: "con orden generada",
  RECHAZADA: "rechazada",
  // RFQ
  ABIERTO: "abierto",
  CERRADO: "cerrado",
  CANCELADO: "cancelado",
  // Orden de compra
  EMITIDA: "emitida",
  ENVIADA: "enviada al proveedor",
  EN_TRANSITO: "en tránsito",
  RECIBIDA_PARCIAL: "recibida parcial",
  RECIBIDA_COMPLETA: "recibida completa",
  CANCELADA: "cancelada",
  // Recepcion
  RECIBIDO: "recibida",
  ALIMENTADO_CXP: "enviada a Cuentas por Pagar",
};

/** "RECIBIDA_PARCIAL" -> "recibida parcial". Cae al codigo en minusculas si no esta mapeado. */
export function estadoLabel(codigo: string): string {
  return ESTADO_LABEL[codigo] ?? codigo.toLowerCase().replace(/_/g, " ");
}

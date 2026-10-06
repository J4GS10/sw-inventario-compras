/**
 * Capa 3 (frontend) - Aplicacion.
 * Bandeja de pendientes del usuario: "que necesita tu acción ahora".
 * Deriva del estado del flujo en el backend (GET /api/com/notificaciones).
 */

import { http } from "./HttpClient.js";

export type NotiTipo =
  | "APROBAR_JEFE"
  | "APROBAR_GERENTE"
  | "COTIZAR"
  | "ORDEN_PENDIENTE"
  | "ADJUDICAR"
  | "RECIBIR"
  | "ESCASEZ";

export interface Notificacion {
  readonly tipo: NotiTipo;
  readonly titulo: string;
  readonly detalle: string;
  readonly cantidad: number;
  readonly leafId: string;
  readonly refs: readonly number[];
}

export interface BandejaPendientes {
  readonly total: number;
  readonly items: readonly Notificacion[];
}

/** Respuesta (aprobada / rechazada) a una solicitud del propio usuario. */
export interface DecisionRecibida {
  readonly idWorkflow: number;
  readonly idSolicitud: number;
  readonly resultado: "APROBADA" | "RECHAZADA";
  readonly estadoNuevo: string;
  readonly por: string;
  readonly mensaje: string;
  readonly comentario: string | null;
  readonly fecha: string;
  readonly resumen: string;
}

export async function fetchDecisiones(): Promise<readonly DecisionRecibida[]> {
  try {
    return await http.get<readonly DecisionRecibida[]>("/api/com/notificaciones/decisiones");
  } catch {
    return [];
  }
}

const VACIA: BandejaPendientes = { total: 0, items: [] };

export async function fetchPendientes(): Promise<BandejaPendientes> {
  try {
    return await http.get<BandejaPendientes>("/api/com/notificaciones");
  } catch {
    return VACIA;
  }
}

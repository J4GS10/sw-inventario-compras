/**
 * Capa 3 (frontend) - Aplicacion.
 * Bandeja de pendientes del usuario: "que necesita tu accion ahora".
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

const VACIA: BandejaPendientes = { total: 0, items: [] };

export async function fetchPendientes(): Promise<BandejaPendientes> {
  try {
    return await http.get<BandejaPendientes>("/api/com/notificaciones");
  } catch {
    return VACIA;
  }
}

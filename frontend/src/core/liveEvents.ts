/** Eventos de aplicacion que produce el canal en vivo (consumidos por la campana y las listas). */
export const LiveEvents = {
  Decision: "live.decision",
  Bandeja: "live.bandeja",
  Reconectado: "live.reconectado",
  /** boolean: el canal en vivo esta conectado. */
  Estado: "live.estado",
  /** number: escrituras (POST/PUT/DELETE) en vuelo ahora mismo. */
  Guardando: "http.guardando",
} as const;

export interface DecisionEnVivo {
  readonly idSolicitud: number;
  readonly resultado: "APROBADA" | "RECHAZADA";
  readonly estadoNuevo: string;
  readonly por: string;
  readonly mensaje: string;
  readonly siguiente: string | null;
  readonly comentario: string | null;
  readonly fecha: string;
}

export interface BandejaEnVivo {
  readonly motivo: string;
  readonly idSolicitud?: number;
  readonly estadoNuevo?: string;
}

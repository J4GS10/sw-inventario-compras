/**
 * Capa 3 (frontend) - Aplicacion.
 * Canal EN VIVO con el backend (Server-Sent Events sobre fetch). Se usa fetch y
 * no `EventSource` porque este ultimo no puede enviar la cabecera Authorization.
 *
 * Resiliencia: reconexion automatica con espera creciente (1 s -> 15 s) y
 * reinicio al volver la pestana a primer plano / recuperar red. Cada
 * (re)conexion avisa con `onReconnect` para que la UI recargue lo que pudo
 * perderse mientras estuvo desconectada (la bandeja y las respuestas se derivan
 * del servidor, asi que nada se pierde).
 */

import { http } from "./HttpClient.js";

export interface LiveMessage {
  readonly event: string;
  readonly data: unknown;
}

export interface LiveHandlers {
  onMessage(msg: LiveMessage): void;
  /** Se invoca cuando el canal queda abierto (primera vez o tras reconectar). */
  onOpen?(esReconexion: boolean): void;
  onStatus?(conectado: boolean): void;
}

/** Parser incremental del formato SSE (separa por linea en blanco). */
export function parseSse(buffer: string): { mensajes: LiveMessage[]; resto: string } {
  const mensajes: LiveMessage[] = [];
  const bloques = buffer.split(/\r?\n\r?\n/);
  const resto = bloques.pop() ?? "";
  for (const b of bloques) {
    let event = "message";
    const datos: string[] = [];
    for (const linea of b.split(/\r?\n/)) {
      if (linea.startsWith(":") || linea === "") continue;
      const i = linea.indexOf(":");
      const campo = i < 0 ? linea : linea.slice(0, i);
      const valor = i < 0 ? "" : linea.slice(i + 1).replace(/^ /, "");
      if (campo === "event") event = valor;
      else if (campo === "data") datos.push(valor);
    }
    if (datos.length === 0) continue;
    const crudo = datos.join("\n");
    let data: unknown = crudo;
    try {
      data = JSON.parse(crudo);
    } catch {
      /* texto plano */
    }
    mensajes.push({ event, data });
  }
  return { mensajes, resto };
}

export class LiveConnection {
  private ctl: AbortController | null = null;
  private cerrado = false;
  private intento = 0;
  private timer: number | undefined;
  private abiertoAntes = false;

  constructor(private readonly handlers: LiveHandlers, private readonly path = "/api/com/notificaciones/stream") {}

  public start(): void {
    this.cerrado = false;
    window.addEventListener("online", this.reiniciar);
    document.addEventListener("visibilitychange", this.alVolver);
    void this.conectar();
  }

  public stop(): void {
    this.cerrado = true;
    window.removeEventListener("online", this.reiniciar);
    document.removeEventListener("visibilitychange", this.alVolver);
    window.clearTimeout(this.timer);
    this.ctl?.abort();
    this.handlers.onStatus?.(false);
  }

  private readonly reiniciar = (): void => {
    if (this.cerrado) return;
    window.clearTimeout(this.timer);
    this.ctl?.abort();
    this.intento = 0;
    void this.conectar();
  };

  private readonly alVolver = (): void => {
    if (document.visibilityState === "visible") this.reiniciar();
  };

  private async conectar(): Promise<void> {
    if (this.cerrado) return;
    const token = http.getToken();
    if (token === null) return;
    const ctl = new AbortController();
    this.ctl = ctl;
    try {
      const res = await fetch(this.path, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        signal: ctl.signal,
      });
      if (!res.ok || res.body === null) {
        // 401/403: sin sesion o sin permiso de flujo -> no insistir; otro error -> reintentar.
        if (res.status === 401 || res.status === 403) return;
        throw new Error(`HTTP ${res.status}`);
      }
      this.intento = 0;
      this.handlers.onStatus?.(true);
      this.handlers.onOpen?.(this.abiertoAntes);
      this.abiertoAntes = true;

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const { mensajes, resto } = parseSse(buf);
        buf = resto;
        for (const m of mensajes) {
          if (m.event === "ready") continue;
          try {
            this.handlers.onMessage(m);
          } catch {
            /* un manejador roto no corta el canal */
          }
        }
      }
    } catch {
      /* se reintenta abajo */
    }
    this.handlers.onStatus?.(false);
    if (this.cerrado || ctl.signal.aborted) return;
    const espera = Math.min(15_000, 1000 * 2 ** this.intento++);
    this.timer = window.setTimeout(() => void this.conectar(), espera);
  }
}

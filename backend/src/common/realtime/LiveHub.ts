/**
 * Capa 6 - Componentes Comunes.
 * Concentrador de conexiones en vivo (Server-Sent Events). Patron Observer +
 * Singleton: los suscriptores de eventos de dominio publican aqui y el hub
 * entrega el mensaje a las conexiones abiertas del/los usuario(s) destino.
 *
 * En memoria (un proceso). Si no hay conexion abierta el mensaje no se pierde
 * para el usuario: la bandeja y "respuestas a tus solicitudes" se derivan del
 * estado en BD y se recargan al reconectar. Sin dependencia del negocio.
 */

export interface LiveMessage {
  /** Nombre del evento SSE (p. ej. "decision", "bandeja"). */
  readonly event: string;
  readonly data: unknown;
}

type Sender = (msg: LiveMessage & { id: number }) => void;

export class LiveHub {
  private static instance: LiveHub | undefined;

  private readonly conns = new Map<number, Set<Sender>>();

  private seq = 0;

  private constructor() {}

  public static getInstance(): LiveHub {
    if (LiveHub.instance === undefined) LiveHub.instance = new LiveHub();
    return LiveHub.instance;
  }

  /** Maximo de conexiones en vivo simultaneas por usuario (varias pestanas si, un flood no). */
  public static readonly MAX_POR_USUARIO = 5;

  /**
   * Registra una conexion del usuario; devuelve la funcion que la da de baja, o
   * `null` si el usuario ya alcanzo el tope (el llamador responde 429).
   */
  public register(userId: number, send: Sender): (() => void) | null {
    const set = this.conns.get(userId) ?? new Set<Sender>();
    if (set.size >= LiveHub.MAX_POR_USUARIO) return null;
    set.add(send);
    this.conns.set(userId, set);
    return () => {
      set.delete(send);
      if (set.size === 0) this.conns.delete(userId);
    };
  }

  /** Envia a todas las conexiones de los usuarios dados. Devuelve cuantas conexiones lo recibieron. */
  public sendToUsers(userIds: readonly number[], msg: LiveMessage): number {
    let n = 0;
    const id = ++this.seq;
    for (const u of new Set(userIds)) {
      for (const send of [...(this.conns.get(u) ?? [])]) {
        try {
          send({ ...msg, id });
          n++;
        } catch {
          /* conexion rota: su cierre la da de baja */
        }
      }
    }
    return n;
  }

  /** Envia a TODAS las conexiones abiertas. */
  public broadcast(msg: LiveMessage): number {
    return this.sendToUsers([...this.conns.keys()], msg);
  }

  public connectionsOf(userId: number): number {
    return this.conns.get(userId)?.size ?? 0;
  }

  public connectionCount(): number {
    let n = 0;
    for (const s of this.conns.values()) n += s.size;
    return n;
  }

  /** Solo para pruebas. */
  public static reset(): void {
    LiveHub.instance = undefined;
  }
}

export function liveHub(): LiveHub {
  return LiveHub.getInstance();
}

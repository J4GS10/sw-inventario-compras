/**
 * Capa 6 - Componentes Comunes.
 * Patron Observer: bus de eventos de dominio in-process.
 *
 * La BLL publica eventos al completar transacciones (ej. RecepcionRegistrada)
 * y los suscriptores reaccionan de forma desacoplada (kardex, CxP, alertas).
 * Sin dependencia del negocio: el catalogo de eventos se define en la BLL.
 */

import { logger } from "../logging/Logger.js";

export type DomainEventHandler<TPayload> = (
  payload: TPayload,
) => void | Promise<void>;

export class DomainEventBus {
  private static instance: DomainEventBus | undefined;

  private readonly handlers = new Map<string, Set<DomainEventHandler<unknown>>>();

  private constructor() {}

  public static getInstance(): DomainEventBus {
    if (DomainEventBus.instance === undefined) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  public subscribe<TPayload>(
    eventName: string,
    handler: DomainEventHandler<TPayload>,
  ): () => void {
    const set = this.handlers.get(eventName) ?? new Set();
    set.add(handler as DomainEventHandler<unknown>);
    this.handlers.set(eventName, set);
    return () => {
      set.delete(handler as DomainEventHandler<unknown>);
    };
  }

  /**
   * Publica un evento y espera a que todos los suscriptores terminen.
   * Un fallo en un suscriptor se registra pero no aborta a los demas ni
   * revienta la transaccion ya confirmada del publicador.
   */
  public async publish<TPayload>(
    eventName: string,
    payload: TPayload,
  ): Promise<void> {
    const set = this.handlers.get(eventName);
    if (set === undefined || set.size === 0) return;
    const results = await Promise.allSettled(
      [...set].map((handler) => Promise.resolve(handler(payload))),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        // code fijo y greppable: el evento ya se publico DESPUES del commit del
        // publicador (TransactionalService), asi que un fallo aqui deja
        // divergencia real (kardex/CxP no reflejan la recepcion). No relanza -
        // detectar y reparar es tarea de GET/POST .../consistencia|reprocesar.
        logger().error("Fallo en suscriptor de evento de dominio", {
          code: "SUBSCRIBER_FAILED",
          eventName,
          payload,
          reason:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    }
  }

  /** Solo para pruebas. */
  public static reset(): void {
    DomainEventBus.instance = undefined;
  }
}

export function eventBus(): DomainEventBus {
  return DomainEventBus.getInstance();
}

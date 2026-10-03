/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Patron Observer: bus de eventos de aplicacion in-process. Singleton.
 * Lo usan los servicios para notificar cambios (una lista se recarga sola tras
 * un alta en otra pantalla, un toast global, etc.).
 */

export const AppEvents = {
  EntityCreated: "entity.created",
  EntityUpdated: "entity.updated",
  EntityRemoved: "entity.removed",
  Toast: "ui.toast",
} as const;

export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];

export interface EntityChangedPayload {
  readonly resource: string;
  readonly id?: number;
}
export interface ToastPayload {
  readonly tone: "success" | "error" | "info";
  readonly message: string;
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private static instance: EventBus | undefined;
  private readonly handlers = new Map<string, Set<Handler<unknown>>>();

  private constructor() {}

  public static getInstance(): EventBus {
    if (EventBus.instance === undefined) EventBus.instance = new EventBus();
    return EventBus.instance;
  }

  public on<T>(event: string, handler: Handler<T>): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as Handler<unknown>);
    this.handlers.set(event, set);
    return () => set.delete(handler as Handler<unknown>);
  }

  public emit<T>(event: string, payload: T): void {
    const set = this.handlers.get(event);
    if (set === undefined) return;
    for (const h of [...set]) {
      try {
        h(payload);
      } catch {
        /* un suscriptor no debe romper a los demas */
      }
    }
  }
}

export const eventBus = EventBus.getInstance();

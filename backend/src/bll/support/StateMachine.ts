/**
 * Capa 3 - Logica de Negocio / soporte.
 * Maquina de estados generica y reutilizable. La usan Solicitud, Orden de
 * Compra, RFQ y Recepcion para validar transiciones de ESTADO.
 */

import { BusinessRuleError } from "../../common/errors/AppError.js";
import { estadoLabel } from "../../common/estadoLabels.js";

export class StateMachine<TState extends string> {
  private readonly transitions: ReadonlyMap<TState, ReadonlySet<TState>>;

  constructor(
    spec: Readonly<Record<string, readonly string[]>>,
    private readonly entityName: string,
    /** Nombre legible en espanol para el mensaje de error (p. ej. "la orden de compra"). */
    private readonly nombreLegible: string = entityName,
  ) {
    const map = new Map<TState, ReadonlySet<TState>>();
    for (const [from, targets] of Object.entries(spec)) {
      map.set(from as TState, new Set(targets as TState[]));
    }
    this.transitions = map;
  }

  public canTransition(from: TState, to: TState): boolean {
    return this.transitions.get(from)?.has(to) ?? false;
  }

  public assertTransition(from: TState, to: TState): void {
    if (from === to) return;
    if (!this.canTransition(from, to)) {
      throw new BusinessRuleError(
        `No se puede pasar ${this.nombreLegible} de "${estadoLabel(from)}" a "${estadoLabel(to)}".`,
      );
    }
  }

  public nextStates(from: TState): readonly TState[] {
    return [...(this.transitions.get(from) ?? [])];
  }
}

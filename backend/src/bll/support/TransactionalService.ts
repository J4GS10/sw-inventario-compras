/**
 * Capa 3 - Logica de Negocio / soporte.
 *
 * Patron Template Method: define el esqueleto invariable de una operacion de
 * negocio transaccional (abrir conexion -> ejecutar -> commit/rollback ->
 * cerrar). Las subclases solo implementan el algoritmo interno dentro de
 * `runInTransaction`, sin volver a escribir el manejo de la transaccion.
 *
 * Tambien centraliza la publicacion diferida de eventos de dominio: los eventos
 * encolados con `enqueueEvent` se emiten SOLO despues de un commit exitoso, de
 * modo que ningun suscriptor observe un estado que luego se revierte.
 */

import type { Connection } from "oracledb";
import { oraclePool } from "../../dal/OraclePool.js";
import { eventBus } from "../../common/events/DomainEventBus.js";
import { logger } from "../../common/logging/Logger.js";

interface PendingEvent {
  readonly name: string;
  readonly payload: unknown;
}

export abstract class TransactionalService {
  protected readonly log = logger();

  /**
   * Ejecuta `work` dentro de una unica transaccion. Si `work` retorna con exito
   * se hace commit y se publican los eventos encolados; si lanza, rollback y se
   * descartan los eventos.
   */
  protected async runInTransaction<T>(
    work: (ctx: TransactionScope) => Promise<T>,
  ): Promise<T> {
    const pending: PendingEvent[] = [];
    const result = await oraclePool().withTransaction(async (conn) => {
      const scope: TransactionScope = {
        conn,
        enqueueEvent: (name, payload) => pending.push({ name, payload }),
      };
      return work(scope);
    });

    for (const evt of pending) {
      await eventBus().publish(evt.name, evt.payload);
    }
    return result;
  }
}

export interface TransactionScope {
  readonly conn: Connection;
  /** Encola un evento de dominio para publicarse tras el commit. */
  enqueueEvent(name: string, payload: unknown): void;
}

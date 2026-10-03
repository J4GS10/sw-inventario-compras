/**
 * Capa 2 - Acceso a Datos / contratos.
 * Interfaz abstracta generica del patron Repository. Las capas superiores
 * dependen de este contrato, nunca de la implementacion `oracledb`.
 */

import type { Connection } from "oracledb";
import type { AuditContext } from "../../common/types/AuditContext.js";
import type {
  FilterCondition,
  PageQuery,
  Paginated,
} from "../../common/types/Query.js";

export interface IRepository<TEntity, TCreate, TUpdate> {
  findById(id: number, conn?: Connection): Promise<TEntity | null>;

  findAll(query: PageQuery, conn?: Connection): Promise<Paginated<TEntity>>;

  create(dto: TCreate, ctx: AuditContext, conn?: Connection): Promise<TEntity>;

  /**
   * @param expectedVersion Valor VERSION esperado para bloqueo optimista.
   *   `null` en tablas sin columna VERSION.
   */
  update(
    id: number,
    dto: TUpdate,
    expectedVersion: number | null,
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<TEntity>;

  softDelete(id: number, ctx: AuditContext, conn?: Connection): Promise<void>;

  count(
    filters: readonly FilterCondition[],
    conn?: Connection,
  ): Promise<number>;

  exists(id: number, conn?: Connection): Promise<boolean>;
}

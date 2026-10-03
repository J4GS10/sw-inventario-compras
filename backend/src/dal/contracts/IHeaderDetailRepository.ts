/**
 * Capa 2 - Acceso a Datos / contratos.
 * Extension del contrato Repository para las 7 parejas cabecera/detalle del
 * modulo de compras. Todas las operaciones ocurren en una unica transaccion.
 */

import type { Connection } from "oracledb";
import type { AuditContext } from "../../common/types/AuditContext.js";
import type { IRepository } from "./IRepository.js";

export interface WithDetails<THeader, TDetail> {
  readonly header: THeader;
  readonly details: readonly TDetail[];
}

export interface IHeaderDetailRepository<
  THeader,
  TCreateHeader,
  TUpdateHeader,
  TDetail,
  TCreateDetail,
> extends IRepository<THeader, TCreateHeader, TUpdateHeader> {
  findByIdWithDetails(
    id: number,
    conn?: Connection,
  ): Promise<WithDetails<THeader, TDetail> | null>;

  createWithDetails(
    header: TCreateHeader,
    details: readonly TCreateDetail[],
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<WithDetails<THeader, TDetail>>;

  /** Reemplaza (soft-delete de las previas + alta de las nuevas) las lineas. */
  replaceDetails(
    headerId: number,
    details: readonly TCreateDetail[],
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<readonly TDetail[]>;

  listDetails(headerId: number, conn?: Connection): Promise<readonly TDetail[]>;
}

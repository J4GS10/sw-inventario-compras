/**
 * Capa 2 - Acceso a Datos.
 * Clase base generica para las 7 parejas cabecera/detalle del modulo de compras.
 * Reutiliza BaseOracleRepository para la cabecera y compone otro
 * BaseOracleRepository (via CrudRepository) para el detalle.
 *
 * Todas las operaciones compuestas exigen una conexion transaccional del
 * llamador (normalmente el servicio de la BLL dentro de withTransaction()).
 */

import type { Connection } from "oracledb";
import type { AuditContext } from "../../common/types/AuditContext.js";
import { normalizePageQuery } from "../../common/types/Query.js";
import { InternalError, NotFoundError } from "../../common/errors/AppError.js";
import type { EntityDescriptor } from "../../entities/support/EntityDescriptor.js";
import { oraclePool } from "../OraclePool.js";
import type {
  IHeaderDetailRepository,
  WithDetails,
} from "../contracts/IHeaderDetailRepository.js";
import { BaseOracleRepository } from "./BaseOracleRepository.js";
import { CrudRepository } from "./CrudRepository.js";

export abstract class BaseHeaderDetailRepository<
    THeader,
    TCreateHeader,
    TUpdateHeader,
    TDetail,
    TCreateDetail,
  >
  extends BaseOracleRepository<THeader, TCreateHeader, TUpdateHeader>
  implements
    IHeaderDetailRepository<
      THeader,
      TCreateHeader,
      TUpdateHeader,
      TDetail,
      TCreateDetail
    >
{
  protected readonly detailRepo: CrudRepository<
    TDetail,
    TCreateDetail,
    Partial<TCreateDetail>
  >;

  protected readonly detailFk: string;

  protected readonly detailFkProp: string;

  protected constructor(
    headerDescriptor: EntityDescriptor,
    detailDescriptor: EntityDescriptor,
  ) {
    super(headerDescriptor);
    if (headerDescriptor.detail === undefined) {
      throw new InternalError(
        `El descriptor ${headerDescriptor.table} no declara relación detail`,
      );
    }
    this.detailRepo = new CrudRepository(detailDescriptor);
    this.detailFk = headerDescriptor.detail.fk;
    const fkCol = detailDescriptor.columns.find((c) => c.db === this.detailFk);
    if (fkCol === undefined) {
      throw new InternalError(
        `El detalle ${detailDescriptor.table} no tiene la columna FK ${this.detailFk}`,
      );
    }
    this.detailFkProp = fkCol.prop;
  }

  /** Nombre (camelCase) de la propiedad FK del detalle hacia la cabecera. */
  public detailForeignKeyProp(): string {
    return this.detailFkProp;
  }

  public async listDetails(
    headerId: number,
    conn?: Connection,
  ): Promise<readonly TDetail[]> {
    const page = await this.detailRepo.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 500,
        filters: [{ prop: this.detailFkProp, operator: "eq", value: headerId }],
      }),
      conn,
    );
    return page.data;
  }

  public async findByIdWithDetails(
    id: number,
    conn?: Connection,
  ): Promise<WithDetails<THeader, TDetail> | null> {
    return oraclePool().withConnection(async (c) => {
      const header = await this.findById(id, c);
      if (header === null) return null;
      const details = await this.listDetails(id, c);
      return { header, details };
    }, conn);
  }

  public async createWithDetails(
    header: TCreateHeader,
    details: readonly TCreateDetail[],
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<WithDetails<THeader, TDetail>> {
    return oraclePool().withTransaction(async (c) => {
      const headerId = await this.insertRow(
        header as Record<string, unknown>,
        ctx,
        c,
      );
      const created: TDetail[] = [];
      for (const line of details) {
        const withFk = {
          ...(line as Record<string, unknown>),
          [this.detailFkProp]: headerId,
        };
        const lineId = await this.detailRepo.insertRow(withFk, ctx, c);
        const row = await this.detailRepo.findById(lineId, c);
        if (row === null) throw new InternalError("Detalle recién creado no encontrado");
        created.push(row);
      }
      const headerRow = await this.findById(headerId, c);
      if (headerRow === null) throw new InternalError("Cabecera recién creada no encontrada");
      return { header: headerRow, details: created };
    }, conn);
  }

  public async replaceDetails(
    headerId: number,
    details: readonly TCreateDetail[],
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<readonly TDetail[]> {
    return oraclePool().withTransaction(async (c) => {
      const exists = await this.exists(headerId, c);
      if (!exists) throw new NotFoundError(this.d.table, headerId);

      const current = await this.listDetails(headerId, c);
      for (const line of current) {
        const lineId = (line as Record<string, unknown>)[
          this.detailPkProp()
        ] as number;
        await this.detailRepo.softDelete(lineId, ctx, c);
      }

      const created: TDetail[] = [];
      for (const line of details) {
        const withFk = {
          ...(line as Record<string, unknown>),
          [this.detailFkProp]: headerId,
        };
        const lineId = await this.detailRepo.insertRow(withFk, ctx, c);
        const row = await this.detailRepo.findById(lineId, c);
        if (row !== null) created.push(row);
      }
      return created;
    }, conn);
  }

  /** Borrado logico de la cabecera y de todos sus detalles, en una transaccion. */
  public async softDeleteWithDetails(
    headerId: number,
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<void> {
    await oraclePool().withTransaction(async (c) => {
      const exists = await this.exists(headerId, c);
      if (!exists) throw new NotFoundError(this.d.table, headerId);
      const current = await this.listDetails(headerId, c);
      for (const line of current) {
        const lineId = (line as Record<string, unknown>)[
          this.detailPkProp()
        ] as number;
        await this.detailRepo.softDelete(lineId, ctx, c);
      }
      await this.softDelete(headerId, ctx, c);
    }, conn);
  }

  protected detailPkProp(): string {
    return this.detailRepo.pkProp();
  }
}

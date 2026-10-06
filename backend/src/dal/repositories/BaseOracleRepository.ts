/**
 * Capa 2 - Acceso a Datos.
 * Clase base generica que implementa el contrato IRepository ENTERO a partir de
 * un EntityDescriptor. Ningun CRUD se escribe a mano: se configura.
 *
 * Seguridad:
 *  - Todos los VALORES viajan como bind variables nombradas (:p0, :id, ...).
 *  - Todos los IDENTIFICADORES SQL (tabla, columnas, orden) provienen del
 *    descriptor mediante whitelists; jamas del input del usuario.
 *
 * Errores: cualquier error del driver se traduce con mapOracleError -> AppError.
 */

import oracledb, { type BindParameters, type Connection } from "oracledb";
import type { AuditContext } from "../../common/types/AuditContext.js";
import {
  buildPaginated,
  normalizePageQuery,
  type FilterCondition,
  type PageQuery,
  type Paginated,
} from "../../common/types/Query.js";
import { mapOracleError } from "../../common/errors/OracleErrorAdapter.js";
import {
  NotFoundError,
  OptimisticLockError,
  ValidationError,
} from "../../common/errors/AppError.js";
import {
  findColumn,
  type ColumnDescriptor,
  type EntityDescriptor,
} from "../../entities/support/EntityDescriptor.js";
import { oraclePool } from "../OraclePool.js";
import type { IRepository } from "../contracts/IRepository.js";
import { buildSearchClause } from "./searchSql.js";

type BindMap = Record<string, unknown>;

/** El BindMap interno usa `unknown`; el driver espera BindParameters. */
function asBinds(map: BindMap): BindParameters {
  return map as unknown as BindParameters;
}

/**
 * Las columnas de auditoria (CREADO_POR / MODIFICADO_POR / ELIMINADO_POR) son
 * FK -> SEG_USUARIO. Para contextos de sistema o dev sin usuario autenticado
 * (userId <= 0) se escribe NULL en lugar de una FK invalida.
 */
function auditUser(userId: number): number | null {
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

const SQL_OPERATOR: Record<string, string> = {
  eq: "=",
  ne: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
};

export abstract class BaseOracleRepository<TEntity, TCreate, TUpdate>
  implements IRepository<TEntity, TCreate, TUpdate>
{
  protected readonly d: EntityDescriptor;

  protected constructor(descriptor: EntityDescriptor) {
    this.d = descriptor;
  }

  // --------------------------------------------------------------------------
  // API publica
  // --------------------------------------------------------------------------

  public async findById(id: number, conn?: Connection): Promise<TEntity | null> {
    return oraclePool().withConnection(async (c) => {
      try {
        const sql =
          `SELECT ${this.selectList()} FROM ${this.d.table} ` +
          `WHERE ${this.d.pk} = :id AND ${this.d.softDelete.flag} = 'N'`;
        const res = await c.execute<Record<string, unknown>>(sql, { id });
        const row = res.rows?.[0];
        return row ? this.mapRow(row) : null;
      } catch (error) {
        throw mapOracleError(error, this.d.table);
      }
    }, conn);
  }

  public async lockById(id: number, conn: Connection): Promise<boolean> {
    try {
      const res = await conn.execute(
        `SELECT ${this.d.pk} FROM ${this.d.table} WHERE ${this.d.pk} = :id AND ${this.d.softDelete.flag} = 'N' FOR UPDATE`,
        { id },
      );
      return (res.rows?.length ?? 0) > 0;
    } catch (error) {
      throw mapOracleError(error, this.d.table);
    }
  }

  public async findAll(
    query: PageQuery,
    conn?: Connection,
  ): Promise<Paginated<TEntity>> {
    const q = normalizePageQuery(query);
    return oraclePool().withConnection(async (c) => {
      try {
        const { clause, binds } = this.buildWhere(q.filters ?? [], q.search);
        const orderBy = this.buildOrderBy(q.sort, q.order);
        const offset = (q.page - 1) * q.pageSize;

        // Una sola consulta: filas de la pagina + total del conjunto filtrado
        // via funcion analitica COUNT(*) OVER (). Evita el segundo round-trip a
        // Oracle en cada listado (la operacion mas frecuente del sistema).
        // mapRow ignora columnas ajenas al descriptor, asi que el alias extra
        // no contamina la entidad devuelta.
        const dataSql =
          `SELECT ${this.selectList()}, COUNT(*) OVER () AS PAGINATION_TOTAL ` +
          `FROM ${this.d.table} ${clause} ` +
          `${orderBy} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        const dataRes = await c.execute<Record<string, unknown>>(
          dataSql,
          asBinds({ ...binds, offset, limit: q.pageSize }),
        );

        const rows = dataRes.rows ?? [];
        let total: number;
        if (rows.length > 0) {
          total = Number(rows[0]?.["PAGINATION_TOTAL"] ?? 0);
        } else if (q.page <= 1) {
          // Pagina 1 sin filas: el conjunto filtrado esta vacio.
          total = 0;
        } else {
          // Pagina fuera de rango (sin filas para deducir el total): se cuenta
          // aparte. Caso poco frecuente (navegacion mas alla de la ultima pag).
          const countSql = `SELECT COUNT(*) AS TOTAL FROM ${this.d.table} ${clause}`;
          const countRes = await c.execute<{ TOTAL: number }>(
            countSql,
            asBinds(binds),
          );
          total = Number(countRes.rows?.[0]?.TOTAL ?? 0);
        }

        const data = rows.map((r) => this.mapRow(r));
        return buildPaginated(data, total, q);
      } catch (error) {
        throw mapOracleError(error, this.d.table);
      }
    }, conn);
  }

  public async create(
    dto: TCreate,
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<TEntity> {
    return oraclePool().withTransaction(async (c) => {
      const id = await this.insertRow(dto as Record<string, unknown>, ctx, c);
      const created = await this.requireById(id, c);
      return created;
    }, conn);
  }

  public async update(
    id: number,
    dto: TUpdate,
    expectedVersion: number | null,
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<TEntity> {
    return oraclePool().withTransaction(async (c) => {
      await this.updateRow(
        id,
        dto as Record<string, unknown>,
        expectedVersion,
        ctx,
        c,
      );
      return this.requireById(id, c);
    }, conn);
  }

  public async softDelete(
    id: number,
    ctx: AuditContext,
    conn?: Connection,
  ): Promise<void> {
    return oraclePool().withTransaction(async (c) => {
      try {
        const sql =
          `UPDATE ${this.d.table} SET ${this.d.softDelete.flag} = 'S', ` +
          `${this.d.softDelete.date} = SYSTIMESTAMP, ` +
          `${this.d.softDelete.user} = :userId ` +
          `WHERE ${this.d.pk} = :id AND ${this.d.softDelete.flag} = 'N'`;
        const res = await c.execute(sql, { userId: auditUser(ctx.userId), id });
        if ((res.rowsAffected ?? 0) === 0) {
          throw new NotFoundError(this.d.table, id);
        }
      } catch (error) {
        throw mapOracleError(error, this.d.table);
      }
    }, conn);
  }

  public async count(
    filters: readonly FilterCondition[],
    conn?: Connection,
  ): Promise<number> {
    return oraclePool().withConnection(async (c) => {
      try {
        const { clause, binds } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS TOTAL FROM ${this.d.table} ${clause}`;
        const res = await c.execute<{ TOTAL: number }>(sql, asBinds(binds));
        return Number(res.rows?.[0]?.TOTAL ?? 0);
      } catch (error) {
        throw mapOracleError(error, this.d.table);
      }
    }, conn);
  }

  public async exists(id: number, conn?: Connection): Promise<boolean> {
    return oraclePool().withConnection(async (c) => {
      try {
        const sql =
          `SELECT 1 AS ONE FROM ${this.d.table} ` +
          `WHERE ${this.d.pk} = :id AND ${this.d.softDelete.flag} = 'N'`;
        const res = await c.execute<{ ONE: number }>(sql, { id });
        return (res.rows?.length ?? 0) > 0;
      } catch (error) {
        throw mapOracleError(error, this.d.table);
      }
    }, conn);
  }

  // --------------------------------------------------------------------------
  // Operaciones reutilizables por subclases (dentro de una transaccion dada)
  // --------------------------------------------------------------------------

  protected async requireById(id: number, conn: Connection): Promise<TEntity> {
    const found = await this.findById(id, conn);
    if (found === null) throw new NotFoundError(this.d.table, id);
    return found;
  }

  /** Nombre de propiedad (camelCase) de la PK. */
  public pkProp(): string {
    const c = this.d.columns.find((x) => x.db === this.d.pk);
    return c?.prop ?? this.d.pk.toLowerCase();
  }

  /** Descriptor asociado (solo lectura). */
  public descriptor(): EntityDescriptor {
    return this.d;
  }

  /**
   * Inserta una fila dentro de la transaccion `conn` y devuelve el id generado.
   * Publico para permitir composicion desde repositorios cabecera/detalle.
   */
  public async insertRow(
    dto: Record<string, unknown>,
    ctx: AuditContext,
    conn: Connection,
  ): Promise<number> {
    try {
      const cols: string[] = [];
      const placeholders: string[] = [];
      const binds: BindMap = {};

      for (const col of this.d.columns) {
        if (!col.insertable) continue;
        if (this.isAuditColumn(col.db)) continue;
        if (col.db === this.d.softDelete.flag) continue;
        if (col.db === this.d.softDelete.date) continue;
        if (col.db === this.d.softDelete.user) continue;
        if (this.d.version !== undefined && col.db === this.d.version) continue;
        if (!(col.prop in dto)) continue;
        const bindName = `b_${col.prop}`;
        cols.push(col.db);
        placeholders.push(`:${bindName}`);
        binds[bindName] = this.toBind(col, dto[col.prop]);
      }

      if (this.d.audit?.createdBy !== undefined) {
        cols.push(this.d.audit.createdBy);
        placeholders.push(":b_createdBy");
        binds["b_createdBy"] = auditUser(ctx.userId);
      }
      if (this.d.audit?.createdAt !== undefined) {
        cols.push(this.d.audit.createdAt);
        placeholders.push("SYSTIMESTAMP");
      }

      if (cols.length === 0) {
        throw new ValidationError("No hay columnas para insertar");
      }

      binds["out_id"] = {
        dir: oracledb.BIND_OUT,
        type: oracledb.NUMBER,
      };

      const sql =
        `INSERT INTO ${this.d.table} (${cols.join(", ")}) ` +
        `VALUES (${placeholders.join(", ")}) ` +
        `RETURNING ${this.d.pk} INTO :out_id`;
      const res = await conn.execute(sql, asBinds(binds));
      const outBinds = res.outBinds as { out_id: number[] } | undefined;
      const newId = outBinds?.out_id?.[0];
      if (newId === undefined) {
        throw new ValidationError("No se pudo obtener el id generado");
      }
      return newId;
    } catch (error) {
      throw mapOracleError(error, this.d.table);
    }
  }

  protected async updateRow(
    id: number,
    dto: Record<string, unknown>,
    expectedVersion: number | null,
    ctx: AuditContext,
    conn: Connection,
  ): Promise<void> {
    try {
      const sets: string[] = [];
      const binds: BindMap = { id };

      for (const col of this.d.columns) {
        if (!col.updatable) continue;
        if (this.isAuditColumn(col.db)) continue;
        if (col.db === this.d.softDelete.flag) continue;
        if (col.db === this.d.softDelete.date) continue;
        if (col.db === this.d.softDelete.user) continue;
        if (this.d.version !== undefined && col.db === this.d.version) continue;
        if (!(col.prop in dto)) continue;
        const bindName = `s_${col.prop}`;
        sets.push(`${col.db} = :${bindName}`);
        binds[bindName] = this.toBind(col, dto[col.prop]);
      }

      if (this.d.audit?.modifiedBy !== undefined) {
        sets.push(`${this.d.audit.modifiedBy} = :s_modifiedBy`);
        binds["s_modifiedBy"] = auditUser(ctx.userId);
      }
      if (this.d.audit?.modifiedAt !== undefined) {
        sets.push(`${this.d.audit.modifiedAt} = SYSTIMESTAMP`);
      }
      if (this.d.version !== undefined) {
        sets.push(`${this.d.version} = ${this.d.version} + 1`);
      }

      if (sets.length === 0) {
        // Nada que actualizar: validamos existencia y salimos.
        const present = await this.exists(id, conn);
        if (!present) throw new NotFoundError(this.d.table, id);
        return;
      }

      let where = `${this.d.pk} = :id AND ${this.d.softDelete.flag} = 'N'`;
      if (this.d.version !== undefined && expectedVersion !== null) {
        where += ` AND ${this.d.version} = :expectedVersion`;
        binds["expectedVersion"] = expectedVersion;
      }

      const sql = `UPDATE ${this.d.table} SET ${sets.join(", ")} WHERE ${where}`;
      const res = await conn.execute(sql, asBinds(binds));

      if ((res.rowsAffected ?? 0) === 0) {
        const present = await this.exists(id, conn);
        if (
          present &&
          this.d.version !== undefined &&
          expectedVersion !== null
        ) {
          throw new OptimisticLockError(this.d.table, id);
        }
        throw new NotFoundError(this.d.table, id);
      }
    } catch (error) {
      throw mapOracleError(error, this.d.table);
    }
  }

  // --------------------------------------------------------------------------
  // Helpers internos
  // --------------------------------------------------------------------------

  protected selectList(): string {
    return this.d.columns.map((c) => c.db).join(", ");
  }

  protected isAuditColumn(db: string): boolean {
    const a = this.d.audit;
    if (a === undefined) return false;
    return (
      db === a.createdBy ||
      db === a.createdAt ||
      db === a.modifiedBy ||
      db === a.modifiedAt
    );
  }

  /**
   * Orden de la consulta. Sin `sort` valido se usa el orden por defecto del
   * descriptor (lo mas reciente primero para documentos y catalogos). Siempre
   * se agrega la PK como desempate: sin el, filas con el mismo valor cambian de
   * posicion entre paginas y la paginacion repite/omite registros.
   */
  protected buildOrderBy(
    sort: string | undefined,
    order: "asc" | "desc" | undefined,
  ): string {
    const explicito = sort !== undefined && this.d.sortable.includes(sort);
    const prop = explicito ? sort : this.d.defaultSort;
    const dir = (explicito ? (order ?? "asc") : this.d.defaultOrder) === "desc" ? "DESC" : "ASC";
    const col = findColumn(this.d, prop);
    const dbCol = col?.db ?? this.d.pk;
    const desempate = dbCol === this.d.pk ? "" : `, ${this.d.pk} ${dir}`;
    return `ORDER BY ${dbCol} ${dir} NULLS LAST${desempate}`;
  }

  protected buildWhere(
    filters: readonly FilterCondition[],
    search?: string,
  ): {
    clause: string;
    binds: BindMap;
  } {
    const parts: string[] = [`${this.d.softDelete.flag} = 'N'`];
    const binds: BindMap = {};
    let i = 0;

    const busqueda = buildSearchClause(this.d, search);
    if (busqueda !== null) {
      parts.push(busqueda.clause);
      Object.assign(binds, busqueda.binds);
    }

    for (const f of filters) {
      if (!this.d.filterable.includes(f.prop)) continue;
      const col = findColumn(this.d, f.prop);
      if (col === undefined) continue;
      const p = `f${i++}`;

      switch (f.operator) {
        case "isNull":
          parts.push(`${col.db} IS NULL`);
          break;
        case "notNull":
          parts.push(`${col.db} IS NOT NULL`);
          break;
        case "in": {
          const list = Array.isArray(f.value) ? f.value : [];
          if (list.length === 0) {
            parts.push("1 = 0");
            break;
          }
          const names = list.map((val, idx) => {
            const name = `${p}_${idx}`;
            binds[name] = this.scalarBind(col, val);
            return `:${name}`;
          });
          parts.push(`${col.db} IN (${names.join(", ")})`);
          break;
        }
        case "like":
          // `%` y `_` escritos por el usuario son texto, no comodines.
          binds[p] = `%${String(f.value ?? "").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
          parts.push(`UPPER(${col.db}) LIKE UPPER(:${p}) ESCAPE '\\'`);
          break;
        default: {
          const op = SQL_OPERATOR[f.operator] ?? "=";
          binds[p] = this.scalarBind(col, f.value);
          parts.push(`${col.db} ${op} :${p}`);
        }
      }
    }

    return { clause: `WHERE ${parts.join(" AND ")}`, binds };
  }

  protected scalarBind(
    col: ColumnDescriptor,
    value: unknown,
  ): unknown {
    if (value === null || value === undefined) return null;
    if (col.type === "boolLike" && typeof value === "boolean") {
      return value ? (col.boolTrue ?? "S") : (col.boolFalse ?? "N");
    }
    if ((col.type === "date" || col.type === "timestamp") && typeof value === "string") {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? value : dt;
    }
    return value as string | number | boolean;
  }

  protected toBind(col: ColumnDescriptor, value: unknown): unknown {
    if (value === null || value === undefined) return null;
    switch (col.type) {
      case "boolLike":
        if (typeof value === "boolean") {
          return value ? (col.boolTrue ?? "S") : (col.boolFalse ?? "N");
        }
        return value;
      case "number":
        return typeof value === "string" ? Number(value) : value;
      case "date":
      case "timestamp": {
        if (value instanceof Date) return value;
        const dt = new Date(String(value));
        if (Number.isNaN(dt.getTime())) {
          throw new ValidationError(`Fecha inválida en ${col.prop}`);
        }
        return dt;
      }
      default:
        return value;
    }
  }

  protected mapRow(row: Record<string, unknown>): TEntity {
    const out: Record<string, unknown> = {};
    for (const col of this.d.columns) {
      const raw = row[col.db];
      out[col.prop] = this.fromDb(col, raw);
    }
    return out as TEntity;
  }

  protected fromDb(col: ColumnDescriptor, raw: unknown): unknown {
    if (raw === null || raw === undefined) return null;
    switch (col.type) {
      case "boolLike":
        return raw === (col.boolTrue ?? "S");
      case "number":
        return typeof raw === "number" ? raw : Number(raw);
      case "date":
      case "timestamp":
        return raw instanceof Date ? raw.toISOString() : String(raw);
      default:
        return typeof raw === "string" ? raw : String(raw);
    }
  }
}

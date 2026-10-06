/**
 * Capa 5 - Entidades (transversal).
 * Azucar para declarar descriptores sin repetir el triplete de soft-delete y las
 * columnas de auditoria. Usado por entities/com/descriptors.ts.
 */

import type {
  ColumnDescriptor,
  ColumnType,
  EntityDescriptor,
  SearchDescriptor,
} from "./EntityDescriptor.js";
import { DDL_LIMITES } from "./ddlLimits.generated.js";

interface ColOpts {
  readonly insertable?: boolean;
  readonly updatable?: boolean;
  readonly nullable?: boolean;
  readonly enumValues?: readonly string[];
  readonly boolTrue?: string;
  readonly boolFalse?: string;
}

/** Declara una columna de negocio (camelCase inferido del nombre Oracle). */
export function col(
  db: string,
  prop: string,
  type: ColumnType,
  opts: ColOpts = {},
): ColumnDescriptor {
  const base: ColumnDescriptor = {
    db,
    prop,
    type,
    insertable: opts.insertable ?? true,
    updatable: opts.updatable ?? true,
    nullable: opts.nullable ?? false,
  };
  const extra: {
    enumValues?: readonly string[];
    boolTrue?: string;
    boolFalse?: string;
  } = {};
  if (opts.enumValues !== undefined) extra.enumValues = opts.enumValues;
  if (type === "boolLike") {
    extra.boolTrue = opts.boolTrue ?? "S";
    extra.boolFalse = opts.boolFalse ?? "N";
  }
  return { ...base, ...extra };
}

/** PK identity: no insertable ni updatable. */
export function pkCol(db: string, prop: string): ColumnDescriptor {
  return { db, prop, type: "number", insertable: false, updatable: false, nullable: false };
}

/** Columna VIRTUAL / GENERATED: solo lectura. */
export function virtualCol(db: string, prop: string, type: ColumnType = "number"): ColumnDescriptor {
  return { db, prop, type, insertable: false, updatable: false, nullable: true };
}

/** Triplete de soft-delete comun a las 26 tablas COM_. */
export const SOFT_DELETE_COLUMNS: readonly ColumnDescriptor[] = [
  { db: "ELIMINADO", prop: "eliminado", type: "boolLike", insertable: false, updatable: false, nullable: false, boolTrue: "S", boolFalse: "N" },
  { db: "FECHA_ELIMINACION", prop: "fechaEliminacion", type: "timestamp", insertable: false, updatable: false, nullable: true },
  { db: "ELIMINADO_POR", prop: "eliminadoPor", type: "number", insertable: false, updatable: false, nullable: true },
];

/** Columnas de auditoria (cuando la tabla las trae explicitas). */
const CREATED_AUDIT_COLUMNS: readonly ColumnDescriptor[] = [
  { db: "FECHA_CREACION", prop: "fechaCreacion", type: "timestamp", insertable: false, updatable: false, nullable: false },
  { db: "CREADO_POR", prop: "creadoPor", type: "number", insertable: false, updatable: false, nullable: true },
];

const MODIFIED_AUDIT_COLUMNS: readonly ColumnDescriptor[] = [
  { db: "FECHA_MODIFICACION", prop: "fechaModificacion", type: "timestamp", insertable: false, updatable: false, nullable: true },
  { db: "MODIFICADO_POR", prop: "modificadoPor", type: "number", insertable: false, updatable: false, nullable: true },
];

/** "full" = create + modify columns; "createOnly" = solo FECHA_CREACION/CREADO_POR. */
export type AuditMode = "none" | "full" | "createOnly";

export const VERSION_COLUMN: ColumnDescriptor = {
  db: "VERSION",
  prop: "version",
  type: "number",
  insertable: false,
  updatable: false,
  nullable: false,
};

interface BuildOpts {
  readonly key: string;
  readonly table: string;
  readonly pk: string;
  readonly business: readonly ColumnDescriptor[];
  readonly withVersion?: boolean;
  readonly audit?: AuditMode;
  /** Orden cuando el cliente no pide uno. Solo aplica si `recientesPrimero === false`. */
  readonly defaultSort: string;
  /**
   * `true` (por defecto): sin orden explicito se lista lo MAS RECIENTE primero
   * (`pk desc`). `false` para lineas de detalle, que conservan `defaultSort asc`.
   */
  readonly recientesPrimero?: boolean;
  readonly filterable: readonly string[];
  readonly sortable: readonly string[];
  readonly detail?: EntityDescriptor["detail"];
  readonly search?: SearchDescriptor;
}

/** Aplica a cada columna los limites del DDL (longitud, precision, CHECK). */
function conLimitesDdl(table: string, columns: readonly ColumnDescriptor[]): ColumnDescriptor[] {
  const lim = DDL_LIMITES[table];
  if (lim === undefined) return [...columns];
  return columns.map((c) => {
    const l = lim[c.db];
    if (l === undefined) return c;
    return {
      ...c,
      ...(l.l !== undefined ? { maxLength: l.l } : {}),
      ...(l.p !== undefined ? { precision: l.p, scale: l.s ?? 0 } : {}),
      ...(l.min !== undefined ? { min: l.min } : {}),
      ...(l.minExcl === true ? { minExclusive: true } : {}),
      ...(l.max !== undefined ? { max: l.max } : {}),
    };
  });
}

/** Ensambla el EntityDescriptor final agregando columnas transversales. */
export function buildDescriptor(o: BuildOpts): EntityDescriptor {
  const auditMode: AuditMode = o.audit ?? "none";
  const columns: ColumnDescriptor[] = [pkCol(o.pk, camelPk(o.pk)), ...o.business];
  if (o.withVersion) columns.push(VERSION_COLUMN);
  if (auditMode === "full") {
    columns.push(...CREATED_AUDIT_COLUMNS, ...MODIFIED_AUDIT_COLUMNS);
  } else if (auditMode === "createOnly") {
    columns.push(...CREATED_AUDIT_COLUMNS);
  }
  columns.push(...SOFT_DELETE_COLUMNS);

  const recientes = o.recientesPrimero ?? true;
  const descriptor: EntityDescriptor = {
    key: o.key,
    table: o.table,
    pk: o.pk,
    columns: conLimitesDdl(o.table, columns),
    softDelete: { flag: "ELIMINADO", date: "FECHA_ELIMINACION", user: "ELIMINADO_POR" },
    defaultSort: recientes ? camelPk(o.pk) : o.defaultSort,
    defaultOrder: recientes ? "desc" : "asc",
    filterable: o.filterable,
    sortable: o.sortable,
  };
  const withExtras = descriptor as {
    -readonly [K in keyof EntityDescriptor]: EntityDescriptor[K];
  };
  if (o.withVersion) withExtras.version = "VERSION";
  if (auditMode === "full") {
    withExtras.audit = {
      createdBy: "CREADO_POR",
      createdAt: "FECHA_CREACION",
      modifiedBy: "MODIFICADO_POR",
      modifiedAt: "FECHA_MODIFICACION",
    };
  } else if (auditMode === "createOnly") {
    withExtras.audit = { createdBy: "CREADO_POR", createdAt: "FECHA_CREACION" };
  }
  if (o.detail !== undefined) withExtras.detail = o.detail;
  if (o.search !== undefined) withExtras.search = o.search;
  return descriptor;
}

function camelPk(pk: string): string {
  return pk
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

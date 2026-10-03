/**
 * Capa 5 - Entidades (transversal).
 * Metadatos declarativos de una tabla: unica fuente de verdad que alimenta las
 * clases base genericas de las capas 2, 3 y 4. Estructura pura, sin frameworks.
 */

export type ColumnType =
  | "string"
  | "number"
  | "date"
  | "timestamp"
  | "boolLike"
  | "enum";

export interface ColumnDescriptor {
  /** Nombre de columna en Oracle (UPPER_SNAKE_CASE). */
  readonly db: string;
  /** Nombre de propiedad en la entidad/DTO (camelCase). */
  readonly prop: string;
  readonly type: ColumnType;
  /** Se incluye en INSERT. false para IDENTITY, VIRTUAL y columnas de sistema. */
  readonly insertable: boolean;
  /** Se incluye en UPDATE. false para IDENTITY, VIRTUAL, FECHA_CREACION, CREADO_POR. */
  readonly updatable: boolean;
  readonly nullable: boolean;
  /** Valores permitidos, para type === "enum" (de los CHECK ... IN (...)). */
  readonly enumValues?: readonly string[];
  /** Representacion de verdadero, para type === "boolLike" (normalmente "S"). */
  readonly boolTrue?: string;
  /** Representacion de falso, para type === "boolLike" (normalmente "N"). */
  readonly boolFalse?: string;
}

export interface SoftDeleteDescriptor {
  readonly flag: string;
  readonly date: string;
  readonly user: string;
}

export interface AuditDescriptor {
  readonly createdBy?: string;
  readonly createdAt?: string;
  readonly modifiedBy?: string;
  readonly modifiedAt?: string;
}

export interface DetailRelationDescriptor {
  /** Clave del descriptor del detalle en el registro de descriptores. */
  readonly entityKey: string;
  /** Columna FK del detalle que apunta a la PK de la cabecera. */
  readonly fk: string;
}

export interface EntityDescriptor {
  /** Clave logica (ej. "proveedor"), usada en el RepositoryFactory y rutas. */
  readonly key: string;
  /** Nombre de tabla en Oracle. */
  readonly table: string;
  /** Nombre de columna PK (identity). */
  readonly pk: string;
  readonly columns: readonly ColumnDescriptor[];
  readonly softDelete: SoftDeleteDescriptor;
  /** Nombre de columna VERSION si la tabla usa bloqueo optimista; si no, undefined. */
  readonly version?: string;
  readonly audit?: AuditDescriptor;
  /** Propiedad de orden por defecto (camelCase). */
  readonly defaultSort: string;
  /** Propiedades permitidas en filtros WHERE (whitelist anti-inyeccion). */
  readonly filterable: readonly string[];
  /** Propiedades permitidas en ORDER BY (whitelist anti-inyeccion). */
  readonly sortable: readonly string[];
  /** Relacion cabecera -> detalle, si aplica. */
  readonly detail?: DetailRelationDescriptor;
}

export function findColumn(
  descriptor: EntityDescriptor,
  prop: string,
): ColumnDescriptor | undefined {
  return descriptor.columns.find((c) => c.prop === prop);
}

export function columnByDb(
  descriptor: EntityDescriptor,
  db: string,
): ColumnDescriptor | undefined {
  return descriptor.columns.find((c) => c.db === db);
}

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
  /*
   * Limites tomados del DDL canonico (ver `ddlLimits.generated.ts`). Los aplica
   * `validateAgainstDescriptor` para rechazar con un mensaje claro lo que
   * Oracle rechazaria con un ORA-12899 / ORA-01438 / ORA-02290.
   */
  /** Longitud maxima de texto (VARCHAR2/CHAR). */
  readonly maxLength?: number;
  /** Precision y escala de NUMBER(p,s): el valor debe caber en p-s enteros y s decimales. */
  readonly precision?: number;
  readonly scale?: number;
  /** Rango permitido por CHECK. `minExclusive`: el minimo no es valido (CHECK (X > n)). */
  readonly min?: number;
  readonly minExclusive?: boolean;
  readonly max?: number;
}

/**
 * Busqueda por relacion: el texto buscado se compara contra columnas de OTRA
 * tabla relacionada (proveedor de una OC, lineas de una solicitud, ...).
 * Se traduce a `own IN (SELECT key FROM table WHERE ...)` con bind variables.
 * Todos los identificadores son de codigo (descriptor), nunca del usuario.
 */
export interface SearchRef {
  /** Columna Oracle de ESTA tabla que se enlaza (FK, o la PK para relaciones 1:N). */
  readonly own: string;
  /** Tabla relacionada. */
  readonly table: string;
  /** Columna de `table` que se compara con `own`. */
  readonly key: string;
  /** Expresiones de texto de `table` donde buscar (p. ej. `NOMBRES || ' ' || APELLIDOS`). */
  readonly columns?: readonly string[];
  /** Salto adicional: la relacion continua hacia otra tabla (OC -> proveedor). */
  readonly via?: SearchRef;
}

export interface SearchDescriptor {
  /** Relaciones por las que tambien se busca. */
  readonly refs?: readonly SearchRef[];
  /** Propiedades de TEXTO que no deben buscarse (campos tecnicos). */
  readonly exclude?: readonly string[];
  /** FK (props) que representan OTRO documento: un token numerico o `SOL-12` las compara por id exacto. */
  readonly idColumns?: readonly string[];
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
  /**
   * Sentido del orden por defecto, cuando el cliente no pide uno. Documentos y
   * catalogos listan lo MAS RECIENTE primero (`pk desc`); las lineas de detalle
   * conservan su orden natural (`asc`).
   */
  readonly defaultOrder: "asc" | "desc";
  /** Configuracion del buscador global (`?q=`). */
  readonly search?: SearchDescriptor;
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

/**
 * Columna de infraestructura (PK, version, soft-delete, auditoria): no la
 * escribe el cliente ni tiene sentido buscarla o validarla como dato de negocio.
 */
export function isSystemColumn(d: EntityDescriptor, col: ColumnDescriptor): boolean {
  if (col.db === d.pk) return true;
  if (d.version !== undefined && col.db === d.version) return true;
  if (
    col.db === d.softDelete.flag ||
    col.db === d.softDelete.date ||
    col.db === d.softDelete.user
  ) {
    return true;
  }
  const a = d.audit;
  if (
    a !== undefined &&
    (col.db === a.createdAt ||
      col.db === a.createdBy ||
      col.db === a.modifiedAt ||
      col.db === a.modifiedBy)
  ) {
    return true;
  }
  return false;
}

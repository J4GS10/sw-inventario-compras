/**
 * Capa 6 - Componentes Comunes.
 * Tipos genericos de consulta/paginacion reutilizables por cualquier modulo.
 */

export type SortOrder = "asc" | "desc";

/** Operadores de filtro soportados por el constructor de WHERE de la DAL. */
export type FilterOperator =
  | "eq"
  | "ne"
  | "like"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "isNull"
  | "notNull";

export interface FilterCondition {
  readonly prop: string;
  readonly operator: FilterOperator;
  readonly value?: string | number | boolean | ReadonlyArray<string | number>;
}

export interface PageQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: string;
  readonly order?: SortOrder;
  readonly filters?: readonly FilterCondition[];
  /** Busqueda global (`?q=`): texto libre, cada palabra debe aparecer en algun campo del registro. */
  readonly search?: string;
}

export interface Paginated<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;
/** Longitud maxima del texto de busqueda; mas largo se recorta (anti-abuso). */
export const MAX_SEARCH_LENGTH = 100;

export function normalizePageQuery(input: Partial<PageQuery> | undefined): PageQuery {
  // `?page=abc` llega como NaN: sin este saneo el OFFSET invalido terminaba en un ORA-... / 500.
  const finito = (n: number | undefined, por: number): number =>
    n !== undefined && Number.isFinite(n) ? Math.trunc(n) : por;
  const page = Math.max(1, finito(input?.page, 1));
  const rawSize = finito(input?.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  const query: {
    page: number;
    pageSize: number;
    order: SortOrder;
    filters: readonly FilterCondition[];
    sort?: string;
    search?: string;
  } = {
    page,
    pageSize,
    order: input?.order === "desc" ? "desc" : "asc",
    filters: input?.filters ?? [],
  };
  if (input?.sort !== undefined) query.sort = input.sort;
  const search = input?.search?.trim().slice(0, MAX_SEARCH_LENGTH);
  if (search !== undefined && search !== "") query.search = search;
  return query;
}

export function buildPaginated<T>(
  data: readonly T[],
  total: number,
  query: PageQuery,
): Paginated<T> {
  return {
    data,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: query.pageSize > 0 ? Math.ceil(total / query.pageSize) : 0,
  };
}

/**
 * Capa 4 - Presentacion / soporte.
 * Traduce la query string de un GET de listado al PageQuery de la Capa 6.
 *
 * Formatos aceptados:
 *   ?page=1&pageSize=20&sort=razonSocial&order=asc
 *   ?q=martillo                   -> busqueda global (ver SearchDescriptor)
 *   ?estado=A                     -> filtro eq sobre "estado"
 *   ?razonSocial__like=acme       -> filtro like
 *   ?prioridad__gte=3             -> operadores: eq ne like gt gte lt lte in isNull notNull
 *   ?estado__in=A,I               -> lista separada por comas
 */

import {
  normalizePageQuery,
  type FilterCondition,
  type FilterOperator,
  type PageQuery,
} from "../../common/types/Query.js";

const RESERVED = new Set(["page", "pageSize", "sort", "order", "q"]);
const OPERATORS = new Set<FilterOperator>([
  "eq",
  "ne",
  "like",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "isNull",
  "notNull",
]);

type RawQuery = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseListQuery(raw: RawQuery): PageQuery {
  const page = Number.parseInt(first(raw["page"]) ?? "1", 10);
  const pageSize = Number.parseInt(first(raw["pageSize"]) ?? "20", 10);
  const sort = first(raw["sort"]);
  const orderRaw = first(raw["order"]);
  const search = first(raw["q"]);
  const order = orderRaw === "desc" ? "desc" : "asc";

  const filters: FilterCondition[] = [];
  for (const [key, rawValue] of Object.entries(raw)) {
    if (RESERVED.has(key)) continue;
    const value = first(rawValue);
    if (value === undefined) continue;

    const [prop, opToken] = key.split("__", 2);
    if (prop === undefined || prop === "") continue;
    const operator: FilterOperator =
      opToken !== undefined && OPERATORS.has(opToken as FilterOperator)
        ? (opToken as FilterOperator)
        : "eq";

    if (operator === "isNull" || operator === "notNull") {
      filters.push({ prop, operator });
    } else if (operator === "in") {
      filters.push({ prop, operator, value: value.split(",") });
    } else {
      filters.push({ prop, operator, value });
    }
  }

  const normalized: {
    page: number;
    pageSize: number;
    order: "asc" | "desc";
    filters: FilterCondition[];
    sort?: string;
    search?: string;
  } = { page, pageSize, order, filters };
  if (sort !== undefined) normalized.sort = sort;
  if (search !== undefined) normalized.search = search;
  return normalizePageQuery(normalized);
}

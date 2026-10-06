/**
 * Capa 2 - Acceso a Datos.
 * Traduce el texto del buscador global (`?q=`) a una clausula WHERE con bind
 * variables, a partir del EntityDescriptor. Funcion pura: sin conexion, para
 * poder probarla sin Oracle.
 *
 * Semantica (la que el usuario espera de un buscador):
 *  - El texto se parte en PALABRAS; el registro debe contener TODAS (AND).
 *  - Cada palabra puede aparecer en CUALQUIER campo de texto del registro, en
 *    una fecha (`2026-10`, `05/10/2026`), en una entidad relacionada (el
 *    proveedor de una orden, las lineas de una solicitud) o ser su numero de
 *    documento (`12`, `OC-12`).
 *  - Sin distinguir mayusculas ni acentos ("camion" encuentra "Camión").
 *  - `%` y `_` del usuario son texto literal, no comodines.
 *
 * Seguridad: los VALORES viajan como binds; los identificadores (tablas,
 * columnas) salen del descriptor, nunca del input.
 */

import {
  isSystemColumn,
  type ColumnDescriptor,
  type EntityDescriptor,
  type SearchRef,
} from "../../entities/support/EntityDescriptor.js";

export interface SearchClause {
  readonly clause: string;
  readonly binds: Record<string, unknown>;
}

const MAX_TOKENS = 6;
const ESCAPE = "ESCAPE '\\'";
/** Prefijos con los que la UI muestra el numero de cada documento. */
const DOC_PREFIX_RE = /^(?:SOL|RFQ|COT|OC|REC|DEV)-?(\d{1,12})$/;

/** Expresion Oracle que deja un texto en MAYUSCULAS sin acentos (espejo de `normalizar`). */
function norm(expr: string): string {
  return `TRANSLATE(UPPER(${expr}), 'ÁÉÍÓÚÜÑ', 'AEIOUUN')`;
}

/** MAYUSCULAS, sin acentos, sin espacios sobrantes (espejo de `norm` en SQL). */
export function normalizar(texto: string): string {
  // NFD separa la letra de su acento; el rango U+0300..U+036F son esas marcas combinantes.
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escaparLike(token: string): string {
  return token.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Palabras del texto buscado, normalizadas y sin repetidos. */
export function tokenizar(texto: string): string[] {
  const vistos = new Set<string>();
  for (const t of normalizar(texto).split(/\s+/)) {
    if (t !== "") vistos.add(t);
    if (vistos.size >= MAX_TOKENS) break;
  }
  return [...vistos];
}

function esColumnaTexto(c: ColumnDescriptor): boolean {
  return c.type === "string" || c.type === "enum";
}

function esColumnaFecha(c: ColumnDescriptor): boolean {
  return c.type === "date" || c.type === "timestamp";
}

/**
 * Atajo de etiqueta para banderas: "activo/activa/inactivo" no existen en la
 * BD (guarda 'A'/'I' o 'S'/'N'), pero asi las ve el usuario.
 */
function condicionEtiquetaActivo(c: ColumnDescriptor, token: string): string | null {
  if (token.length < 3) return null;
  let verdadero: string | undefined;
  let falso: string | undefined;
  if (c.type === "enum" && c.enumValues?.length === 2 && c.enumValues.includes("A") && c.enumValues.includes("I")) {
    verdadero = "A";
    falso = "I";
  } else if (c.type === "boolLike" && /^activ[oa]$/i.test(c.prop)) {
    verdadero = c.boolTrue ?? "S";
    falso = c.boolFalse ?? "N";
  }
  if (verdadero === undefined || falso === undefined) return null;
  if (/^INACTIV/.test(token) || "INACTIVO".startsWith(token) || "INACTIVA".startsWith(token)) {
    return `${c.db} = '${falso}'`;
  }
  if ("ACTIVO".startsWith(token) || "ACTIVA".startsWith(token)) return `${c.db} = '${verdadero}'`;
  return null;
}

function condicionRef(ref: SearchRef, like: string): string {
  const partes: string[] = (ref.columns ?? []).map((c) => `${norm(c)} LIKE ${like} ${ESCAPE}`);
  if (ref.via !== undefined) partes.push(condicionRef(ref.via, like));
  if (partes.length === 0) return "1 = 0";
  return `${ref.own} IN (SELECT ${ref.key} FROM ${ref.table} WHERE ELIMINADO = 'N' AND (${partes.join(" OR ")}))`;
}

/**
 * Construye `( (token1 en algun campo) AND (token2 en algun campo) ... )`.
 * Devuelve `null` si no hay texto util o el descriptor no tiene donde buscar.
 */
export function buildSearchClause(
  d: EntityDescriptor,
  texto: string | undefined,
  prefix = "q",
): SearchClause | null {
  if (texto === undefined) return null;
  const tokens = tokenizar(texto);
  if (tokens.length === 0) return null;

  const excluidas = new Set(d.search?.exclude ?? []);
  const negocio = d.columns.filter((c) => !isSystemColumn(d, c) && !excluidas.has(c.prop));
  const textuales = negocio.filter(esColumnaTexto);
  const fechas = negocio.filter(esColumnaFecha);
  const idCols = (d.search?.idColumns ?? [])
    .map((prop) => d.columns.find((c) => c.prop === prop))
    .filter((c): c is ColumnDescriptor => c !== undefined);

  const binds: Record<string, unknown> = {};
  const porToken: string[] = [];

  tokens.forEach((token, i) => {
    const like = `:${prefix}${i}`;
    binds[`${prefix}${i}`] = `%${escaparLike(token)}%`;
    const opciones: string[] = [];

    for (const c of textuales) opciones.push(`${norm(c.db)} LIKE ${like} ${ESCAPE}`);

    if (/\d/.test(token)) {
      for (const c of fechas) {
        opciones.push(`TO_CHAR(${c.db}, 'YYYY-MM-DD') LIKE ${like} ${ESCAPE}`);
        opciones.push(`TO_CHAR(${c.db}, 'DD/MM/YYYY') LIKE ${like} ${ESCAPE}`);
      }
    }

    for (const c of negocio) {
      const etiqueta = condicionEtiquetaActivo(c, token);
      if (etiqueta !== null) opciones.push(etiqueta);
    }

    // Numero de documento: "12", "OC-12". Compara por id exacto (no por LIKE: el
    // 1 no debe traer los documentos 10..19).
    const doc = DOC_PREFIX_RE.exec(token);
    const digitos = doc?.[1] ?? (/^\d{1,12}$/.test(token) ? token : undefined);
    if (digitos !== undefined) {
      binds[`${prefix}${i}id`] = Number(digitos);
      opciones.push(`${d.pk} = :${prefix}${i}id`);
      for (const c of idCols) opciones.push(`${c.db} = :${prefix}${i}id`);
    }

    for (const ref of d.search?.refs ?? []) opciones.push(condicionRef(ref, like));

    porToken.push(opciones.length === 0 ? "1 = 0" : `(${opciones.join(" OR ")})`);
  });

  return { clause: `(${porToken.join(" AND ")})`, binds };
}

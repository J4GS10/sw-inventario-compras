/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Busqueda en memoria para tablas que ya tienen TODAS sus filas cargadas
 * (reportes, cuentas por pagar). Mismas reglas que el buscador del servidor
 * (`?q=`): cada palabra debe aparecer en algun campo, sin distinguir mayusculas
 * ni acentos.
 */

/** MAYUSCULAS sin acentos ni espacios repetidos. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** true si TODAS las palabras de `consulta` aparecen en `textoFila` (ya normalizado o no). */
export function coincide(textoFila: string, consulta: string): boolean {
  const q = normalizarTexto(consulta);
  if (q === "") return true;
  const haystack = normalizarTexto(textoFila);
  return q.split(" ").every((palabra) => haystack.includes(palabra));
}

/** Texto buscable de una fila: todos sus valores primitivos concatenados. */
export function textoDeFila(fila: unknown): string {
  if (fila === null || typeof fila !== "object") return String(fila ?? "");
  const partes: string[] = [];
  for (const v of Object.values(fila as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue;
    partes.push(String(v));
  }
  return partes.join(" ");
}

export function filtrarFilas<T>(
  filas: readonly T[],
  consulta: string,
  textoDe: (fila: T) => string = textoDeFila,
): readonly T[] {
  if (consulta.trim() === "") return filas;
  return filas.filter((f) => coincide(textoDe(f), consulta));
}

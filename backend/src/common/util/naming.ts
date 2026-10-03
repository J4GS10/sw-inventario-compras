/**
 * Capa 6 - Componentes Comunes.
 * Utilidades de conversion de nombres entre columnas Oracle (UPPER_SNAKE_CASE)
 * y propiedades TypeScript (camelCase). Sin dependencia del negocio.
 */

export function snakeToCamel(input: string): string {
  return input
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_match, chr: string) => chr.toUpperCase());
}

export function camelToSnakeUpper(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
}

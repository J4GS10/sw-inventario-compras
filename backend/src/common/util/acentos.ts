/**
 * Capa 6 - Componentes Comunes.
 * Ortografia de textos DERIVADOS de nombres de campo (que van sin tilde en codigo):
 * "descripcion no puede estar vacio" -> "descripción no puede estar vacío".
 */

import { ACENTOS } from "./acentos.generated.js";

/** Acentua cada palabra conocida (sin ambiguedad) de un texto en minusculas/capitalizado. */
export function acentuar(texto: string): string {
  return texto.replace(/[A-Za-z]+/g, (w) => {
    const bueno = ACENTOS[w.toLowerCase()];
    if (bueno === undefined || (w.length > 1 && w === w.toUpperCase())) return w;
    return w[0] === w[0]!.toUpperCase() ? bueno[0]!.toUpperCase() + bueno.slice(1) : bueno;
  });
}

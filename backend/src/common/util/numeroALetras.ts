/**
 * Capa 6 - Componentes Comunes.
 * Importe en letras en español ("QUINCE MIL OCHOCIENTOS CINCUENTA Y TRES
 * QUETZALES CON 25/100"), como se imprime al pie de una orden de compra o
 * factura. Hasta 999,999,999,999.99. Sin dependencia del negocio.
 */

const UNIDADES = [
  "", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE",
  "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
  "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE",
  "VEINTIOCHO", "VEINTINUEVE",
];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS",
  "OCHOCIENTOS", "NOVECIENTOS",
];

/** 0..999 */
function centenas(n: number, apocopar: boolean): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]!);
  if (r > 0) {
    if (r < 30) {
      let t = UNIDADES[r]!;
      if (apocopar && (r === 1 || r === 21)) t = t.replace(/UNO$/, "UN").replace(/^VEINTIUN$/, "VEINTIÚN");
      partes.push(t);
    } else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      let t = DECENAS[d]!;
      if (u > 0) t += ` Y ${apocopar && u === 1 ? "UN" : UNIDADES[u]!}`;
      partes.push(t);
    }
  }
  return partes.join(" ");
}

/** Entero >= 0 en letras. `apocopar`: "UN" antes de un sustantivo masculino (UN QUETZAL). */
export function enteroALetras(n: number, apocopar = true): string {
  if (!Number.isFinite(n) || n < 0 || n > 999_999_999_999) throw new RangeError("Fuera de rango");
  n = Math.floor(n);
  if (n === 0) return "CERO";
  const millardos = Math.floor(n / 1_000_000_000);
  const millones = Math.floor((n % 1_000_000_000) / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const out: string[] = [];
  if (millardos > 0) out.push(millardos === 1 ? "MIL" : `${centenas(millardos, false)} MIL`);
  if (millones > 0) {
    // "MIL MILLONES" cuando hay millardos y 0 millones exactos
    out.push(millones === 1 && millardos === 0 ? "UN MILLÓN" : `${centenas(millones, true)} MILLONES`);
  } else if (millardos > 0) {
    out[out.length - 1] = `${out[out.length - 1]} MILLONES`;
  }
  if (miles > 0) out.push(miles === 1 ? "MIL" : `${centenas(miles, true)} MIL`);
  if (resto > 0) out.push(centenas(resto, apocopar));
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/** "TRES MIL QUINIENTOS QUETZALES CON 50/100". */
export function importeALetras(monto: number, plural: string, singular: string): string {
  const centavosTotal = Math.round(Math.abs(monto) * 100);
  const entero = Math.floor(centavosTotal / 100);
  const cent = centavosTotal % 100;
  const nombre = entero === 1 ? singular : plural;
  const complemento = entero >= 1_000_000 && entero % 1_000_000 === 0 ? " DE" : "";
  return `${enteroALetras(entero)}${complemento} ${nombre} CON ${String(cent).padStart(2, "0")}/100`;
}

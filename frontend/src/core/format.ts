/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Formateo regional unico de la suite. skills/patron-diseno.md §7 "Moneda":
 * los valores monetarios usan el formato regional de Guatemala (GTQ).
 */

const MONEY = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 2,
});

const QTY = new Intl.NumberFormat("es-GT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

const PERCENT = new Intl.NumberFormat("es-GT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Moneda GTQ: "Q 1,234.50". Devuelve "—" si el valor no es numerico. */
export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? MONEY.format(n) : "—";
}

/** Cantidad (hasta 4 decimales, sin ceros de relleno). */
export function formatQty(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? QTY.format(n) : "—";
}

/** Porcentaje ya expresado en unidades (12.5 -> "12.5 %"). */
export function formatPercent(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n)
    ? `${PERCENT.format(n)} %`
    : "—";
}

const RATE = new Intl.NumberFormat("es-GT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/** Tasa de cambio: "× 1.00", "× 7.85" — se lee como factor, no como id. */
export function formatRate(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? `× ${RATE.format(n)}` : "—";
}

/* ---- Fechas -------------------------------------------------------------
 * El backend entrega dos clases de valor:
 *  - DATE / dia tecleado: medianoche UTC ("2026-10-19T00:00:00.000Z") = un DIA
 *    de calendario. Se muestra tal cual; convertirlo a la zona del navegador lo
 *    correria al dia anterior en Guatemala (UTC-6).
 *  - TIMESTAMP (emision, recepcion...): un INSTANTE real. Se muestra en la hora
 *    LOCAL del usuario (antes se cortaba el texto ISO y se veia la hora UTC:
 *    un registro de las 16:26 aparecia como 22:26).
 */
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const MEDIANOCHE_UTC = /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0+)?Z$/;

/** "2026-10-05" — un dia de calendario. "—" si no es una fecha. */
export function formatDia(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const t = String(value);
  if (SOLO_DIA.test(t) || MEDIANOCHE_UTC.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-CA");
}

/** "2026-10-05 16:26" en la hora local del usuario. "—" si no es una fecha. */
export function formatFechaHora(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const t = String(value);
  if (SOLO_DIA.test(t) || MEDIANOCHE_UTC.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "—";
  const hora = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d.toLocaleDateString("en-CA")} ${hora}`;
}

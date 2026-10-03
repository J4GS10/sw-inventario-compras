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

/**
 * Capa 6 - Componentes Comunes.
 * Aritmetica de fechas de CALENDARIO (sin hora) en la zona horaria del negocio.
 *
 * Por que existe: `new Date().toISOString().slice(0, 10)` devuelve el dia en UTC.
 * En Guatemala (UTC-6) eso es "manana" desde las 18:00 locales, asi que una
 * regla "no menor a hoy" rechazaria o aceptaria fechas equivocadas segun la
 * hora. Toda comparacion de reglas de negocio pasa por aqui.
 *
 * Un "dia" es siempre un string `YYYY-MM-DD`; comparar dos dias es comparar
 * strings (orden lexicografico == orden cronologico). Sin dependencia del negocio.
 */

/** Zona horaria del negocio. Configurable por `APP_TIMEZONE`; por defecto Guatemala. */
export function zonaHorariaNegocio(): string {
  const tz = process.env["APP_TIMEZONE"]?.trim();
  return tz !== undefined && tz !== "" ? tz : "America/Guatemala";
}

const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** true si `YYYY-MM-DD` es un dia real del calendario (rechaza 2026-02-30). */
export function esDiaValido(dia: string): boolean {
  const m = DIA_RE.exec(dia);
  if (m === null) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const ultimo = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= ultimo;
}

function diaEnZona(fecha: Date, tz: string): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/** El dia de hoy (zona del negocio). `ahora` es inyectable para pruebas. */
export function hoy(ahora: Date = new Date()): string {
  return diaEnZona(ahora, zonaHorariaNegocio());
}

/**
 * Normaliza un valor de fecha a su dia de calendario `YYYY-MM-DD`.
 *  - "2026-10-05"                 -> tal cual (si es un dia real)
 *  - "2026-10-05T03:00:00.000Z"   -> el dia local del negocio de ese instante
 *  - Date                         -> idem
 * Devuelve `null` si no es una fecha valida.
 */
export function aDia(valor: unknown): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    // Misma regla que para el ISO: medianoche UTC exacta = dia de calendario.
    if (valor.getTime() % 86_400_000 === 0) return valor.toISOString().slice(0, 10);
    return diaEnZona(valor, zonaHorariaNegocio());
  }
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  if (t === "") return null;
  if (DIA_RE.test(t)) return esDiaValido(t) ? t : null;
  // Solo se aceptan ISO-8601 con fecha completa; evita que `new Date("5")` o
  // "foo 12" se interpreten como fechas.
  if (!/^\d{4}-\d{2}-\d{2}[T ]/.test(t)) return null;
  if (!esDiaValido(t.slice(0, 10))) return null;
  // Columnas DATE (y fechas tecleadas sin hora) viajan como medianoche UTC
  // ("2026-10-19T00:00:00.000Z"): son un dia de calendario, no un instante.
  // Convertirlas a la zona del negocio las corria al dia anterior.
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0+)?Z$/.test(t)) return t.slice(0, 10);
  const parsed = new Date(t);
  return Number.isNaN(parsed.getTime()) ? null : diaEnZona(parsed, zonaHorariaNegocio());
}

/** Suma `n` dias (puede ser negativo) a un dia `YYYY-MM-DD`. */
export function sumarDias(dia: string, n: number): string {
  const m = DIA_RE.exec(dia);
  if (m === null) throw new Error(`Día inválido: ${dia}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return d.toISOString().slice(0, 10);
}

/** Diferencia en dias `b - a` entre dos dias de calendario. */
export function diferenciaDias(a: string, b: string): number {
  const pa = DIA_RE.exec(a);
  const pb = DIA_RE.exec(b);
  if (pa === null || pb === null) throw new Error(`Dia invalido: ${a} / ${b}`);
  const ta = Date.UTC(Number(pa[1]), Number(pa[2]) - 1, Number(pa[3]));
  const tb = Date.UTC(Number(pb[1]), Number(pb[2]) - 1, Number(pb[3]));
  return Math.round((tb - ta) / 86_400_000);
}

/** Formato legible `05/10/2026` para mensajes de error al usuario. */
export function formatoDia(dia: string): string {
  const m = DIA_RE.exec(dia);
  return m === null ? dia : `${m[3]}/${m[2]}/${m[1]}`;
}

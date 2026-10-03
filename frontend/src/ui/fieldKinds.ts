/**
 * Catalogo de "tipos de campo" de formulario. Cada tipo define el control
 * adecuado, su ANCHO acorde al dato (una fecha no ocupa lo mismo que una razon
 * social; un NIT no ocupa lo mismo que un codigo), atributos de entrada y una
 * validacion en tiempo real. skills/patron-diseno.md seccion 10.
 */

export type FieldKind =
  | "code"
  | "nit"
  | "shortText"
  | "name"
  | "longText"
  | "email"
  | "phone"
  | "integer"
  | "quantity"
  | "money"
  | "percent"
  | "rate"
  | "date"
  | "datetime"
  | "select"
  | "textarea"
  | "switch";

export interface FieldKindSpec {
  /** Tipo de <input> HTML (ignorado para select/textarea/switch). */
  readonly inputType: string;
  /** Ancho en px del control; los que ocupan toda la fila usan `full`. */
  readonly width: number | "full";
  readonly inputMode?:
    | "text"
    | "numeric"
    | "decimal"
    | "email"
    | "tel"
    | "none";
  readonly maxLength?: number;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
  readonly uppercase?: boolean;
  /** Prefijo/sufijo visual (ej. "%", "Q"). */
  readonly prefix?: string;
  readonly suffix?: string;
  readonly placeholder?: string;
  /** Devuelve un mensaje de error o null si el valor es valido. */
  readonly validate?: (raw: string, required: boolean) => string | null;
}

function req(raw: string, required: boolean): string | null {
  return required && raw.trim() === "" ? "Requerido" : null;
}

function numRange(
  raw: string,
  required: boolean,
  opts: { min?: number; max?: number; integer?: boolean },
): string | null {
  const base = req(raw, required);
  if (base !== null || raw.trim() === "") return base;
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Debe ser numerico";
  if (opts.integer && !Number.isInteger(n)) return "Debe ser entero";
  if (opts.min !== undefined && n < opts.min) return `Minimo ${opts.min}`;
  if (opts.max !== undefined && n > opts.max) return `Maximo ${opts.max}`;
  return null;
}

export const FIELD_KINDS: Record<FieldKind, FieldKindSpec> = {
  code: {
    inputType: "text",
    width: 120,
    maxLength: 20,
    uppercase: true,
    inputMode: "text",
    placeholder: "COD-001",
    validate: (r, q) => req(r, q),
  },
  nit: {
    inputType: "text",
    width: 150,
    maxLength: 20,
    inputMode: "text",
    placeholder: "1234567-8",
    validate: (r, q) => {
      const b = req(r, q);
      if (b !== null || r.trim() === "") return b;
      return /^[0-9A-Za-z-]{5,20}$/.test(r.trim()) ? null : "NIT no valido";
    },
  },
  shortText: {
    inputType: "text",
    width: 200,
    maxLength: 80,
    validate: (r, q) => req(r, q),
  },
  name: {
    inputType: "text",
    width: 260,
    maxLength: 150,
    placeholder: "Nombre o razon social",
    validate: (r, q) => req(r, q),
  },
  longText: {
    inputType: "text",
    width: 380,
    maxLength: 255,
    validate: (r, q) => req(r, q),
  },
  email: {
    inputType: "email",
    width: 240,
    inputMode: "email",
    maxLength: 100,
    placeholder: "correo@empresa.com",
    validate: (r, q) => {
      const b = req(r, q);
      if (b !== null || r.trim() === "") return b;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.trim()) ? null : "Correo no valido";
    },
  },
  phone: {
    inputType: "tel",
    width: 140,
    inputMode: "tel",
    maxLength: 20,
    placeholder: "0000-0000",
    validate: (r, q) => req(r, q),
  },
  integer: {
    inputType: "number",
    width: 90,
    inputMode: "numeric",
    step: 1,
    min: 0,
    validate: (r, q) => numRange(r, q, { min: 0, integer: true }),
  },
  quantity: {
    inputType: "number",
    width: 110,
    inputMode: "decimal",
    step: 0.01,
    min: 0,
    validate: (r, q) => numRange(r, q, { min: 0 }),
  },
  money: {
    inputType: "number",
    width: 130,
    inputMode: "decimal",
    step: 0.01,
    min: 0,
    prefix: "Q",
    validate: (r, q) => numRange(r, q, { min: 0 }),
  },
  percent: {
    inputType: "number",
    width: 82,
    inputMode: "decimal",
    step: 0.01,
    min: 0,
    max: 100,
    suffix: "%",
    validate: (r, q) => numRange(r, q, { min: 0, max: 100 }),
  },
  rate: {
    inputType: "number",
    width: 120,
    inputMode: "decimal",
    step: 0.00001,
    min: 0,
    validate: (r, q) => numRange(r, q, { min: 0 }),
  },
  date: {
    inputType: "date",
    width: 150,
    validate: (r, q) => req(r, q),
  },
  datetime: {
    inputType: "datetime-local",
    width: 196,
    validate: (r, q) => req(r, q),
  },
  select: {
    inputType: "text",
    width: 210,
    validate: (r, q) => req(r, q),
  },
  textarea: {
    inputType: "text",
    width: "full",
    maxLength: 500,
    validate: (r, q) => req(r, q),
  },
  switch: {
    inputType: "checkbox",
    width: 110,
  },
};

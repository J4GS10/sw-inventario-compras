/**
 * Campo de formulario "inteligente": elige el control y el ANCHO segun el tipo
 * de dato (fecha != razon social != NIT != codigo), con validacion en tiempo
 * real (borde y mensaje cambian de color). skills/patron-diseno.md seccion 10.
 */

import { useId, useState } from "react";
import { FIELD_KINDS, type FieldKind } from "./fieldKinds.js";
import SearchSelect from "./SearchSelect.js";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /** Fila completa de origen: permite autocompletar OTROS campos al elegir esta opcion. */
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface FieldDef {
  readonly name: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required?: boolean;
  readonly options?: readonly SelectOption[];
  readonly help?: string;
  /** Fuerza el campo a ocupar toda la fila (p. ej. una nota larga). */
  readonly fullWidth?: boolean;
  /** Deshabilita el control (valor fijo: sesion, dependiente sin padre, etc.). */
  readonly disabled?: boolean;
  /** Texto de la unica opcion cuando un select no tiene opciones (dependiente). */
  readonly emptyHint?: string;
  /** Fecha minima permitida: "today" o un dia YYYY-MM-DD. Aplica a `date` y `datetime`. */
  readonly minDate?: "today" | string;
  /** Fecha maxima permitida: "today" o un dia YYYY-MM-DD. */
  readonly maxDate?: "today" | string;
  /** El minimo es el valor de OTRO campo del formulario (p. ej. fin >= inicio). */
  readonly minDateField?: string;
  /** Cantidad/monto estrictamente mayor que 0 (el minimo 0 no es valido). */
  readonly positive?: boolean;
  /**
   * Tope tomado de la fila elegida en OTRO campo del mismo ambito: `prop` de `opcion.data` del
   * select `select` (p. ej. devolver como maximo lo recibido). `noun` redacta el mensaje.
   */
  readonly limitFrom?: { readonly select: string; readonly prop: string; readonly noun: string };
}

export type FieldValue = string | boolean;

/** Hoy en la zona horaria del navegador, como YYYY-MM-DD. */
export function hoyLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

export interface DateBounds {
  readonly min?: string;
  readonly max?: string;
}

/** Limites de fecha efectivos de un campo, dados los valores actuales del formulario. */
export function dateBounds(
  def: FieldDef,
  values?: Readonly<Record<string, FieldValue>>,
): DateBounds {
  if (def.kind !== "date" && def.kind !== "datetime") return {};
  const resolve = (v: string | undefined): string | undefined =>
    v === undefined ? undefined : v === "today" ? hoyLocal() : v;
  let min = resolve(def.minDate);
  const max = resolve(def.maxDate);
  if (def.minDateField !== undefined) {
    const other = values?.[def.minDateField];
    if (typeof other === "string" && other.length >= 10) {
      const d = other.slice(0, 10);
      if (min === undefined || d > min) min = d;
    }
  }
  return {
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
  };
}

const fmtDia = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * Mensaje de error de un campo (null si es valido): la validacion del tipo +
 * las reglas de FECHA y de CANTIDAD POSITIVA declaradas en la definicion.
 * Espeja lo que el servidor valida, para que el usuario lo vea al teclear y no
 * al recibir un 422.
 */
export function fieldError(
  def: FieldDef,
  raw: string,
  bounds: DateBounds = {},
): string | null {
  const base = FIELD_KINDS[def.kind].validate?.(raw, def.required ?? false) ?? null;
  if (base !== null || raw.trim() === "") return base;
  if (def.kind === "date" || def.kind === "datetime") {
    const dia = raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(new Date(dia).getTime())) {
      return "Fecha no válida";
    }
    if (bounds.min !== undefined && dia < bounds.min) {
      return `No puede ser anterior al ${fmtDia(bounds.min)}`;
    }
    if (bounds.max !== undefined && dia > bounds.max) {
      return `No puede ser posterior al ${fmtDia(bounds.max)}`;
    }
  }
  if (def.positive === true && Number(raw) <= 0) return "Debe ser mayor que 0";
  return null;
}

export function Field(props: {
  def: FieldDef;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** true una vez que el usuario intento enviar; activa el estado invalido. */
  showErrors?: boolean;
  /** Valores del formulario: necesarios para reglas entre campos (fin >= inicio). */
  values?: Readonly<Record<string, FieldValue>>;
  /** Error devuelto por el SERVIDOR para este campo (se muestra bajo el campo y lleva el foco). */
  externalError?: string | null;
}): React.ReactElement {
  const { def, value, onChange, showErrors } = props;
  const spec = FIELD_KINDS[def.kind];
  const id = useId();
  const [touched, setTouched] = useState(false);

  const raw = typeof value === "boolean" ? "" : value;
  const bounds = dateBounds(def, props.values);
  const error = def.kind === "switch" ? null : fieldError(def, raw, bounds);
  // `min`/`max` nativos: el selector de fecha del navegador ya no deja elegir lo prohibido.
  const sufijo = def.kind === "datetime" ? "T00:00" : "";
  const minAttr = bounds.min !== undefined ? `${bounds.min}${sufijo}` : spec.min;
  const maxAttr = bounds.max !== undefined ? `${bounds.max}${def.kind === "datetime" ? "T23:59" : ""}` : spec.max;
  const mensajeError = props.externalError ?? error;
  // Con algo ya escrito/elegido el aviso sale al instante (no hay que salir del campo ni enviar);
  // un campo obligatorio aun vacio solo se marca al salir de el o al intentar registrar.
  const conValor = raw.trim() !== "";
  const showError = props.externalError != null || ((touched || showErrors === true || conValor) && error !== null);
  const showValid = touched && error === null && raw.trim() !== "";
  const state = showError ? "invalid" : showValid ? "valid" : undefined;

  const isFull = def.fullWidth === true || spec.width === "full";
  // En escritorio cada campo toma su ancho natural (distinto por tipo de dato);
  // en pantallas angostas puede encogerse y envolver.
  const style: React.CSSProperties = isFull
    ? { flex: "1 1 100%", minWidth: 0 }
    : { flex: `0 1 ${spec.width as number}px`, minWidth: 0, maxWidth: "100%" };

  return (
    // minmax(0,1fr): sin esto la pista del grid crece hasta el ancho del texto y el control se sale de su celda.
    <div className="grid gap-1" style={{ ...style, gridTemplateColumns: "minmax(0, 1fr)", alignContent: "start" }}>
      <label htmlFor={id} className="field-label">
        {def.label}
        {def.required === true && <span style={{ color: "var(--color-danger)" }}> *</span>}
      </label>

      {def.kind === "switch" ? (
        <SwitchControl
          id={id}
          checked={value === true}
          onChange={(c) => onChange(c)}
        />
      ) : def.kind === "select" ? (
        <SearchSelect
          id={id}
          data-state={state}
          value={raw}
          options={def.options ?? []}
          required={def.required === true}
          disabled={def.disabled === true}
          emptyHint={def.emptyHint}
          onBlur={() => setTouched(true)}
          onChange={(v) => {
            setTouched(true);
            onChange(v);
          }}
        />
      ) : def.kind === "textarea" ? (
        <textarea
          id={id}
          className="field-control"
          data-state={state}
          rows={3}
          maxLength={spec.maxLength}
          placeholder={spec.placeholder}
          value={raw}
          onBlur={() => setTouched(true)}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="relative flex items-center">
          {spec.prefix !== undefined && (
            <span className="absolute left-2.5 text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
              {spec.prefix}
            </span>
          )}
          <input
            id={id}
            className="field-control"
            disabled={def.disabled === true}
            style={{
              paddingLeft: spec.prefix !== undefined ? 22 : undefined,
              paddingRight: spec.suffix !== undefined ? 24 : undefined,
              textTransform: spec.uppercase === true ? "uppercase" : undefined,
            }}
            data-state={state}
            type={spec.inputType}
            inputMode={spec.inputMode}
            maxLength={spec.maxLength}
            step={spec.step}
            min={def.positive === true && minAttr === 0 ? 0.01 : minAttr}
            max={maxAttr}
            placeholder={spec.placeholder}
            value={raw}
            onBlur={() => setTouched(true)}
            onChange={(e) => onChange(e.target.value)}
          />
          {spec.suffix !== undefined && (
            <span className="absolute right-2.5 text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
              {spec.suffix}
            </span>
          )}
        </div>
      )}

      {(def.kind === "date" || def.kind === "datetime") && def.disabled !== true && (
        <AtajosFecha
          kind={def.kind}
          valor={raw}
          min={bounds.min}
          max={bounds.max}
          onElegir={(v) => {
            setTouched(true);
            onChange(v);
          }}
        />
      )}

      {(showError || def.help !== undefined) && (
        <span className="field-hint" data-state={showError ? "invalid" : undefined} role={showError ? "alert" : undefined}>
          {showError ? mensajeError : def.help}
        </span>
      )}
    </div>
  );
}

function SwitchControl(props: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): React.ReactElement {
  return (
    <button
      id={props.id}
      type="button"
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
      className="relative"
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "1px solid var(--color-line)",
        background: props.checked ? "var(--color-success)" : "var(--color-surface-2)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: props.checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,.25)",
          transition: "left 160ms cubic-bezier(0.2,0,0,1)",
        }}
      />
    </button>
  );
}

/**
 * Atajos de fecha y lectura humana: "Hoy · +7 d · +14 d · +30 d" y, debajo, la fecha escrita
 * completa ("lunes 20 de octubre de 2026"). El selector nativo muestra mm/dd/aaaa segun el sistema
 * operativo; esto elimina la duda de si 05/10 es mayo u octubre.
 */
function AtajosFecha(props: {
  kind: "date" | "datetime";
  valor: string;
  min: string | undefined;
  max: string | undefined;
  onElegir: (v: string) => void;
}): React.ReactElement {
  const hora = props.kind === "datetime" ? (props.valor.slice(11, 16) || "12:00") : "";
  const poner = (n: number): void => {
    const d = new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA");
    props.onElegir(props.kind === "datetime" ? `${d}T${hora}` : d);
  };
  const dia = props.valor.slice(0, 10);
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(dia) && !Number.isNaN(new Date(`${dia}T12:00:00`).getTime());
  const texto = valida
    ? new Date(`${dia}T12:00:00`).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  const atajos: readonly [string, number][] = [["Hoy", 0], ["+7 d", 7], ["+14 d", 14], ["+30 d", 30]];
  const hoyStr = new Date().toLocaleDateString("en-CA");
  const permitido = (n: number): boolean => {
    const d = new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA");
    return (props.min === undefined || d >= props.min) && (props.max === undefined || d <= props.max);
  };
  void hoyStr;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {atajos.filter(([, n]) => permitido(n)).map(([label, n]) => (
        <button
          key={label}
          type="button"
          onClick={() => poner(n)}
          className="rounded-full px-2 py-0.5 text-[0.7rem] font-semibold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-ink-soft)", border: "1px solid var(--color-line)" }}
        >
          {label}
        </button>
      ))}
      {texto !== null && (
        <span className="text-[0.72rem]" style={{ color: "var(--color-ink-soft)" }}>
          {texto}
        </span>
      )}
    </div>
  );
}

/* ---- Contenedor: coloca los campos a su ancho natural y envuelve --------- */

export function FormGrid(props: { children: React.ReactNode }): React.ReactElement {
  // Fibonacci: 13 px entre filas, 21 px entre columnas.
  return <div className="flex flex-wrap" style={{ gap: "var(--sp-3) var(--sp-4)" }}>{props.children}</div>;
}

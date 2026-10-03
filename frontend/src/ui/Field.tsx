/**
 * Campo de formulario "inteligente": elige el control y el ANCHO segun el tipo
 * de dato (fecha != razon social != NIT != codigo), con validacion en tiempo
 * real (borde y mensaje cambian de color). skills/patron-diseno.md seccion 10.
 */

import { useId, useState } from "react";
import { FIELD_KINDS, type FieldKind } from "./fieldKinds.js";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
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
}

export type FieldValue = string | boolean;

export function Field(props: {
  def: FieldDef;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** true una vez que el usuario intento enviar; activa el estado invalido. */
  showErrors?: boolean;
}): React.ReactElement {
  const { def, value, onChange, showErrors } = props;
  const spec = FIELD_KINDS[def.kind];
  const id = useId();
  const [touched, setTouched] = useState(false);

  const raw = typeof value === "boolean" ? "" : value;
  const error =
    def.kind === "switch"
      ? null
      : (spec.validate?.(raw, def.required ?? false) ?? null);
  const showError = (touched || showErrors === true) && error !== null;
  const showValid = touched && error === null && raw.trim() !== "";
  const state = showError ? "invalid" : showValid ? "valid" : undefined;

  const isFull = def.fullWidth === true || spec.width === "full";
  // En escritorio cada campo toma su ancho natural (distinto por tipo de dato);
  // en pantallas angostas puede encogerse y envolver.
  const style: React.CSSProperties = isFull
    ? { flex: "1 1 100%", minWidth: 0 }
    : { flex: `0 1 ${spec.width as number}px`, minWidth: 0, maxWidth: "100%" };

  return (
    <div className="grid gap-1" style={style}>
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
        <select
          id={id}
          className="field-control"
          data-state={state}
          value={raw}
          disabled={def.disabled === true}
          onBlur={() => setTouched(true)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {(def.options ?? []).length === 0 && def.emptyHint !== undefined
              ? def.emptyHint
              : "— seleccionar —"}
          </option>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
            min={spec.min}
            max={spec.max}
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

      {(showError || def.help !== undefined) && (
        <span className="field-hint" data-state={showError ? "invalid" : undefined}>
          {showError ? error : def.help}
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

/* ---- Contenedor: coloca los campos a su ancho natural y envuelve --------- */

export function FormGrid(props: { children: React.ReactNode }): React.ReactElement {
  return <div className="flex flex-wrap gap-x-4 gap-y-3.5">{props.children}</div>;
}

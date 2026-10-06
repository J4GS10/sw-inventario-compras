/**
 * Primitivos UI de la suite (skills/patron-diseno.md seccion 7).
 * Botones, Card, KPI, Chip, Skeleton, EmptyState, PageHeader.
 */

import Icon, { type IconName } from "./Icon.js";
import { estadoIcono, estadoLabel, estadoTono } from "../core/estados.js";
import { HelpTip, type HelpContent } from "./HelpTip.js";

/* ---- Button ------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "md" | "sm";
    icon?: IconName;
  },
): React.ReactElement {
  const { variant = "primary", size = "md", icon, className = "", children, ...rest } = props;
  const cls = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {icon !== undefined && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}

/* ---- Card ------------------------------------------------------------- */

export function Card(props: {
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}): React.ReactElement {
  return (
    <div className={`card ${props.pad === false ? "" : "p-4 md:p-5"} ${props.className ?? ""}`}>
      {props.children}
    </div>
  );
}

/* ---- PageHeader ----------------------------------------------------------- */

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Boton "?" junto al titulo que abre un modal explicando la pantalla. */
  help?: HelpContent;
}): React.ReactElement {
  return (
    <header className="flex min-w-0 flex-wrap items-end justify-between gap-3">
      {/* `min-w-0`: sin esto, un subtitulo largo en una sola linea reclama su
          ancho natural completo como item flex y empuja las acciones fuera
          del viewport en vez de dejarlas envolver a la fila de abajo. */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h1 style={{ color: "var(--color-heading)" }}>{props.title}</h1>
          {props.help !== undefined && <HelpTip title={props.help.title} body={props.help.body} />}
        </div>
        {props.subtitle !== undefined && (
          <p className="mt-1 text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
            {props.subtitle}
          </p>
        )}
      </div>
      {props.actions !== undefined && (
        <div className="page-actions flex flex-wrap items-center gap-2">{props.actions}</div>
      )}
    </header>
  );
}

/* ---- KPI card ----------------------------------------------------------- */

type Tone = "brand" | "success" | "warning" | "danger" | "navy";

const TONE_BG: Record<Tone, string> = {
  brand: "var(--color-brand-050)",
  success: "var(--color-success-050)",
  warning: "var(--color-warning-050)",
  danger: "var(--color-danger-050)",
  navy: "var(--color-brand-050)",
};
const TONE_FG: Record<Tone, string> = {
  brand: "var(--color-brand-ink)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  navy: "var(--color-brand-ink)",
};

export function KpiCard(props: {
  label: string;
  value: string;
  icon: IconName;
  tone?: Tone;
  hint?: string;
  /** Tendencia: nuevos en los últimos 7 días frente a los 7 días anteriores. */
  tendencia?: { actual: number; previo: number };
}): React.ReactElement {
  const tone = props.tone ?? "brand";
  const t = props.tendencia;
  const delta = t === undefined ? 0 : t.actual - t.previo;
  const flecha = delta > 0 ? "▲" : delta < 0 ? "▼" : "＝";
  return (
    <div className="card p-4 flex items-center gap-3.5 min-w-[170px]">
      <div
        className="grid place-items-center shrink-0"
        style={{
          width: 42,
          height: 42,
          borderRadius: 9,
          background: TONE_BG[tone],
          color: TONE_FG[tone],
        }}
      >
        <Icon name={props.icon} size={20} />
      </div>
      <div className="min-w-0">
        <div
          className="text-[0.68rem] font-semibold uppercase tracking-wide leading-tight"
          style={{ color: "var(--color-ink-soft)" }}
        >
          {props.label}
        </div>
        <div className="text-xl font-bold leading-tight" style={{ color: "var(--color-heading)" }}>
          {props.value}
        </div>
        {props.hint !== undefined && (
          <div className="text-[0.7rem]" style={{ color: "var(--color-ink-faint)" }}>
            {props.hint}
          </div>
        )}
        {t !== undefined && (
          <div
            className="text-[0.7rem]"
            style={{ color: "var(--color-ink-faint)" }}
            title={`Registros nuevos en los últimos 7 días (${delta === 0 ? "igual que" : delta > 0 ? `${delta} más que` : `${-delta} menos que`} los 7 días anteriores)`}
          >
            <span style={{ color: delta > 0 ? "var(--color-success)" : delta < 0 ? "var(--color-warning)" : "inherit" }} aria-hidden="true">
              {flecha}
            </span>{" "}
            {t.actual} nuevos · 7 días
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Chip / badge de estado ------------------------------------------- */

export type ChipTone = "neutral" | "brand" | "success" | "warning" | "danger";

const CHIP: Record<ChipTone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--color-surface-2)", fg: "var(--color-ink-soft)" },
  brand: { bg: "var(--color-brand-050)", fg: "var(--color-brand-ink)" },
  success: { bg: "var(--color-success-050)", fg: "var(--color-success)" },
  warning: { bg: "var(--color-warning-050)", fg: "var(--color-warning)" },
  danger: { bg: "var(--color-danger-050)", fg: "var(--color-danger)" },
};

/** Mapea estados de dominio a un tono semantico. */
export function toneForEstado(estado: string): ChipTone {
  const e = estado.toUpperCase();
  if (["A", "ACTIVO", "ABIERTO", "EMITIDA", "RECIBIDO", "PENDIENTE_JEFE", "PENDIENTE_GERENTE"].includes(e))
    return "brand";
  if (["RECIBIDA_COMPLETA", "ORDEN_GENERADA", "ALIMENTADO_CXP", "PAGADA", "S", "SI"].includes(e))
    return "success";
  if (["EN_COTIZACION", "ENVIADA", "EN_TRANSITO", "RECIBIDA_PARCIAL", "PAGADA_PARCIAL"].includes(e))
    return "warning";
  if (["RECHAZADA", "CANCELADA", "CANCELADO", "ANULADA", "I", "INACTIVO"].includes(e))
    return "danger";
  return "neutral";
}

/** Tono deterministico por texto (para tags sin un tono de negocio propio, p. ej. familias de producto). */
export function tagTone(text: string): ChipTone {
  const palette: ChipTone[] = ["brand", "success", "warning", "danger", "neutral"];
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}

export function Chip(props: {
  children: React.ReactNode;
  tone?: ChipTone;
  icon?: IconName;
}): React.ReactElement {
  const t = CHIP[props.tone ?? "neutral"];
  return (
    <span className="chip" style={{ background: t.bg, color: t.fg }}>
      {props.icon !== undefined && <Icon name={props.icon} size={13} />}
      {props.children}
    </span>
  );
}

export function EstadoChip(props: { estado: string | null | undefined }): React.ReactElement {
  // Texto legible + tono semantico desde la fuente unica (core/estados).
  const icono = estadoIcono(props.estado) as IconName | undefined;
  return (
    <Chip tone={estadoTono(props.estado)} {...(icono !== undefined ? { icon: icono } : {})}>
      {estadoLabel(props.estado)}
    </Chip>
  );
}

/* ---- StarRating --------------------------------------------------------
 * Calificacion 0-5 (COM_PROVEEDOR.CALIFICACION, hoy texto libre en el DDL —
 * se interpreta como numero 0-5 sin tocar el esquema). Estrellas llenas +
 * el valor numerico, igual que el patron visual de referencia.
 * ------------------------------------------------------------------------ */
export function StarRating(props: {
  value: number | string | null | undefined;
  /** Texto a la derecha de las estrellas; por defecto el numero (4.0). */
  label?: string;
}): React.ReactElement {
  const n = Number(props.value);
  const valid = Number.isFinite(n) && n > 0;
  const rounded = valid ? Math.max(0, Math.min(5, Math.round(n))) : 0;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex" style={{ color: "var(--color-warning)" }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Icon key={i} name="star" size={14} className={i < rounded ? undefined : "opacity-25"} />
        ))}
      </span>
      <span className="text-[0.78rem]" style={{ color: "var(--color-ink-soft)" }}>
        {props.label ?? (valid ? n.toFixed(1) : "—")}
      </span>
    </span>
  );
}

/* ---- StatCard / StatRow -------------------------------------------------
 * Tarjetas KPI sobre una lista (conteo, promedio, etc.) — mismo patron que
 * el resumen del Dashboard, reutilizable en cualquier pantalla de catalogo.
 * ------------------------------------------------------------------------ */
export function StatCard(props: {
  icon: IconName;
  tone?: ChipTone;
  title: string;
  subtitle: string;
}): React.ReactElement {
  const t = CHIP[props.tone ?? "brand"];
  return (
    <div className="card flex items-center gap-3" style={{ padding: 16 }}>
      <span
        className="grid shrink-0 place-items-center rounded-full"
        style={{ width: 44, height: 44, background: t.bg, color: t.fg }}
      >
        <Icon name={props.icon} size={20} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[1.05rem] font-bold" style={{ color: "var(--color-heading)" }}>
          {props.title}
        </div>
        <div className="truncate text-[0.76rem]" style={{ color: "var(--color-ink-soft)" }}>
          {props.subtitle}
        </div>
      </div>
    </div>
  );
}

export function StatRow(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {props.children}
    </div>
  );
}

/* ---- Skeleton --------------------------------------------------------- */

export function Skeleton(props: { rows?: number }): React.ReactElement {
  return (
    <div className="grid gap-2">
      {Array.from({ length: props.rows ?? 5 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 40 }} />
      ))}
    </div>
  );
}

/* ---- EmptyState ------------------------------------------------------- */

export function EmptyState(props: {
  icon?: IconName;
  title: string;
  hint?: string;
  /** Salida concreta: "Crear la primera solicitud". */
  action?: { label: string; onClick: () => void };
}): React.ReactElement {
  return (
    <div
      className="grid place-items-center gap-2 py-12 text-center"
      style={{ color: "var(--color-ink-faint)" }}
    >
      <Icon name={props.icon ?? "list"} size={30} />
      <div className="font-semibold" style={{ color: "var(--color-ink-soft)" }}>
        {props.title}
      </div>
      {props.hint !== undefined && <div className="text-[0.8rem]">{props.hint}</div>}
      {props.action !== undefined && (
        <Button size="sm" icon="plus" onClick={props.action.onClick}>
          {props.action.label}
        </Button>
      )}
    </div>
  );
}

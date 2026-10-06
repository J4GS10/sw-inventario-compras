/**
 * Ayudas de UX de las listas de documentos: urgencia/antiguedad, filtros rapidos,
 * "siguiente paso" y memoria de la vista (busqueda, filtros y orden por pantalla).
 */

import { Chip, type ChipTone } from "../../ui/primitives.js";
import type { Column } from "../../ui/DataTable.js";

type Row = Record<string, unknown>;

const DIA_MS = 86_400_000;

/** Dia de calendario (YYYY-MM-DD) en hora local, de un valor de fecha del servidor. */
function dia(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) || /T00:00:00(\.0+)?Z$/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-CA");
}

/** Dias de calendario de `a` a `b` (b - a). */
function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);
}

const hoy = (): string => new Date().toLocaleDateString("en-CA");

const plural = (n: number, s: string): string => `${n} ${s}${n === 1 ? "" : "s"}`;

function chip(tone: ChipTone, texto: string, title?: string): React.ReactElement {
  return (
    <span title={title}>
      <Chip tone={tone}>{texto}</Chip>
    </span>
  );
}

/** Solicitudes: cuanto lleva esperando. >=2 dias ambar, >=5 rojo. Resueltas: sin urgencia. */
export function esperaSolicitud(r: Row): React.ReactElement {
  const estado = String(r["estado"] ?? "");
  const creada = dia(r["fechaCreacion"]);
  if (creada === null) return <span style={{ color: "var(--color-ink-faint)" }}>—</span>;
  const d = Math.max(0, diasEntre(creada, hoy()));
  if (estado === "RECHAZADA" || estado === "ORDEN_GENERADA") {
    return <span style={{ color: "var(--color-ink-faint)" }}>{d === 0 ? "hoy" : `hace ${plural(d, "día")}`}</span>;
  }
  const tono: ChipTone = d >= 5 ? "danger" : d >= 2 ? "warning" : "neutral";
  return chip(tono, d === 0 ? "Hoy" : plural(d, "día"), `Creada ${creada}; lleva ${plural(d, "día")} sin resolverse`);
}

/** RFQ: tiempo que le queda para recibir ofertas. */
export function vencimientoRfq(r: Row): React.ReactElement {
  if (String(r["estado"]) !== "ABIERTO") return <span style={{ color: "var(--color-ink-faint)" }}>—</span>;
  const lim = dia(r["fechaLimite"]);
  if (lim === null) return <span>—</span>;
  const d = diasEntre(hoy(), lim);
  if (d < 0) return chip("danger", `Vencido hace ${plural(-d, "día")}`, `Venció el ${lim}`);
  if (d === 0) return chip("warning", "Vence hoy", `Vence el ${lim}`);
  return chip(d <= 2 ? "warning" : "neutral", `Vence en ${plural(d, "día")}`, `Vence el ${lim}`);
}

/** Orden de compra: entrega esperada vs hoy (si aun no se recibio completa). */
export function entregaOrden(r: Row): React.ReactElement {
  const estado = String(r["estado"] ?? "");
  if (["RECIBIDA_COMPLETA", "CANCELADA", "RECHAZADA"].includes(estado)) {
    return <span style={{ color: "var(--color-ink-faint)" }}>—</span>;
  }
  const ent = dia(r["fechaEntregaEsperada"]);
  if (ent === null) return <span>—</span>;
  const d = diasEntre(hoy(), ent);
  if (d < 0) return chip("danger", `Atrasada ${plural(-d, "día")}`, `Debía llegar el ${ent}`);
  if (d === 0) return chip("warning", "Llega hoy", `Entrega esperada ${ent}`);
  return chip(d <= 2 ? "warning" : "neutral", `En ${plural(d, "día")}`, `Entrega esperada ${ent}`);
}

/** Columna de urgencia por tipo de documento (si aplica). */
export function columnaUrgencia(configKey: string): Column<Row> | null {
  switch (configKey) {
    case "solicitudes":
      return { key: "espera", sortKey: "fechaCreacion", sortable: true, header: "Espera", width: 108, render: esperaSolicitud, value: (r) => String(r["fechaCreacion"] ?? "") };
    case "rfq":
      return { key: "vence", sortKey: "fechaLimite", sortable: true, header: "Plazo", width: 150, render: vencimientoRfq, value: (r) => String(r["fechaLimite"] ?? "") };
    case "ordenesCompra":
      return { key: "entrega", sortKey: "fechaEntregaEsperada", sortable: true, header: "Entrega", width: 140, render: entregaOrden, value: (r) => String(r["fechaEntregaEsperada"] ?? "") };
    default:
      return null;
  }
}

/* ---- Filtros rapidos ------------------------------------------------------ */

export interface FiltroRapido {
  readonly id: string;
  readonly label: string;
  /** Parametros de consulta que aplica (`estado__in`, ...). Vacio = sin filtro. */
  readonly extra: Readonly<Record<string, string>>;
}

export const FILTROS_RAPIDOS: Readonly<Record<string, readonly FiltroRapido[]>> = {
  solicitudes: [
    { id: "todas", label: "Todas", extra: {} },
    { id: "pend", label: "Esperando aprobación", extra: { estado__in: "PENDIENTE_JEFE,PENDIENTE_GERENTE" } },
    { id: "cot", label: "Listas para cotizar", extra: { estado__eq: "EN_COTIZACION" } },
    { id: "rech", label: "Rechazadas", extra: { estado__eq: "RECHAZADA" } },
  ],
  rfq: [
    { id: "todas", label: "Todos", extra: {} },
    { id: "abiertos", label: "Abiertos", extra: { estado__eq: "ABIERTO" } },
    { id: "cerrados", label: "Cerrados", extra: { estado__eq: "CERRADO" } },
  ],
  ordenesCompra: [
    { id: "todas", label: "Todas", extra: {} },
    { id: "porrecibir", label: "Por recibir", extra: { estado__in: "EMITIDA,ENVIADA,EN_TRANSITO,RECIBIDA_PARCIAL" } },
    { id: "completas", label: "Recibidas", extra: { estado__eq: "RECIBIDA_COMPLETA" } },
    { id: "canc", label: "Canceladas", extra: { estado__in: "CANCELADA,RECHAZADA" } },
  ],
  recepciones: [
    { id: "todas", label: "Todas", extra: {} },
    { id: "cxp", label: "Enviadas a CxP", extra: { estado__eq: "ALIMENTADO_CXP" } },
    { id: "rec", label: "Sin facturar", extra: { estado__eq: "RECIBIDO" } },
  ],
};

/* ---- Siguiente paso tras crear un documento -------------------------------- */

export interface SiguientePaso {
  readonly mensaje: string;
  readonly boton: string;
  readonly leafId: string;
}

export const SIGUIENTE_PASO: Readonly<Record<string, SiguientePaso>> = {
  rfq: { mensaje: "RFQ enviado a los proveedores", boton: "Registrar ofertas", leafId: "com-doc-cotizaciones" },
  cotizaciones: { mensaje: "Cotización registrada", boton: "Comparar ofertas", leafId: "com-an-comparativo" },
  ordenesCompra: { mensaje: "Orden emitida", boton: "Ver órdenes", leafId: "com-doc-ordenes" },
  recepciones: { mensaje: "Recepción registrada", boton: "Cuentas por pagar", leafId: "com-cxp-liquidacion" },
};

/* ---- Memoria de la vista por pantalla --------------------------------------- */

export interface VistaGuardada {
  search: string;
  filtros: Record<string, string>;
  sort: { key: string; dir: "asc" | "desc" } | null;
  filtroRapido: string;
}

const clave = (k: string): string => `erp.vista.${k}`;

export function leerVista(configKey: string): Partial<VistaGuardada> {
  try {
    const raw = window.sessionStorage.getItem(clave(configKey));
    return raw === null ? {} : (JSON.parse(raw) as Partial<VistaGuardada>);
  } catch {
    return {};
  }
}

export function guardarVista(configKey: string, v: VistaGuardada): void {
  try {
    window.sessionStorage.setItem(clave(configKey), JSON.stringify(v));
  } catch {
    /* sin almacenamiento: la vista no se recuerda */
  }
}

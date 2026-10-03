/**
 * Tabla de datos (skills/patron-diseno.md seccion 7 + 11 responsive).
 *
 * Estructura de 3 zonas dentro de una Card:
 *   [barra de seleccion masiva condicional]
 *   [cuerpo con scroll propio y encabezado sticky]   <- solo aqui hay scroll
 *   [paginacion siempre visible]
 * Asi una lista larga no descuadra la vista: el header queda fijo y la
 * paginacion no se va del viewport.
 *
 * Sistema de columnas (para que las tablas con muchas columnas se vean bien):
 *  - Cada `Column` tiene un ANCHO (explicito o por defecto segun su `type`,
 *    igual que `ui/fieldKinds.ts` hace con los campos de formulario).
 *  - `table-layout: fixed` + un ancho minimo en `<table>` = la tabla ANCHA
 *    hace scroll horizontal dentro de `.table-scroll`, nunca se aplasta ni
 *    envuelve el texto en filas altas.
 *  - Texto/`refKind`: se recortan con elipsis + tooltip (`title`) con el
 *    valor completo.
 *  - `Column.priority: "secondary"` — columnas de apoyo; si no caben junto a
 *    las `primary`, se ocultan de la tabla y se accede a ellas con un
 *    disclosure "+" por fila (`patron-diseno.md` §11 "colapso de elementos
 *    secundarios cuando el espacio sea limitado").
 *  - En ancho de telefono (~<560px) las filas se muestran como tarjetas
 *    apiladas en vez de tabla.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Icon, { type IconName } from "./Icon.js";
import { Button, Chip, EstadoChip, Skeleton, EmptyState } from "./primitives.js";
import { formatMoney, formatQty, formatRate } from "../core/format.js";
import { prioridadLabel, prioridadTono } from "../core/estados.js";
import { useRefs, type RefKind, type DocRef } from "../core/RefContext.js";

export type ColumnType =
  | "text"
  | "num"
  | "money"
  | "rate"
  | "estado"
  | "prioridad"
  | "date"
  | "datetime";

/** Ancho por defecto (px) segun el tipo de dato — espeja `ui/fieldKinds.ts`. */
const COLUMN_WIDTH: Record<ColumnType, number> = {
  text: 220,
  num: 96,
  money: 120,
  rate: 104,
  // 176: cabe el estado mas largo del dominio ("Pendiente del gerente", 22
  // caracteres) en una sola linea — con 140 el chip se partia en 2 lineas.
  estado: 176,
  prioridad: 120,
  date: 112,
  datetime: 156,
};
/** Ancho por defecto de una columna `refKind` sin ancho explicito. */
const REF_WIDTH = 176;

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly type?: ColumnType;
  readonly sortable?: boolean;
  readonly value?: (row: T) => string | number | null | undefined;
  readonly render?: (row: T) => React.ReactNode;
  /**
   * La celda contiene una llave foranea: se muestra su etiqueta legible en vez
   * del id (idMoneda 1 -> "GTQ"). Un `DocRef` la muestra con prefijo (OC-123).
   */
  readonly refKind?: RefKind | DocRef;
  /** Ancho en px. Por defecto, segun `type`/`refKind` (ver `COLUMN_WIDTH`). */
  readonly width?: number;
  /** Esta columna absorbe el espacio sobrante (normalmente la de texto libre). Como maximo una por tabla. */
  readonly grow?: boolean;
  readonly align?: "left" | "right" | "center";
  /**
   * "secondary": columna de apoyo — se oculta cuando no cabe junto a las
   * `primary` y pasa a un disclosure por fila. Por defecto `"primary"`.
   */
  readonly priority?: "primary" | "secondary";
  /** Tooltip cuando la columna usa `render` (si no se da, se usa el texto plano de la celda). */
  readonly title?: (row: T) => string | undefined;
}

export interface RowAction<T> {
  readonly label: string;
  readonly icon?: IconName;
  readonly onClick: (row: T) => void;
  readonly tone?: "brand" | "danger" | "muted";
  /** Si devuelve true, la accion NO aplica a esa fila: sale del menu de esa fila. */
  readonly hidden?: (row: T) => boolean;
  /** Ordena primero en el menu y la resalta (accion principal del documento). */
  readonly primary?: boolean;
}

/**
 * Acciones de fila: SIEMPRE un unico control por fila — el menu "⋯". Asi todas
 * las filas de una pantalla tienen exactamente el mismo peso visual, sin filas
 * con 1/2/3 botones sueltos. Las acciones que no aplican a una fila (por estado)
 * no aparecen en su menu; el boton se deshabilita si la fila no tiene ninguna.
 */
function RowActions<T>(props: {
  actions: readonly RowAction<T>[];
  row: T;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const available = props.actions.filter((a) => a.hidden?.(props.row) !== true);
  const ordered = [
    ...available.filter((a) => a.primary === true),
    ...available.filter((a) => a.primary !== true),
  ];
  const empty = ordered.length === 0;

  return (
    <div ref={ref} className="relative flex justify-end">
      <Button
        size="sm"
        variant="ghost"
        aria-label="Más opciones"
        title="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={empty}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more" size={16} />
      </Button>
      {open && !empty && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-lg py-1"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {ordered.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.82rem]"
              style={{
                color: a.tone === "danger" ? "var(--color-danger)" : "var(--color-ink)",
                fontWeight: a.primary === true ? 600 : 400,
              }}
              onClick={() => {
                setOpen(false);
                a.onClick(props.row);
              }}
            >
              {a.icon !== undefined && <Icon name={a.icon} size={15} />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Boton "Filtrar" con un select por campo (server-side, `campo__eq`). */
function FilterPopover(props: {
  fields: readonly { key: string; label: string; options: readonly { value: string; label: string }[] }[];
  values: Readonly<Record<string, string>>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = Object.values(props.values).filter((v) => v !== "").length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="secondary" icon="filter" onClick={() => setOpen((v) => !v)}>
        Filtrar{activeCount > 0 ? ` (${activeCount})` : ""}
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 min-w-[240px] rounded-lg p-3"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div className="grid gap-2.5">
            {props.fields.map((f) => (
              <label key={f.key} className="grid gap-1">
                <span className="text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                  {f.label}
                </span>
                <select
                  value={props.values[f.key] ?? ""}
                  onChange={(e) => props.onChange(f.key, e.target.value)}
                  className="rounded-lg px-2.5 py-1.5 text-[0.85rem]"
                  style={{ background: "var(--field-bg)", border: "1px solid var(--field-border)", color: "var(--color-ink)" }}
                >
                  <option value="">Todos</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {activeCount > 0 && (
            <button
              type="button"
              className="mt-3 text-[0.78rem]"
              style={{ color: "var(--color-brand-ink)" }}
              onClick={props.onClear}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface BulkAction<T> {
  readonly label: string;
  readonly icon?: IconName;
  readonly tone?: "brand" | "danger";
  readonly onClick: (rows: readonly T[]) => void;
}

function cellText(v: string | number | null | undefined, type?: ColumnType): string {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "date") return String(v).slice(0, 10);
  if (type === "datetime") return String(v).slice(0, 16).replace("T", " ");
  if (type === "money") return formatMoney(v);
  if (type === "rate") return formatRate(v);
  if (type === "prioridad") return prioridadLabel(v);
  if (type === "num") {
    const n = Number(v);
    return Number.isFinite(n) ? formatQty(n) : String(v);
  }
  return String(v);
}

type Refs = ReturnType<typeof useRefs>;

/** Contenido de una celda (usado por la tabla, el disclosure y la vista tarjeta). */
function cellNode<T>(c: Column<T>, row: T, refs: Refs): React.ReactNode {
  if (c.render !== undefined) return c.render(row);
  if (c.type === "estado") return <EstadoChip estado={String(c.value?.(row) ?? "")} />;
  if (c.type === "prioridad") {
    return <Chip tone={prioridadTono(c.value?.(row))}>{prioridadLabel(c.value?.(row))}</Chip>;
  }
  if (c.refKind !== undefined) return refs.label(c.refKind, c.value?.(row));
  return cellText(c.value?.(row), c.type);
}

/** Texto plano para el tooltip nativo de una celda truncada. `undefined` = sin tooltip. */
function cellTitle<T>(c: Column<T>, row: T, refs: Refs): string | undefined {
  if (c.title !== undefined) return c.title(row);
  if (c.render !== undefined || c.type === "estado" || c.type === "prioridad") return undefined;
  if (c.refKind !== undefined) {
    const label = refs.label(c.refKind, c.value?.(row));
    return typeof label === "string" && label !== "" ? label : undefined;
  }
  const text = cellText(c.value?.(row), c.type);
  return text === "—" ? undefined : text;
}

function resolveWidth<T>(c: Column<T>): number {
  if (c.width !== undefined) return c.width;
  if (c.refKind !== undefined) return REF_WIDTH;
  return COLUMN_WIDTH[c.type ?? "text"];
}

function resolveAlign<T>(c: Column<T>): "left" | "right" | "center" {
  if (c.align !== undefined) return c.align;
  return c.type === "num" || c.type === "money" || c.type === "rate" ? "right" : "left";
}

/** true si la celda es texto/valor plano (candidata a truncar con elipsis). */
function isTruncatable<T>(c: Column<T>): boolean {
  return c.render === undefined && c.type !== "estado" && c.type !== "prioridad";
}

const SELECT_W = 38;
const ACTIONS_W = 44;
const TOGGLE_W = 30;
/** Por debajo de este ancho de contenedor, las filas se muestran como tarjetas. */
const CARD_BREAKPOINT = 560;
/**
 * Por debajo de este ancho de contenedor, las columnas `secondary` se ocultan
 * tras el disclosure "+" de cada fila. De ahi para arriba se muestran SIEMPRE
 * inline — si aun asi no caben todas, el scroll horizontal propio de
 * `.table-scroll` resuelve el sobrante, nunca un colapso de columnas que el
 * usuario podria no notar (antes el umbral exigia que la suma de TODAS las
 * columnas cupiera sin scroll, asi que en catalogos con varias columnas
 * secundarias — p. ej. Proveedores — el disclosure se activaba incluso con la
 * ventana bien ancha, y el usuario veía "columnas perdidas").
 */
const SECONDARY_COLLAPSE_BREAKPOINT = 920;

/** Ancho disponible del contenedor, actualizado con ResizeObserver. */
function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function DataTable<T>(props: {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  actions?: readonly RowAction<T>[];
  selectable?: boolean;
  bulkActions?: readonly BulkAction<T>[];
  emptyTitle?: string;
  /** Pista bajo el titulo vacio: que hacer a continuacion. */
  emptyHint?: string;
  /** Paginacion (opcional). Si se pasa `onPage`, se muestra el pie de pagina. */
  page?: number;
  totalPages?: number;
  total?: number;
  onPage?: (page: number) => void;
  onReload?: () => void;
  /** Alto maximo del cuerpo scrollable. */
  maxBodyHeight?: string;
  /** Buscador server-side (envia `campo__like` al backend, ya soportado por parseListQuery). */
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  /** Nombre de archivo (sin extension) para el boton "Exportar" (CSV de la pagina actual). */
  exportFilename?: string;
  /** Boton "Filtrar" con panel de selects (server-side, `campo__eq`). */
  filters?: {
    fields: readonly { key: string; label: string; options: readonly { value: string; label: string }[] }[];
    values: Readonly<Record<string, string>>;
    onChange: (key: string, value: string) => void;
    onClear: () => void;
  };
}): React.ReactElement {
  const {
    columns,
    rows,
    rowKey,
    loading,
    actions = [],
    selectable,
    bulkActions = [],
    onPage,
    // El cuerpo hace scroll propio: el encabezado queda fijo y la paginacion
    // siempre visible al pie. Se adapta al alto disponible del viewport.
    maxBodyHeight = "min(64vh, calc(100dvh - 270px))",
  } = props;

  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [checked, setChecked] = useState<Set<string | number>>(new Set());
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const refs = useRefs();
  const [wrapRef, containerWidth] = useContainerWidth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    if (sort === null) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (col?.value === undefined) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.value?.(a) ?? "";
      const vb = col.value?.(b) ?? "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, sort, columns]);

  const selectedRows = sorted.filter((r) => checked.has(rowKey(r)));
  const hasActionsCol = actions.length > 0;
  const allChecked = sorted.length > 0 && selectedRows.length === sorted.length;

  function toggleAll(): void {
    setChecked(allChecked ? new Set() : new Set(sorted.map(rowKey)));
  }
  function toggleOne(k: string | number): void {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }
  function toggleExpanded(k: string | number): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  /** CSV de la pagina actual (lo que el usuario ve, no todo el recurso). */
  function exportCsv(): void {
    const escape = (v: string): string =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const header = columns.map((c) => escape(c.header)).join(",");
    const lines = sorted.map((row) =>
      columns.map((c) => escape(String(c.value?.(row) ?? ""))).join(","),
    );
    const csv = [header, ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.exportFilename ?? "exportacion"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, props.totalPages ?? 1);
  const page = props.page ?? 1;

  // -- Layout responsive: tabla completa / tabla + disclosure / tarjetas ----
  const isCardView = containerWidth !== null && containerWidth < CARD_BREAKPOINT;
  const primaryColumns = columns.filter((c) => c.priority !== "secondary");
  const secondaryColumns = columns.filter((c) => c.priority === "secondary");
  const showAllInline =
    secondaryColumns.length === 0 ||
    containerWidth === null ||
    containerWidth >= SECONDARY_COLLAPSE_BREAKPOINT;
  const visibleColumns = showAllInline ? columns : primaryColumns;
  const showToggleCol = !isCardView && !showAllInline;

  // El espacio sobrante SIEMPRE lo absorbe una columna real (con contenido),
  // nunca una columna de relleno vacia — un "grow" explicito si lo declaro el
  // catalogo, o si no, la primera columna de texto visible. Antes, sin
  // `grow` explicito, se insertaba una columna invisible: en un contenedor
  // ancho (sidebar colapsado, pantalla grande) esa columna vacia se estiraba
  // y dejaba un hueco en blanco enorme a la derecha de la tabla.
  const explicitGrowKey = visibleColumns.find((c) => c.grow === true)?.key;
  const autoGrowKey = visibleColumns.find(
    (c) => c.render === undefined && (c.type === undefined || c.type === "text"),
  )?.key;
  const growKey = explicitGrowKey ?? autoGrowKey ?? visibleColumns[0]?.key;
  const hasSpacer = growKey === undefined;
  const fixedWidth =
    visibleColumns.reduce((a, c) => (c.key === growKey ? a : a + resolveWidth(c)), 0) +
    (selectable === true ? SELECT_W : 0) +
    (hasActionsCol ? ACTIONS_W : 0) +
    (showToggleCol ? TOGGLE_W : 0);
  const growMinWidth = growKey !== undefined ? Math.min(140, resolveWidth(visibleColumns.find((c) => c.key === growKey)!)) : 0;
  const tableMinWidth = fixedWidth + growMinWidth;
  const colCount =
    visibleColumns.length +
    (selectable ? 1 : 0) +
    (hasActionsCol ? 1 : 0) +
    (showToggleCol ? 1 : 0) +
    (hasSpacer ? 1 : 0);

  function updateScrollState(el: HTMLDivElement | null): void {
    if (el === null) return;
    setScrollState({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }
  useEffect(() => {
    updateScrollState(scrollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, containerWidth, isCardView]);

  return (
    <div className="card overflow-hidden" style={{ padding: 0, isolation: "isolate" }} ref={wrapRef}>
      {(props.search !== undefined || props.exportFilename !== undefined || props.filters !== undefined) && (
        <div
          className="flex flex-wrap items-center gap-2 p-3"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          {props.search !== undefined && (
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "var(--field-bg)", border: "1px solid var(--field-border)" }}
            >
              <Icon name="search" size={15} />
              <input
                type="text"
                value={props.search.value}
                onChange={(e) => props.search!.onChange(e.target.value)}
                placeholder={props.search.placeholder ?? "Buscar..."}
                className="w-full min-w-0 bg-transparent text-[0.85rem] outline-none"
                style={{ color: "var(--color-ink)" }}
              />
            </div>
          )}
          {props.filters !== undefined && props.filters.fields.length > 0 && (
            <FilterPopover
              fields={props.filters.fields}
              values={props.filters.values}
              onChange={props.filters.onChange}
              onClear={props.filters.onClear}
            />
          )}
          {props.exportFilename !== undefined && (
            <Button size="sm" variant="secondary" icon="download" onClick={exportCsv}>
              Exportar
            </Button>
          )}
        </div>
      )}

      {selectable === true && selectedRows.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{ background: "var(--color-brand-050)", borderBottom: "1px solid var(--color-line)" }}
        >
          <span className="text-[0.8rem] font-semibold" style={{ color: "var(--color-brand-ink)" }}>
            {selectedRows.length} seleccionada(s)
          </span>
          <div className="flex-1" />
          {bulkActions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.tone === "danger" ? "danger" : "secondary"}
              icon={a.icon}
              onClick={() => a.onClick(selectedRows)}
            >
              {a.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
            Limpiar
          </Button>
        </div>
      )}

      {loading === true ? (
        <div style={{ padding: 16 }}>
          <Skeleton rows={6} />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title={props.emptyTitle ?? "Sin registros"} hint={props.emptyHint} />
      ) : isCardView ? (
        <div className="grid gap-2 p-2.5" style={{ maxHeight: maxBodyHeight, overflowY: "auto" }}>
          {sorted.map((row) => {
            const k = rowKey(row);
            const headerCol = primaryColumns[0] ?? columns[0];
            const estadoCol = columns.find((c) => c.type === "estado" && c.key !== headerCol?.key);
            const bodyCols = columns.filter((c) => c.key !== headerCol?.key && c.key !== estadoCol?.key);
            return (
              <div
                key={k}
                className="surface-2 rounded-xl p-3"
                style={{ border: "1px solid var(--color-line)" }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {selectable === true && (
                      <input
                        type="checkbox"
                        checked={checked.has(k)}
                        onChange={() => toggleOne(k)}
                        aria-label="Seleccionar fila"
                      />
                    )}
                    {headerCol !== undefined && (
                      <span
                        className="mono truncate text-[0.85rem] font-semibold"
                        style={{ color: "var(--color-heading)" }}
                      >
                        {cellNode(headerCol, row, refs)}
                      </span>
                    )}
                    {estadoCol !== undefined && cellNode(estadoCol, row, refs)}
                  </div>
                  {hasActionsCol && <RowActions actions={actions} row={row} />}
                </div>
                <dl
                  className="grid gap-x-3 gap-y-1.5"
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}
                >
                  {bodyCols.map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt
                        className="text-[0.66rem] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--color-ink-soft)" }}
                      >
                        {c.header}
                      </dt>
                      <dd className="truncate text-[0.82rem]" style={{ color: "var(--color-ink)" }} title={cellTitle(c, row, refs)}>
                        {cellNode(c, row, refs)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div
            ref={scrollRef}
            className="table-scroll"
            style={{ maxHeight: maxBodyHeight, minHeight: 160, overflow: "auto" }}
            onScroll={(e) => updateScrollState(e.currentTarget)}
          >
            <table className="data-table" style={{ tableLayout: "fixed", minWidth: tableMinWidth, width: "100%" }}>
              <colgroup>
                {selectable === true && <col style={{ width: SELECT_W }} />}
                {showToggleCol && <col style={{ width: TOGGLE_W }} />}
                {visibleColumns.map((c) =>
                  c.key === growKey ? <col key={c.key} /> : <col key={c.key} style={{ width: resolveWidth(c) }} />,
                )}
                {hasSpacer && <col />}
                {hasActionsCol && <col style={{ width: ACTIONS_W }} />}
              </colgroup>
              <thead>
                <tr>
                  {selectable === true && (
                    <th style={{ width: SELECT_W }}>
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Seleccionar todo" />
                    </th>
                  )}
                  {showToggleCol && <th style={{ width: TOGGLE_W }} aria-hidden="true" />}
                  {visibleColumns.map((c) => {
                    const active = sort?.key === c.key;
                    const align = resolveAlign(c);
                    return (
                      <th
                        key={c.key}
                        className={align === "right" ? "num" : undefined}
                        title={c.header}
                        style={{
                          cursor: c.sortable === true ? "pointer" : "default",
                          textAlign: align === "center" ? "center" : undefined,
                        }}
                        onClick={
                          c.sortable === true
                            ? () =>
                                setSort((s) =>
                                  s?.key === c.key
                                    ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
                                    : { key: c.key, dir: "asc" },
                                )
                            : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          {c.header}
                          {active && (
                            <Icon
                              name="chevron-down"
                              size={12}
                              className={sort?.dir === "asc" ? "rotate-180" : undefined}
                            />
                          )}
                        </span>
                      </th>
                    );
                  })}
                  {hasSpacer && <th aria-hidden="true" />}
                  {hasActionsCol && <th style={{ width: ACTIONS_W }} aria-hidden="true" />}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const k = rowKey(row);
                  const isOpen = expanded.has(k);
                  return (
                    <Fragment key={k}>
                      <tr>
                        {selectable === true && (
                          <td>
                            <input
                              type="checkbox"
                              checked={checked.has(k)}
                              onChange={() => toggleOne(k)}
                              aria-label="Seleccionar fila"
                            />
                          </td>
                        )}
                        {showToggleCol && (
                          <td>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(k)}
                              aria-label={isOpen ? "Ocultar detalles" : "Mostrar mas detalles"}
                              aria-expanded={isOpen}
                              style={{ color: "var(--color-ink-faint)" }}
                            >
                              <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={14} />
                            </button>
                          </td>
                        )}
                        {visibleColumns.map((c) => {
                          const align = resolveAlign(c);
                          const truncate = isTruncatable(c);
                          return (
                            <td
                              key={c.key}
                              className={[align === "right" ? "num" : undefined, truncate ? "truncate-cell" : undefined]
                                .filter(Boolean)
                                .join(" ") || undefined}
                              style={{ textAlign: align === "center" ? "center" : undefined }}
                              title={truncate ? cellTitle(c, row, refs) : undefined}
                            >
                              {cellNode(c, row, refs)}
                            </td>
                          );
                        })}
                        {hasSpacer && <td aria-hidden="true" />}
                        {hasActionsCol && (
                          <td style={{ overflow: "visible" }}>
                            <RowActions actions={actions} row={row} />
                          </td>
                        )}
                      </tr>
                      {showToggleCol && isOpen && (
                        <tr>
                          <td colSpan={colCount} className="surface-2" style={{ padding: "10px 14px" }}>
                            <dl
                              className="grid gap-x-4 gap-y-1.5"
                              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
                            >
                              {secondaryColumns.map((c) => (
                                <div key={c.key} className="min-w-0">
                                  <dt
                                    className="text-[0.66rem] font-semibold uppercase tracking-wide"
                                    style={{ color: "var(--color-ink-soft)" }}
                                  >
                                    {c.header}
                                  </dt>
                                  <dd className="truncate text-[0.82rem]" style={{ color: "var(--color-ink)" }}>
                                    {cellNode(c, row, refs)}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {scrollState.right && <div className="table-scroll-fade table-scroll-fade-r" aria-hidden="true" />}
          {scrollState.left && <div className="table-scroll-fade table-scroll-fade-l" aria-hidden="true" />}
        </div>
      )}

      {onPage !== undefined && (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{ borderTop: "1px solid var(--color-line)", background: "var(--color-surface)" }}
        >
          <Button size="sm" variant="ghost" icon="chevron-left" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          <span className="text-[0.75rem]" style={{ color: "var(--color-ink-soft)" }}>
            Pag. {page} / {totalPages}
            {props.total !== undefined ? ` · ${props.total} reg.` : ""}
          </span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <span className="hidden sm:inline">Siguiente</span>
            <Icon name="chevron-right" size={14} />
          </Button>
          <div className="flex-1" />
          {props.onReload !== undefined && (
            <Button size="sm" variant="ghost" icon="refresh" onClick={props.onReload}>
              <span className="hidden sm:inline">Recargar</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

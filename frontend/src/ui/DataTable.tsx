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

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon, { type IconName } from "./Icon.js";
import { Button, Chip, EstadoChip, Skeleton, EmptyState } from "./primitives.js";
import { formatDia, formatFechaHora, formatMoney, formatQty, formatRate } from "../core/format.js";
import { prioridadLabel, prioridadTono } from "../core/estados.js";
import { useRefs, type RefKind, type DocRef } from "../core/RefContext.js";
import { filtrarFilas, textoDeFila } from "../core/search.js";
import SearchSelect from "./SearchSelect.js";
import { useDensidad } from "./density.js";

export type ColumnType =
  | "text"
  | "num"
  /** Identificador / numero de documento: entero sin separador de miles (1016, no "1,016"). */
  | "id"
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
  id: 84,
  money: 120,
  rate: 104,
  // 176: cabe el estado mas largo del dominio ("Pendiente del gerente", 22
  // caracteres) en una sola linea — con 140 el chip se partia en 2 lineas.
  estado: 164,
  prioridad: 120,
  date: 112,
  datetime: 156,
};
/** Ancho por defecto de una columna `refKind` sin ancho explicito. */
const REF_WIDTH = 176;

export interface Column<T> {
  readonly key: string;
  /** Propiedad del backend por la que ordena el encabezado (por defecto, `key`): p. ej. "Espera" ordena por la fecha. */
  readonly sortKey?: string;
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
  /** Atajo de UNA tecla con el menu abierto (p. ej. "A" aprobar, "R" rechazar). */
  readonly hotkey?: string;
  /**
   * Accion principal DISCRETA: su boton en linea solo se ve al pasar el cursor / enfocar la fila (o en pantallas
   * tactiles). Evita decenas de botones iguales en una lista; la accion sigue en el menu y con su atajo.
   */
  readonly alPasar?: boolean;
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
  /** false: sin boton de accion principal en linea (solo el menu). */
  inline?: boolean;
  /** Contenedor angosto: la accion principal muestra solo su icono (el rotulo va como tooltip). */
  soloIcono?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const botonWrap = useRef<HTMLSpanElement>(null);
  const botonEl = (): HTMLButtonElement | null => botonWrap.current?.querySelector("button") ?? null;
  const menuRef = useRef<HTMLDivElement>(null);
  /** Posicion fija del menu (se dibuja fuera de la tabla: ningun scroll ni columna fija lo recorta). */
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const cerrar = (devolverFoco: boolean): void => {
    setOpen(false);
    setPos(null);
    if (devolverFoco) botonEl()?.focus();
  };

  // Posiciona el menu junto al boton; si no cabe abajo, se abre hacia arriba; nunca se sale de la pantalla.
  useLayoutEffect(() => {
    if (!open) return;
    const b = botonEl()?.getBoundingClientRect();
    const m = menuRef.current;
    if (b === undefined || m === null) return;
    // Pantalla angosta: el menu es una hoja inferior (se alcanza con el pulgar y no se sale de pantalla).
    if (window.innerWidth < 640) {
      setPos({ top: 0, left: 0 });
      return;
    }
    const w = m.offsetWidth;
    const h = m.offsetHeight;
    const left = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8));
    let top = b.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, b.top - h - 4);
    setPos({ top, left });
  }, [open]);

  // El menu es visible solo cuando ya tiene posicion: recien entonces puede recibir el foco.
  useEffect(() => {
    if (open && pos !== null) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (ref.current?.contains(t) === true || menuRef.current?.contains(t) === true) return;
      cerrar(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cerrar(true);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        if (items.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      } else if (e.key === "Tab") {
        cerrar(false);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Atajo de una tecla: ejecuta la accion cuyo `hotkey` coincide.
        const a = ordered.find((x) => x.hotkey !== undefined && x.hotkey.toLowerCase() === e.key.toLowerCase());
        if (a !== undefined) {
          e.preventDefault();
          e.stopPropagation();
          cerrar(false);
          a.onClick(props.row);
        }
      }
    };
    // Con scroll o cambio de tamano el boton se mueve: se cierra en vez de dejar el menu flotando en otro sitio.
    const onMove = (e: Event): void => {
      if (menuRef.current?.contains(e.target as Node) === true) return;
      cerrar(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const available = props.actions.filter((a) => a.hidden?.(props.row) !== true);
  const ordered = [
    ...available.filter((a) => a.primary === true),
    ...available.filter((a) => a.primary !== true),
  ];
  const empty = ordered.length === 0;
  // La accion principal del documento va VISIBLE en la fila (un clic), no escondida en el menu.
  const principal = props.inline === false ? undefined : available.find((a) => a.primary === true);

  return (
    <div ref={ref} className="relative flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      {principal !== undefined && (
        <Button size="sm" variant="secondary" icon={principal.icon} aria-label={principal.label} title={principal.label} className={principal.alPasar === true ? "accion-al-pasar" : undefined} onClick={() => principal.onClick(props.row)}>
          {props.soloIcono !== true && <span className="hidden sm:inline">{principal.label}</span>}
        </Button>
      )}
      <span ref={botonWrap} className="inline-flex">
      <Button
        size="sm"
        variant="ghost"
        aria-label="Más opciones"
        title="Acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={empty}
        onClick={() => (open ? cerrar(false) : setOpen(true))}
      >
        <Icon name="sliders" size={16} />
      </Button>
      </span>
      {open &&
        !empty &&
        createPortal(
          <>
          {window.innerWidth < 640 && (
            <div className="fixed inset-0 z-[69]" style={{ background: "rgba(0,0,0,.35)" }} onMouseDown={() => cerrar(false)} aria-hidden="true" />
          )}
          <div
            ref={menuRef}
            role="menu"
            aria-label="Acciones"
            className="fixed z-[70] min-w-[200px] overflow-hidden rounded-lg py-1"
            style={{
              ...(window.innerWidth < 640
                ? { left: 8, right: 8, bottom: 8, top: "auto", borderRadius: 14, paddingBottom: 6 }
                : { top: pos?.top ?? 0, left: pos?.left ?? 0 }),
              visibility: pos === null ? "hidden" : "visible",
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {ordered.map((a, i) => (
              <Fragment key={a.label}>
                {a.tone === "danger" && i > 0 && ordered[i - 1]?.tone !== "danger" && (
                  <div role="separator" style={{ height: 1, margin: "4px 0", background: "var(--color-line)" }} />
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item flex w-full items-center gap-2 px-3 py-2 text-left text-[0.84rem]"
                  style={{
                    color: a.tone === "danger" ? "var(--color-danger)" : "var(--color-ink)",
                    fontWeight: a.primary === true ? 600 : 400,
                  }}
                  onClick={() => {
                    cerrar(false);
                    a.onClick(props.row);
                  }}
                >
                  {a.icon !== undefined && <Icon name={a.icon} size={15} />}
                  {a.label}
                  {a.hotkey !== undefined && (
                    <kbd
                      className="ml-auto rounded px-1.5 text-[0.68rem] font-semibold"
                      style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-faint)" }}
                      aria-hidden="true"
                    >
                      {a.hotkey.toUpperCase()}
                    </kbd>
                  )}
                </button>
              </Fragment>
            ))}
          </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/**
 * Si una busqueda no da resultados, sugiere una version mas corta de la ultima palabra (tolera errores de
 * tecleo al final: "proveedr" -> "prove"). null si no hay nada razonable que sugerir.
 */
function sugerenciaBusqueda(texto: string): string | null {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const ultima = palabras[palabras.length - 1];
  if (ultima === undefined || ultima.length < 5) return null;
  const corta = ultima.slice(0, Math.max(3, Math.ceil(ultima.length * 0.6)));
  return [...palabras.slice(0, -1), corta].join(" ");
}

/** Boton "Columnas": el usuario elige que columnas ver en la tabla (el resto queda en el desplegable de la fila). */
function ColumnasPopover<T>(props: {
  columns: readonly Column<T>[];
  onToggle: (key: string) => void;
  onReset: () => void;
  personalizado: boolean;
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
  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="ghost" icon="layers" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)} title="Elegir columnas de la tabla">
        <span className="hidden lg:inline">Columnas</span>
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-[240px] rounded-lg p-2"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="px-1 pb-1 text-[0.7rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
            Columnas en la tabla
          </div>
          {props.columns.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[0.82rem]" style={{ color: "var(--color-ink)" }}>
              <input type="checkbox" checked={c.priority !== "secondary"} onChange={() => props.onToggle(c.key)} />
              {c.header}
            </label>
          ))}
          <div className="mt-1 flex items-center justify-between border-t px-1 pt-1.5" style={{ borderColor: "var(--color-line)" }}>
            <span className="text-[0.72rem]" style={{ color: "var(--color-ink-faint)" }}>
              Las demás van en el «+» de cada fila.
            </span>
            {props.personalizado && (
              <Button size="sm" variant="ghost" onClick={props.onReset}>
                Restablecer
              </Button>
            )}
          </div>
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
      if ((e.target as HTMLElement).closest?.("[data-select-panel]") !== null) return;
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
                <SearchSelect
                  value={props.values[f.key] ?? ""}
                  options={f.options}
                  placeholder="Todos"
                  onChange={(v) => props.onChange(f.key, v)}
                />
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
  if (v === null || v === undefined || v === "") return type === "money" ? "Sin monto" : "—";
  if (type === "date") return formatDia(v);
  if (type === "datetime") return formatFechaHora(v);
  if (type === "money") return formatMoney(v);
  if (type === "rate") return formatRate(v);
  if (type === "prioridad") return prioridadLabel(v);
  if (type === "id") return String(v);
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
  return c.type === "num" || c.type === "id" || c.type === "money" || c.type === "rate" ? "right" : "left";
}

/** true si la celda es texto/valor plano (candidata a truncar con elipsis). */
function isTruncatable<T>(c: Column<T>): boolean {
  return c.render === undefined && c.type !== "estado" && c.type !== "prioridad";
}

const SELECT_W = 38;
const ACTIONS_W = 60;
/** Con accion principal en linea (boton con rotulo + menu): ancho suficiente para que NUNCA invada la columna vecina. */
const ACTIONS_W_PRINCIPAL = 192;
const TOGGLE_W = 30;
/** Por debajo de este ancho de contenedor, las filas se muestran como tarjetas. */
const CARD_BREAKPOINT = 560;
/** Las columnas `secondary` van SIEMPRE en el desplegable de la fila (la tabla lleva solo lo importante). */

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

/**
 * Alto maximo (px) para el cuerpo de la tabla de modo que la tarjeta completa, paginacion incluida,
 * quepa en el area visible de `<main>` (el unico scroller). Se recalcula al redimensionar la ventana
 * o cambiar el contenido que hay sobre la tabla. Devuelve null fuera de `<main>` (pruebas, modales).
 */
function useAltoDisponible(
  wrapRef: React.RefObject<HTMLDivElement | null>,
  activo: boolean,
  deps: readonly unknown[],
): number | null {
  const [alto, setAlto] = useState<number | null>(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const main = wrap?.closest("main") ?? null;
    if (!activo || wrap === null || main === null) return;
    const medir = (): void => {
      const cuerpo = wrap.querySelector<HTMLElement>("[data-tbody]");
      if (cuerpo === null) return;
      const wr = wrap.getBoundingClientRect();
      const chrome = wr.height - cuerpo.getBoundingClientRect().height; // barra de herramientas + paginacion
      const arriba = wr.top - main.getBoundingClientRect().top + main.scrollTop;
      const disponible = main.clientHeight - arriba - chrome - 20;
      setAlto(Math.max(220, Math.floor(disponible)));
    };
    medir();
    window.addEventListener("resize", medir);
    if (typeof ResizeObserver === "undefined") return () => window.removeEventListener("resize", medir);
    const ro = new ResizeObserver(medir);
    ro.observe(main);
    if (main.firstElementChild !== null) ro.observe(main.firstElementChild);
    return () => {
      window.removeEventListener("resize", medir);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, wrapRef, ...deps]);
  return alto;
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
  /**
   * Buscador server-side (`?q=`): el backend busca cada palabra en todos los
   * campos del registro y en sus relaciones (ver SearchDescriptor).
   */
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  /**
   * Orden CONTROLADO (server-side). Si se pasa `onSort`, el click en un
   * encabezado `sortable` cicla asc -> desc -> sin orden (vuelve al orden por
   * defecto del servidor: lo mas reciente primero) y re-consulta TODO el
   * conjunto, no solo la pagina visible. `key` es la propiedad del backend.
   */
  sort?: { key: string; dir: "asc" | "desc" } | null;
  /**
   * Buscador EN MEMORIA para tablas con todas sus filas cargadas (reportes):
   * la tabla filtra por si misma, sin que el padre maneje el texto. Mismas
   * reglas que `?q=`: todas las palabras, sin mayusculas ni acentos.
   */
  localSearch?: { placeholder?: string; text?: (row: T) => string };
  onSort?: (sort: { key: string; dir: "asc" | "desc" } | null) => void;
  /** Identificador de esta tabla: habilita "Columnas" (el usuario elige que ver en la tabla; se recuerda). */
  columnsKey?: string;
  /** Fila recien creada/editada: se resalta unos segundos y se desplaza a la vista. */
  highlightKey?: string | number | null;
  /** Estado vacio (sin busqueda ni filtros): accion concreta para empezar. */
  emptyAction?: { label: string; onClick: () => void };
  /** Nombre de archivo (sin extension) para el boton "Exportar" (CSV de la pagina actual). */
  exportFilename?: string;
  /**
   * Si se pasa, "Exportar" baja TODO lo filtrado (no solo la pagina visible): la funcion
   * devuelve todas las filas del filtro actual.
   */
  exportAll?: () => Promise<readonly T[]>;
  /** Clic (o Enter) en una fila: abrir su detalle. Los controles internos no lo disparan. */
  onRowClick?: (row: T) => void;
  /** Boton "Filtrar" con panel de selects (server-side, `campo__eq`). */
  filters?: {
    fields: readonly { key: string; label: string; options: readonly { value: string; label: string }[] }[];
    values: Readonly<Record<string, string>>;
    onChange: (key: string, value: string) => void;
    onClear: () => void;
  };
}): React.ReactElement {
  const {
    columns: columnsProp,
    rows,
    rowKey,
    loading,
    actions = [],
    selectable,
    bulkActions = [],
    onPage,
    // El cuerpo hace scroll propio: el encabezado queda fijo y la paginacion
    // siempre visible al pie. Sin valor explicito, el alto se MIDE (ver `useAltoDisponible`):
    // el descuento fijo anterior (270 px) no contaba lo que hay sobre la tabla (titulo, flujo,
    // filtros), asi que en pantallas bajas o con escala de Windows >100 % la paginacion quedaba
    // bajo el borde y habia que desplazar la pagina para ver el total.
    maxBodyHeight: maxBodyHeightProp,
  } = props;

  // Columnas: el usuario puede elegir cuales ver en la tabla (el resto va al desplegable de la fila).
  const claveCols = props.columnsKey !== undefined ? `erp.cols.${props.columnsKey}` : null;
  const [overrides, setOverrides] = useState<Readonly<Record<string, boolean>>>(() => {
    if (claveCols === null) return {};
    try {
      return JSON.parse(window.localStorage.getItem(claveCols) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const columns = useMemo<readonly Column<T>[]>(
    () =>
      columnsProp.map((c) => {
        const ov = overrides[c.key];
        if (ov === undefined) return c;
        return { ...c, priority: ov ? ("primary" as const) : ("secondary" as const) };
      }),
    [columnsProp, overrides],
  );
  function alternarColumna(key: string): void {
    const actual = columns.find((c) => c.key === key)?.priority !== "secondary";
    // siempre debe quedar al menos una columna en la tabla
    if (actual && columns.filter((c) => c.priority !== "secondary").length <= 1) return;
    const next = { ...overrides, [key]: !actual };
    setOverrides(next);
    if (claveCols !== null) {
      try {
        window.localStorage.setItem(claveCols, JSON.stringify(next));
      } catch {
        /* sin almacenamiento: solo no se recuerda */
      }
    }
  }
  function restablecerColumnas(): void {
    setOverrides({});
    if (claveCols !== null) {
      try {
        window.localStorage.removeItem(claveCols);
      } catch {
        /* nada */
      }
    }
  }

  const [localQuery, setLocalQuery] = useState("");
  // Con `localSearch` la tabla es dueña del texto; con `search` lo es el padre (servidor).
  const search = props.search ?? (props.localSearch !== undefined
    ? { value: localQuery, onChange: setLocalQuery, placeholder: props.localSearch.placeholder }
    : undefined);
  const baseRows = useMemo(
    () =>
      props.localSearch !== undefined
        ? filtrarFilas(props.rows, localQuery, props.localSearch.text ?? ((r: T) => textoDeFila(r)))
        : props.rows,
    [props.rows, props.localSearch, localQuery],
  );
  const [localSort, setLocalSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const serverSort = props.onSort !== undefined;
  const sort = serverSort ? (props.sort ?? null) : localSort;
  /** asc -> desc -> sin orden. */
  function cycleSort(key: string): void {
    const next: { key: string; dir: "asc" | "desc" } | null =
      sort?.key !== key
        ? { key, dir: "asc" }
        : sort.dir === "asc"
          ? { key, dir: "desc" }
          : null;
    if (props.onSort !== undefined) props.onSort(next);
    else setLocalSort(next);
  }
  const [checked, setChecked] = useState<Set<string | number>>(new Set());
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const refs = useRefs();
  const [wrapRef, containerWidth] = useContainerWidth();
  // Atajo: "/" lleva el foco al buscador de la tabla (como en GitHub o Gmail).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t !== null && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]') !== null) return;
      const caja = wrapRef.current?.querySelector<HTMLInputElement>('[role="searchbox"]');
      if (caja === null || caja === undefined) return;
      e.preventDefault();
      caja.focus();
      caja.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wrapRef]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const altoMedido = useAltoDisponible(wrapRef, maxBodyHeightProp === undefined, [props.rows.length, props.loading, containerWidth]);
  const maxBodyHeight = maxBodyHeightProp ?? (altoMedido !== null ? `${altoMedido}px` : "min(64vh, calc(100dvh - 270px))");
  // Fila recien creada/editada: se lleva a la vista (y el CSS la resalta unos segundos).
  useEffect(() => {
    if (props.highlightKey === undefined || props.highlightKey === null) return;
    const t = window.setTimeout(() => {
      wrapRef.current?.querySelector(`[data-fila="${String(props.highlightKey)}"]`)?.scrollIntoView?.({ block: "nearest" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [props.highlightKey, props.rows, wrapRef]);

  const sorted = useMemo(() => {
    // Orden en servidor: las filas ya llegan ordenadas, no se reordena la pagina aqui.
    if (sort === null || serverSort) return baseRows;
    const col = columns.find((c) => (c.sortKey ?? c.key) === sort.key);
    if (col?.value === undefined) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...baseRows].sort((a, b) => {
      const va = col.value?.(a) ?? "";
      const vb = col.value?.(b) ?? "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [baseRows, sort, columns, serverSort]);

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
  const [densidad, alternarDensidad] = useDensidad();
  const [exportando, setExportando] = useState(false);
  async function exportCsv(): Promise<void> {
    let filas: readonly T[] = sorted;
    if (props.exportAll !== undefined) {
      setExportando(true);
      try {
        filas = await props.exportAll();
      } catch {
        filas = sorted;
      } finally {
        setExportando(false);
      }
    }
    exportarFilas(filas);
  }
  function exportarFilas(filasExp: readonly T[]): void {
    // Inyeccion de formulas (CSV injection): una celda que empieza por = + - @ (o tab/CR) se
    // ejecuta como formula al abrir el CSV en Excel. Se antepone un apostrofo para neutralizarla.
    const escape = (raw: string): string => {
      const peligrosa = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+([.,]\d+)?$/.test(raw);
      const v = peligrosa ? `'${raw}` : raw;
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const header = columns.map((c) => escape(c.header)).join(",");
    const lines = filasExp.map((row) =>
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
  const buscando = search !== undefined && search.value.trim() !== "";
  const filtrando =
    props.filters !== undefined && Object.values(props.filters.values).some((v) => v !== "");

  // -- Layout responsive: tabla completa / tabla + disclosure / tarjetas ----
  const isCardView = containerWidth !== null && containerWidth < CARD_BREAKPOINT;
  const primaryColumns = columns.filter((c) => c.priority !== "secondary");
  const secondaryColumns = columns.filter((c) => c.priority === "secondary");
  // Las columnas de apoyo (secondary) NUNCA van en la tabla: viven en el desplegable de cada fila. Asi la tabla lleva solo lo importante.
  const showAllInline = secondaryColumns.length === 0;
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
  const sinAcciones =
    visibleColumns.reduce((a, c) => (c.key === growKey ? a : a + resolveWidth(c)), 0) +
    (selectable === true ? SELECT_W : 0) +
    (showToggleCol ? TOGGLE_W : 0);
  const hayPrincipal = actions.some((a) => a.primary === true);
  // La accion principal pasa a solo icono cuando el contenedor es angosto O cuando, con rotulo, la tabla no cabe
  // (p. ej. el usuario agrego columnas o hay un panel abierto): asi se gana el ancho para los datos.
  const accionesCompactas =
    hasActionsCol &&
    hayPrincipal &&
    containerWidth !== null &&
    (containerWidth < 940 || sinAcciones + 120 + ACTIONS_W_PRINCIPAL > containerWidth);
  const actionsW = hayPrincipal ? (accionesCompactas ? 104 : ACTIONS_W_PRINCIPAL) : ACTIONS_W;
  const fixedWidth = sinAcciones + (hasActionsCol ? actionsW : 0);
  // La columna que crece cede hasta 96 px antes de que aparezca el scroll horizontal.
  const growMinWidth = growKey !== undefined ? Math.min(96, resolveWidth(visibleColumns.find((c) => c.key === growKey)!)) : 0;
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
    <div className="card" style={{ padding: 0, isolation: "isolate", overflow: "clip" }} ref={wrapRef}>
      {(search !== undefined || props.exportFilename !== undefined || props.filters !== undefined) && (
        <div
          className="flex flex-wrap items-center gap-2 p-3"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          {search !== undefined && (
            <div
              className="search-box flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "var(--field-bg)", border: "1px solid var(--field-border)" }}
            >
              <Icon name="search" size={15} />
              <input
                type="search"
                role="searchbox"
                aria-label={search.placeholder ?? "Buscar"}
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
                value={search.value}
                onChange={(e) => search!.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && search!.value !== "") {
                    e.preventDefault();
                    search!.onChange("");
                  }
                }}
                placeholder={search.placeholder ?? "Buscar..."}
                title="Atajo: /"
                className="w-full min-w-0 bg-transparent text-[0.85rem]"
                style={{ color: "var(--color-ink)", outline: "none", boxShadow: "none", border: "none" }}
              />
              {search.value !== "" && (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  title="Limpiar búsqueda (Esc)"
                  className="grid place-items-center rounded-full"
                  style={{ color: "var(--color-ink-faint)", width: 20, height: 20 }}
                  onClick={() => search!.onChange("")}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          )}
          {props.localSearch !== undefined && buscando && (
            <span className="text-[0.75rem]" style={{ color: "var(--color-ink-soft)" }} aria-live="polite">
              {sorted.length} de {props.rows.length}
            </span>
          )}
          {props.filters !== undefined && props.filters.fields.length > 0 && (
            <FilterPopover
              fields={props.filters.fields}
              values={props.filters.values}
              onChange={props.filters.onChange}
              onClear={props.filters.onClear}
            />
          )}
          {claveCols !== null && (
            <ColumnasPopover columns={columns} onToggle={alternarColumna} onReset={restablecerColumnas} personalizado={Object.keys(overrides).length > 0} />
          )}
          <Button
            size="sm"
            variant="ghost"
            icon="list"
            aria-label={densidad === "comoda" ? "Cambiar a vista compacta" : "Cambiar a vista cómoda"}
            title={densidad === "comoda" ? "Vista compacta (más filas)" : "Vista cómoda"}
            onClick={alternarDensidad}
          >
            <span className="hidden lg:inline">{densidad === "comoda" ? "Compacta" : "Cómoda"}</span>
          </Button>
          {props.exportFilename !== undefined && (
            <Button size="sm" variant="secondary" icon="download" disabled={exportando} onClick={() => void exportCsv()}>
              {exportando ? "Preparando…" : "Exportar"}
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
        buscando || filtrando ? (
          <div className="grid place-items-center gap-2 py-12 text-center" style={{ color: "var(--color-ink-faint)" }}>
            <Icon name="search" size={30} />
            <div className="font-semibold" style={{ color: "var(--color-ink-soft)" }}>
              {buscando ? `Sin resultados para «${search!.value.trim()}»` : "Ningún registro cumple los filtros"}
            </div>
            <div className="text-[0.8rem]">
              {buscando
                ? "Revisa la ortografía o prueba con menos palabras. Se busca en todos los campos, incluido el proveedor."
                : "Prueba quitando algún filtro."}
            </div>
            <div className="mt-1 flex gap-2">
              {buscando && sugerenciaBusqueda(search!.value) !== null && (
                <Button size="sm" variant="secondary" icon="search" onClick={() => search!.onChange(sugerenciaBusqueda(search!.value)!)}>
                  Probar con «{sugerenciaBusqueda(search!.value)}»
                </Button>
              )}
              {buscando && (
                <Button size="sm" variant="secondary" onClick={() => search!.onChange("")}>
                  Ver todos los registros
                </Button>
              )}
              {filtrando && (
                <Button size="sm" variant="secondary" onClick={props.filters!.onClear}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title={props.emptyTitle ?? "Sin registros"} hint={props.emptyHint} action={props.emptyAction} />
        )
      ) : isCardView ? (
        <div data-tbody className="grid gap-2 p-2.5" style={{ maxHeight: maxBodyHeight, overflowY: "auto" }}>
          {sorted.map((row) => {
            const k = rowKey(row);
            const headerCol = primaryColumns[0] ?? columns[0];
            const estadoCol = columns.find((c) => c.type === "estado" && c.key !== headerCol?.key);
            const bodyCols = primaryColumns.filter((c) => c.key !== headerCol?.key && c.key !== estadoCol?.key);
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
            data-tbody
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
                {hasActionsCol && <col style={{ width: actionsW }} />}
              </colgroup>
              <thead>
                <tr>
                  {selectable === true && (
                    <th className="col-select" style={{ width: SELECT_W }}>
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Seleccionar todo" />
                    </th>
                  )}
                  {showToggleCol && <th className="col-select" style={{ width: TOGGLE_W }} aria-hidden="true" />}
                  {visibleColumns.map((c) => {
                    const sk = c.sortKey ?? c.key;
                    const active = sort?.key === sk;
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
                        aria-sort={
                          active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined
                        }
                        onClick={c.sortable === true ? () => cycleSort(sk) : undefined}
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
                  {hasActionsCol && <th className="col-acciones" style={{ width: actionsW }} aria-hidden="true" />}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const k = rowKey(row);
                  const isOpen = expanded.has(k);
                  return (
                    <Fragment key={k}>
                      <tr
                        data-fila={String(k)}
                        onContextMenu={(e) => {
                          // Clic derecho: abre el mismo menu de acciones de la fila.
                          const b = e.currentTarget.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
                          if (b === null || b.disabled) return;
                          e.preventDefault();
                          b.click();
                        }}
                        className={
                          [props.onRowClick !== undefined ? "fila-clicable" : "", props.highlightKey !== undefined && props.highlightKey !== null && String(props.highlightKey) === String(k) ? "fila-nueva" : ""]
                            .filter(Boolean)
                            .join(" ") || undefined
                        }
                        tabIndex={props.onRowClick !== undefined ? 0 : undefined}
                        onClick={props.onRowClick !== undefined ? () => props.onRowClick!(row) : undefined}
                        onKeyDown={
                          props.onRowClick !== undefined
                            ? (e) => {
                                if (e.key === "Enter" && e.target === e.currentTarget) props.onRowClick!(row);
                              }
                            : undefined
                        }
                      >
                        {selectable === true && (
                          <td className="col-select" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked.has(k)}
                              onChange={() => toggleOne(k)}
                              aria-label="Seleccionar fila"
                            />
                          </td>
                        )}
                        {showToggleCol && (
                          <td className="col-select" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(k)}
                              aria-label={isOpen ? "Ocultar detalles" : "Mostrar más detalles"}
                              aria-expanded={isOpen}
                              style={{ color: "var(--color-ink-faint)" }}
                            >
                              <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={14} />
                            </button>
                          </td>
                        )}
                        {visibleColumns.map((c, ci) => {
                          const align = resolveAlign(c);
                          const truncate = isTruncatable(c);
                          return (
                            <td
                              key={c.key}
                              className={[
                                align === "right" ? "num" : undefined,
                                truncate ? "truncate-cell" : undefined,
                                ci === 0 ? "col-principal" : c.priority === "secondary" ? "col-apoyo" : undefined,
                              ]
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
                          <td className="col-acciones" style={{ overflow: "visible" }} onClick={(e) => e.stopPropagation()}>
                            <RowActions actions={actions} row={row} soloIcono={accionesCompactas} />
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
          {(scrollState.right || scrollState.left) && (
            <div className="table-scroll-hint" style={{ right: (hasActionsCol ? actionsW : 0) + 12 }}>
              {scrollState.left && (
                <button type="button" aria-label="Ver columnas anteriores" onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })}>
                  ‹
                </button>
              )}
              {scrollState.right && (
                <button type="button" aria-label="Ver más columnas" onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}>
                  Más columnas ›
                </button>
              )}
            </div>
          )}
          {scrollState.left && <div className="table-scroll-fade table-scroll-fade-l" aria-hidden="true" />}
        </div>
      )}

      {onPage !== undefined && (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{ borderTop: "1px solid var(--color-line)", background: "var(--color-surface)", position: "sticky", bottom: 0, zIndex: 5 }}
        >
          <Button size="sm" variant="ghost" icon="chevron-left" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          <span className="text-[0.75rem]" style={{ color: "var(--color-ink-soft)" }}>
            Página {page} de {totalPages}
            {props.total !== undefined
              ? buscando
                ? ` · ${props.total} resultado${props.total === 1 ? "" : "s"}`
                : ` · ${props.total} registro${props.total === 1 ? "" : "s"}`
              : ""}
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

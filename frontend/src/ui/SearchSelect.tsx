/**
 * Lista desplegable con BUSCADOR DEDICADO (combobox accesible).
 *
 * Al desplegarla aparece, dentro del propio panel, un cuadro de busqueda ya
 * enfocado: se escribe y la lista se filtra al instante (todas las palabras,
 * sin mayusculas ni acentos — mismas reglas que el resto del sistema). Teclado:
 * ↑ ↓ Inicio Fin mueven, Enter elige, Esc cierra, Tab cierra. El panel se
 * dibuja en un portal con posicion fija: no lo recortan modales ni tablas con
 * scroll, y se abre hacia arriba si abajo no hay espacio.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.js";
import { coincide } from "../core/search.js";

export interface SearchSelectOption {
  readonly value: string;
  readonly label: string;
}

const ALTO_MAX_LISTA = 240;
const ALTO_CABECERA = 52;

export default function SearchSelect(props: {
  id?: string;
  value: string;
  options: readonly SearchSelectOption[];
  onChange: (value: string) => void;
  /** Texto cuando no hay seleccion. */
  placeholder?: string;
  /** Si es false, se ofrece "— quitar selección —" para vaciarlo. */
  required?: boolean;
  disabled?: boolean;
  /** Texto cuando no hay ninguna opcion (select dependiente sin padre). */
  emptyHint?: string;
  onBlur?: () => void;
  "data-state"?: string;
}): React.ReactElement {
  const { value, options, onChange } = props;
  const autoId = useId();
  const id = props.id ?? autoId;
  const listId = `${id}-lista`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; arriba: boolean } | null>(null);

  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const seleccionada = options.find((o) => o.value === value);
  const sinOpciones = options.length === 0;

  const filtradas = useMemo(() => {
    const base = query.trim() === "" ? options : options.filter((o) => coincide(o.label, query));
    return base;
  }, [options, query]);

  // Entradas navegables: opcion de vaciar (si no es obligatorio) + filtradas.
  const entradas = useMemo<readonly SearchSelectOption[]>(
    () =>
      props.required === true || query.trim() !== "" || value === ""
        ? filtradas
        : [{ value: "", label: "— quitar selección —" }, ...filtradas],
    [filtradas, props.required, query, value],
  );

  const cerrar = useCallback((devolverFoco: boolean) => {
    setOpen(false);
    setQuery("");
    if (devolverFoco) trigger.current?.focus();
  }, []);

  const elegir = useCallback(
    (v: string) => {
      onChange(v);
      cerrar(true);
    },
    [onChange, cerrar],
  );

  // Posicion: bajo el disparador, o arriba si no cabe.
  const reubicar = useCallback(() => {
    const el = trigger.current;
    if (el === null) return;
    const r = el.getBoundingClientRect();
    const necesario = ALTO_CABECERA + Math.min(ALTO_MAX_LISTA, 8 + Math.max(entradas.length, 1) * 34) + 8;
    const abajo = window.innerHeight - r.bottom;
    const arriba = abajo < necesario && r.top > abajo;
    const ancho = Math.max(r.width, 220);
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)),
      top: arriba ? r.top - 4 : r.bottom + 4,
      width: ancho,
      arriba,
    });
  }, [entradas.length]);

  useLayoutEffect(() => {
    if (open) reubicar();
  }, [open, reubicar]);

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event): void => {
      // Scroll DENTRO del panel (la lista) no cierra ni mueve nada.
      if (panel.current?.contains(e.target as Node) === true) return;
      reubicar();
    };
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (panel.current?.contains(t) === true || trigger.current?.contains(t) === true) return;
      cerrar(false);
      props.onBlur?.();
    };
    window.addEventListener("resize", reubicar);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("resize", reubicar);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, reubicar, cerrar, props]);

  // Al abrir: foco en el buscador y la seleccion actual resaltada.
  useEffect(() => {
    if (!open) return;
    const i = entradas.findIndex((o) => o.value === value && value !== "");
    setActivo(i >= 0 ? i : 0);
    const t = window.setTimeout(() => buscador.current?.focus(), 0);
    return () => window.clearTimeout(t);
    // solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Al escribir, la primera coincidencia queda activa.
  useEffect(() => {
    setActivo(0);
  }, [query]);

  // Mantiene visible la opcion activa.
  useEffect(() => {
    if (!open) return;
    lista.current?.querySelector<HTMLElement>(`[data-i="${activo}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [activo, open]);

  function onKeyDownBuscador(e: React.KeyboardEvent): void {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActivo((i) => Math.min(entradas.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActivo((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActivo(0);
        break;
      case "End":
        e.preventDefault();
        setActivo(Math.max(0, entradas.length - 1));
        break;
      case "Enter": {
        e.preventDefault();
        const o = entradas[activo];
        if (o !== undefined) elegir(o.value);
        break;
      }
      case "Escape":
        e.preventDefault();
        e.stopPropagation(); // no cierra el modal que contiene al campo
        cerrar(true);
        break;
      case "Tab":
        cerrar(false);
        props.onBlur?.();
        break;
      default:
    }
  }

  const textoDisparador =
    seleccionada?.label ??
    (sinOpciones && props.emptyHint !== undefined ? props.emptyHint : (props.placeholder ?? "— seleccionar —"));

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={props.disabled === true}
        data-state={props["data-state"]}
        className="field-control flex w-full items-center justify-between gap-2 text-left"
        style={{ cursor: props.disabled === true ? "not-allowed" : "pointer" }}
        onClick={() => (open ? cerrar(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          className="min-w-0 flex-1 truncate"
          style={{ color: seleccionada === undefined ? "var(--color-ink-faint)" : undefined }}
        >
          {textoDisparador}
        </span>
        <Icon name="chevron-down" size={14} className={open ? "rotate-180" : undefined} />
      </button>

      {open &&
        pos !== null &&
        createPortal(
          <div
            ref={panel}
            data-select-panel=""
            className="rounded-lg"
            style={{
              position: "fixed",
              zIndex: 1000,
              left: pos.left,
              width: pos.width,
              ...(pos.arriba ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
            }}
          >
            <div className="p-2" style={{ borderBottom: "1px solid var(--color-line)" }}>
              <div
                className="search-box flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{ background: "var(--field-bg)", border: "1px solid var(--field-border)" }}
              >
                <Icon name="search" size={14} />
                <input
                  ref={buscador}
                  type="search"
                  role="searchbox"
                  aria-label="Buscar en la lista"
                  aria-controls={listId}
                  aria-activedescendant={entradas[activo] !== undefined ? `${id}-op-${activo}` : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Buscar…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDownBuscador}
                  className="w-full min-w-0 bg-transparent text-[0.85rem]"
                  style={{ color: "var(--color-ink)", outline: "none", boxShadow: "none", border: "none" }}
                />
                {query !== "" && (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => {
                      setQuery("");
                      buscador.current?.focus();
                    }}
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    <Icon name="x" size={13} />
                  </button>
                )}
              </div>
            </div>
            <ul
              ref={lista}
              id={listId}
              role="listbox"
              className="py-1"
              style={{ maxHeight: ALTO_MAX_LISTA, overflowY: "auto" }}
            >
              {entradas.length === 0 ? (
                <li className="px-3 py-3 text-center text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
                  {sinOpciones ? (props.emptyHint ?? "No hay opciones") : `Sin resultados para «${query.trim()}»`}
                </li>
              ) : (
                entradas.map((o, i) => {
                  const esActiva = i === activo;
                  const esElegida = o.value === value && o.value !== "";
                  return (
                    <li
                      key={`${o.value}-${i}`}
                      id={`${id}-op-${i}`}
                      data-i={i}
                      role="option"
                      aria-selected={esElegida}
                      className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[0.85rem]"
                      style={{
                        background: esActiva ? "var(--color-brand-050)" : "transparent",
                        color: o.value === "" ? "var(--color-ink-faint)" : "var(--color-ink)",
                        fontWeight: esElegida ? 600 : 400,
                      }}
                      onMouseEnter={() => setActivo(i)}
                      onMouseDown={(e) => e.preventDefault() /* no roba el foco al buscador */}
                      onClick={() => elegir(o.value)}
                    >
                      <span className="min-w-0 flex-1 truncate" title={o.label}>
                        {o.label}
                      </span>
                      {esElegida && <Icon name="check" size={14} />}
                    </li>
                  );
                })
              )}
            </ul>
            {query.trim() !== "" && filtradas.length > 0 && (
              <div className="px-3 py-1 text-[0.7rem]" style={{ borderTop: "1px solid var(--color-line)", color: "var(--color-ink-faint)" }}>
                {filtradas.length} de {options.length}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

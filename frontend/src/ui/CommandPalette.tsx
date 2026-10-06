/**
 * Busqueda rapida global con Ctrl+K (skills/patron-diseno.md seccion 11).
 * Filtra las entradas de navegacion y permite saltar con el teclado.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.js";
import { ALL_LEAVES, type NavLeaf } from "../nav.js";
import { normalizarTexto } from "../core/search.js";

export function useCommandPalette(): {
  open: boolean;
  setOpen: (v: boolean) => void;
} {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandPalette(props: {
  open: boolean;
  onClose: () => void;
  onPick: (leaf: NavLeaf) => void;
  /** Pantallas visibles para el usuario (RBAC). Por defecto, todas. */
  leaves?: readonly NavLeaf[];
}): React.ReactElement | null {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const pool = props.leaves ?? ALL_LEAVES;
  const results = useMemo(() => {
    const t = normalizarTexto(q.trim());
    if (t === "") return pool.slice(0, 8);
    return pool.filter((l) => normalizarTexto(l.label).includes(t)).slice(0, 10);
  }, [q, pool]);

  useEffect(() => {
    if (props.open) {
      setQ("");
      setIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4"
      style={{ background: "var(--overlay)", backdropFilter: "blur(2px)", paddingTop: "12vh" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="card w-full" style={{ maxWidth: 560, boxShadow: "var(--shadow-lg)", padding: 0 }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, results.length - 1));
              else if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
              else if (e.key === "Enter" && results[idx] !== undefined) {
                props.onPick(results[idx]!);
                props.onClose();
              } else if (e.key === "Escape") props.onClose();
            }}
            placeholder="Buscar pantalla, catálogo, documento…"
            className="w-full bg-transparent outline-none text-[0.95rem]"
            style={{ color: "var(--color-ink)" }}
          />
          <kbd className="chip" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-faint)" }}>
            Esc
          </kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto py-1">
          {results.map((l, i) => (
            <li key={l.id}>
              <button
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => {
                  props.onPick(l);
                  props.onClose();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[0.88rem]"
                style={{
                  background: i === idx ? "var(--color-brand-050)" : "transparent",
                  color: i === idx ? "var(--color-brand-ink)" : "var(--color-ink)",
                }}
              >
                <Icon name="arrow-right" size={15} />
                {l.label}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-[0.85rem]" style={{ color: "var(--color-ink-faint)" }}>
              Sin coincidencias
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

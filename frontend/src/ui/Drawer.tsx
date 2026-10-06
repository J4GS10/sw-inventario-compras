/**
 * Panel lateral de detalle: se abre a la DERECHA sin tapar ni bloquear la lista (en pantallas anchas la lista se
 * recorre a su izquierda), así se puede saltar de un documento al siguiente con ↑ / ↓ sin cerrar y volver a abrir.
 * Esc cierra. En móvil ocupa todo el ancho.
 */

import { useEffect } from "react";
import Icon from "./Icon.js";
import { Button } from "./primitives.js";

const esCampoDeTexto = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  return el !== null && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export function Drawer(props: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Navegación entre documentos de la lista (↑ anterior, ↓ siguiente). */
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  /** "3 de 25". */
  posicion?: string | undefined;
}): React.ReactElement | null {
  const { open, onClose, onPrev, onNext } = props;

  // La lista reserva el espacio del panel mientras está abierto (CSS: html[data-drawer="open"]).
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset["drawer"] = "open";
    return () => {
      delete document.documentElement.dataset["drawer"];
    };
  }, [open]);

  // Clic fuera del panel lo cierra. No cuentan: el propio panel, una fila de la tabla (cambia de documento), un modal,
  // un menu o una lista desplegable abiertos, y los avisos.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t === null || typeof t.closest !== "function") return;
      if (t.closest("aside.drawer, [role=dialog], [role=menu], [role=listbox], [role=alertdialog], tr[data-fila], [data-toast], .toast")) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      // Un modal encima (p. ej. confirmar la aprobación) tiene prioridad sobre el panel.
      if (document.querySelector('[role="dialog"]') !== null) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || esCampoDeTexto(e.target)) return;
      if (e.key === "ArrowDown" && onNext !== undefined) {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowUp" && onPrev !== undefined) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrev, onNext]);

  if (!open) return null;

  return (
    <>
    {/* En pantallas angostas el panel tapa la lista: se atenua y un clic fuera lo cierra. */}
    <div className="drawer-backdrop" aria-hidden="true" onMouseDown={onClose} />
    <aside
      className="drawer fixed bottom-0 right-0 top-0 z-40 flex w-full flex-col"
      style={{
        maxWidth: 480,
        background: "var(--color-surface)",
        borderLeft: "1px solid var(--color-line)",
        boxShadow: "var(--shadow-lg)",
      }}
      aria-label={typeof props.title === "string" ? props.title : "Detalle"}
    >
      <header className="flex items-center justify-between gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <h2 className="min-w-0 truncate text-[1rem] font-semibold" style={{ color: "var(--color-heading)" }}>
          {props.title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {props.posicion !== undefined && (
            <span className="mr-1 text-[0.72rem]" style={{ color: "var(--color-ink-faint)" }}>
              {props.posicion}
            </span>
          )}
          {(onPrev !== undefined || onNext !== undefined) && (
            <>
              <Button size="sm" variant="ghost" aria-label="Documento anterior (↑)" title="Anterior (↑)" disabled={onPrev === undefined} onClick={onPrev}>
                <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
                  <Icon name="chevron-down" size={16} />
                </span>
              </Button>
              <Button size="sm" variant="ghost" aria-label="Documento siguiente (↓)" title="Siguiente (↓)" disabled={onNext === undefined} onClick={onNext}>
                <Icon name="chevron-down" size={16} />
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" aria-label="Cerrar panel (Esc)" title="Cerrar (Esc)" onClick={onClose}>
            <Icon name="x" size={16} />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{props.children}</div>
      {props.footer !== undefined && (
        <footer className="flex flex-wrap items-center justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--color-line)", background: "var(--color-surface)" }}>
          {props.footer}
        </footer>
      )}
    </aside>
    </>
  );
}

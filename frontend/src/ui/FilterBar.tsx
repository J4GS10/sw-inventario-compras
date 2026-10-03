/**
 * Panel de filtros colapsable. Oculto por defecto; un boton "Filtros" lo
 * despliega y muestra cuantos hay activos. No invade la vista.
 */

import { useState } from "react";
import Icon from "./Icon.js";
import { Button } from "./primitives.js";

export function FilterBar(props: {
  activeCount: number;
  onClear?: () => void;
  onApply?: () => void;
  children: React.ReactNode;
  /** Empieza abierto (por defecto cerrado). */
  defaultOpen?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(props.defaultOpen ?? false);

  return (
    <div className="card" style={{ padding: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[0.85rem] font-semibold"
        style={{ color: "var(--color-heading)" }}
        aria-expanded={open}
      >
        <Icon name="filter" size={16} />
        Filtros
        {props.activeCount > 0 && (
          <span
            className="chip"
            style={{ background: "var(--color-brand)", color: "#fff" }}
          >
            {props.activeCount}
          </span>
        )}
        <span className="flex-1" />
        <Icon name={open ? "chevron-down" : "chevron-right"} size={15} />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5" style={{ borderTop: "1px solid var(--color-line)" }}>
          <div className="pt-3">{props.children}</div>
          <div className="mt-3 flex gap-2">
            {props.onApply !== undefined && (
              <Button size="sm" icon="check" onClick={props.onApply}>
                Aplicar
              </Button>
            )}
            {props.onClear !== undefined && (
              <Button size="sm" variant="ghost" icon="x" onClick={props.onClear}>
                Limpiar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

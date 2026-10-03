/**
 * Ayuda contextual reutilizable: un boton "Ayuda" que abre un modal
 * explicando que hace la pantalla y como usarla. No invasivo por diseno —
 * nada se renderiza hasta que el usuario decide abrirlo, y no reaparece solo.
 * Un componente, se usa donde haga falta via `PageHeader({ help })`.
 */

import { useState } from "react";
import Icon from "./Icon.js";
import { Button } from "./primitives.js";
import { Modal } from "./Modal.js";

export interface HelpContent {
  readonly title: string;
  readonly body: React.ReactNode;
}

export function HelpTip(props: HelpContent): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ayuda: ${props.title}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-fluent"
        style={{
          background: "var(--color-brand-050)",
          color: "var(--color-brand-ink)",
          border: "1px solid var(--color-line)",
        }}
      >
        <Icon name="help" size={13} />
        Ayuda
      </button>

      <Modal
        open={open}
        title={
          <span className="flex items-center gap-2.5">
            <span
              className="grid shrink-0 place-items-center"
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "var(--color-brand)",
                color: "#fff",
              }}
            >
              <Icon name="help" size={16} />
            </span>
            {props.title}
          </span>
        }
        onClose={() => setOpen(false)}
        width={560}
        footer={
          <Button size="sm" onClick={() => setOpen(false)}>
            Entendido
          </Button>
        }
      >
        <div className="grid gap-3 text-[0.85rem] leading-relaxed" style={{ color: "var(--color-ink)" }}>
          {props.body}
        </div>
      </Modal>
    </>
  );
}

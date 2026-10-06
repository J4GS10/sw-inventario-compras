/**
 * Modal con pestañas: formularios largos organizados en secciones navegables
 * (skills/patron-diseno.md seccion 7 y 10). Cierra con Escape / clic afuera.
 * Confirmacion explicita para acciones destructivas.
 */

import { useEffect } from "react";
import Icon from "./Icon.js";
import { Button } from "./primitives.js";

export function Modal(props: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}): React.ReactElement | null {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props]);

  if (!props.open) return null;

  return (
    <div
      className="modal-wrap fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-8"
      style={{ background: "var(--overlay)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        className="modal-card card w-full"
        style={{ maxWidth: props.width ?? 640, boxShadow: "var(--shadow-lg)" }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof props.title === "string" ? props.title : undefined}
      >
        <div
          className="modal-head flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <h2 style={{ color: "var(--color-heading)" }}>{props.title}</h2>
          <Button variant="ghost" size="sm" icon="x" onClick={props.onClose} aria-label="Cerrar" />
        </div>
        <div className="modal-body px-5 py-4">{props.children}</div>
        {props.footer !== undefined && (
          <div
            className="modal-foot flex items-center justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: "1px solid var(--color-line)" }}
          >
            {props.footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Tabs(props: {
  tabs: readonly { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}): React.ReactElement {
  return (
    <div
      className="mb-4 flex gap-1 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--color-line)" }}
    >
      {props.tabs.map((t) => {
        const on = t.id === props.active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => props.onChange(t.id)}
            className="px-3 py-2 text-[0.82rem] font-semibold whitespace-nowrap"
            style={{
              color: on ? "var(--color-brand-ink)" : "var(--color-ink-soft)",
              borderBottom: on ? "2px solid var(--color-brand-ink)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}): React.ReactElement | null {
  return (
    <Modal
      open={props.open}
      title={props.title}
      onClose={props.onCancel}
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" icon="trash" onClick={props.onConfirm}>
            {props.confirmLabel ?? "Eliminar"}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className="grid place-items-center shrink-0"
          style={{ width: 34, height: 34, borderRadius: 9, background: "var(--color-danger-050)", color: "var(--color-danger)" }}
        >
          <Icon name="trash" size={18} />
        </span>
        <p className="text-[0.88rem]" style={{ color: "var(--color-ink)" }}>
          {props.message}
        </p>
      </div>
    </Modal>
  );
}

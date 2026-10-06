/**
 * Notificacion toast: confirmacion no bloqueante (skills/patron-diseno.md 7).
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Icon from "./Icon.js";

type ToastTone = "success" | "error" | "info";
/** Boton dentro del aviso: "Deshacer", "Registrar cotización", etc. */
export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  success(message: string, ms?: number, action?: ToastAction): void;
  error(message: string, ms?: number, action?: ToastAction): void;
  info(message: string, ms?: number, action?: ToastAction): void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (api === null) throw new Error("useToast fuera de <ToastProvider>");
  return api;
}

const TONE = {
  success: { bg: "var(--color-success-050)", fg: "var(--color-success)", icon: "check" as const },
  error: { bg: "var(--color-danger-050)", fg: "var(--color-danger)", icon: "x" as const },
  info: { bg: "var(--color-brand-050)", fg: "var(--color-brand-ink)", icon: "bell" as const },
};

export function ToastProvider(props: { children: React.ReactNode }): React.ReactElement {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastTone, message: string, ms = 4200, action?: ToastAction) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message, ...(action !== undefined ? { action } : {}) }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, ms, a) => push("success", m, ms, a),
      error: (m, ms, a) => push("error", m, ms, a),
      info: (m, ms, a) => push("info", m, ms, a),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {props.children}
      <div
        data-toast="" className="fixed z-50 flex flex-col gap-2"
        style={{ right: 20, bottom: 20, maxWidth: "min(92vw, 380px)" }}
      >
        {items.map((t) => {
          const tone = TONE[t.tone];
          return (
            <div
              key={t.id}
              className="card flex items-start gap-2.5 p-3"
              style={{ boxShadow: "var(--shadow-lg)" }}
            >
              <span
                className="grid place-items-center shrink-0"
                style={{ width: 26, height: 26, borderRadius: 8, background: tone.bg, color: tone.fg }}
              >
                <Icon name={tone.icon} size={15} />
              </span>
              <span className="min-w-0 flex-1 text-[0.85rem]" style={{ color: "var(--color-ink)" }} role="status">
                {t.message}
              </span>
              {t.action !== undefined && (
                <button
                  type="button"
                  className="shrink-0 rounded-md px-2 py-1 text-[0.8rem] font-semibold"
                  style={{ color: "var(--color-brand-ink)", background: "var(--color-brand-050)" }}
                  onClick={() => {
                    t.action!.onClick();
                    setItems((prev) => prev.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

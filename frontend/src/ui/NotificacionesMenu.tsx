/**
 * Campana de la topbar: bandeja de pendientes por rol. Muestra un badge con el
 * total y un panel con cada grupo (aprobar, cotizar, adjudicar, recibir).
 * Al pulsar un grupo navega a su pantalla. skills/patron-diseno.md §7 (modal /
 * popover no invasivo), §11 (retroalimentacion).
 */

import { useState } from "react";
import Icon, { type IconName } from "./Icon.js";
import { useNotificaciones } from "../hooks/useNotificaciones.js";
import type { NotiTipo } from "../core/NotificacionService.js";

const ICONO: Record<NotiTipo, IconName> = {
  APROBAR_JEFE: "check",
  APROBAR_GERENTE: "check",
  COTIZAR: "send",
  ORDEN_PENDIENTE: "cart",
  ADJUDICAR: "award",
  RECIBIR: "package",
  ESCASEZ: "package",
};

export function NotificacionesMenu(props: {
  onNavigate: (leafId: string) => void;
}): React.ReactElement {
  const { bandeja, decisiones, sinLeer, marcarLeidas, loading } = useNotificaciones();
  const [open, setOpen] = useState(false);
  const total = bandeja.total + sinLeer;

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-sm relative"
        onClick={() => {
          setOpen((v) => !v);
          // Abrir la campana = ya viste las respuestas.
          if (!open) window.setTimeout(marcarLeidas, 1200);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Pendientes: ${total}`}
      >
        <Icon name="bell" size={17} />
        {total > 0 && (
          <span
            className="absolute grid place-items-center"
            style={{
              top: -3,
              right: -3,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              background: "var(--color-danger)",
              color: "#fff",
            }}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-80 max-w-[92vw] p-2"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {decisiones.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[0.82rem] font-semibold" style={{ color: "var(--color-heading)" }}>
                  Respuestas a tus solicitudes
                </div>
                <div className="grid gap-0.5" style={{ maxHeight: 220, overflowY: "auto" }}>
                  {decisiones.slice(0, 8).map((d) => (
                    <button
                      key={d.idWorkflow}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        props.onNavigate("com-doc-solicitudes");
                      }}
                      className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-fluent"
                      style={{ background: "transparent" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span
                        className="mt-0.5 grid place-items-center shrink-0"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: d.resultado === "RECHAZADA" ? "var(--color-danger-050, #fdecec)" : "var(--color-success-050)",
                          color: d.resultado === "RECHAZADA" ? "var(--color-danger)" : "var(--color-success)",
                        }}
                      >
                        <Icon name={d.resultado === "RECHAZADA" ? "x" : "check"} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.82rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                          {d.mensaje}
                        </span>
                        <span className="block text-[0.72rem]" style={{ color: "var(--color-ink-soft)" }}>
                          {d.resultado === "RECHAZADA" && d.comentario !== null
                            ? `Motivo: ${d.comentario}`
                            : d.estadoNuevo === "EN_COTIZACION"
                              ? "Aprobada por completo: pasa a cotización."
                              : d.estadoNuevo === "PENDIENTE_GERENTE"
                                ? "Ahora espera al gerente de área."
                                : d.resumen}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="my-1" style={{ borderTop: "1px solid var(--color-line)" }} />
              </>
            )}
            <div className="px-2 py-1.5 text-[0.82rem] font-semibold" style={{ color: "var(--color-heading)" }}>
              Pendientes
            </div>
            <div className="my-1" style={{ borderTop: "1px solid var(--color-line)" }} />

            {loading ? (
              <div className="px-2 py-4 text-center text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
                Cargando…
              </div>
            ) : bandeja.items.length === 0 ? (
              <div className="grid place-items-center gap-1 px-2 py-6 text-center" style={{ color: "var(--color-ink-faint)" }}>
                <Icon name="check" size={22} />
                <span className="text-[0.82rem]">Nada pendiente de tu parte</span>
              </div>
            ) : (
              <div className="grid gap-0.5">
                {bandeja.items.map((n) => (
                  <button
                    key={n.tipo}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      props.onNavigate(n.leafId);
                    }}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-fluent"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span
                      className="mt-0.5 grid place-items-center shrink-0"
                      style={{ width: 26, height: 26, borderRadius: 8, background: "var(--color-brand-050)", color: "var(--color-brand-ink)" }}
                    >
                      <Icon name={ICONO[n.tipo]} size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[0.82rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                          {n.titulo}
                        </span>
                        <span className="chip" style={{ background: "var(--color-brand-050)", color: "var(--color-brand-ink)" }}>
                          {n.cantidad}
                        </span>
                      </span>
                      <span className="block text-[0.72rem]" style={{ color: "var(--color-ink-soft)" }}>
                        {n.detalle}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

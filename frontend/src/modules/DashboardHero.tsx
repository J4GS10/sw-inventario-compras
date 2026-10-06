/**
 * Cabecera del Dashboard: lo URGENTE primero (tarjeta héroe con tu cola de trabajo y un botón por
 * cada pendiente) y, la primera vez, una guía corta de "primeros pasos" según tu rol.
 */

import { useState } from "react";
import { Button, Card } from "../ui/primitives.js";
import Icon, { type IconName } from "../ui/Icon.js";
import { useNotificaciones } from "../hooks/useNotificaciones.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { Permisos } from "../core/auth/permisos.js";
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

function saludo(): string {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default function DashboardHero(props: { onNavigateById: (leafId: string) => void }): React.ReactElement {
  const { sesion } = useAuth();
  const { bandeja, loading } = useNotificaciones();
  const nombre = (sesion?.nombre ?? "").split(" ")[0] ?? "";
  const items = [...bandeja.items].sort((a, b) => b.cantidad - a.cantidad).slice(0, 3);

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[0.8rem] font-semibold" style={{ color: "var(--color-ink-soft)" }}>
              {saludo()}
              {nombre !== "" ? `, ${nombre}` : ""}
            </div>
            <h2 className="mt-0.5 text-[1.35rem] font-semibold leading-tight" style={{ color: "var(--color-heading)" }}>
              {loading
                ? "Preparando tu día…"
                : bandeja.total === 0
                  ? "Estás al día: nada espera tu acción"
                  : `${bandeja.total} cosa${bandeja.total === 1 ? "" : "s"} esperan tu acción`}
            </h2>
          </div>
          {bandeja.total === 0 && !loading && (
            <span className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold" style={{ color: "var(--color-success)" }}>
              <Icon name="check" size={16} /> Todo en orden
            </span>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {items.map((n) => (
              <button
                key={n.tipo}
                type="button"
                onClick={() => props.onNavigateById(n.leafId)}
                className="flex items-center gap-3 rounded-xl p-3 text-left transition-fluent"
                style={{ background: "var(--color-brand-050)", border: "1px solid var(--color-line)" }}
              >
                <span
                  className="grid shrink-0 place-items-center rounded-lg"
                  style={{ width: 44, height: 44, background: "var(--color-surface)", color: "var(--color-brand-ink)" }}
                >
                  <Icon name={ICONO[n.tipo]} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.5rem] font-bold leading-none" style={{ color: "var(--color-brand-ink)" }}>
                    {n.cantidad}
                  </span>
                  <span className="mt-1 block truncate text-[0.82rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                    {n.titulo}
                  </span>
                </span>
                <Icon name="chevron-right" size={16} />
              </button>
            ))}
          </div>
        )}
      </Card>
      <PrimerosPasos onNavigateById={props.onNavigateById} />
    </div>
  );
}

interface Paso {
  readonly titulo: string;
  readonly detalle: string;
  readonly leafId: string;
}

/** Guía de 3 pasos según lo que el rol PUEDE hacer; se cierra una vez y no vuelve. */
function PrimerosPasos(props: { onNavigateById: (leafId: string) => void }): React.ReactElement | null {
  const { sesion, hasPerm, hasAnyPerm } = useAuth();
  const clave = `erp.primerospasos.${sesion?.idUsuario ?? 0}`;
  // Plegado por omision (una sola linea): se abre a pedido y se recuerda; "cerrado" lo oculta del todo.
  const [estado, setEstado] = useState<"plegado" | "abierto" | "cerrado">(() => {
    try {
      const v = window.localStorage.getItem(clave);
      return v === "cerrado" ? "cerrado" : v === "abierto" ? "abierto" : "plegado";
    } catch {
      return "plegado";
    }
  });
  const visible = estado !== "cerrado";
  const setVisible = (v: boolean): void => setEstado(v ? "plegado" : "cerrado");
  const guardarEstado = (v: "plegado" | "abierto"): void => {
    setEstado(v);
    try {
      window.localStorage.setItem(clave, v);
    } catch {
      /* no se recuerda */
    }
  };

  const pasos: Paso[] = [];
  if (hasPerm(Permisos.SOLICITUD_CREAR)) {
    pasos.push({ titulo: "Crea tu solicitud", detalle: "Elige el artículo: el sistema completa unidad, fecha y datos.", leafId: "com-doc-solicitudes" });
  }
  if (hasAnyPerm([Permisos.SOLICITUD_APROBAR_JEFE, Permisos.SOLICITUD_APROBAR_GERENTE])) {
    pasos.push({ titulo: "Aprueba o rechaza", detalle: "Selecciona varias y apruébalas juntas. Al rechazar, escribe el motivo.", leafId: "com-doc-solicitudes" });
  }
  if (hasPerm(Permisos.RFQ_GESTIONAR)) {
    pasos.push({ titulo: "Pide cotizaciones", detalle: "Desde una solicitud aprobada: ya vienen 3 proveedores sugeridos.", leafId: "com-doc-rfq" });
    pasos.push({ titulo: "Registra las ofertas", detalle: "Cada artículo pedido ya es un renglón: solo tecleas precios.", leafId: "com-doc-cotizaciones" });
  }
  if (hasPerm(Permisos.COTIZACION_ADJUDICAR)) {
    pasos.push({ titulo: "Compara y adjudica", detalle: "El comparativo muestra la mejor oferta por artículo.", leafId: "com-an-comparativo" });
  }
  if (hasPerm(Permisos.RECEPCION_GESTIONAR)) {
    pasos.push({ titulo: "Recibe la mercadería", detalle: "Si todo coincide, usa “Recibir todo conforme”; si no, anota solo lo que contaste.", leafId: "com-doc-recepciones" });
  }
  pasos.push({ titulo: "Mira la campana", detalle: "Te avisa en vivo cuando alguien aprueba o rechaza lo tuyo.", leafId: "com-dashboard" });

  if (!visible || pasos.length === 0) return null;
  const cerrar = (): void => {
    try {
      window.localStorage.setItem(clave, "cerrado");
    } catch {
      /* se mostrará de nuevo la próxima vez */
    }
    setVisible(false);
  };

  if (estado === "plegado") {
    return (
      <div className="flex items-center justify-between gap-3 px-1 text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
        <span>¿Primera vez aquí? Mira lo que puedes hacer con tu rol.</span>
        <span className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => guardarEstado("abierto")}>
            Ver primeros pasos
          </Button>
          <Button size="sm" variant="ghost" onClick={cerrar} aria-label="No mostrar más">
            ✕
          </Button>
        </span>
      </div>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 style={{ color: "var(--color-heading)" }}>Primeros pasos</h3>
          <p className="text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
            Esto es lo que puedes hacer con tu rol. El sistema se encarga del resto.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => guardarEstado("plegado")}>
          Ocultar
        </Button>
      </div>
      <ol className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {pasos.slice(0, 4).map((p, i) => (
          <li key={p.titulo}>
            <button
              type="button"
              onClick={() => props.onNavigateById(p.leafId)}
              className="flex w-full items-start gap-3 rounded-xl p-3 text-left"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
            >
              <span
                className="grid shrink-0 place-items-center rounded-full text-[0.8rem] font-bold"
                style={{ width: 26, height: 26, background: "var(--color-brand)", color: "#fff" }}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.88rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                  {p.titulo}
                </span>
                <span className="mt-0.5 block text-[0.78rem]" style={{ color: "var(--color-ink-soft)" }}>
                  {p.detalle}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

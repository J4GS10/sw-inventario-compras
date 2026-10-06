/**
 * Indicador de estado en la barra superior: "En vivo" (canal de avisos conectado), "Reconectando…",
 * "Sin conexión" (el navegador no tiene red) y "Guardando…" mientras hay escrituras en curso.
 * El usuario siempre sabe si lo que hace llegó y si lo que ve está al día.
 */

import { useEffect, useState } from "react";
import { eventBus } from "../core/EventBus.js";
import { LiveEvents } from "../core/liveEvents.js";
import { OUTBOX_EVENTO, pendientesEnCola } from "../core/outbox.js";
import { useAuth } from "../core/auth/AuthContext.js";

export default function EstadoConexion(): React.ReactElement {
  const [vivo, setVivo] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [guardando, setGuardando] = useState(0);
  const { sesion } = useAuth();
  const [enCola, setEnCola] = useState(() => (sesion === null ? 0 : pendientesEnCola(sesion.idUsuario)));

  useEffect(() => {
    const offs = [
      eventBus.on<boolean>(LiveEvents.Estado, setVivo),
      eventBus.on<number>(LiveEvents.Guardando, setGuardando),
      eventBus.on<number>(OUTBOX_EVENTO, setEnCola),
    ];
    const on = (): void => setOnline(true);
    const off = (): void => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      offs.forEach((o) => o());
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const { texto, color, pulso } = enCola > 0
    ? { texto: `${enCola} por enviar`, color: "var(--color-warning)", pulso: true }
    : !online
    ? { texto: "Sin conexión", color: "var(--color-danger)", pulso: false }
    : guardando > 0
      ? { texto: "Guardando…", color: "var(--color-brand)", pulso: true }
      : vivo
        ? { texto: "En vivo", color: "var(--color-success)", pulso: false }
        : { texto: "Reconectando…", color: "var(--color-warning)", pulso: true };

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold md:inline-flex"
      style={{ background: "var(--color-surface-2)", color: "var(--color-ink-soft)" }}
      role="status"
      aria-live="polite"
      title={
        !online
          ? "Tu equipo no tiene conexión a internet"
          : vivo
            ? "Recibes avisos al instante"
            : "Reintentando conectar los avisos en vivo"
      }
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          animation: pulso ? "estadoPulso 1.2s ease-in-out infinite" : undefined,
        }}
      />
      {texto}
    </span>
  );
}

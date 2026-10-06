/**
 * Capa 4 (frontend) - Presentacion / adaptador.
 * Mantiene la campana al dia: pendientes (lo que necesita TU accion) y
 * respuestas a tus solicitudes (aprobada / rechazada). Se refresca al instante
 * con el canal en vivo (LiveEvents), al cambiar algo del flujo (EventBus) y,
 * como red de seguridad, cada 60 s.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchDecisiones,
  fetchPendientes,
  type BandejaPendientes,
  type DecisionRecibida,
} from "../core/NotificacionService.js";
import { AppEvents, eventBus } from "../core/EventBus.js";
import { LiveEvents } from "../core/liveEvents.js";
import { useAuth } from "../core/auth/AuthContext.js";

const VACIA: BandejaPendientes = { total: 0, items: [] };
const INTERVALO_MS = 60_000;

function leerVisto(clave: string): number {
  try {
    return Number(window.localStorage.getItem(clave) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function useNotificaciones(): {
  bandeja: BandejaPendientes;
  decisiones: readonly DecisionRecibida[];
  /** Respuestas que el usuario aun no ha abierto en la campana. */
  sinLeer: number;
  marcarLeidas: () => void;
  loading: boolean;
  reload: () => void;
} {
  const { sesion } = useAuth();
  const claveVisto = `erp.decisiones.visto.${sesion?.idUsuario ?? 0}`;
  const [bandeja, setBandeja] = useState<BandejaPendientes>(VACIA);
  const [decisiones, setDecisiones] = useState<readonly DecisionRecibida[]>([]);
  const [visto, setVisto] = useState(() => leerVisto(claveVisto));
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [b, d] = await Promise.all([fetchPendientes(), fetchDecisiones()]);
      if (vivo) {
        setBandeja(b);
        setDecisiones(d);
        setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tick]);

  useEffect(() => {
    const id = window.setInterval(reload, INTERVALO_MS);
    const offs = [
      eventBus.on(AppEvents.EntityCreated, () => reload()),
      eventBus.on(AppEvents.EntityUpdated, () => reload()),
      eventBus.on(AppEvents.EntityRemoved, () => reload()),
      eventBus.on(LiveEvents.Bandeja, () => reload()),
      eventBus.on(LiveEvents.Decision, () => reload()),
      eventBus.on(LiveEvents.Reconectado, () => reload()),
    ];
    return () => {
      window.clearInterval(id);
      offs.forEach((off) => off());
    };
  }, [reload]);

  const sinLeer = useMemo(() => decisiones.filter((d) => d.idWorkflow > visto).length, [decisiones, visto]);

  const marcarLeidas = useCallback(() => {
    const max = decisiones.reduce((a, d) => Math.max(a, d.idWorkflow), 0);
    if (max <= visto) return;
    setVisto(max);
    try {
      window.localStorage.setItem(claveVisto, String(max));
    } catch {
      /* almacenamiento bloqueado: solo no se recuerda entre sesiones */
    }
  }, [decisiones, visto, claveVisto]);

  return { bandeja, decisiones, sinLeer, marcarLeidas, loading, reload };
}

/**
 * Capa 4 (frontend) - Presentacion / adaptador.
 * Mantiene la bandeja de pendientes al dia: carga inicial, refresco periodico
 * (60 s) y refresco inmediato cuando algo del flujo cambia (Observer / EventBus).
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchPendientes,
  type BandejaPendientes,
} from "../core/NotificacionService.js";
import { AppEvents, eventBus } from "../core/EventBus.js";

const VACIA: BandejaPendientes = { total: 0, items: [] };
const INTERVALO_MS = 60_000;

export function useNotificaciones(): {
  bandeja: BandejaPendientes;
  loading: boolean;
  reload: () => void;
} {
  const [bandeja, setBandeja] = useState<BandejaPendientes>(VACIA);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const b = await fetchPendientes();
      if (vivo) {
        setBandeja(b);
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
      AppEvents.EntityCreated,
      AppEvents.EntityUpdated,
      AppEvents.EntityRemoved,
    ].map((ev) => eventBus.on(ev, () => reload()));
    return () => {
      window.clearInterval(id);
      offs.forEach((off) => off());
    };
  }, [reload]);

  return { bandeja, loading, reload };
}

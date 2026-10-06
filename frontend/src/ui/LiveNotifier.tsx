/**
 * Escucha el canal en vivo y lo convierte en avisos visibles:
 *  - "decision": toast al solicitante (quien aprobo/rechazo, que sigue o el motivo)
 *    y recarga de las listas de solicitudes.
 *  - "bandeja": refresca la campana y, si la solicitud ahora espera la accion de
 *    ESTE usuario (segun su propia bandeja, ya acotada por rol/equipo), avisa.
 * No renderiza nada. Se monta una vez por sesion.
 */

import { useEffect, useRef } from "react";
import { LiveConnection } from "../core/LiveService.js";
import { LiveEvents, type BandejaEnVivo, type DecisionEnVivo } from "../core/liveEvents.js";
import { AppEvents, eventBus } from "../core/EventBus.js";
import { fetchPendientes } from "../core/NotificacionService.js";
import { useToast } from "./Toast.js";

const TIPOS_ACCION = new Set(["APROBAR_JEFE", "APROBAR_GERENTE", "COTIZAR", "ADJUDICAR", "ORDEN_PENDIENTE", "RECIBIR"]);

export default function LiveNotifier(): null {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const conn = new LiveConnection({
      onStatus: (c) => eventBus.emit(LiveEvents.Estado, c),
      onOpen: (reconexion) => {
        // Tras reconectar pudo pasar algo: recargar campana y respuestas.
        if (reconexion) eventBus.emit(LiveEvents.Reconectado, {});
      },
      onMessage: (m) => {
        if (m.event === "decision") {
          const d = m.data as DecisionEnVivo;
          const texto =
            d.resultado === "RECHAZADA"
              ? `${d.mensaje}${d.comentario !== null ? ` — Motivo: ${d.comentario}` : ""}`
              : `${d.mensaje}${d.siguiente !== null ? ` · ${d.siguiente}` : ""}`;
          if (d.resultado === "RECHAZADA") toastRef.current.error(texto, 9000);
          else toastRef.current.success(texto, 7000);
          eventBus.emit(LiveEvents.Decision, d);
          // Las listas de solicitudes se actualizan solas (estado nuevo visible de inmediato).
          eventBus.emit(AppEvents.EntityUpdated, { resource: "/api/com/solicitudes", id: d.idSolicitud });
        } else if (m.event === "bandeja") {
          const b = m.data as BandejaEnVivo;
          eventBus.emit(LiveEvents.Bandeja, b);
          if (b.idSolicitud !== undefined) {
            void (async () => {
              const bandeja = await fetchPendientes();
              const item = bandeja.items.find((i) => TIPOS_ACCION.has(i.tipo) && i.refs.includes(b.idSolicitud!));
              if (item !== undefined) {
                toastRef.current.info(`SOL-${b.idSolicitud} espera tu acción: ${item.titulo}`, 6000);
              }
            })();
          }
        }
      },
    });
    conn.start();
    return () => conn.stop();
  }, []);

  return null;
}

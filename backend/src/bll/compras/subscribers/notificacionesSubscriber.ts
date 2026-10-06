/**
 * Capa 3 - Logica de Negocio / compras.
 * Suscriptor Observer: convierte los eventos de aprobacion en avisos EN VIVO.
 *
 *  - "decision": al solicitante, cuando alguien aprueba o rechaza su solicitud
 *    (quien, que paso sigue, y el motivo si la rechazaron).
 *  - "bandeja": a todos los conectados, para que refresquen su campana y, si la
 *    solicitud ahora espera SU accion, se les avise (cada cliente lo decide con
 *    su propia bandeja, que ya esta acotada por rol/equipo en el servidor).
 *
 * Un fallo aqui nunca afecta a la transaccion de negocio ya confirmada
 * (DomainEventBus aisla a los suscriptores).
 */

import { eventBus } from "../../../common/events/DomainEventBus.js";
import { liveHub } from "../../../common/realtime/LiveHub.js";
import { logger } from "../../../common/logging/Logger.js";
import { CompraReadRepository } from "../../../dal/repositories/com/CompraReadRepository.js";
import { ComEvents, type SolicitudAprobacionPayload } from "../../events/domainEvents.js";

export interface DecisionEnVivo {
  readonly idSolicitud: number;
  readonly resultado: "APROBADA" | "RECHAZADA";
  readonly estadoNuevo: string;
  readonly por: string;
  /** Texto listo para mostrar. */
  readonly mensaje: string;
  readonly siguiente: string | null;
  readonly comentario: string | null;
  readonly fecha: string;
}

const SIGUIENTE: Record<string, string> = {
  PENDIENTE_GERENTE: "Ahora espera la aprobación del gerente de área.",
  EN_COTIZACION: "Aprobada por completo: Compras ya puede pedir cotizaciones.",
};

export function construirDecision(p: SolicitudAprobacionPayload, por: string): DecisionEnVivo {
  const rechazada = p.estadoNuevo === "RECHAZADA";
  const quien = por !== "" ? por : "Un aprobador";
  return {
    idSolicitud: p.idSolicitud,
    resultado: rechazada ? "RECHAZADA" : "APROBADA",
    estadoNuevo: p.estadoNuevo,
    por: quien,
    mensaje: rechazada
      ? `${quien} rechazó tu solicitud SOL-${p.idSolicitud}`
      : `${quien} aprobó tu solicitud SOL-${p.idSolicitud}`,
    siguiente: rechazada ? null : (SIGUIENTE[p.estadoNuevo] ?? null),
    comentario: p.comentario,
    fecha: new Date().toISOString(),
  };
}

export function registerNotificacionesSubscriber(read: CompraReadRepository = new CompraReadRepository()): void {
  const alDecidir = async (p: SolicitudAprobacionPayload): Promise<void> => {
    const hub = liveHub();
    try {
      const [usuario, por] = await Promise.all([
        read.usuarioDeEmpleado(p.idEmpleadoSolicitante),
        read.nombreDeEmpleado(p.idEmpleado),
      ]);
      // Aviso al dueño (salvo que se haya decidido a si mismo).
      if (usuario !== null && p.idEmpleadoSolicitante !== p.idEmpleado) {
        hub.sendToUsers([usuario], { event: "decision", data: construirDecision(p, por) });
      }
    } catch (e) {
      logger().warn("No se pudo avisar la decisión al solicitante", {
        idSolicitud: p.idSolicitud,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
    // Siempre: la bandeja de todos pudo cambiar (nuevo pendiente / pendiente resuelto).
    hub.broadcast({
      event: "bandeja",
      data: { motivo: "solicitud", idSolicitud: p.idSolicitud, estadoNuevo: p.estadoNuevo },
    });
  };

  eventBus().subscribe<SolicitudAprobacionPayload>(ComEvents.SolicitudAprobada, alDecidir);
  eventBus().subscribe<SolicitudAprobacionPayload>(ComEvents.SolicitudRechazada, alDecidir);

  // Otros hitos del flujo: solo refrescan bandejas (el pendiente de alguien cambio).
  const refrescar = (motivo: string) => (): void => {
    liveHub().broadcast({ event: "bandeja", data: { motivo } });
  };
  for (const [ev, motivo] of [
    [ComEvents.RfqCerrado, "rfq"],
    [ComEvents.CotizacionAdjudicada, "adjudicacion"],
    [ComEvents.OrdenCompraEmitida, "orden"],
    [ComEvents.OrdenCompraEstadoCambiado, "orden"],
    [ComEvents.RecepcionRegistrada, "recepcion"],
  ] as const) {
    eventBus().subscribe(ev, refrescar(motivo));
  }
}

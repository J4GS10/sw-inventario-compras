/**
 * Capa 3 - Logica de Negocio / compras.
 * Registro central de suscriptores de eventos de dominio. Se invoca una vez al
 * arrancar el backend (server.ts), despues de inicializar el pool.
 */

import { registerKardexSubscriber } from "./kardexSubscriber.js";
import { registerCxpSubscriber } from "./cxpSubscriber.js";
import { registerEscasezSubscriber } from "./escasezSubscriber.js";
import { registerNotificacionesSubscriber } from "./notificacionesSubscriber.js";
import { logger } from "../../../common/logging/Logger.js";

export function registerComprasSubscribers(): void {
  registerKardexSubscriber();
  registerCxpSubscriber();
  registerEscasezSubscriber();
  registerNotificacionesSubscriber();
  logger().info("Suscriptores de eventos de compras registrados", {
    subscribers: ["kardex", "cxp", "escasez", "notificaciones"],
  });
}

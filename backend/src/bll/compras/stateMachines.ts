/**
 * Capa 3 - Logica de Negocio / compras.
 * Instancias de StateMachine para los documentos del modulo. Fuente: los CHECK
 * de ESTADO en database/ddl/SCRIPT_DDL.sql.
 */

import { StateMachine } from "../support/StateMachine.js";
import {
  ORDEN_COMPRA_ESTADOS,
  RECEPCION_ESTADOS,
  RFQ_ESTADOS,
  SOLICITUD_ESTADOS,
} from "../../entities/com/descriptors.js";

export type SolicitudEstado = (typeof SOLICITUD_ESTADOS)[number];
export type RfqEstado = (typeof RFQ_ESTADOS)[number];
export type OrdenCompraEstado = (typeof ORDEN_COMPRA_ESTADOS)[number];
export type RecepcionEstado = (typeof RECEPCION_ESTADOS)[number];

export const solicitudStateMachine = new StateMachine<SolicitudEstado>(
  {
    PENDIENTE_JEFE: ["PENDIENTE_GERENTE", "RECHAZADA"],
    PENDIENTE_GERENTE: ["EN_COTIZACION", "RECHAZADA"],
    EN_COTIZACION: ["ORDEN_GENERADA", "RECHAZADA"],
    ORDEN_GENERADA: [],
    RECHAZADA: [],
  },
  "SolicitudCompra",
  "la solicitud",
);

export const rfqStateMachine = new StateMachine<RfqEstado>(
  {
    ABIERTO: ["CERRADO", "CANCELADO"],
    CERRADO: [],
    CANCELADO: [],
  },
  "RFQ",
  "el RFQ",
);

export const ordenCompraStateMachine = new StateMachine<OrdenCompraEstado>(
  {
    // Recibir directo desde EMITIDA es un caso real: Bodega puede recibir la
    // mercaderia antes de que Compras marque la OC como enviada al proveedor
    // (`CompraReadRepository.ordenesReceptibles` ya ofrece EMITIDA como
    // receptible; sin este destino, esa Recepcion fallaba con un 409 confuso
    // sobre "transicion no permitida" en vez de completarse).
    EMITIDA: ["ENVIADA", "RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "CANCELADA", "RECHAZADA"],
    ENVIADA: ["EN_TRANSITO", "RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "CANCELADA"],
    EN_TRANSITO: ["RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "CANCELADA"],
    // "ENVIADA" aqui es de COMPENSACION unicamente: RecepcionService la usa para
    // devolver la OC a "sin recepciones activas" cuando se elimina/reversa la
    // unica recepcion (o todas). No es un paso hacia adelante del flujo normal.
    RECIBIDA_PARCIAL: ["RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "ENVIADA"],
    RECIBIDA_COMPLETA: ["RECIBIDA_PARCIAL", "ENVIADA"],
    CANCELADA: [],
    RECHAZADA: [],
  },
  "OrdenCompra",
  "la orden de compra",
);

export const recepcionStateMachine = new StateMachine<RecepcionEstado>(
  {
    RECIBIDO: ["ALIMENTADO_CXP"],
    // Reversa: se anula la factura de CxP y la recepcion vuelve a RECIBIDO
    // (acto seguido queda con borrado logico).
    ALIMENTADO_CXP: ["RECIBIDO"],
  },
  "Recepcion",
  "la recepcion",
);

/** Nivel jerarquico por estado de la solicitud (para COM_WORKFLOW_APROBACION). */
export const SOLICITUD_NIVEL: Record<SolicitudEstado, number> = {
  PENDIENTE_JEFE: 1,
  PENDIENTE_GERENTE: 2,
  EN_COTIZACION: 3,
  ORDEN_GENERADA: 4,
  RECHAZADA: 0,
};

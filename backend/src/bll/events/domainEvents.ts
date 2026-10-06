/**
 * Capa 3 - Logica de Negocio / eventos de dominio.
 * Catalogo tipado de eventos que publican los servicios de compras. Los
 * suscriptores (kardex, CxP, alertas) reaccionan de forma desacoplada via el
 * DomainEventBus (patron Observer).
 */

export const ComEvents = {
  SolicitudAprobada: "com.solicitud.aprobada",
  SolicitudRechazada: "com.solicitud.rechazada",
  RfqCerrado: "com.rfq.cerrado",
  CotizacionAdjudicada: "com.cotizacion.adjudicada",
  OrdenCompraEmitida: "com.ordenCompra.emitida",
  OrdenCompraEstadoCambiado: "com.ordenCompra.estadoCambiado",
  RecepcionRegistrada: "com.recepcion.registrada",
  RecepcionReversada: "com.recepcion.reversada",
  DevolucionRegistrada: "com.devolucion.registrada",
  /** Derivado: lo publica kardexSubscriber tras confirmar un saldo nuevo de existencia. */
  ExistenciaActualizada: "com.existencia.actualizada",
} as const;

export type ComEventName = (typeof ComEvents)[keyof typeof ComEvents];

export interface RecepcionRegistradaPayload {
  readonly idRecepcion: number;
  readonly idOrdenCompra: number;
  readonly idBodega: number;
  readonly idProveedor: number;
  readonly idEmpleadoRecibe: number;
  readonly fechaRecepcion: string;
  readonly lineas: readonly {
    readonly idOcDetalle: number;
    readonly idArticulo: number | null;
    readonly cantidadRecibida: number;
    readonly cantidadRechazada: number;
    readonly costoUnitario: number;
  }[];
  /** Contexto de auditoria para propagar a los suscriptores. */
  readonly userId: number;
}

/**
 * Reversa de una recepcion que ya alimento CxP. Los suscriptores compensan:
 *  - kardex: un movimiento AJUSTE_NEGATIVO por linea (back-out del promedio),
 *  - CxP: la CXP_FACTURA_PROVEEDOR generada pasa a ANULADA y se borra logicamente.
 */
export interface RecepcionReversadaPayload {
  readonly idRecepcion: number;
  readonly idBodega: number;
  readonly idFacturaProveedor: number | null;
  readonly fechaRecepcion: string;
  readonly lineas: readonly {
    readonly idArticulo: number | null;
    readonly cantidadRecibida: number;
    readonly costoUnitario: number;
  }[];
  readonly userId: number;
}

/**
 * Saldo de existencia confirmado para un articulo/bodega (tras kardex). No dice
 * POR QUE cambio — solo que cambio — para que cualquier suscriptor desacoplado
 * (p. ej. escasezSubscriber) reaccione sin conocer el origen (compra, reversa,
 * y en el futuro venta/traslado).
 */
export interface ExistenciaActualizadaPayload {
  readonly idArticulo: number;
  readonly idBodega: number;
  readonly cantidadActual: number;
  readonly costoPromedioActual: number;
  readonly userId: number;
}

export interface OrdenCompraEstadoPayload {
  readonly idOrdenCompra: number;
  readonly estadoAnterior: string;
  readonly estadoNuevo: string;
  readonly userId: number;
}

export interface SolicitudAprobacionPayload {
  readonly idSolicitud: number;
  readonly estadoAnterior: string;
  readonly estadoNuevo: string;
  readonly nivelJerarquico: number;
  /** Empleado que decidio. */
  readonly idEmpleado: number;
  readonly userId: number;
  /** Duenio de la solicitud: a quien se le avisa la decision. */
  readonly idEmpleadoSolicitante: number;
  /** Motivo/comentario escrito por quien decidio (obligatorio al rechazar). */
  readonly comentario: string | null;
}

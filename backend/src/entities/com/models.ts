/**
 * Capa 5 - Entidades (transversal).
 * Interfaces de lectura de las entidades COM_ que usan los servicios
 * transaccionales. Estructuras puras (sin decoradores ni dependencias).
 * Espejo parcial de descriptors.ts; el generador (Fase 2 opcional) las cubre
 * al 100% mas adelante.
 */

import type {
  ORDEN_COMPRA_ESTADOS,
  RECEPCION_ESTADOS,
  RFQ_ESTADOS,
  SOLICITUD_ESTADOS,
} from "./descriptors.js";

export type SolicitudEstado = (typeof SOLICITUD_ESTADOS)[number];
export type RfqEstado = (typeof RFQ_ESTADOS)[number];
export type OrdenCompraEstado = (typeof ORDEN_COMPRA_ESTADOS)[number];
export type RecepcionEstado = (typeof RECEPCION_ESTADOS)[number];

interface SoftDelete {
  readonly eliminado: boolean;
  readonly fechaEliminacion: string | null;
  readonly eliminadoPor: number | null;
}

export interface SolicitudCompra extends SoftDelete {
  readonly idSolicitud: number;
  readonly idEmpleadoSolicitante: number;
  readonly idSucursal: number;
  readonly idGrupoCompra: number;
  readonly idTerminoEntrega: number;
  readonly idCentroCosto: number | null;
  readonly estado: SolicitudEstado;
  readonly justificacion: string;
  readonly prioridad: number;
  readonly montoEstimado: number | null;
  readonly version: number;
  readonly fechaCreacion: string;
  readonly creadoPor: number | null;
  readonly fechaModificacion: string | null;
  readonly modificadoPor: number | null;
}

export interface SolicitudDetalle extends SoftDelete {
  readonly idSolicitudDetalle: number;
  readonly idSolicitud: number;
  readonly idArticulo: number | null;
  readonly descripcion: string;
  readonly cantidadSolicitada: number;
  readonly cantidadAutorizada: number | null;
  readonly idUnidadMedida: number;
  readonly fechaRequerida: string;
  readonly version: number;
}

export interface CotizacionDetalle extends SoftDelete {
  readonly idCotizacionDetalle: number;
  readonly idCotizacion: number;
  readonly idSolicitudDetalle: number;
  readonly precioUnitario: number;
  readonly cantidad: number;
  readonly idUnidadMedida: number;
  readonly porcentajeDescuento: number;
  readonly porcentajeImpuesto: number;
  readonly adjudicado: boolean;
  readonly version: number;
}

export interface OrdenCompra extends SoftDelete {
  readonly idOrdenCompra: number;
  readonly idProveedor: number;
  readonly idEmpleadoGerenteFinanciero: number;
  readonly idMoneda: number;
  readonly tasaCambio: number;
  readonly estado: OrdenCompraEstado;
  readonly numeroReferencia: string | null;
  readonly fechaEmision: string;
  readonly fechaEntregaEsperada: string;
  readonly creadoPor: number | null;
  readonly fechaCreacion: string;
  readonly version: number;
}

export interface OrdenCompraDetalle extends SoftDelete {
  readonly idOcDetalle: number;
  readonly idOrdenCompra: number;
  readonly idCotizacionDetalle: number | null;
  readonly idArticulo: number | null;
  readonly descripcion: string;
  readonly cantidad: number;
  readonly idUnidadMedida: number;
  readonly precioUnitario: number;
  readonly porcentajeDescuento: number;
  readonly porcentajeImpuesto: number;
  readonly toleranciaPorcentaje: number;
  readonly subtotalCalculado: number | null;
  readonly version: number;
}

export interface Recepcion extends SoftDelete {
  readonly idRecepcion: number;
  readonly idOrdenCompra: number;
  readonly idBodega: number;
  readonly fechaRecepcion: string;
  readonly idEmpleadoRecibe: number;
  readonly idFacturaProveedor: number | null;
  readonly estado: RecepcionEstado | null;
}

export interface RecepcionDetalle extends SoftDelete {
  readonly idRecepcionDetalle: number;
  readonly idRecepcion: number;
  readonly idOcDetalle: number;
  readonly cantidadRecibida: number;
  readonly cantidadRechazada: number;
  readonly version: number;
}

export interface DevolucionProveedor extends SoftDelete {
  readonly idDevolucion: number;
  readonly idRecepcion: number;
  readonly fechaDevolucion: string;
  readonly motivo: string;
  readonly idEmpleadoSolicita: number;
}

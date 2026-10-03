/**
 * Capa 3 - Logica de Negocio / pricing.
 * Contrato del patron Strategy para resolver el precio de una linea de compra.
 * Intercambiable en tiempo de ejecucion (acuerdo marco, cotizacion adjudicada,
 * ultima compra), analogo a las estrategias de valuacion FIFO / Promedio del
 * inventario descritas en skills/patron-arquitectura.md 4.3.
 */

import type { Connection } from "oracledb";

export interface PriceQuery {
  readonly idArticulo: number | null;
  readonly idProveedor: number;
  readonly cantidad: number;
  readonly fecha: string;
  /** Linea de cotizacion adjudicada, si el origen es una cotizacion. */
  readonly idCotizacionDetalle?: number;
}

export interface PriceResult {
  readonly precioUnitario: number;
  readonly porcentajeDescuento: number;
  readonly porcentajeImpuesto: number;
  readonly fuente: string;
}

export interface PriceStrategy {
  readonly nombre: string;
  /** Devuelve un precio o `null` si la estrategia no aplica al caso. */
  resolve(query: PriceQuery, conn: Connection): Promise<PriceResult | null>;
}

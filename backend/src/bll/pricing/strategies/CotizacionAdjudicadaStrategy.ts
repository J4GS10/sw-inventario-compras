/**
 * Capa 3 - pricing / estrategia.
 * Toma el precio de la linea de cotizacion adjudicada (COM_COTIZACION_DETALLE
 * con ADJUDICADO = 'S').
 */

import type { Connection } from "oracledb";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import type { PriceQuery, PriceResult, PriceStrategy } from "../PriceStrategy.js";

interface CotDetalle {
  readonly idCotizacionDetalle: number;
  readonly precioUnitario: number;
  readonly porcentajeDescuento: number;
  readonly porcentajeImpuesto: number;
  readonly adjudicado: boolean;
}

export class CotizacionAdjudicadaStrategy implements PriceStrategy {
  public readonly nombre = "COTIZACION_ADJUDICADA";

  public async resolve(
    query: PriceQuery,
    conn: Connection,
  ): Promise<PriceResult | null> {
    if (query.idCotizacionDetalle === undefined) return null;
    const repo = repositoryFactory().get<CotDetalle, object, object>(
      "cotizacionDetalle",
    );
    const line = await repo.findById(query.idCotizacionDetalle, conn);
    if (line === null || line.adjudicado !== true) return null;
    return {
      precioUnitario: line.precioUnitario,
      porcentajeDescuento: line.porcentajeDescuento,
      porcentajeImpuesto: line.porcentajeImpuesto,
      fuente: this.nombre,
    };
  }
}

/**
 * Capa 3 - Logica de Negocio / pricing.
 * Contexto del patron Strategy: prueba las estrategias en orden de prioridad y
 * devuelve el primer precio resuelto. El conjunto y el orden de estrategias se
 * inyectan por constructor (composicion sobre herencia).
 */

import type { Connection } from "oracledb";
import { BusinessRuleError } from "../../common/errors/AppError.js";
import type { PriceQuery, PriceResult, PriceStrategy } from "./PriceStrategy.js";
import { CotizacionAdjudicadaStrategy } from "./strategies/CotizacionAdjudicadaStrategy.js";
import { AcuerdoMarcoStrategy } from "./strategies/AcuerdoMarcoStrategy.js";
import { UltimaCompraStrategy } from "./strategies/UltimaCompraStrategy.js";

export class PriceResolver {
  private readonly strategies: readonly PriceStrategy[];

  constructor(strategies?: readonly PriceStrategy[]) {
    this.strategies =
      strategies ?? [
        new CotizacionAdjudicadaStrategy(),
        new AcuerdoMarcoStrategy(),
        new UltimaCompraStrategy(),
      ];
  }

  /** @throws BusinessRuleError si ninguna estrategia puede resolver el precio. */
  public async resolve(
    query: PriceQuery,
    conn: Connection,
  ): Promise<PriceResult> {
    for (const strategy of this.strategies) {
      const result = await strategy.resolve(query, conn);
      if (result !== null) return result;
    }
    throw new BusinessRuleError(
      `No se pudo determinar el precio para el artículo ${query.idArticulo ?? "(libre)"} ` +
        `del proveedor ${query.idProveedor}. Registre una cotización adjudicada, ` +
        `un acuerdo marco o una compra previa.`,
    );
  }

  /** Igual que resolve() pero devuelve null en vez de lanzar. */
  public async tryResolve(
    query: PriceQuery,
    conn: Connection,
  ): Promise<PriceResult | null> {
    for (const strategy of this.strategies) {
      const result = await strategy.resolve(query, conn);
      if (result !== null) return result;
    }
    return null;
  }
}

export const defaultPriceResolver = new PriceResolver();

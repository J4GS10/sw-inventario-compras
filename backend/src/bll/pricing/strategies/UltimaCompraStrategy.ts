/**
 * Capa 3 - pricing / estrategia.
 * Ultimo recurso: precio de la ultima compra registrada en
 * COM_ARTICULO_PROVEEDOR.
 */

import type { Connection } from "oracledb";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import { normalizePageQuery } from "../../../common/types/Query.js";
import type { PriceQuery, PriceResult, PriceStrategy } from "../PriceStrategy.js";

interface ArticuloProveedor {
  readonly idArticuloProveedor: number;
  readonly idArticulo: number;
  readonly idProveedor: number;
  readonly precioUltimaCompra: number | null;
}

export class UltimaCompraStrategy implements PriceStrategy {
  public readonly nombre = "ULTIMA_COMPRA";

  public async resolve(
    query: PriceQuery,
    conn: Connection,
  ): Promise<PriceResult | null> {
    if (query.idArticulo === null) return null;
    const repo = repositoryFactory().get<ArticuloProveedor, object, object>(
      "articuloProveedor",
    );
    const rows = await repo.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 1,
        filters: [
          { prop: "idProveedor", operator: "eq", value: query.idProveedor },
          { prop: "idArticulo", operator: "eq", value: query.idArticulo },
        ],
      }),
      conn,
    );
    const row = rows.data[0];
    if (row === undefined || row.precioUltimaCompra === null) return null;
    return {
      precioUnitario: row.precioUltimaCompra,
      porcentajeDescuento: 0,
      porcentajeImpuesto: 0,
      fuente: this.nombre,
    };
  }
}

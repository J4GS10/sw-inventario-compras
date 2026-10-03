/**
 * Capa 3 - pricing / estrategia.
 * Usa un acuerdo marco vigente (COM_ACUERDO_PROVEEDOR) y su mejor escala de
 * descuento por volumen (COM_ACUERDO_DETALLE) para la cantidad solicitada.
 */

import type { Connection } from "oracledb";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import { normalizePageQuery } from "../../../common/types/Query.js";
import type { PriceQuery, PriceResult, PriceStrategy } from "../PriceStrategy.js";

interface Acuerdo {
  readonly idAcuerdo: number;
  readonly idProveedor: number;
  readonly idArticulo: number;
  readonly precioFijo: number | null;
  readonly fechaInicio: string;
  readonly fechaFin: string;
  readonly activo: boolean;
}

interface AcuerdoDetalle {
  readonly idAcuerdoDetalle: number;
  readonly idAcuerdo: number;
  readonly cantidadMinima: number;
  readonly porcentajeDescuento: number;
}

export class AcuerdoMarcoStrategy implements PriceStrategy {
  public readonly nombre = "ACUERDO_MARCO";

  public async resolve(
    query: PriceQuery,
    conn: Connection,
  ): Promise<PriceResult | null> {
    if (query.idArticulo === null) return null;

    const acuerdoRepo = repositoryFactory().get<Acuerdo, object, object>(
      "acuerdoProveedor",
    );
    const acuerdos = await acuerdoRepo.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 50,
        filters: [
          { prop: "idProveedor", operator: "eq", value: query.idProveedor },
          { prop: "idArticulo", operator: "eq", value: query.idArticulo },
          { prop: "activo", operator: "eq", value: "S" },
        ],
      }),
      conn,
    );

    const ref = new Date(query.fecha).getTime();
    const vigente = acuerdos.data.find((a) => {
      const ini = new Date(a.fechaInicio).getTime();
      const fin = new Date(a.fechaFin).getTime();
      return a.precioFijo !== null && ini <= ref && ref <= fin;
    });
    if (vigente === undefined || vigente.precioFijo === null) return null;

    const detalleRepo = repositoryFactory().get<AcuerdoDetalle, object, object>(
      "acuerdoDetalle",
    );
    const escalas = await detalleRepo.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 100,
        sort: "cantidadMinima",
        order: "desc",
        filters: [{ prop: "idAcuerdo", operator: "eq", value: vigente.idAcuerdo }],
      }),
      conn,
    );
    const escala = escalas.data.find((e) => query.cantidad >= e.cantidadMinima);

    return {
      precioUnitario: vigente.precioFijo,
      porcentajeDescuento: escala?.porcentajeDescuento ?? 0,
      porcentajeImpuesto: 0,
      fuente: this.nombre,
    };
  }
}

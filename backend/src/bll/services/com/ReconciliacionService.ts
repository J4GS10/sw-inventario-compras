/**
 * Capa 3 - Logica de Negocio / compras.
 *
 * Caso de uso: deteccion y reparacion de divergencias entre una Recepcion y
 * sus efectos en INV_ (kardex) / CXP_ (factura), que llegan por el
 * `DomainEventBus` (patron Observer) DESPUES del commit de la recepcion. Si un
 * suscriptor falla, `DomainEventBus.publish` solo lo loguea (`SUBSCRIBER_FAILED`)
 * — no hay outbox ni reintento automatico. Este servicio es la contraparte
 * manual: `consistencia` detecta, `reprocesar` repara (los suscriptores son
 * idempotentes, ver kardexSubscriber/cxpSubscriber).
 *
 * Solo lectura salvo `reprocesar` (que no escribe directamente: re-publica el
 * evento y deja que los suscriptores hagan su trabajo, igual que la vez
 * original). No hereda de TransactionalService por lo mismo que DashboardService.
 */

import { NotFoundError, BusinessRuleError } from "../../../common/errors/AppError.js";
import { normalizePageQuery } from "../../../common/types/Query.js";
import type {
  OrdenCompra,
  OrdenCompraDetalle,
  Recepcion,
  RecepcionDetalle,
} from "../../../entities/com/models.js";
import { ordenCompraRepository, recepcionRepository } from "../../../dal/repositories/com/index.js";
import {
  facturaProveedorRepository,
  kardexRepository,
} from "../../../dal/repositories/shared/index.js";
import { eventBus } from "../../../common/events/DomainEventBus.js";
import { ComEvents, type RecepcionRegistradaPayload } from "../../events/domainEvents.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";

export interface ConsistenciaReport {
  readonly idRecepcion: number;
  readonly estado: string;
  readonly lineas: number;
  readonly kardex: { readonly esperado: boolean; readonly encontrado: boolean; readonly ok: boolean };
  readonly cxp: { readonly esperada: boolean; readonly encontrada: boolean; readonly ok: boolean };
  readonly ok: boolean;
}

/** Resultado de validar la correspondencia Solicitud -> OC -> Recepcion -> Factura. */
export interface TresWayMatchReport {
  readonly idOrdenCompra: number;
  readonly idRecepcion: number;
  readonly idFacturaProveedor: number;
  /** La OC nace de una cotizacion adjudicada, que a su vez viene de una solicitud. */
  readonly solicitudOrden: {
    readonly lineasOc: number;
    readonly lineasTrazadas: number;
    readonly ok: boolean;
  };
  /** Las lineas de ESTA recepcion corresponden a renglones reales de la OC. */
  readonly ordenRecepcion: {
    readonly lineasRecepcion: number;
    readonly lineasValidas: number;
    readonly ok: boolean;
  };
  /** El monto de la factura coincide con lo recibido x precio de la OC (tolerancia Q5 o 2%). */
  readonly recepcionFactura: {
    readonly montoSistema: number;
    readonly montoFactura: number;
    readonly diferencia: number;
    readonly ok: boolean;
  };
  readonly ok: boolean;
}

const RECEPCION_ACTIVA = ["RECIBIDO", "ALIMENTADO_CXP"];

export class ReconciliacionService {
  private readonly recepcionRepo = recepcionRepository();

  private readonly ocRepo = ordenCompraRepository();

  /**
   * Compara lo que la recepcion DEBERIA haber generado (kardex de entrada; y,
   * si ya alimento CxP, una factura) contra lo que realmente existe.
   */
  public async consistencia(idRecepcion: number): Promise<ConsistenciaReport> {
    const recepcion = (await this.recepcionRepo.findById(idRecepcion)) as Recepcion | null;
    if (recepcion === null) throw new NotFoundError("COM_RECEPCION", idRecepcion);
    const detalles = (await this.recepcionRepo.listDetails(
      idRecepcion,
    )) as readonly RecepcionDetalle[];

    const kardexEsperado = detalles.some((d) => d.cantidadRecibida > 0);
    const kardexPage = await kardexRepository().findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 1,
        filters: [
          { prop: "idDocumentoRef", operator: "eq", value: idRecepcion },
          { prop: "tipoMovimiento", operator: "eq", value: "ENTRADA_COMPRA" },
        ],
      }),
    );
    const kardexEncontrado = kardexPage.data.length > 0;

    const cxpEsperada = recepcion.estado === "ALIMENTADO_CXP";
    let cxpEncontrada = false;
    if (cxpEsperada) {
      const facturas = await facturaProveedorRepository().findAll(
        normalizePageQuery({
          page: 1,
          pageSize: 1,
          filters: [{ prop: "idRecepcion", operator: "eq", value: idRecepcion }],
        }),
      );
      cxpEncontrada = facturas.data.length > 0;
    }

    const kardexOk = !kardexEsperado || kardexEncontrado;
    const cxpOk = !cxpEsperada || cxpEncontrada;

    return {
      idRecepcion,
      estado: recepcion.estado ?? "—",
      lineas: detalles.length,
      kardex: { esperado: kardexEsperado, encontrado: kardexEncontrado, ok: kardexOk },
      cxp: { esperada: cxpEsperada, encontrada: cxpEncontrada, ok: cxpOk },
      ok: kardexOk && cxpOk,
    };
  }

  /**
   * Validacion de 3-way match para la factura que se va a liquidar: compara
   * Solicitud->OC (la OC traza a una cotizacion adjudicada), OC->Recepcion
   * (las lineas de esta recepcion son renglones reales de la OC) y
   * Recepcion->Factura (el monto coincide con lo recibido x precio de la OC).
   * Informativo: no bloquea la liquidacion por si solo, la deja a criterio de
   * Finanzas con el detalle visible (ver LiquidacionService).
   */
  public async tresWayMatch(idFacturaProveedor: number): Promise<TresWayMatchReport> {
    const factura = (await facturaProveedorRepository().findById(idFacturaProveedor)) as
      | { idFacturaProveedor: number; idRecepcion: number | null; montoTotal: number }
      | null;
    if (factura === null) throw new NotFoundError("CXP_FACTURA_PROVEEDOR", idFacturaProveedor);
    if (factura.idRecepcion === null) {
      throw new BusinessRuleError(
        "Esta factura no está ligada a una recepción; no admite 3-way match.",
      );
    }
    const idRecepcion = factura.idRecepcion;

    const recepcion = (await this.recepcionRepo.findById(idRecepcion)) as Recepcion | null;
    if (recepcion === null) throw new NotFoundError("COM_RECEPCION", idRecepcion);
    const idOrdenCompra = recepcion.idOrdenCompra;

    const ocLineas = (await this.ocRepo.listDetails(idOrdenCompra)) as readonly OrdenCompraDetalle[];
    const porOcId = new Map(ocLineas.map((l) => [l.idOcDetalle, l]));
    const recDetalles = (await this.recepcionRepo.listDetails(
      idRecepcion,
    )) as readonly RecepcionDetalle[];

    // Solicitud -> OC: cada renglon de la OC viene de una cotizacion
    // adjudicada (que a su vez viene de un renglon de Solicitud).
    const lineasTrazadas = ocLineas.filter((l) => l.idCotizacionDetalle !== null).length;

    // OC -> Recepcion: cada linea de ESTA recepcion corresponde a un renglon
    // real de la OC (RecepcionService solo admite idOcDetalle de la misma OC).
    const lineasValidas = recDetalles.filter((d) => porOcId.has(d.idOcDetalle)).length;

    // Recepcion -> Factura: monto de la factura vs. lo recibido x precio neto
    // de la OC (mismo calculo que cxpSubscriber al generar el borrador).
    let montoSistema = 0;
    for (const d of recDetalles) {
      const ocLinea = porOcId.get(d.idOcDetalle);
      if (ocLinea === undefined) continue;
      const neto = ocLinea.precioUnitario * (1 - ocLinea.porcentajeDescuento / 100);
      montoSistema += d.cantidadRecibida * neto;
    }
    montoSistema = Number(montoSistema.toFixed(2));
    const diferencia = Number((factura.montoTotal - montoSistema).toFixed(2));
    const tolerancia = Math.max(5, montoSistema * 0.02);

    const solicitudOrden = {
      lineasOc: ocLineas.length,
      lineasTrazadas,
      ok: ocLineas.length > 0 && lineasTrazadas === ocLineas.length,
    };
    const ordenRecepcion = {
      lineasRecepcion: recDetalles.length,
      lineasValidas,
      ok: recDetalles.length > 0 && lineasValidas === recDetalles.length,
    };
    const recepcionFactura = {
      montoSistema,
      montoFactura: factura.montoTotal,
      diferencia,
      ok: Math.abs(diferencia) <= tolerancia,
    };

    return {
      idOrdenCompra,
      idRecepcion,
      idFacturaProveedor,
      solicitudOrden,
      ordenRecepcion,
      recepcionFactura,
      ok: solicitudOrden.ok && ordenRecepcion.ok && recepcionFactura.ok,
    };
  }

  /**
   * Reconstruye el payload de `RecepcionRegistrada` desde el estado actual de
   * la recepcion + la OC y lo vuelve a publicar. Los suscriptores son
   * idempotentes: si ya tienen su parte hecha, no duplican nada.
   */
  public async reprocesar(
    idRecepcion: number,
    ctx: AuditContext,
  ): Promise<{ idRecepcion: number; evento: string }> {
    const recepcion = (await this.recepcionRepo.findById(idRecepcion)) as Recepcion | null;
    if (recepcion === null) throw new NotFoundError("COM_RECEPCION", idRecepcion);
    if (recepcion.estado === null || !RECEPCION_ACTIVA.includes(recepcion.estado)) {
      throw new BusinessRuleError(
        `Solo se puede reprocesar una recepción activa (${RECEPCION_ACTIVA.join("/")}); ` +
          `esta está ${String(recepcion.estado)}.`,
      );
    }
    const detalles = (await this.recepcionRepo.listDetails(
      idRecepcion,
    )) as readonly RecepcionDetalle[];
    const oc = (await this.ocRepo.findById(recepcion.idOrdenCompra)) as OrdenCompra | null;
    if (oc === null) throw new NotFoundError("COM_ORDEN_COMPRA", recepcion.idOrdenCompra);
    const ocLineas = (await this.ocRepo.listDetails(
      recepcion.idOrdenCompra,
    )) as readonly OrdenCompraDetalle[];
    const porOcId = new Map(ocLineas.map((l) => [l.idOcDetalle, l]));

    const payload: RecepcionRegistradaPayload = {
      idRecepcion,
      idOrdenCompra: oc.idOrdenCompra,
      idBodega: recepcion.idBodega,
      idProveedor: oc.idProveedor,
      idEmpleadoRecibe: recepcion.idEmpleadoRecibe,
      fechaRecepcion: recepcion.fechaRecepcion,
      userId: ctx.userId,
      lineas: detalles.map((d) => {
        const ocLinea = porOcId.get(d.idOcDetalle);
        const neto =
          ocLinea === undefined
            ? 0
            : ocLinea.precioUnitario * (1 - ocLinea.porcentajeDescuento / 100);
        return {
          idOcDetalle: d.idOcDetalle,
          idArticulo: ocLinea?.idArticulo ?? null,
          cantidadRecibida: d.cantidadRecibida,
          cantidadRechazada: d.cantidadRechazada,
          costoUnitario: Number(neto.toFixed(4)),
        };
      }),
    };
    await eventBus().publish(ComEvents.RecepcionRegistrada, payload);
    return { idRecepcion, evento: ComEvents.RecepcionRegistrada };
  }
}

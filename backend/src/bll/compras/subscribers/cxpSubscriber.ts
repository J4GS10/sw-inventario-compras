/**
 * Capa 3 - Logica de Negocio / suscriptor de eventos.
 *
 * PROVISIONAL: pertenece al modulo de Cuentas por Pagar (CXP_). Reacciona a
 * RecepcionRegistrada y genera la CXP_FACTURA_PROVEEDOR borrador, resolviendo
 * la FK circular con COM_RECEPCION en dos pasos dentro de una misma transaccion:
 *   1) crear la factura (ID_RECEPCION apunta a la recepcion)
 *   2) actualizar COM_RECEPCION.ID_FACTURA_PROVEEDOR + ESTADO = ALIMENTADO_CXP
 */

import { oraclePool } from "../../../dal/OraclePool.js";
import { logger } from "../../../common/logging/Logger.js";
import { normalizePageQuery } from "../../../common/types/Query.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import { facturaProveedorRepository } from "../../../dal/repositories/shared/index.js";
import { eventBus } from "../../../common/events/DomainEventBus.js";
import { recepcionStateMachine } from "../../compras/stateMachines.js";
import {
  ComEvents,
  type RecepcionRegistradaPayload,
  type RecepcionReversadaPayload,
} from "../../events/domainEvents.js";

function hoyIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Emision + dias de credito del proveedor (COM_PROVEEDOR.DIAS_CREDITO, 0 si no tiene). */
function sumarDias(isoDate: string, dias: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function onRecepcionRegistrada(
  payload: RecepcionRegistradaPayload,
): Promise<void> {
  const montoTotal = Number(
    payload.lineas
      .reduce((acc, l) => acc + l.cantidadRecibida * l.costoUnitario, 0)
      .toFixed(2),
  );
  if (montoTotal <= 0) return;

  const facturas = facturaProveedorRepository();
  const recepciones = repositoryFactory().get("recepcion");
  const sys = { userId: payload.userId, permisos: ["*"] as const };

  await oraclePool().withTransaction(async (conn) => {
    // Idempotencia: si ya hay una factura para esta recepcion, el evento ya se
    // proceso entero (factura + COM_RECEPCION en la misma tx) -> no duplicar
    // (permite `POST .../reprocesar` sin riesgo).
    const existente = await facturas.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 1,
        filters: [{ prop: "idRecepcion", operator: "eq", value: payload.idRecepcion }],
      }),
      conn,
    );
    if (existente.data.length > 0) {
      logger().info("CxP ya alimentada para esta recepción (idempotente)", {
        idRecepcion: payload.idRecepcion,
      });
      return;
    }

    // Vencimiento = emision + dias de credito del proveedor — sin esto, la
    // factura borrador quedaba "sin fecha" hasta liquidarse, e invisible para
    // cualquier proyeccion de flujo de pagos mientras seguia pendiente.
    const proveedor = (await repositoryFactory()
      .get("proveedor")
      .findById(payload.idProveedor, conn)) as { diasCredito: number | null } | null;
    const fechaEmision = hoyIsoDate();
    const fechaVencimiento = sumarDias(fechaEmision, proveedor?.diasCredito ?? 0);

    const factura = (await facturas.create(
      {
        idProveedor: payload.idProveedor,
        idRecepcion: payload.idRecepcion,
        tipoDocumento: "FACTURA",
        fechaEmision,
        fechaDocumento: fechaEmision,
        fechaVencimiento,
        montoTotal,
        montoRetencionIva: 0,
        montoRetencionIsr: 0,
        saldoPendiente: montoTotal,
        estado: "PENDIENTE",
      },
      sys,
      conn,
    )) as { idFacturaProveedor: number };

    recepcionStateMachine.assertTransition("RECIBIDO", "ALIMENTADO_CXP");
    await recepciones.update(
      payload.idRecepcion,
      {
        idFacturaProveedor: factura.idFacturaProveedor,
        estado: "ALIMENTADO_CXP",
      },
      null,
      sys,
      conn,
    );

    logger().info("CxP alimentada por recepción", {
      idRecepcion: payload.idRecepcion,
      idFacturaProveedor: factura.idFacturaProveedor,
      montoTotal,
    });
  });
}

/**
 * Reversa: la factura de proveedor generada por la recepcion pasa a ANULADA
 * (valor valido del enum del DDL) y se borra logicamente. El cerrojo de "sin
 * pagos" ya lo valido RecepcionService.reversar dentro de su transaccion.
 */
async function onRecepcionReversada(
  payload: RecepcionReversadaPayload,
): Promise<void> {
  if (payload.idFacturaProveedor === null) return;
  const idFactura = payload.idFacturaProveedor;
  const facturas = facturaProveedorRepository();
  const sys = { userId: payload.userId, permisos: ["*"] as const };

  await oraclePool().withTransaction(async (conn) => {
    const factura = (await facturas.findById(idFactura, conn)) as
      | { idFacturaProveedor: number; estado: string | null }
      | null;
    if (factura === null || factura.estado === "ANULADA") return;

    await facturas.update(
      idFactura,
      { estado: "ANULADA", saldoPendiente: 0 },
      null,
      sys,
      conn,
    );
    await facturas.softDelete(idFactura, sys, conn);

    logger().info("CxP anulada por reversa de recepción", {
      idRecepcion: payload.idRecepcion,
      idFacturaProveedor: idFactura,
    });
  });
}

export function registerCxpSubscriber(): void {
  eventBus().subscribe<RecepcionRegistradaPayload>(
    ComEvents.RecepcionRegistrada,
    (payload) => onRecepcionRegistrada(payload),
  );
  eventBus().subscribe<RecepcionReversadaPayload>(
    ComEvents.RecepcionReversada,
    (payload) => onRecepcionReversada(payload),
  );
}

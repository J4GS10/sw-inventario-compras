/**
 * Capa 3 - Logica de Negocio / suscriptor de eventos.
 *
 * PROVISIONAL: pertenece conceptualmente al modulo de Inventario (INV_). Se
 * ubica aqui hasta que ese modulo se implemente. Reacciona al evento de dominio
 * RecepcionRegistrada (patron Observer) y registra la ENTRADA_COMPRA en el
 * kardex, recalculando saldo y costo promedio ponderado.
 *
 * Corre en su PROPIA transaccion: el evento se publica solo tras el commit de
 * la recepcion (ver TransactionalService), por lo que aqui ya existe.
 */

import type { Connection } from "oracledb";
import { oraclePool } from "../../../dal/OraclePool.js";
import { normalizePageQuery } from "../../../common/types/Query.js";
import { logger } from "../../../common/logging/Logger.js";
import {
  existenciaRepository,
  kardexRepository,
} from "../../../dal/repositories/shared/index.js";
import { eventBus } from "../../../common/events/DomainEventBus.js";
import {
  ComEvents,
  type ExistenciaActualizadaPayload,
  type RecepcionRegistradaPayload,
  type RecepcionReversadaPayload,
} from "../../events/domainEvents.js";

interface KardexRow {
  readonly idMovimiento: number;
  readonly saldoCantidad: number;
  readonly saldoCostoPromedio: number;
}

interface ExistenciaRow {
  readonly idExistencia: number;
  readonly cantidadActual: number | null;
  readonly costoPromedioActual: number | null;
}

async function ultimoSaldo(
  kardex: ReturnType<typeof kardexRepository>,
  idArticulo: number,
  idBodega: number,
  conn: Connection,
): Promise<{ cantidad: number; costo: number }> {
  const page = await kardex.findAll(
    normalizePageQuery({
      page: 1,
      pageSize: 1,
      sort: "idMovimiento",
      order: "desc",
      filters: [
        { prop: "idArticulo", operator: "eq", value: idArticulo },
        { prop: "idBodega", operator: "eq", value: idBodega },
      ],
    }),
    conn,
  );
  const last = page.data[0] as KardexRow | undefined;
  return {
    cantidad: last?.saldoCantidad ?? 0,
    costo: last?.saldoCostoPromedio ?? 0,
  };
}

/**
 * Idempotencia: true si ya existe un movimiento de este tipo para la recepcion
 * (permite reprocesar un evento sin duplicar filas — `POST .../reprocesar`).
 * El lote de una recepcion es atomico (una sola transaccion), asi que basta
 * con una fila de cualquier linea para saber que el evento ya se aplico entero.
 */
async function yaProcesado(
  kardex: ReturnType<typeof kardexRepository>,
  idRecepcion: number,
  tipoMovimiento: "ENTRADA_COMPRA" | "AJUSTE_NEGATIVO",
  conn: Connection,
): Promise<boolean> {
  const page = await kardex.findAll(
    normalizePageQuery({
      page: 1,
      pageSize: 1,
      filters: [
        { prop: "idDocumentoRef", operator: "eq", value: idRecepcion },
        { prop: "tipoMovimiento", operator: "eq", value: tipoMovimiento },
      ],
    }),
    conn,
  );
  return page.data.length > 0;
}

async function upsertExistencia(
  existencia: ReturnType<typeof existenciaRepository>,
  idArticulo: number,
  idBodega: number,
  saldoCantidad: number,
  costoPromedio: number,
  conn: Connection,
): Promise<void> {
  const page = await existencia.findAll(
    normalizePageQuery({
      page: 1,
      pageSize: 1,
      filters: [
        { prop: "idArticulo", operator: "eq", value: idArticulo },
        { prop: "idBodega", operator: "eq", value: idBodega },
      ],
    }),
    conn,
  );
  const row = page.data[0] as ExistenciaRow | undefined;
  const sys = { userId: 0, permisos: ["*"] as const };
  if (row === undefined) {
    await existencia.create(
      {
        idBodega,
        idArticulo,
        cantidadActual: saldoCantidad,
        costoPromedioActual: costoPromedio,
      },
      sys,
      conn,
    );
  } else {
    await existencia.update(
      row.idExistencia,
      { cantidadActual: saldoCantidad, costoPromedioActual: costoPromedio },
      null,
      sys,
      conn,
    );
  }
}

async function onRecepcionRegistrada(
  payload: RecepcionRegistradaPayload,
): Promise<void> {
  const kardex = kardexRepository();
  const existencia = existenciaRepository();
  const sys = { userId: payload.userId, permisos: ["*"] as const };
  // Saldos que de verdad cambiaron en esta corrida (vacio si el evento ya
  // estaba procesado) — se notifican DESPUES del commit, igual que este mismo
  // evento se publica solo tras el commit de la recepcion.
  const afectados: ExistenciaActualizadaPayload[] = [];

  await oraclePool().withTransaction(async (conn) => {
    if (await yaProcesado(kardex, payload.idRecepcion, "ENTRADA_COMPRA", conn)) {
      logger().info("Kardex ya tenía la entrada de esta recepción (idempotente)", {
        idRecepcion: payload.idRecepcion,
      });
      return;
    }
    for (const linea of payload.lineas) {
      if (linea.idArticulo === null || linea.cantidadRecibida <= 0) continue;

      const prev = await ultimoSaldo(kardex, linea.idArticulo, payload.idBodega, conn);
      const nuevaCantidad = prev.cantidad + linea.cantidadRecibida;
      const nuevoCosto =
        nuevaCantidad > 0
          ? (prev.cantidad * prev.costo +
              linea.cantidadRecibida * linea.costoUnitario) /
            nuevaCantidad
          : linea.costoUnitario;

      await kardex.create(
        {
          idArticulo: linea.idArticulo,
          idBodega: payload.idBodega,
          fechaMovimiento: payload.fechaRecepcion,
          tipoMovimiento: "ENTRADA_COMPRA",
          tipoDocumentoRef: "COM_RECEPCION",
          idDocumentoRef: payload.idRecepcion,
          cantidad: linea.cantidadRecibida,
          costoUnitario: Number(linea.costoUnitario.toFixed(4)),
          saldoCantidad: Number(nuevaCantidad.toFixed(2)),
          saldoCostoPromedio: Number(nuevoCosto.toFixed(4)),
          idEmpleadoRegistro: null,
        },
        sys,
        conn,
      );

      const cantidadActual = Number(nuevaCantidad.toFixed(2));
      const costoPromedioActual = Number(nuevoCosto.toFixed(4));
      await upsertExistencia(
        existencia,
        linea.idArticulo,
        payload.idBodega,
        cantidadActual,
        costoPromedioActual,
        conn,
      );
      afectados.push({
        idArticulo: linea.idArticulo,
        idBodega: payload.idBodega,
        cantidadActual,
        costoPromedioActual,
        userId: payload.userId,
      });
    }
  });

  for (const a of afectados) {
    await eventBus().publish<ExistenciaActualizadaPayload>(
      ComEvents.ExistenciaActualizada,
      a,
    );
  }

  logger().info("Kardex actualizado por recepción", {
    idRecepcion: payload.idRecepcion,
    lineas: payload.lineas.length,
  });
}

/**
 * Reversa: compensa cada linea de la recepcion con un AJUSTE_NEGATIVO (CANTIDAD
 * siempre > 0 por el CHECK del DDL) y hace el back-out del promedio ponderado.
 */
async function onRecepcionReversada(
  payload: RecepcionReversadaPayload,
): Promise<void> {
  const kardex = kardexRepository();
  const existencia = existenciaRepository();
  const sys = { userId: payload.userId, permisos: ["*"] as const };
  const afectados: ExistenciaActualizadaPayload[] = [];

  await oraclePool().withTransaction(async (conn) => {
    if (await yaProcesado(kardex, payload.idRecepcion, "AJUSTE_NEGATIVO", conn)) {
      logger().info("Kardex ya tenía el ajuste de esta reversa (idempotente)", {
        idRecepcion: payload.idRecepcion,
      });
      return;
    }
    for (const linea of payload.lineas) {
      if (linea.idArticulo === null || linea.cantidadRecibida <= 0) continue;

      const prev = await ultimoSaldo(kardex, linea.idArticulo, payload.idBodega, conn);
      const nuevaCantidad = prev.cantidad - linea.cantidadRecibida;
      const restante =
        prev.cantidad * prev.costo - linea.cantidadRecibida * linea.costoUnitario;
      const nuevoCosto = nuevaCantidad > 1e-9 ? restante / nuevaCantidad : 0;
      const saldoCantidad = Math.max(nuevaCantidad, 0);
      const saldoCosto = Math.max(nuevoCosto, 0);

      await kardex.create(
        {
          idArticulo: linea.idArticulo,
          idBodega: payload.idBodega,
          fechaMovimiento: new Date().toISOString(),
          tipoMovimiento: "AJUSTE_NEGATIVO",
          tipoDocumentoRef: "COM_RECEPCION_REVERSA",
          idDocumentoRef: payload.idRecepcion,
          cantidad: linea.cantidadRecibida,
          costoUnitario: Number(linea.costoUnitario.toFixed(4)),
          saldoCantidad: Number(saldoCantidad.toFixed(2)),
          saldoCostoPromedio: Number(saldoCosto.toFixed(4)),
          idEmpleadoRegistro: null,
        },
        sys,
        conn,
      );

      const cantidadActual = Number(saldoCantidad.toFixed(2));
      const costoPromedioActual = Number(saldoCosto.toFixed(4));
      await upsertExistencia(
        existencia,
        linea.idArticulo,
        payload.idBodega,
        cantidadActual,
        costoPromedioActual,
        conn,
      );
      afectados.push({
        idArticulo: linea.idArticulo,
        idBodega: payload.idBodega,
        cantidadActual,
        costoPromedioActual,
        userId: payload.userId,
      });
    }
  });

  for (const a of afectados) {
    await eventBus().publish<ExistenciaActualizadaPayload>(
      ComEvents.ExistenciaActualizada,
      a,
    );
  }

  logger().info("Kardex compensado por reversa de recepción", {
    idRecepcion: payload.idRecepcion,
    lineas: payload.lineas.length,
  });
}

/** Registra el suscriptor. Se llama una vez al arrancar el backend. */
export function registerKardexSubscriber(): void {
  eventBus().subscribe<RecepcionRegistradaPayload>(
    ComEvents.RecepcionRegistrada,
    (payload) => onRecepcionRegistrada(payload),
  );
  eventBus().subscribe<RecepcionReversadaPayload>(
    ComEvents.RecepcionReversada,
    (payload) => onRecepcionReversada(payload),
  );
}

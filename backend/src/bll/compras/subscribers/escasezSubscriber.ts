/**
 * Capa 3 - Logica de Negocio / suscriptor de eventos.
 *
 * PROVISIONAL: pertenece conceptualmente al modulo de Inventario (INV_). Se
 * ubica aqui hasta que ese modulo se implemente (igual que kardexSubscriber).
 *
 * Reacciona a `ExistenciaActualizada` (patron Observer) — lo publica
 * kardexSubscriber tras CONFIRMAR el saldo nuevo, nunca en paralelo con el
 * recalculo (el bus corre los suscriptores de un mismo evento en paralelo;
 * por eso esta es una reaccion a un evento DERIVADO que solo se publica
 * despues del commit de existencia, no al mismo evento de recepcion).
 *
 * Compara la existencia contra INV_ARTICULO.STOCK_MINIMO:
 *  - Cae por debajo y no hay ya una alerta PENDIENTE -> crea INV_ALERTA_ESCASEZ.
 *  - Se recupera por encima del minimo -> cierra (ATENDIDA) la alerta abierta.
 * Idempotente por diseno: una alerta PENDIENTE por articulo+bodega.
 */

import { oraclePool } from "../../../dal/OraclePool.js";
import { normalizePageQuery } from "../../../common/types/Query.js";
import { logger } from "../../../common/logging/Logger.js";
import {
  alertaEscasezRepository,
  articuloRepository,
} from "../../../dal/repositories/shared/index.js";
import { eventBus } from "../../../common/events/DomainEventBus.js";
import {
  ComEvents,
  type ExistenciaActualizadaPayload,
} from "../../events/domainEvents.js";

interface AlertaRow {
  readonly idAlerta: number;
}

interface ArticuloRow {
  readonly stockMinimo: number | null;
}

async function onExistenciaActualizada(
  payload: ExistenciaActualizadaPayload,
): Promise<void> {
  const articulos = articuloRepository();
  const alertas = alertaEscasezRepository();
  const sys = { userId: payload.userId, permisos: ["*"] as const };

  await oraclePool().withTransaction(async (conn) => {
    const articulo = (await articulos.findById(
      payload.idArticulo,
      conn,
    )) as ArticuloRow | null;
    // Articulo sin umbral configurado (STOCK_MINIMO en 0/NULL): sin alerta.
    const stockMinimo = articulo?.stockMinimo ?? 0;

    const page = await alertas.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 1,
        filters: [
          { prop: "idArticulo", operator: "eq", value: payload.idArticulo },
          { prop: "idBodega", operator: "eq", value: payload.idBodega },
          { prop: "estado", operator: "eq", value: "PENDIENTE" },
        ],
      }),
      conn,
    );
    const existente = page.data[0] as AlertaRow | undefined;

    if (stockMinimo > 0 && payload.cantidadActual < stockMinimo) {
      if (existente !== undefined) return; // ya hay una alerta abierta para este par
      await alertas.create(
        {
          idArticulo: payload.idArticulo,
          idBodega: payload.idBodega,
          fechaDeteccion: new Date().toISOString(),
          cantidadActual: payload.cantidadActual,
          stockMinimo,
          idSolicitudGenerada: null,
          estado: "PENDIENTE",
        },
        sys,
        conn,
      );
      logger().info("Alerta de escasez creada", {
        idArticulo: payload.idArticulo,
        idBodega: payload.idBodega,
        cantidadActual: payload.cantidadActual,
        stockMinimo,
      });
      return;
    }

    if (existente !== undefined) {
      await alertas.update(existente.idAlerta, { estado: "ATENDIDA" }, null, sys, conn);
      logger().info("Alerta de escasez atendida (existencia recuperada)", {
        idArticulo: payload.idArticulo,
        idBodega: payload.idBodega,
        cantidadActual: payload.cantidadActual,
      });
    }
  });
}

/** Registra el suscriptor. Se llama una vez al arrancar el backend. */
export function registerEscasezSubscriber(): void {
  eventBus().subscribe<ExistenciaActualizadaPayload>(
    ComEvents.ExistenciaActualizada,
    (payload) => onExistenciaActualizada(payload),
  );
}

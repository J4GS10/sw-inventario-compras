/**
 * Test de INTEGRACION - regresiones corregidas:
 *  1. POST de accion sin cuerpo pero con Content-Type: application/json
 *     (el frontend lo hacia y Fastify respondia 400 "Body cannot be empty").
 *  2. Alta en tablas con columnas de auditoria usando un usuario real
 *     (fallaba con FK a SEG_USUARIO cuando la tabla estaba vacia).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const inTwoWeeks = new Date(Date.now() + 14 * 864e5).toISOString();

interface Ids {
  empleado: number;
  sucursal: number;
  grupoCompra: number;
  terminoEntrega: number;
  moneda: number;
  condicionPago: number;
  unidadMedida: number;
  proveedor: number;
  proveedores: number[];
}
const ids = {} as Ids;

const state = { idRfq: 0, idCotizacionDetalle: 0 };

beforeAll(async () => {
  app = await startTestApp();
  ids.empleado = await scalar("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'");
  ids.sucursal = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  ids.grupoCompra = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  ids.terminoEntrega = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  ids.moneda = await scalar("SELECT MIN(ID_MONEDA) V FROM COM_MONEDA WHERE ELIMINADO='N'");
  ids.condicionPago = await scalar("SELECT MIN(ID_CONDICION_PAGO) V FROM COM_CONDICION_PAGO WHERE ELIMINADO='N'");
  ids.unidadMedida = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
  ids.proveedor = await scalar("SELECT MIN(ID_PROVEEDOR) V FROM COM_PROVEEDOR WHERE ELIMINADO='N'");
  ids.proveedores = await proveedoresIds(3);
});

async function proveedoresIds(n: number): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      await scalar(
        `SELECT MIN(ID_PROVEEDOR) V FROM COM_PROVEEDOR WHERE ELIMINADO='N'` +
          (out.length ? ` AND ID_PROVEEDOR > ${out[out.length - 1]!}` : ""),
      ),
    );
  }
  return out;
}

afterAll(async () => {
  await stopTestApp(app);
});

describe("Regresión: POST de acción sin cuerpo + auditoría con usuario real", () => {
  it("crea una solicitud con X-Dev-User=1 y puebla CREADO_POR (auditoria real)", async () => {
    const segUser = await scalar("SELECT COUNT(*) V FROM SEG_USUARIO WHERE ID_USUARIO=1");
    expect(segUser).toBe(1); // 00_seed_base.sql debe haber creado el usuario de sistema

    const res = await app.inject({
      method: "POST",
      url: "/api/com/solicitudes",
      headers: { "x-dev-user": "1", "content-type": "application/json" },
      payload: {
        cabecera: {
          idEmpleadoSolicitante: ids.empleado,
          idSucursal: ids.sucursal,
          idGrupoCompra: ids.grupoCompra,
          idTerminoEntrega: ids.terminoEntrega,
          justificacion: "Regresión auditoría",
          prioridad: 3,
        },
        detalles: [
          {
            descripcion: "item",
            cantidadSolicitada: 1,
            idUnidadMedida: ids.unidadMedida,
            fechaRequerida: inTwoWeeks.slice(0, 10),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { header: { idSolicitud: number; creadoPor: number } } };
    expect(body.data.header.creadoPor).toBe(1);

    // Aprobar x2 para dejar la solicitud EN_COTIZACION y montar el escenario.
    const idSolicitud = body.data.header.idSolicitud;
    for (let i = 0; i < 2; i++) {
      const ap = await app.inject({
        method: "POST",
        url: `/api/com/solicitudes/${idSolicitud}/aprobar`,
        headers: { "x-dev-user": "1", "content-type": "application/json" },
        payload: { idEmpleado: ids.empleado },
      });
      expect(ap.statusCode).toBe(200);
    }
    const rfq = await app.inject({
      method: "POST",
      url: "/api/com/rfq",
      headers: { "x-dev-user": "1", "content-type": "application/json" },
      payload: { idSolicitud, fechaLimite: inTwoWeeks.slice(0, 10), proveedores: ids.proveedores },
    });
    expect(rfq.statusCode).toBe(201);
    state.idRfq = (rfq.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;

    const idSolicitudDetalle = await scalar(
      `SELECT MIN(ID_SOLICITUD_DETALLE) V FROM COM_SOLICITUD_DETALLE WHERE ID_SOLICITUD=${idSolicitud}`,
    );
    const cot = await app.inject({
      method: "POST",
      url: "/api/com/cotizaciones",
      headers: { "x-dev-user": "1", "content-type": "application/json" },
      payload: {
        idRfq: state.idRfq,
        idProveedor: ids.proveedor,
        idCondicionPago: ids.condicionPago,
        idMoneda: ids.moneda,
        tasaCambio: 1,
        fechaVencimiento: inTwoWeeks,
        lineas: [
          { idSolicitudDetalle, precioUnitario: 10, cantidad: 1, idUnidadMedida: ids.unidadMedida },
        ],
      },
    });
    expect(cot.statusCode).toBe(201);
    state.idCotizacionDetalle = (
      cot.json() as { data: { details: { idCotizacionDetalle: number }[] } }
    ).data.details[0]!.idCotizacionDetalle;
  });

  it("adjudica con Content-Type application/json y SIN cuerpo -> 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/detalle/${state.idCotizacionDetalle}/adjudicar`,
      headers: { "x-dev-user": "1", "content-type": "application/json" },
      // sin payload
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { data: { adjudicado: boolean } }).data.adjudicado).toBe(true);
  });

  it("cierra el RFQ con Content-Type application/json y SIN cuerpo -> 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/com/rfq/${state.idRfq}/cerrar`,
      headers: { "x-dev-user": "1", "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { data: { estado: string } }).data.estado).toBe("CERRADO");
  });

  it("no permite registrar una cotización nueva contra un RFQ ya CERRADO (409)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/cotizaciones",
      headers: { "x-dev-user": "1", "content-type": "application/json" },
      payload: {
        idRfq: state.idRfq,
        idProveedor: ids.proveedor,
        idCondicionPago: ids.condicionPago,
        idMoneda: ids.moneda,
        tasaCambio: 1,
        fechaVencimiento: inTwoWeeks,
        lineas: [{ idSolicitudDetalle: 1, precioUnitario: 10, cantidad: 1, idUnidadMedida: ids.unidadMedida }],
      },
    });
    expect(res.statusCode).toBe(409);
  });
});

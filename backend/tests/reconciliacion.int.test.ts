/**
 * Test de INTEGRACION - Reconciliacion de una recepcion contra sus efectos en
 * INV_ (kardex) / CXP_ (factura), publicados por el DomainEventBus tras el
 * commit. Simula la divergencia que dejaria un suscriptor fallido (se borran
 * a mano las filas) y verifica deteccion (`GET .../consistencia`) y reparacion
 * idempotente (`POST .../reprocesar`).
 *
 * Ejecutar:  pnpm --filter backend test:int
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SYS_HEADERS, oraclePool, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const H = SYS_HEADERS;
const inTwoWeeks = new Date(Date.now() + 14 * 864e5).toISOString();

interface Ids {
  sucursal: number;
  empleado: number;
  articulo: number;
  unidadMedida: number;
  grupoCompra: number;
  terminoEntrega: number;
  moneda: number;
  condicionPago: number;
  bodega: number;
  proveedores: number[];
}
const ids = {} as Ids;

const s = { idRecepcion: 0, idOrdenCompra: 0 };

beforeAll(async () => {
  app = await startTestApp();

  ids.sucursal = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  ids.empleado = await scalar("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'");
  ids.articulo = await scalar("SELECT MIN(ID_ARTICULO) V FROM INV_ARTICULO WHERE ELIMINADO='N'");
  ids.unidadMedida = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
  ids.grupoCompra = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  ids.terminoEntrega = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  ids.moneda = await scalar("SELECT MIN(ID_MONEDA) V FROM COM_MONEDA WHERE ELIMINADO='N'");
  ids.condicionPago = await scalar("SELECT MIN(ID_CONDICION_PAGO) V FROM COM_CONDICION_PAGO WHERE ELIMINADO='N'");
  ids.bodega = await scalar("SELECT MIN(ID_BODEGA) V FROM INV_BODEGA WHERE ELIMINADO='N'");
  ids.proveedores = await oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ ID_PROVEEDOR: number }>(
      "SELECT ID_PROVEEDOR FROM COM_PROVEEDOR WHERE ELIMINADO='N' ORDER BY ID_PROVEEDOR FETCH FIRST 3 ROWS ONLY",
    );
    return (r.rows ?? []).map((x) => Number(x.ID_PROVEEDOR));
  });

  const sol = await app.inject({
    method: "POST",
    url: "/api/com/solicitudes",
    headers: H,
    payload: {
      cabecera: {
        idEmpleadoSolicitante: ids.empleado,
        idSucursal: ids.sucursal,
        idGrupoCompra: ids.grupoCompra,
        idTerminoEntrega: ids.terminoEntrega,
        justificacion: "Reconciliacion (test)",
        prioridad: 2,
      },
      detalles: [
        {
          idArticulo: ids.articulo,
          descripcion: "Artículo reconciliacion",
          cantidadSolicitada: 8,
          idUnidadMedida: ids.unidadMedida,
          fechaRequerida: inTwoWeeks.slice(0, 10),
        },
      ],
    },
  });
  const sb = sol.json() as {
    data: { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
  };
  const idSolicitud = sb.data.header.idSolicitud;
  const idSolicitudDetalle = sb.data.details[0]!.idSolicitudDetalle;

  for (let i = 0; i < 2; i++) {
    await app.inject({
      method: "POST",
      url: `/api/com/solicitudes/${idSolicitud}/aprobar`,
      headers: H,
      payload: { idEmpleado: ids.empleado },
    });
  }

  const rfq = await app.inject({
    method: "POST",
    url: "/api/com/rfq",
    headers: H,
    payload: { idSolicitud, fechaLimite: inTwoWeeks.slice(0, 10), proveedores: ids.proveedores },
  });
  const idRfq = (rfq.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;

  const cot = await app.inject({
    method: "POST",
    url: "/api/com/cotizaciones",
    headers: H,
    payload: {
      idRfq,
      idProveedor: ids.proveedores[0],
      idCondicionPago: ids.condicionPago,
      idMoneda: ids.moneda,
      tasaCambio: 1,
      fechaVencimiento: inTwoWeeks,
      lineas: [{ idSolicitudDetalle, precioUnitario: 20, cantidad: 8, idUnidadMedida: ids.unidadMedida }],
    },
  });
  const cotDetalle = (
    cot.json() as { data: { details: { idCotizacionDetalle: number }[] } }
  ).data.details[0]!.idCotizacionDetalle;
  await app.inject({
    method: "POST",
    url: `/api/com/cotizaciones/detalle/${cotDetalle}/adjudicar`,
    headers: H,
  });

  const oc = await app.inject({
    method: "POST",
    url: "/api/com/ordenes-compra",
    headers: H,
    payload: {
      idProveedor: ids.proveedores[0],
      idEmpleadoGerenteFinanciero: ids.empleado,
      idMoneda: ids.moneda,
      tasaCambio: 1,
      fechaEntregaEsperada: inTwoWeeks,
      idSolicitud,
      lineas: [
        {
          idArticulo: ids.articulo,
          descripcion: "Artículo reconciliacion",
          cantidad: 8,
          idUnidadMedida: ids.unidadMedida,
          idCotizacionDetalle: cotDetalle,
        },
      ],
    },
  });
  const ob = oc.json() as {
    data: { header: { idOrdenCompra: number }; details: { idOcDetalle: number }[] };
  };
  s.idOrdenCompra = ob.data.header.idOrdenCompra;
  const idOcDetalle = ob.data.details[0]!.idOcDetalle;

  await app.inject({
    method: "POST",
    url: `/api/com/ordenes-compra/${s.idOrdenCompra}/estado`,
    headers: H,
    payload: { estado: "ENVIADA" },
  });

  const rec = await app.inject({
    method: "POST",
    url: "/api/com/recepciones",
    headers: H,
    payload: {
      idOrdenCompra: s.idOrdenCompra,
      idBodega: ids.bodega,
      idEmpleadoRecibe: ids.empleado,
      lineas: [{ idOcDetalle, cantidadRecibida: 8 }],
    },
  });
  s.idRecepcion = (rec.json() as { data: { header: { idRecepcion: number } } }).data.header.idRecepcion;
});

afterAll(async () => {
  await stopTestApp(app);
});

describe("Reconciliacion de una recepción (consistencia + reprocesar)", () => {
  it("1. la recepción recién registrada esta consistente (kardex + CxP ok)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/recepciones/${s.idRecepcion}/consistencia`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const data = (res.json() as { data: { ok: boolean; kardex: { ok: boolean }; cxp: { ok: boolean } } }).data;
    expect(data.kardex.ok).toBe(true);
    expect(data.cxp.ok).toBe(true);
    expect(data.ok).toBe(true);
  });

  it("2. simula un suscriptor fallido: borra el kardex y anula/borra la factura -> consistencia detecta la divergencia", async () => {
    await oraclePool().withTransaction(async (c) => {
      await c.execute(
        `DELETE FROM INV_KARDEX_MOVIMIENTO WHERE TIPO_DOCUMENTO_REF='COM_RECEPCION' AND ID_DOCUMENTO_REF = :id`,
        { id: s.idRecepcion },
      );
      await c.execute(
        `UPDATE CXP_FACTURA_PROVEEDOR SET ELIMINADO='S' WHERE ID_RECEPCION = :id`,
        { id: s.idRecepcion },
      );
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/com/recepciones/${s.idRecepcion}/consistencia`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const data = (res.json() as { data: { ok: boolean; kardex: { ok: boolean }; cxp: { ok: boolean } } }).data;
    expect(data.kardex.ok).toBe(false);
    expect(data.cxp.ok).toBe(false);
    expect(data.ok).toBe(false);
  });

  it("3. reprocesar recrea el kardex y la factura faltantes", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/com/recepciones/${s.idRecepcion}/reprocesar`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);

    const check = await app.inject({
      method: "GET",
      url: `/api/com/recepciones/${s.idRecepcion}/consistencia`,
      headers: H,
    });
    const data = (check.json() as { data: { ok: boolean; kardex: { ok: boolean }; cxp: { ok: boolean } } }).data;
    expect(data.kardex.ok).toBe(true);
    expect(data.cxp.ok).toBe(true);
    expect(data.ok).toBe(true);
  });

  it("4. reprocesar de nuevo es idempotente: no duplica el kardex ni la factura", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/com/recepciones/${s.idRecepcion}/reprocesar`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);

    const kardex = await scalar(
      `SELECT COUNT(*) V FROM INV_KARDEX_MOVIMIENTO
       WHERE TIPO_DOCUMENTO_REF='COM_RECEPCION' AND ID_DOCUMENTO_REF = ${s.idRecepcion} AND ELIMINADO='N'`,
    );
    expect(kardex).toBe(1);
    const facturas = await scalar(
      `SELECT COUNT(*) V FROM CXP_FACTURA_PROVEEDOR WHERE ID_RECEPCION = ${s.idRecepcion} AND ELIMINADO='N'`,
    );
    expect(facturas).toBe(1);
  });

  it("5. reprocesar una recepción inexistente da 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/recepciones/99999999/reprocesar",
      headers: H,
    });
    expect(res.statusCode).toBe(404);
  });

  it("6. no se puede reprocesar una recepción ya eliminada (reversada)", async () => {
    const rev = await app.inject({
      method: "POST",
      url: `/api/com/recepciones/${s.idRecepcion}/reversar`,
      headers: H,
    });
    expect(rev.statusCode).toBe(200);

    const res = await app.inject({
      method: "POST",
      url: `/api/com/recepciones/${s.idRecepcion}/reprocesar`,
      headers: H,
    });
    expect(res.statusCode).toBe(404);
  });
});

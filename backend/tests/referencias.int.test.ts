/**
 * Test de INTEGRACION - endpoints de referencia (solo lectura) que alimentan
 * los selects de los formularios de captura.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SYS_HEADERS, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const H = SYS_HEADERS;

beforeAll(async () => {
  app = await startTestApp();
});
afterAll(async () => {
  await stopTestApp(app);
});

const endpoints = [
  "/api/com/ref/empleados",
  "/api/com/ref/sucursales",
  "/api/com/ref/articulos",
  "/api/com/ref/unidades-medida",
  "/api/com/ref/bodegas",
  "/api/com/ref/departamentos",
];

describe("Endpoints de referencia", () => {
  it("responden 200 con el sobre { data, meta }", async () => {
    for (const url of endpoints) {
      const res = await app.inject({ method: "GET", url, headers: H });
      expect(res.statusCode, url).toBe(200);
      const body = res.json() as { data: unknown[]; meta: { total: number } };
      expect(Array.isArray(body.data), url).toBe(true);
      expect(typeof body.meta.total, url).toBe("number");
    }
  });

  it("empleados trae los campos necesarios para el select", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/ref/empleados?pageSize=1", headers: H });
    const row = (res.json() as { data: Record<string, unknown>[] }).data[0];
    expect(row).toBeDefined();
    expect(row).toHaveProperty("idEmpleado");
    expect(row).toHaveProperty("nombres");
    expect(row).toHaveProperty("apellidos");
  });

  it("aplica paginado y filtro", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/com/ref/sucursales?pageSize=1&estado=A",
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: unknown[]; meta: { pageSize: number } };
    expect(body.meta.pageSize).toBe(1);
    expect(body.data.length).toBeLessThanOrEqual(1);
  });

  it("hay datos maestros suficientes para poblar los selects", async () => {
    const counts = await Promise.all(
      ["departamentos", "articulos", "unidades-medida", "empleados"].map(async (e) => {
        const r = await app.inject({ method: "GET", url: `/api/com/ref/${e}?pageSize=1`, headers: H });
        return (r.json() as { meta: { total: number } }).meta.total;
      }),
    );
    // departamentos, articulos, unidades, empleados
    expect(counts[0]).toBeGreaterThanOrEqual(3);
    expect(counts[1]).toBeGreaterThanOrEqual(5);
    expect(counts[2]).toBeGreaterThanOrEqual(5);
    expect(counts[3]).toBeGreaterThanOrEqual(2);
  });
});

describe("Selects dependientes del ciclo de compra", () => {
  it("rfq/:id/lineas-solicitud devuelve los renglones de la solicitud del RFQ", async () => {
    const idRfq = await scalar("SELECT MIN(ID_RFQ) V FROM COM_RFQ_CABECERA WHERE ELIMINADO='N'");
    const res = await app.inject({
      method: "GET",
      url: `/api/com/ref/rfq/${idRfq}/lineas-solicitud`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const rows = (res.json() as { data: Record<string, unknown>[] }).data;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty("idSolicitudDetalle");
    expect(rows[0]).toHaveProperty("descripcion");
    expect(rows[0]).toHaveProperty("unidadMedida");
  });

  it("rfq/:id/proveedores devuelve solo los proveedores invitados al RFQ", async () => {
    const idRfq = await scalar("SELECT MIN(ID_RFQ) V FROM COM_RFQ_CABECERA WHERE ELIMINADO='N'");
    const res = await app.inject({
      method: "GET",
      url: `/api/com/ref/rfq/${idRfq}/proveedores`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const rows = (res.json() as { data: Record<string, unknown>[] }).data;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty("idProveedor");
    expect(rows[0]).toHaveProperty("razonSocial");
    // Coincide con COM_RFQ_PROVEEDOR de ese RFQ.
    const invitados = await scalar(
      `SELECT COUNT(*) V FROM COM_RFQ_PROVEEDOR WHERE ID_RFQ = ${idRfq} AND ELIMINADO='N'`,
    );
    expect(rows.length).toBe(invitados);
  });

  it("cotizaciones-adjudicadas requiere idSolicitud y devuelve solo adjudicadas", async () => {
    const bad = await app.inject({
      method: "GET",
      url: "/api/com/ref/cotizaciones-adjudicadas",
      headers: H,
    });
    expect(bad.statusCode).toBe(422);

    // Alguna solicitud con cotización adjudicada (creada por los otros tests).
    const idSol = await scalar(`
      SELECT MIN(rfq.ID_SOLICITUD) V
      FROM COM_COTIZACION_DETALLE cd
      JOIN COM_COTIZACION_PROVEEDOR cp ON cp.ID_COTIZACION = cd.ID_COTIZACION
      JOIN COM_RFQ_CABECERA rfq ON rfq.ID_RFQ = cp.ID_RFQ
      WHERE cd.ADJUDICADO = 'S' AND cd.ELIMINADO = 'N'`);
    const ok = await app.inject({
      method: "GET",
      url: `/api/com/ref/cotizaciones-adjudicadas?idSolicitud=${idSol}`,
      headers: H,
    });
    expect(ok.statusCode).toBe(200);
    const rows = (ok.json() as { data: Record<string, unknown>[] }).data;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty("idCotizacionDetalle");
    expect(rows[0]).toHaveProperty("proveedor");
    expect(rows[0]).toHaveProperty("precioUnitario");
    // Campos para la inferencia de la OC (proveedor/moneda/tasa se bloquean al elegir).
    expect(rows[0]).toHaveProperty("idProveedor");
    expect(rows[0]).toHaveProperty("idMoneda");
    expect(rows[0]).toHaveProperty("tasaCambio");
  });
});

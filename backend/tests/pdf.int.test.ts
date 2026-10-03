/**
 * Test de INTEGRACION - exportacion PDF del comparativo de cotizaciones.
 * Verifica descarga directa y almacenamiento (memoria por defecto).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SYS_HEADERS, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const H = SYS_HEADERS;
let idSolicitud = 0;

beforeAll(async () => {
  app = await startTestApp();
  // Cualquier solicitud existente sirve para renderizar el PDF.
  idSolicitud = await scalar("SELECT MIN(ID_SOLICITUD) V FROM COM_SOLICITUD_COMPRA WHERE ELIMINADO='N'");
});
afterAll(async () => {
  await stopTestApp(app);
});

describe("PDF del comparativo", () => {
  it("GET .../pdf devuelve un PDF descargable", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/comparativo/solicitud/${idSolicitud}/pdf`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.rawPayload.length).toBeGreaterThan(500);

    // El comparativo de una solicitud pequena no debe generar paginas de sobra.
    const text = res.rawPayload.toString("latin1");
    const count = /\/Count\s+(\d+)/.exec(text);
    if (count !== null) {
      expect(Number(count[1])).toBeLessThanOrEqual(3);
    }
  });

  it("POST .../pdf almacena y devuelve una URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/com/comparativo/solicitud/${idSolicitud}/pdf`,
      headers: H,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { url: string; storage: string; filename: string } };
    expect(body.data.url).toBeTruthy();
    expect(["s3", "memoria"]).toContain(body.data.storage);
    expect(body.data.filename).toMatch(/\.pdf$/);
  });

  it("el archivo almacenado en memoria se puede descargar por su URL", async () => {
    const post = await app.inject({
      method: "POST",
      url: `/api/com/comparativo/solicitud/${idSolicitud}/pdf`,
      headers: H,
    });
    const { url, storage } = (post.json() as { data: { url: string; storage: string } }).data;
    if (storage !== "memoria") return; // con S3 real la URL es externa
    const get = await app.inject({ method: "GET", url, headers: H });
    expect(get.statusCode).toBe(200);
    expect(get.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

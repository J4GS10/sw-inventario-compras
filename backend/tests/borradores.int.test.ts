/**
 * Test de INTEGRACION - borradores de trabajo por usuario (continuidad entre equipos).
 * Cada usuario solo ve los suyos; no se pisa un guardado mas nuevo con uno viejo.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
let uA = 0;
let uB = 0;
const clave = `erp.borrador.test.${Date.now()}`;
const hdr = (u: number): Record<string, string> => ({ "x-dev-user": String(u) });

beforeAll(async () => {
  app = await startTestApp();
  uA = await scalar("SELECT MIN(ID_USUARIO) V FROM SEG_USUARIO WHERE ELIMINADO='N'");
  uB = await scalar(`SELECT MIN(ID_USUARIO) V FROM SEG_USUARIO WHERE ELIMINADO='N' AND ID_USUARIO > ${uA}`);
});
afterAll(async () => {
  for (const u of [uA, uB]) {
    await app.inject({ method: "DELETE", url: `/api/borradores?clave=${clave}`, headers: hdr(u) });
  }
  await stopTestApp(app);
});

async function put(u: number, contenido: unknown, actualizadoEn: number, k = clave) {
  return app.inject({
    method: "PUT",
    url: "/api/borradores",
    headers: hdr(u),
    payload: { clave: k, contenido: typeof contenido === "string" ? contenido : JSON.stringify(contenido), actualizadoEn },
  });
}
async function listar(u: number): Promise<{ clave: string; contenido: string; actualizadoEn: number }[]> {
  const res = await app.inject({ method: "GET", url: "/api/borradores", headers: hdr(u) });
  expect(res.statusCode).toBe(200);
  return (res.json() as { data: { clave: string; contenido: string; actualizadoEn: number }[] }).data;
}

describe("Borradores de trabajo", () => {
  it("exige sesión", async () => {
    const res = await app.inject({ method: "GET", url: "/api/borradores" });
    expect(res.statusCode).toBe(401);
  });

  it("guarda, lista y reemplaza por la misma clave", async () => {
    const t = Date.now() - 1000;
    expect((await put(uA, { header: { a: "1" } }, t)).statusCode).toBe(200);
    expect((await put(uA, { header: { a: "2" } }, t + 500)).statusCode).toBe(200);
    const mios = (await listar(uA)).filter((b) => b.clave === clave);
    expect(mios).toHaveLength(1);
    expect(JSON.parse(mios[0]!.contenido)).toEqual({ header: { a: "2" } });
  });

  it("no pisa un guardado más nuevo con uno viejo", async () => {
    await put(uA, { v: "nuevo" }, Date.now() - 100);
    await put(uA, { v: "viejo" }, Date.now() - 50_000);
    const b = (await listar(uA)).find((x) => x.clave === clave)!;
    expect(JSON.parse(b.contenido)).toEqual({ v: "nuevo" });
  });

  it("aísla por usuario", async () => {
    if (uB === 0) return;
    expect((await listar(uB)).some((b) => b.clave === clave)).toBe(false);
  });

  it("rechaza clave o contenido inválidos (422)", async () => {
    expect((await put(uA, { a: 1 }, Date.now(), "clave con espacios!")).statusCode).toBe(422);
    expect((await put(uA, "esto no es json", Date.now())).statusCode).toBe(422);
    expect((await put(uA, "x".repeat(210_000), Date.now())).statusCode).toBe(422);
  });

  it("descarta el borrador (DELETE)", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/borradores?clave=${clave}`, headers: hdr(uA) });
    expect(res.statusCode).toBe(204);
    expect((await listar(uA)).some((b) => b.clave === clave)).toBe(false);
  });
});

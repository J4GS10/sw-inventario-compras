/**
 * Test de INTEGRACION (requiere Oracle local con el esquema desplegado).
 * Ejecutar:  pnpm exec vitest run tests/com.int.test.ts
 * Excluido de `pnpm test` por defecto (patron *.int.test.ts).
 *
 * Verifica el stack generico completo sobre COM_PROVEEDOR:
 *  Fastify -> BaseCrudController -> BaseCrudService -> BaseOracleRepository -> Oracle
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

// Cargar .env de la raiz antes de importar modulos que leen EnvConfig.
const envRaw = readFileSync(resolve(process.cwd(), "../.env"), "utf8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim();
}

const { oraclePool } = await import("../src/dal/OraclePool.js");
const { buildApp } = await import("../src/app.js");

let app: FastifyInstance;
// userId 0 = contexto de sistema: las columnas FK -> SEG_USUARIO se escriben NULL
// (SEG_USUARIO se puebla desde el modulo de Seguridad, fuera del alcance aqui).
const H = { "x-dev-user": "0" };

beforeAll(async () => {
  await oraclePool().init();
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await oraclePool().close();
});

describe("CRUD genérico COM_PROVEEDOR (end-to-end)", () => {
  let createdId = 0;
  const nit = `INT-${Date.now()}`;

  it("POST crea un proveedor", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/proveedores",
      headers: H,
      payload: {
        nit,
        razonSocial: "Proveedor Integracion S.A.",
        email: "int@test.com",
        diasCredito: 30,
        estado: "A",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { idProveedor: number; razonSocial: string } };
    expect(body.data.idProveedor).toBeGreaterThan(0);
    expect(body.data.razonSocial).toBe("Proveedor Integracion S.A.");
    createdId = body.data.idProveedor;
  });

  it("GET lista con paginado y filtro", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/proveedores?pageSize=5&sort=razonSocial&nit=${nit}`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: unknown[]; meta: { total: number } };
    expect(body.data.length).toBe(1);
    expect(body.meta.total).toBe(1);
  });

  it("GET by id devuelve el recurso", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/proveedores/${createdId}`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { data: { nit: string } }).data.nit).toBe(nit);
  });

  it("PUT actualiza", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/com/proveedores/${createdId}`,
      headers: H,
      payload: { calificacion: "A+", diasCredito: 45 },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { data: { diasCredito: number } }).data.diasCredito).toBe(45);
  });

  it("DELETE hace soft delete (desaparece del listado y GET da 404)", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: `/api/com/proveedores/${createdId}`,
      headers: H,
    });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: "GET",
      url: `/api/com/proveedores/${createdId}`,
      headers: H,
    });
    expect(get.statusCode).toBe(404);
  });

  it("422 cuando falta un campo obligatorio", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/proveedores",
      headers: H,
      payload: { razonSocial: "sin nit" },
    });
    expect(res.statusCode).toBe(422);
    expect((res.json() as { error: { code: string } }).error.code).toBe("VALIDATION");
  });

  it("401 sin credenciales", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/proveedores" });
    expect(res.statusCode).toBe(401);
  });
});

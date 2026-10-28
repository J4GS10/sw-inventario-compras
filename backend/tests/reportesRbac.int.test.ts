/**
 * Test de INTEGRACION - Cada area ve SOLO los reportes que le corresponden.
 * Inicia sesion con cada usuario de demostracion (permisos reales de la BD, via
 * 02_seg_rbac.sql) y recorre los 5 reportes (JSON y PDF) y el resumen del
 * Dashboard: 200 si el rol lo necesita para decidir, 403 si no.
 *
 *   Reporte (decision)                 comprador financiero auditor | admin
 *   evaluacion  (a quien comprar)           x                       |   x
 *   gasto+resumen (cuanto/concentracion)              x         x   |   x
 *   entregas    (caja / seguimiento)        x         x             |   x
 *   desempeno   (cumplimiento)              x                   x   |   x
 *   riesgo      (de quien depender)                   x         x   |   x
 *   (solicitante, jefe, gerente de area y bodega: ninguno)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const DEMO_PASSWORD = "compras.demo";
const tokens = new Map<string, string>();

const USUARIOS = ["comprador", "financiero", "auditor", "solicitante", "jefe", "gerente", "bodega", "admin"] as const;
type Usuario = (typeof USUARIOS)[number];

/** Ruta -> quienes la pueden ver. El resto debe recibir 403. */
const MATRIZ: Record<string, readonly Usuario[]> = {
  "/api/com/reportes/evaluacion-proveedores": ["comprador", "admin"],
  "/api/com/reportes/gasto-proveedor": ["financiero", "auditor", "admin"],
  "/api/com/reportes/oc-pendientes": ["comprador", "financiero", "admin"],
  "/api/com/reportes/desempeno-proveedores": ["comprador", "auditor", "admin"],
  "/api/com/reportes/riesgo-proveedores": ["financiero", "auditor", "admin"],
  "/api/com/dashboard/resumen": ["financiero", "auditor", "admin"],
};

const auth = (u: string): Record<string, string> => ({ authorization: `Bearer ${tokens.get(u)!}` });

beforeAll(async () => {
  app = await startTestApp();
  for (const u of USUARIOS) {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: u, password: DEMO_PASSWORD } });
    expect(res.statusCode, `login ${u}`).toBe(200);
    tokens.set(u, (res.json() as { data: { token: string } }).data.token);
  }
}, 60_000);
afterAll(async () => {
  await stopTestApp(app);
});

describe("reportes: acceso por area", () => {
  for (const [ruta, permitidos] of Object.entries(MATRIZ)) {
    for (const u of USUARIOS) {
      const debe = permitidos.includes(u);
      it(`${u} ${debe ? "VE" : "NO ve"} ${ruta.replace("/api/com/", "")}`, async () => {
        const res = await app.inject({ method: "GET", url: ruta, headers: auth(u) });
        expect(res.statusCode).toBe(debe ? 200 : 403);
      });
    }
  }

  it("el PDF de cada reporte exige el mismo permiso que su JSON", async () => {
    for (const [ruta, permitidos] of Object.entries(MATRIZ).filter(([r]) => r.includes("/reportes/"))) {
      for (const u of USUARIOS) {
        const res = await app.inject({ method: "GET", url: `${ruta}/pdf`, headers: auth(u) });
        expect(res.statusCode, `${u} ${ruta}/pdf`).toBe(permitidos.includes(u) ? 200 : 403);
      }
    }
  }, 60_000);

  it("el inventario por categoría solo lo ven finanzas, auditoría y admin (sin PDF)", async () => {
    const permitidos: readonly Usuario[] = ["financiero", "auditor", "admin"];
    for (const u of USUARIOS) {
      const res = await app.inject({ method: "GET", url: "/api/com/reportes/inventario-categoria", headers: auth(u) });
      expect(res.statusCode, u).toBe(permitidos.includes(u) ? 200 : 403);
    }
  });

  it("las áreas sin reportes no traen ningún permiso de reporte en la sesión", async () => {
    for (const u of ["gerente", "jefe", "solicitante", "bodega"] as const) {
      const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: auth(u) });
      const permisos = ((res.json() as { data: { permisos: string[] } }).data.permisos ?? []) as string[];
      expect(permisos.filter((p) => p.startsWith("COMPRAS_REPORTE_")), u).toEqual([]);
    }
  });

  it("ningún par de áreas con reportes comparte el mismo conjunto", () => {
    const conjunto = (u: Usuario): string =>
      Object.entries(MATRIZ)
        .filter(([r, p]) => r.includes("/reportes/") && p.includes(u))
        .map(([r]) => r)
        .join("|");
    const [c, f, a] = [conjunto("comprador"), conjunto("financiero"), conjunto("auditor")];
    expect(new Set([c, f, a]).size).toBe(3);
  });
});

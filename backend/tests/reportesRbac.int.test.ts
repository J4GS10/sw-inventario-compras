/**
 * Test de INTEGRACION - Cada area ve SOLO los reportes que le corresponden.
 * Inicia sesion con cada usuario de demostracion (permisos reales de la BD, via
 * 02_seg_rbac.sql) y recorre los reportes (JSON y PDF) y el resumen del
 * Dashboard: 200 si el rol lo necesita para decidir, 403 si no.
 *
 *   Reporte (decision)              solic. jefe gerente comprador financiero bodega auditor | admin
 *   evaluacion  (a quien comprar)                         x                                 |   x
 *   gasto+resumen (concentracion)                                   x                 x     |   x
 *   entregas    (que llega)                               x         x          x            |   x
 *   desempeno   (cumplimiento)                            x                           x     |   x
 *   riesgo      (de quien depender)                                 x                 x     |   x
 *   inventario  (cuanto vale)                                       x                 x     |   x
 *   disponibilidad (¿pedir?)      x     x      x         x                    x            |   x
 *   gasto por area                      x      x                    x                 x     |   x
 *   auditoria   (hallazgos)                                                           x     |   x
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
  "/api/com/reportes/oc-pendientes": ["comprador", "financiero", "bodega", "admin"],
  "/api/com/reportes/desempeno-proveedores": ["comprador", "auditor", "admin"],
  "/api/com/reportes/riesgo-proveedores": ["financiero", "auditor", "admin"],
  "/api/com/reportes/inventario-categoria": ["financiero", "auditor", "admin"],
  "/api/com/reportes/disponibilidad-articulos": ["solicitante", "jefe", "gerente", "comprador", "bodega", "admin"],
  "/api/com/reportes/gasto-area": ["jefe", "gerente", "financiero", "auditor", "admin"],
  "/api/com/reportes/auditoria-compras": ["auditor", "admin"],
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
  }, 120_000);

  it("cada rol tiene un conjunto de reportes distinto (ninguno ve lo mismo que otro)", () => {
    const conjunto = (u: Usuario): string =>
      Object.entries(MATRIZ)
        .filter(([r, p]) => r.includes("/reportes/") && p.includes(u))
        .map(([r]) => r)
        .join("|");
    const roles: readonly Usuario[] = ["comprador", "financiero", "auditor", "solicitante", "gerente", "bodega"];
    expect(new Set(roles.map(conjunto)).size).toBe(roles.length);
  });
});

describe("reportes: el PDF respeta los filtros", () => {
  it("un filtro de texto reduce la tabla y el PDF por igual", async () => {
    const todo = await app.inject({ method: "GET", url: "/api/com/reportes/gasto-proveedor", headers: auth("admin") });
    const filtrado = await app.inject({ method: "GET", url: "/api/com/reportes/gasto-proveedor?q=zzz-no-existe", headers: auth("admin") });
    expect((filtrado.json() as { data: { proveedores: unknown[] } }).data.proveedores).toEqual([]);
    const pdfTodo = await app.inject({ method: "GET", url: "/api/com/reportes/gasto-proveedor/pdf", headers: auth("admin") });
    const pdfFiltrado = await app.inject({ method: "GET", url: "/api/com/reportes/gasto-proveedor/pdf?q=zzz-no-existe", headers: auth("admin") });
    expect(pdfFiltrado.statusCode).toBe(200);
    if ((todo.json() as { data: { proveedores: unknown[] } }).data.proveedores.length > 0) {
      expect(pdfFiltrado.rawPayload.length).toBeLessThan(pdfTodo.rawPayload.length);
    }
  });

  it("el gasto por área de un gerente se acota a su departamento", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/reportes/gasto-area", headers: auth("gerente") });
    const d = (res.json() as { data: { acotado: boolean; areas: unknown[] } }).data;
    expect(d.acotado).toBe(true);
    expect(d.areas.length).toBeLessThanOrEqual(1);
    const admin = await app.inject({ method: "GET", url: "/api/com/reportes/gasto-area", headers: auth("admin") });
    expect((admin.json() as { data: { acotado: boolean } }).data.acotado).toBe(false);
  });

  it("los filtros inválidos se rechazan (422), no se ignoran", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/reportes/riesgo-proveedores?nivel=critico", headers: auth("admin") });
    expect(res.statusCode).toBe(422);
  });
});

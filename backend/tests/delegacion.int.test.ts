/**
 * Test de INTEGRACION - delegacion temporal de aprobaciones.
 * El delegado decide con el alcance del delegante mientras la delegacion esta vigente; revocar
 * corta el acceso al instante; la decision queda a nombre de quien la toma con la nota de delegacion.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const PASS = "compras.demo";
const dia = (n: number): string => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
interface Sesion {
  token: string;
  idEmpleado: number;
  nombre: string;
}
const u: Record<string, Sesion> = {};
const fk: Record<string, number> = {};

async function login(username: string): Promise<Sesion> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: PASS } });
  expect(res.statusCode, `login ${username}`).toBe(200);
  const d = (res.json() as { data: { token: string; sesion: { idEmpleado: number; nombre: string } } }).data;
  return { token: d.token, idEmpleado: d.sesion.idEmpleado, nombre: d.sesion.nombre };
}
async function call(
  who: string,
  method: "GET" | "POST" | "DELETE",
  url: string,
  payload?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${u[who]!.token}`, "content-type": "application/json" },
    ...(payload !== undefined ? { payload: payload as object } : {}),
  });
  return { status: res.statusCode, json: res.statusCode === 204 ? {} : (res.json() as Record<string, unknown>) };
}
async function nuevaSolicitud(): Promise<number> {
  const r = await call("solicitante", "POST", "/api/com/solicitudes", {
    cabecera: {
      idEmpleadoSolicitante: u["solicitante"]!.idEmpleado,
      idSucursal: fk["sucursal"],
      idGrupoCompra: fk["grupo"],
      idTerminoEntrega: fk["termino"],
      justificacion: "Prueba de delegación de aprobaciones",
      prioridad: 3,
    },
    detalles: [{ descripcion: "Línea", cantidadSolicitada: 1, idUnidadMedida: fk["unidad"], fechaRequerida: dia(20) }],
  });
  expect(r.status).toBe(201);
  return (r.json["data"] as { header: { idSolicitud: number } }).header.idSolicitud;
}

beforeAll(async () => {
  app = await startTestApp();
  for (const n of ["solicitante", "jefe", "comprador"]) u[n] = await login(n);
  fk["sucursal"] = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  fk["grupo"] = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  fk["termino"] = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  fk["unidad"] = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
});
afterAll(async () => {
  await stopTestApp(app);
});

describe("Delegación de aprobaciones", () => {
  let idDelegacion = 0;

  it("sin delegación, quien no aprueba recibe 403", async () => {
    const id = await nuevaSolicitud();
    const r = await call("comprador", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["comprador"]!.idEmpleado });
    expect(r.status).toBe(403);
  });

  it("solo quien puede aprobar puede delegar; no a sí mismo; rango válido", async () => {
    const comprador = u["comprador"]!.idEmpleado;
    expect((await call("solicitante", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: comprador, desde: dia(0), hasta: dia(2) })).status).toBe(403);
    expect((await call("jefe", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: u["jefe"]!.idEmpleado, desde: dia(0), hasta: dia(2) })).status).toBe(422);
    expect((await call("jefe", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: comprador, desde: dia(-3), hasta: dia(2) })).status).toBe(422);
    expect((await call("jefe", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: comprador, desde: dia(0), hasta: dia(90) })).status).toBe(422);
  });

  it("con delegación vigente el delegado aprueba a su nombre, con la nota, y la sesión lo refleja", async () => {
    const comprador = u["comprador"]!.idEmpleado;
    const crear = await call("jefe", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: comprador, desde: dia(0), hasta: dia(3), motivo: "Vacaciones (test)" });
    expect(crear.status, JSON.stringify(crear.json)).toBe(201);
    idDelegacion = (crear.json["data"] as { idDelegacion: number }).idDelegacion;

    const solape = await call("jefe", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: comprador, desde: dia(1), hasta: dia(2) });
    expect(solape.status).toBe(409);

    const me = await call("comprador", "GET", "/api/auth/me");
    const sesion = me.json["data"] as { permisos: string[]; delegadoDe?: string[] };
    expect(sesion.permisos).toContain("COMPRAS_SOLICITUD_APROBAR_JEFE");
    expect(sesion.delegadoDe).toContain(u["jefe"]!.nombre);

    const id = await nuevaSolicitud();
    const ap = await call("comprador", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: comprador, comentario: "ok" });
    expect(ap.status, JSON.stringify(ap.json)).toBe(200);
    const hist = await scalar(
      `SELECT COUNT(*) V FROM COM_WORKFLOW_APROBACION WHERE ID_SOLICITUD = ${id} AND COMENTARIO LIKE '%por delegación de%' AND ID_EMPLEADO_REALIZA = ${comprador}`,
    );
    expect(hist).toBe(1);
  });

  it("no se puede suplantar: el delegado no decide a nombre del delegante", async () => {
    const id = await nuevaSolicitud();
    const r = await call("comprador", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["jefe"]!.idEmpleado });
    expect(r.status).toBe(403);
  });

  it("al revocar, el acceso se corta al instante", async () => {
    expect((await call("jefe", "DELETE", `/api/com/delegaciones/${idDelegacion}`)).status).toBe(204);
    const id = await nuevaSolicitud();
    const r = await call("comprador", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["comprador"]!.idEmpleado });
    expect(r.status).toBe(403);
    const me = await call("comprador", "GET", "/api/auth/me");
    expect((me.json["data"] as { permisos: string[] }).permisos).not.toContain("COMPRAS_SOLICITUD_APROBAR_JEFE");
  });

  it("solo el delegante puede revocar", async () => {
    const crear = await call("jefe", "POST", "/api/com/delegaciones", { idEmpleadoDelegado: u["comprador"]!.idEmpleado, desde: dia(0), hasta: dia(1) });
    const id = (crear.json["data"] as { idDelegacion: number }).idDelegacion;
    expect((await call("comprador", "DELETE", `/api/com/delegaciones/${id}`)).status).toBe(403);
    expect((await call("jefe", "DELETE", `/api/com/delegaciones/${id}`)).status).toBe(204);
  });
});

/**
 * Test de INTEGRACION - Alcance por departamento / equipo (Fase 6.2).
 * Verifica que el JEFE solo vea las solicitudes de sus reportes, el GERENTE las
 * de su departamento, el SOLICITANTE solo las suyas, y los roles transversales
 * (COMPRADOR) todas. Depende del seed database/dml/03_alcance_departamento.sql.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const PASS = "compras.demo";

interface Fk {
  empSolicitante: number; // EMP-101 (dept Compras, reporta a EMP-102)
  empBodega: number; // EMP-104 (dept Operaciones y Logistica)
  sucursal: number;
  grupoCompra: number;
  terminoEntrega: number;
  articulo: number;
  unidadMedida: number;
}
const fk = {} as Fk;

async function token(username: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password: PASS },
  });
  expect(res.statusCode, `login ${username}`).toBe(200);
  return (res.json() as { data: { token: string } }).data.token;
}
const bearer = (t: string): Record<string, string> => ({ authorization: `Bearer ${t}` });

async function crearSolicitud(tk: string, idEmpleadoSolicitante: number): Promise<number> {
  const res = await app.inject({
    method: "POST",
    url: "/api/com/solicitudes",
    headers: bearer(tk),
    payload: {
      cabecera: {
        idEmpleadoSolicitante,
        idSucursal: fk.sucursal,
        idGrupoCompra: fk.grupoCompra,
        idTerminoEntrega: fk.terminoEntrega,
        justificacion: "Alcance por departamento (test)",
        prioridad: 3,
      },
      detalles: [
        {
          idArticulo: fk.articulo,
          descripcion: "Artículo de prueba",
          cantidadSolicitada: 5,
          idUnidadMedida: fk.unidadMedida,
          fechaRequerida: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
        },
      ],
    },
  });
  expect(res.statusCode, "crear solicitud").toBe(201);
  return (res.json() as { data: { header: { idSolicitud: number } } }).data.header.idSolicitud;
}

async function idsVisibles(username: string): Promise<Set<number>> {
  const tk = await token(username);
  // Orden DESCENDENTE por id: para roles sin acotamiento por departamento
  // (p. ej. COMPRADOR, transversal) la lista no tiene WHERE, solo paginacion.
  // Con datos acumulados de corridas anteriores (esta suite lleva meses
  // creando solicitudes reales contra la misma Oracle), la pagina 1 en orden
  // ASC (default) deja de incluir las recien creadas en cuanto el total pasa
  // de 200 filas -- exactamente el flake real que esto corrige.
  const res = await app.inject({
    method: "GET",
    url: "/api/com/solicitudes?pageSize=200&sort=idSolicitud&order=desc",
    headers: bearer(tk),
  });
  expect(res.statusCode, `list ${username}`).toBe(200);
  const rows = (res.json() as { data: { idSolicitud: number }[] }).data;
  return new Set(rows.map((r) => r.idSolicitud));
}

let idA = 0; // solicitante = EMP-101
let idB = 0; // solicitante = EMP-104 (otro departamento)

beforeAll(async () => {
  app = await startTestApp();
  fk.empSolicitante = await scalar("SELECT ID_EMPLEADO V FROM NOM_EMPLEADO WHERE CODIGO_EMPLEADO='EMP-101'");
  fk.empBodega = await scalar("SELECT ID_EMPLEADO V FROM NOM_EMPLEADO WHERE CODIGO_EMPLEADO='EMP-104'");
  fk.sucursal = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  fk.grupoCompra = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  fk.terminoEntrega = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  fk.articulo = await scalar("SELECT MIN(ID_ARTICULO) V FROM INV_ARTICULO WHERE ELIMINADO='N'");
  fk.unidadMedida = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");

  const admin = await token("admin");
  idA = await crearSolicitud(admin, fk.empSolicitante);
  idB = await crearSolicitud(admin, fk.empBodega);
});

afterAll(async () => {
  await stopTestApp(app);
});

describe("Alcance por departamento / equipo", () => {
  it("el seed 03 ligo EMP-101 a un jefe y a un departamento", () => {
    expect(fk.empSolicitante).toBeGreaterThan(0);
    expect(fk.empBodega).toBeGreaterThan(0);
    expect(idA).toBeGreaterThan(0);
    expect(idB).toBeGreaterThan(0);
  });

  it("JEFE ve la solicitud de su reporte (EMP-101) pero no la de otro depto (EMP-104)", async () => {
    const v = await idsVisibles("jefe");
    expect(v.has(idA)).toBe(true);
    expect(v.has(idB)).toBe(false);
  });

  it("GERENTE de área ve las de su departamento (EMP-101) pero no las de otro (EMP-104)", async () => {
    const v = await idsVisibles("gerente");
    expect(v.has(idA)).toBe(true);
    expect(v.has(idB)).toBe(false);
  });

  it("SOLICITANTE (EMP-101) ve la suya, no la de EMP-104", async () => {
    const v = await idsVisibles("solicitante");
    expect(v.has(idA)).toBe(true);
    expect(v.has(idB)).toBe(false);
  });

  it("COMPRADOR (rol transversal) ve ambas", async () => {
    const v = await idsVisibles("comprador");
    expect(v.has(idA)).toBe(true);
    expect(v.has(idB)).toBe(true);
  });

  it("GET por id fuera de alcance responde 404 (no revela que existe)", async () => {
    const tk = await token("jefe");
    const fuera = await app.inject({
      method: "GET",
      url: `/api/com/solicitudes/${idB}`,
      headers: bearer(tk),
    });
    expect(fuera.statusCode).toBe(404);

    const dentro = await app.inject({
      method: "GET",
      url: `/api/com/solicitudes/${idA}`,
      headers: bearer(tk),
    });
    expect(dentro.statusCode).toBe(200);
  });

  it("el JEFE no puede aprobar una solicitud de otro departamento (403)", async () => {
    const tk = await token("jefe");
    const res = await app.inject({
      method: "POST",
      url: `/api/com/solicitudes/${idB}/aprobar`,
      headers: bearer(tk),
      payload: { idEmpleado: fk.empBodega, comentario: "no deberia" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("el JEFE sí puede aprobar una solicitud de su equipo (no 401/403)", async () => {
    const tk = await token("jefe");
    // La decision se registra a nombre de quien decide: el idEmpleado es el del JEFE en sesion.
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: bearer(tk) });
    const idEmpleadoJefe = (me.json() as { data: { sesion?: { idEmpleado: number }; idEmpleado?: number } }).data;
    const res = await app.inject({
      method: "POST",
      url: `/api/com/solicitudes/${idA}/aprobar`,
      headers: bearer(tk),
      payload: { idEmpleado: idEmpleadoJefe.sesion?.idEmpleado ?? idEmpleadoJefe.idEmpleado, comentario: "OK jefe" },
    });
    expect([401, 403]).not.toContain(res.statusCode);
  });
});

describe("Notificaciones (bandeja de pendientes por rol)", () => {
  it("el JEFE solo recibe notificaciones que le corresponden (su equipo, nunca idB)", async () => {
    const tk = await token("jefe");
    const res = await app.inject({
      method: "GET",
      url: "/api/com/notificaciones",
      headers: bearer(tk),
    });
    expect(res.statusCode).toBe(200);
    const data = (res.json() as {
      data: { items: { tipo: string; cantidad: number; refs: number[] }[] };
    }).data;
    // Nunca trae items de otros roles.
    expect(data.items.every((i) => i.tipo === "APROBAR_JEFE")).toBe(true);
    // Nunca incluye la solicitud de otro departamento (idB / EMP-104).
    for (const it of data.items) {
      expect(it.refs).not.toContain(idB);
    }
  });

  it("BODEGA no ve pendientes de aprobación; ve (si hay) órdenes por recibir", async () => {
    const tk = await token("bodega");
    const res = await app.inject({
      method: "GET",
      url: "/api/com/notificaciones",
      headers: bearer(tk),
    });
    expect(res.statusCode).toBe(200);
    const data = (res.json() as { data: { items: { tipo: string }[] } }).data;
    expect(data.items.some((i) => i.tipo.startsWith("APROBAR"))).toBe(false);
    expect(data.items.every((i) => i.tipo === "RECIBIR")).toBe(true);
  });
});

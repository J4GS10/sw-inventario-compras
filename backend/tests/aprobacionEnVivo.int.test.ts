/**
 * Test de INTEGRACION - aprobar / rechazar: el flujo continua con la data
 * correcta Y el solicitante recibe el aviso EN VIVO.
 *
 * Usa usuarios reales (login) para que cuente el alcance por equipo y la
 * identidad de quien decide, y se suscribe al LiveHub como lo haria el canal SSE.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { liveHub } from "../src/common/realtime/LiveHub.js";
import { scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const PASS = "compras.demo";
const dia = (n: number): string => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

interface Sesion {
  token: string;
  idUsuario: number;
  idEmpleado: number;
  nombre: string;
}
const u: Record<string, Sesion> = {};

async function login(username: string): Promise<Sesion> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: PASS } });
  expect(res.statusCode, `login ${username}`).toBe(200);
  const d = (res.json() as { data: { token: string; sesion: { idUsuario: number; idEmpleado: number; nombre: string } } }).data;
  return { token: d.token, idUsuario: d.sesion.idUsuario, idEmpleado: d.sesion.idEmpleado, nombre: d.sesion.nombre };
}

async function call(who: string, method: "GET" | "POST", url: string, payload?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${u[who]!.token}`, "content-type": "application/json" },
    ...(payload !== undefined ? { payload: payload as object } : {}),
  });
  return { status: res.statusCode, json: res.json() as Record<string, unknown> };
}
const msg = (r: { json: Record<string, unknown> }): string => String((r.json["error"] as { message?: string } | undefined)?.message ?? "");

interface Evento {
  event: string;
  data: Record<string, unknown>;
}
function escuchar(userId: number): { eventos: Evento[]; off: () => void } {
  const eventos: Evento[] = [];
  const off = liveHub().register(userId, (m) => eventos.push({ event: m.event, data: m.data as Record<string, unknown> }))!;
  return { eventos, off };
}

const fk = {} as Record<string, number>;

async function nuevaSolicitud(extra: Record<string, unknown> = {}, lineas = 2): Promise<{ id: number; renglones: number[] }> {
  const r = await call("solicitante", "POST", "/api/com/solicitudes", {
    cabecera: {
      idEmpleadoSolicitante: u["solicitante"]!.idEmpleado,
      idSucursal: fk["sucursal"],
      idGrupoCompra: fk["grupo"],
      idTerminoEntrega: fk["termino"],
      justificacion: "Reposición para prueba de aprobación",
      prioridad: 2,
      ...extra,
    },
    detalles: Array.from({ length: lineas }, (_, i) => ({
      descripcion: `Línea ${i + 1}`,
      cantidadSolicitada: 10,
      idUnidadMedida: fk["unidad"],
      fechaRequerida: dia(20),
    })),
  });
  expect(r.status, msg(r)).toBe(201);
  const d = r.json["data"] as { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
  return { id: d.header.idSolicitud, renglones: d.details.map((x) => x.idSolicitudDetalle) };
}

beforeAll(async () => {
  app = await startTestApp();
  for (const n of ["solicitante", "jefe", "gerente", "comprador"]) u[n] = await login(n);
  fk["sucursal"] = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  fk["grupo"] = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  fk["termino"] = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  fk["unidad"] = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
  fk["prov1"] = await scalar("SELECT MIN(ID_PROVEEDOR) V FROM COM_PROVEEDOR WHERE ELIMINADO='N' AND ESTADO='A'");
  fk["prov2"] = await scalar(`SELECT MIN(ID_PROVEEDOR) V FROM COM_PROVEEDOR WHERE ELIMINADO='N' AND ESTADO='A' AND ID_PROVEEDOR > ${fk["prov1"]}`);
  fk["prov3"] = await scalar(`SELECT MIN(ID_PROVEEDOR) V FROM COM_PROVEEDOR WHERE ELIMINADO='N' AND ESTADO='A' AND ID_PROVEEDOR > ${fk["prov2"]}`);
});
afterAll(async () => {
  await stopTestApp(app);
});

describe("Aprobación completa: el flujo avanza, la data llega y se avisa en vivo", () => {
  it("jefe aprueba -> gerente aprueba -> Compras puede crear el RFQ", async () => {
    const { id, renglones } = await nuevaSolicitud();
    const alSolicitante = escuchar(u["solicitante"]!.idUsuario);
    const alGerente = escuchar(u["gerente"]!.idUsuario);

    // --- Jefe aprueba (y ajusta la cantidad de un renglon)
    const j = await call("jefe", "POST", `/api/com/solicitudes/${id}/aprobar`, {
      idEmpleado: u["jefe"]!.idEmpleado,
      comentario: "Ok, pero con menos cantidad",
      ajustes: [{ idSolicitudDetalle: renglones[0], cantidadAutorizada: 6 }],
    });
    expect(j.status, msg(j)).toBe(200);
    expect((j.json["data"] as { estado: string }).estado).toBe("PENDIENTE_GERENTE");

    // El solicitante recibe el aviso con quien, que sigue y el comentario.
    const dec = alSolicitante.eventos.find((e) => e.event === "decision");
    expect(dec, "el solicitante debe recibir 'decisión'").toBeDefined();
    expect(dec!.data).toMatchObject({ idSolicitud: id, resultado: "APROBADA", estadoNuevo: "PENDIENTE_GERENTE", comentario: "Ok, pero con menos cantidad" });
    expect(String(dec!.data["mensaje"])).toContain(`SOL-${id}`);
    expect(String(dec!.data["por"])).toContain(u["jefe"]!.nombre.split(" ")[0]!);
    expect(String(dec!.data["siguiente"])).toMatch(/gerente/i);
    // Todos los conectados refrescan su bandeja (el gerente tiene un pendiente nuevo).
    expect(alGerente.eventos.some((e) => e.event === "bandeja" && e.data["idSolicitud"] === id)).toBe(true);
    // El jefe NO se avisa a si mismo.
    // La data del ajuste llego a la linea
    const cant = await scalar(`SELECT CANTIDAD_AUTORIZADA V FROM COM_SOLICITUD_DETALLE WHERE ID_SOLICITUD_DETALLE = ${renglones[0]}`);
    expect(cant).toBe(6);

    // Aparece en el listado de la bandeja del gerente
    const band = await call("gerente", "GET", "/api/com/notificaciones");
    const items = (band.json["data"] as { items: { tipo: string; cantidad: number; refs: number[] }[] }).items;
    // La bandeja lista solo las 25 de mayor prioridad (refs); con datos acumulados la nueva puede no caber, pero SI cuenta.
    expect(items.find((i) => i.tipo === "APROBAR_GERENTE")?.cantidad ?? 0).toBeGreaterThan(0);

    // --- No se puede aprobar dos veces ni saltarse el nivel
    const dup = await call("jefe", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["jefe"]!.idEmpleado });
    expect([403, 409]).toContain(dup.status);

    // --- Gerente aprueba
    alSolicitante.eventos.length = 0;
    const g = await call("gerente", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["gerente"]!.idEmpleado });
    expect(g.status, msg(g)).toBe(200);
    expect((g.json["data"] as { estado: string }).estado).toBe("EN_COTIZACION");
    const dec2 = alSolicitante.eventos.find((e) => e.event === "decision");
    expect(dec2!.data).toMatchObject({ resultado: "APROBADA", estadoNuevo: "EN_COTIZACION" });
    expect(String(dec2!.data["siguiente"])).toMatch(/cotizaciones/i);

    // --- El flujo CONTINUA: Compras ya puede crear el RFQ de esa solicitud
    const rfq = await call("comprador", "POST", "/api/com/rfq", {
      idSolicitud: id,
      fechaLimite: dia(10),
      proveedores: [fk["prov1"], fk["prov2"], fk["prov3"]],
    });
    expect(rfq.status, msg(rfq)).toBe(201);

    // Historial: creada + 2 aprobaciones, con quien y comentario
    const hist = await scalar(`SELECT COUNT(*) V FROM COM_WORKFLOW_APROBACION WHERE ID_SOLICITUD = ${id} AND ELIMINADO='N'`);
    expect(hist).toBe(3);
    const quien = await scalar(`SELECT COUNT(*) V FROM COM_WORKFLOW_APROBACION WHERE ID_SOLICITUD = ${id} AND ID_EMPLEADO_REALIZA IN (${u["jefe"]!.idEmpleado}, ${u["gerente"]!.idEmpleado}) AND ESTADO_ANTERIOR IS NOT NULL`);
    expect(quien).toBe(2);

    // Respuestas persistentes: el solicitante las ve aunque estuviera desconectado
    alSolicitante.off();
    alGerente.off();
    const dr = await call("solicitante", "GET", "/api/com/notificaciones/decisiones");
    const lista = dr.json["data"] as { idSolicitud: number; resultado: string; estadoNuevo: string }[];
    const mias = lista.filter((d) => d.idSolicitud === id);
    expect(mias.map((d) => d.estadoNuevo).sort()).toEqual(["EN_COTIZACION", "PENDIENTE_GERENTE"]);
    expect(mias.every((d) => d.resultado === "APROBADA")).toBe(true);
  });
});

describe("Rechazo: cierra el flujo, exige motivo y el solicitante lo ve", () => {
  it("sin motivo -> 422; con motivo -> RECHAZADA, aviso en vivo con el motivo, y nada mas avanza", async () => {
    const { id } = await nuevaSolicitud();
    const alSolicitante = escuchar(u["solicitante"]!.idUsuario);

    const sinMotivo = await call("jefe", "POST", `/api/com/solicitudes/${id}/rechazar`, { idEmpleado: u["jefe"]!.idEmpleado });
    expect(sinMotivo.status).toBe(422);
    expect(msg(sinMotivo)).toMatch(/motivo/i);
    expect(alSolicitante.eventos.filter((e) => e.event === "decision")).toHaveLength(0); // nada se publico
    const sigue = await scalar(`SELECT COUNT(*) V FROM COM_SOLICITUD_COMPRA WHERE ID_SOLICITUD=${id} AND ESTADO='PENDIENTE_JEFE'`);
    expect(sigue).toBe(1);

    const r = await call("jefe", "POST", `/api/com/solicitudes/${id}/rechazar`, {
      idEmpleado: u["jefe"]!.idEmpleado,
      comentario: "  Falta el centro de costo  ",
    });
    expect(r.status, msg(r)).toBe(200);
    expect((r.json["data"] as { estado: string }).estado).toBe("RECHAZADA");

    const dec = alSolicitante.eventos.find((e) => e.event === "decision");
    expect(dec!.data).toMatchObject({ idSolicitud: id, resultado: "RECHAZADA", estadoNuevo: "RECHAZADA", comentario: "Falta el centro de costo", siguiente: null });
    expect(String(dec!.data["mensaje"])).toMatch(/rechaz/);
    alSolicitante.off();

    // Motivo guardado en el historial
    const com = await scalar(`SELECT COUNT(*) V FROM COM_WORKFLOW_APROBACION WHERE ID_SOLICITUD=${id} AND ESTADO_NUEVO='RECHAZADA' AND COMENTARIO='Falta el centro de costo'`);
    expect(com).toBe(1);

    // El flujo SE DETIENE: no se aprueba, no se cotiza, no se edita
    const ap = await call("gerente", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["gerente"]!.idEmpleado });
    expect([403, 409]).toContain(ap.status);
    const rfq = await call("comprador", "POST", "/api/com/rfq", { idSolicitud: id, fechaLimite: dia(5), proveedores: [fk["prov1"], fk["prov2"], fk["prov3"]] });
    expect([409, 422]).toContain(rfq.status);

    // El solicitante ve el rechazo con su motivo
    const dr = await call("solicitante", "GET", "/api/com/notificaciones/decisiones");
    const mia = (dr.json["data"] as { idSolicitud: number; resultado: string; comentario: string | null }[]).find((d) => d.idSolicitud === id);
    expect(mia).toMatchObject({ resultado: "RECHAZADA", comentario: "Falta el centro de costo" });
  });

  it("el gerente también puede rechazar tras la aprobación del jefe", async () => {
    const { id } = await nuevaSolicitud();
    expect((await call("jefe", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["jefe"]!.idEmpleado })).status).toBe(200);
    const alSolicitante = escuchar(u["solicitante"]!.idUsuario);
    const r = await call("gerente", "POST", `/api/com/solicitudes/${id}/rechazar`, { idEmpleado: u["gerente"]!.idEmpleado, comentario: "Sin presupuesto" });
    expect(r.status, msg(r)).toBe(200);
    expect(alSolicitante.eventos.find((e) => e.event === "decision")!.data).toMatchObject({ resultado: "RECHAZADA", comentario: "Sin presupuesto" });
    alSolicitante.off();
  });
});

describe("Seguridad de la decisión", () => {
  it("no se puede decidir a nombre de otro empleado", async () => {
    const { id } = await nuevaSolicitud();
    const r = await call("jefe", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["gerente"]!.idEmpleado });
    expect(r.status).toBe(403);
    expect(await scalar(`SELECT COUNT(*) V FROM COM_SOLICITUD_COMPRA WHERE ID_SOLICITUD=${id} AND ESTADO='PENDIENTE_JEFE'`)).toBe(1);
  });

  it("un rol sin permiso de aprobar no puede decidir (403)", async () => {
    const { id } = await nuevaSolicitud();
    const r = await call("solicitante", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["solicitante"]!.idEmpleado });
    expect(r.status).toBe(403);
  });

  it("el nivel gerente no decide mientras espera al jefe", async () => {
    const { id } = await nuevaSolicitud();
    const r = await call("gerente", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["gerente"]!.idEmpleado });
    expect([403, 409]).toContain(r.status);
  });

  it("un aviso solo llega al dueño de la solicitud (no a otros usuarios)", async () => {
    const { id } = await nuevaSolicitud();
    const alComprador = escuchar(u["comprador"]!.idUsuario);
    await call("jefe", "POST", `/api/com/solicitudes/${id}/aprobar`, { idEmpleado: u["jefe"]!.idEmpleado });
    expect(alComprador.eventos.some((e) => e.event === "decision")).toBe(false);
    expect(alComprador.eventos.some((e) => e.event === "bandeja")).toBe(true);
    alComprador.off();
  });
});

describe("Canal en vivo (SSE)", () => {
  it("exige autenticación", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/notificaciones/stream" });
    expect(res.statusCode).toBe(401);
  });

  it("el hub entrega solo a las conexiones del usuario y las da de baja", () => {
    const hub = liveHub();
    const a: string[] = [];
    const b: string[] = [];
    const offA = hub.register(900001, (m) => a.push(m.event))!;
    const offB = hub.register(900002, (m) => b.push(m.event))!;
    expect(hub.sendToUsers([900001], { event: "x", data: {} })).toBe(1);
    expect(a).toEqual(["x"]);
    expect(b).toEqual([]);
    offA();
    expect(hub.sendToUsers([900001], { event: "y", data: {} })).toBe(0);
    expect(hub.broadcast({ event: "z", data: {} })).toBeGreaterThanOrEqual(1);
    expect(b).toEqual(["z"]);
    offB();
  });
});

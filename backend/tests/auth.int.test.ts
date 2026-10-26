/**
 * Test de INTEGRACION - Autenticacion + RBAC del modulo de Compras.
 * Verifica que cada usuario de demostracion (sembrado en
 * database/dml/02_seg_rbac.sql) reciba exactamente los permisos de su rol y
 * que las rutas rechacen (403) lo que no le corresponde y permitan (no 401/403)
 * lo que si.
 *
 * Endurecimiento (Fase 6.1): contrasena real (hash scrypt), bloqueo por
 * intentos fallidos, bitacora SEG_BITACORA_ACCESO y POST /api/auth/logout.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { scalar, startTestApp, stopTestApp, oraclePool } from "./helpers/testApp.js";

let app: FastifyInstance;

/** Contrasena comun de los usuarios de demostracion (ver 02_seg_rbac.sql). */
const DEMO_PASSWORD = "compras.demo";

async function login(
  username: string,
  password: string = DEMO_PASSWORD,
): Promise<{ token: string; permisos: string[]; roles: string[] }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password },
  });
  expect(res.statusCode, `login ${username}`).toBe(200);
  const { data } = res.json() as {
    data: { token: string; sesion: { permisos: string[]; roles: string[] } };
  };
  return { token: data.token, permisos: data.sesion.permisos, roles: data.sesion.roles };
}

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function resetLock(username: string): Promise<void> {
  await oraclePool().withTransaction(async (c) => {
    await c.execute(
      `UPDATE SEG_USUARIO SET INTENTOS_FALLIDOS = 0, FECHA_BLOQUEO = NULL
       WHERE LOWER(USERNAME) = :u`,
      { u: username.toLowerCase() },
    );
  });
}

beforeAll(async () => {
  app = await startTestApp();
});

afterAll(async () => {
  await stopTestApp(app);
});

describe("Autenticación", () => {
  it("rechaza un usuario inexistente con 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "no-existe", password: "cualquier-cosa" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("exige username en el login (422)", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: {} });
    expect(res.statusCode).toBe(422);
  });

  it("exige password en el login (422)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "comprador" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("emite token y sesión para un usuario de demostración", async () => {
    const s = await login("comprador");
    expect(s.token.split(".")).toHaveLength(3);
    expect(s.roles).toContain("COMPRADOR");
    expect(s.permisos).toContain("COMPRAS_RFQ_GESTIONAR");
  });

  it("GET /api/auth/me devuelve la sesión con el token", async () => {
    const { token } = await login("gerente");
    const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: bearer(token) });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { data: { username: string } }).data.username).toBe("gerente");
  });

  it("GET /api/auth/permisos publica el catálogo (19 permisos, 8 roles)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/permisos" });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as { data: { permisos: unknown[]; roles: unknown[] } };
    expect(data.permisos).toHaveLength(19);
    expect(data.roles).toHaveLength(8);
  });
});

describe("Endurecimiento: contraseña, bloqueo y bitácora", () => {
  const VICTIMA = "auditor";

  beforeAll(() => resetLock(VICTIMA));
  afterAll(() => resetLock(VICTIMA));

  it("contrasena incorrecta -> 401 (credenciales invalidas)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "comprador", password: "clave-erronea" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("5 intentos fallidos bloquean la cuenta (423), incluso con la clave correcta", async () => {
    for (let i = 0; i < 4; i++) {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { username: VICTIMA, password: "mala" },
      });
      expect(r.statusCode, `intento ${i + 1}`).toBe(401);
    }
    const quinto = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: VICTIMA, password: "mala" },
    });
    expect(quinto.statusCode).toBe(423);

    const conClaveOk = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: VICTIMA, password: DEMO_PASSWORD },
    });
    expect(conClaveOk.statusCode).toBe(423);
  });

  it("deja rastro en SEG_BITACORA_ACCESO (LOGIN_FALLIDO + BLOQUEO_CUENTA)", async () => {
    const fallidos = await scalar(
      `SELECT COUNT(*) V FROM SEG_BITACORA_ACCESO b
       JOIN SEG_USUARIO u ON u.ID_USUARIO = b.ID_USUARIO
       WHERE LOWER(u.USERNAME) = 'auditor' AND b.TIPO_EVENTO = 'LOGIN_FALLIDO'`,
    );
    const bloqueos = await scalar(
      `SELECT COUNT(*) V FROM SEG_BITACORA_ACCESO b
       JOIN SEG_USUARIO u ON u.ID_USUARIO = b.ID_USUARIO
       WHERE LOWER(u.USERNAME) = 'auditor' AND b.TIPO_EVENTO = 'BLOQUEO_CUENTA'`,
    );
    expect(fallidos).toBeGreaterThanOrEqual(5);
    expect(bloqueos).toBeGreaterThanOrEqual(1);
  });

  it("un login correcto reinicia el contador de intentos", async () => {
    await resetLock(VICTIMA);
    // dos fallos, luego uno bueno, luego otro fallo: no debe bloquear
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { username: VICTIMA, password: "mala" },
      });
    }
    const ok = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: VICTIMA, password: DEMO_PASSWORD },
    });
    expect(ok.statusCode).toBe(200);
    const falloTrasOk = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: VICTIMA, password: "mala" },
    });
    expect(falloTrasOk.statusCode).toBe(401);
  });
});

describe("Cierre de sesión", () => {
  it("POST /api/auth/logout con token -> 204", async () => {
    const { token } = await login("gerente");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: bearer(token),
    });
    expect(res.statusCode).toBe(204);
  });

  it("POST /api/auth/logout sin token -> 401", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/logout" });
    expect(res.statusCode).toBe(401);
  });

  it("deja rastro LOGOUT en la bitácora", async () => {
    const { token } = await login("comprador");
    await app.inject({ method: "POST", url: "/api/auth/logout", headers: bearer(token) });
    const n = await scalar(
      `SELECT COUNT(*) V FROM SEG_BITACORA_ACCESO b
       JOIN SEG_USUARIO u ON u.ID_USUARIO = b.ID_USUARIO
       WHERE LOWER(u.USERNAME) = 'comprador' AND b.TIPO_EVENTO = 'LOGOUT'`,
    );
    expect(n).toBeGreaterThanOrEqual(1);
  });
});

describe("RBAC por rol - deniega lo que no corresponde", () => {
  it("sin credenciales -> 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/solicitudes" });
    expect(res.statusCode).toBe(401);
  });

  it("SOLICITANTE lee solicitudes pero NO RFQ/OC (403) ni gestiona RFQ (403)", async () => {
    const { token } = await login("solicitante");
    const lee = await app.inject({ method: "GET", url: "/api/com/solicitudes", headers: bearer(token) });
    expect(lee.statusCode).toBe(200);

    // Lectura de documentos que no le tocan: 403 (segregacion de funciones).
    for (const url of ["/api/com/rfq", "/api/com/cotizaciones", "/api/com/ordenes-compra"]) {
      const r = await app.inject({ method: "GET", url, headers: bearer(token) });
      expect(r.statusCode, `GET ${url} como solicitante`).toBe(403);
    }

    const rfq = await app.inject({
      method: "POST",
      url: "/api/com/rfq",
      headers: bearer(token),
      payload: { idSolicitud: 1, fechaLimite: "2099-01-01", proveedores: [1, 2, 3] },
    });
    expect(rfq.statusCode).toBe(403);
  });

  it("COMPRADOR no puede adjudicar cotizaciones (403) ni aprobar solicitudes (403)", async () => {
    const { token } = await login("comprador");
    const adj = await app.inject({
      method: "POST",
      url: "/api/com/cotizaciones/detalle/1/adjudicar",
      headers: bearer(token),
    });
    expect(adj.statusCode).toBe(403);

    const ap = await app.inject({
      method: "POST",
      url: "/api/com/solicitudes/1/aprobar",
      headers: bearer(token),
      payload: { idEmpleado: 1 },
    });
    expect(ap.statusCode).toBe(403);
  });

  it("GERENTE_FINANCIERO puede adjudicar (no 401/403) pero no crear solicitudes (403)", async () => {
    const { token } = await login("financiero");
    const crea = await app.inject({
      method: "POST",
      url: "/api/com/solicitudes",
      headers: bearer(token),
      payload: { cabecera: {}, detalles: [] },
    });
    expect(crea.statusCode).toBe(403);

    // Con permiso, el guard deja pasar; el id 1 puede no existir -> 404/409/422, nunca 401/403.
    const adj = await app.inject({
      method: "POST",
      url: "/api/com/cotizaciones/detalle/999999/adjudicar",
      headers: bearer(token),
    });
    expect([401, 403]).not.toContain(adj.statusCode);
  });

  it("BODEGA gestiona recepciones/devoluciones; no gestiona ni lee nada más (403), ni siquiera OC", async () => {
    const { token } = await login("bodega");
    const rfq = await app.inject({
      method: "POST",
      url: "/api/com/rfq",
      headers: bearer(token),
      payload: { idSolicitud: 1, fechaLimite: "2099-01-01", proveedores: [1, 2, 3] },
    });
    expect(rfq.statusCode).toBe(403);

    // Lo suyo: 200. Lo que no gestiona: 403 (ni el documento OC completo —
    // para recibir usa la referencia acotada `GET /api/com/ref/oc/receptibles`,
    // no el listado de Ordenes de compra).
    const rec = await app.inject({ method: "GET", url: "/api/com/recepciones", headers: bearer(token) });
    expect(rec.statusCode).toBe(200);
    for (const url of ["/api/com/solicitudes", "/api/com/rfq", "/api/com/cotizaciones", "/api/com/ordenes-compra"]) {
      const r = await app.inject({ method: "GET", url, headers: bearer(token) });
      expect(r.statusCode, `GET ${url} como bodega`).toBe(403);
    }
  });

  it("read por rol: comprador/financiero solo ven lo que gestionan; bodega solo ve recepciones/devoluciones", async () => {
    const comprador = await login("comprador");
    for (const url of ["/api/com/solicitudes", "/api/com/rfq", "/api/com/cotizaciones", "/api/com/ordenes-compra"]) {
      const r = await app.inject({ method: "GET", url, headers: bearer(comprador.token) });
      expect(r.statusCode, `comprador GET ${url}`).toBe(200);
    }
    for (const url of ["/api/com/recepciones", "/api/com/devoluciones"]) {
      const r = await app.inject({ method: "GET", url, headers: bearer(comprador.token) });
      expect(r.statusCode, `comprador GET ${url} (no gestiona, no ve)`).toBe(403);
    }
    const financiero = await login("financiero");
    for (const url of ["/api/com/cotizaciones", "/api/com/ordenes-compra"]) {
      const r = await app.inject({ method: "GET", url, headers: bearer(financiero.token) });
      expect(r.statusCode, `financiero GET ${url}`).toBe(200);
    }
    for (const url of ["/api/com/rfq", "/api/com/recepciones", "/api/com/devoluciones"]) {
      const r = await app.inject({ method: "GET", url, headers: bearer(financiero.token) });
      expect(r.statusCode, `financiero GET ${url} (no gestiona, no ve)`).toBe(403);
    }
    const bodega = await login("bodega");
    for (const url of ["/api/com/recepciones", "/api/com/devoluciones"]) {
      const r = await app.inject({ method: "GET", url, headers: bearer(bodega.token) });
      expect(r.statusCode, `bodega GET ${url}`).toBe(200);
    }
    for (const url of ["/api/com/rfq", "/api/com/cotizaciones", "/api/com/ordenes-compra"]) {
      const r = await app.inject({ method: "GET", url, headers: bearer(bodega.token) });
      expect(r.statusCode, `bodega GET ${url} (no gestiona, no ve)`).toBe(403);
    }
  });

  it("GERENTE_AREA y AUDITOR no ven ni escriben RFQ/cotizaciones/OC/recepciones/devoluciones (no gestionan nada de eso)", async () => {
    for (const rol of ["gerente", "auditor"] as const) {
      const { token } = await login(rol);
      for (const url of [
        "/api/com/rfq",
        "/api/com/cotizaciones",
        "/api/com/ordenes-compra",
        "/api/com/recepciones",
        "/api/com/devoluciones",
      ]) {
        const r = await app.inject({ method: "GET", url, headers: bearer(token) });
        expect(r.statusCode, `${rol} GET ${url}`).toBe(403);
      }
      const post = await app.inject({
        method: "POST",
        url: "/api/com/recepciones",
        headers: bearer(token),
        payload: { idOrdenCompra: 1, idBodega: 1, idEmpleadoRecibe: 1, lineas: [{ idOcDetalle: 1, cantidadRecibida: 1 }] },
      });
      expect(post.statusCode, `${rol} POST recepciones`).toBe(403);
    }
  });

  it("BODEGA no gestiona OC (403 al listarla) pero elige una vía la referencia acotada de su propio formulario de Recepción", async () => {
    const { token } = await login("bodega");
    const listado = await app.inject({ method: "GET", url: "/api/com/ordenes-compra", headers: bearer(token) });
    expect(listado.statusCode).toBe(403);
    const referencia = await app.inject({ method: "GET", url: "/api/com/ref/oc/receptibles", headers: bearer(token) });
    expect(referencia.statusCode).toBe(200);
    const rows = referencia.json() as { data: unknown[] };
    expect(Array.isArray(rows.data)).toBe(true);
  });

  it("COMPRADOR edita catálogos operativos pero NO monedas (403) — monedas es de Finanzas", async () => {
    const { token } = await login("comprador");
    const op = await app.inject({
      method: "POST",
      url: "/api/com/condiciones-pago",
      headers: bearer(token),
      payload: { nombre: `Cred ${Math.random().toString(36).slice(2, 7)}`, dias: 30 },
    });
    expect([401, 403]).not.toContain(op.statusCode);
    const sens = await app.inject({
      method: "POST",
      url: "/api/com/monedas",
      headers: bearer(token),
      payload: { codigo: `X${Math.random().toString(36).slice(2, 4).toUpperCase()}`, nombre: "Prueba", activa: true },
    });
    expect(sens.statusCode).toBe(403);
  });

  it("GERENTE_FINANCIERO edita catálogos operativos Y monedas (dueno de moneda)", async () => {
    const { token } = await login("financiero");
    const op = await app.inject({
      method: "POST",
      url: "/api/com/centros-costo",
      headers: bearer(token),
      payload: { codigo: `CC${Math.random().toString(36).slice(2, 6)}`, nombre: "Prueba", estado: "A" },
    });
    expect([401, 403]).not.toContain(op.statusCode);
    const sens = await app.inject({
      method: "POST",
      url: "/api/com/monedas",
      headers: bearer(token),
      payload: { codigo: `Y${Math.random().toString(36).slice(2, 4).toUpperCase()}`, nombre: "Prueba", activa: true },
    });
    expect([401, 403]).not.toContain(sens.statusCode);
  });

  it("las tablas de auditoría del flujo (workflow de aprobación, comparativo) no admiten escritura de nadie vía API, ni ADMIN", async () => {
    const { token } = await login("admin");
    for (const url of ["/api/com/workflow-aprobacion", "/api/com/comparativo-cotizaciones"]) {
      const post = await app.inject({ method: "POST", url, headers: bearer(token), payload: {} });
      expect(post.statusCode, `POST ${url}`).toBe(404);
      const put = await app.inject({ method: "PUT", url: `${url}/1`, headers: bearer(token), payload: {} });
      expect(put.statusCode, `PUT ${url}`).toBe(404);
      const del = await app.inject({ method: "DELETE", url: `${url}/1`, headers: bearer(token) });
      expect(del.statusCode, `DELETE ${url}`).toBe(404);
      // La lectura si sigue disponible (trazabilidad/auditoria).
      const get = await app.inject({ method: "GET", url, headers: bearer(token) });
      expect(get.statusCode, `GET ${url}`).toBe(200);
    }
  });

  it("BODEGA no puede editar ningún catálogo (403) pero si verlos (200)", async () => {
    const { token } = await login("bodega");
    const ver = await app.inject({ method: "GET", url: "/api/com/proveedores", headers: bearer(token) });
    expect(ver.statusCode).toBe(200);
    const edita = await app.inject({
      method: "POST",
      url: "/api/com/proveedores",
      headers: bearer(token),
      payload: { nit: "T0", razonSocial: "X", estado: "A" },
    });
    expect(edita.statusCode).toBe(403);
  });

  it("AUDITOR es de solo lectura: lee (200) pero no crea solicitudes (403)", async () => {
    const { token } = await login("auditor");
    const lee = await app.inject({ method: "GET", url: "/api/com/comparativo/solicitud/1", headers: bearer(token) });
    expect([401, 403]).not.toContain(lee.statusCode);

    const crea = await app.inject({
      method: "POST",
      url: "/api/com/solicitudes",
      headers: bearer(token),
      payload: { cabecera: {}, detalles: [] },
    });
    expect(crea.statusCode).toBe(403);
  });

  it("ADMIN_COMPRAS (comodín *) no recibe 403 en ninguna ruta del módulo", async () => {
    const { token, permisos } = await login("admin");
    expect(permisos).toEqual(["*"]);
    for (const url of [
      "/api/com/solicitudes",
      "/api/com/rfq",
      "/api/com/cotizaciones",
      "/api/com/ordenes-compra",
      "/api/com/recepciones",
      "/api/com/devoluciones",
      "/api/com/monedas",
    ]) {
      const res = await app.inject({ method: "GET", url, headers: bearer(token) });
      expect(res.statusCode, url).toBe(200);
    }
  });
});

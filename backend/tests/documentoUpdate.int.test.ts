/**
 * Test de INTEGRACION - Actualización (PUT) de documentos del flujo.
 * Completa el CRUD: hasta ahora los documentos solo tenían crear + acciones.
 *   - Solicitud: editable SOLO en PENDIENTE_JEFE, con bloqueo optimista.
 *   - RFQ: fecha límite editable SOLO mientras está ABIERTO.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const PASS = "compras.demo";
const H = { "x-dev-user": "0" } as const; // contexto de sistema (permisos *)

interface Fk {
  empleado: number;
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
  return (res.json() as { data: { token: string } }).data.token;
}
const bearer = (t: string): Record<string, string> => ({ authorization: `Bearer ${t}` });

async function crearSolicitud(): Promise<{ id: number; version: number }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/com/solicitudes",
    headers: H,
    payload: {
      cabecera: {
        idEmpleadoSolicitante: fk.empleado,
        idSucursal: fk.sucursal,
        idGrupoCompra: fk.grupoCompra,
        idTerminoEntrega: fk.terminoEntrega,
        justificacion: "Original",
        prioridad: 2,
      },
      detalles: [
        {
          idArticulo: fk.articulo,
          descripcion: "Linea",
          cantidadSolicitada: 3,
          idUnidadMedida: fk.unidadMedida,
          fechaRequerida: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
        },
      ],
    },
  });
  expect(res.statusCode).toBe(201);
  const h = (res.json() as { data: { header: { idSolicitud: number; version: number } } }).data.header;
  return { id: h.idSolicitud, version: h.version };
}

beforeAll(async () => {
  app = await startTestApp();
  fk.empleado = await scalar("SELECT ID_EMPLEADO V FROM NOM_EMPLEADO WHERE CODIGO_EMPLEADO='EMP-101'");
  fk.sucursal = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  fk.grupoCompra = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  fk.terminoEntrega = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  fk.articulo = await scalar("SELECT MIN(ID_ARTICULO) V FROM INV_ARTICULO WHERE ELIMINADO='N'");
  fk.unidadMedida = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
});

afterAll(async () => {
  await stopTestApp(app);
});

describe("PUT /api/com/solicitudes/:id", () => {
  it("edita la cabecera en PENDIENTE_JEFE (200) y aplica el cambio", async () => {
    const { id, version } = await crearSolicitud();
    const res = await app.inject({
      method: "PUT",
      url: `/api/com/solicitudes/${id}`,
      headers: H,
      payload: { justificacion: "Editada por PUT", prioridad: 5, version },
    });
    expect(res.statusCode).toBe(200);
    const h = (res.json() as { data: { header: { justificacion: string; prioridad: number } } }).data.header;
    expect(h.justificacion).toBe("Editada por PUT");
    expect(h.prioridad).toBe(5);
  });

  it("exige el campo version (bloqueo optimista) → 422", async () => {
    const { id } = await crearSolicitud();
    const res = await app.inject({
      method: "PUT",
      url: `/api/com/solicitudes/${id}`,
      headers: H,
      payload: { justificacion: "sin version" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("rechaza editar una solicitud ya aprobada (no PENDIENTE_JEFE) → 409", async () => {
    const { id, version } = await crearSolicitud();
    const ap = await app.inject({
      method: "POST",
      url: `/api/com/solicitudes/${id}/aprobar`,
      headers: H,
      payload: { idEmpleado: fk.empleado },
    });
    expect(ap.statusCode).toBe(200); // -> PENDIENTE_GERENTE
    const res = await app.inject({
      method: "PUT",
      url: `/api/com/solicitudes/${id}`,
      headers: H,
      payload: { justificacion: "tarde", version: version + 1 },
    });
    expect(res.statusCode).toBe(409);
  });

  it("el SOLICITANTE puede editar la suya; BODEGA no (403 por permiso)", async () => {
    const { id, version } = await crearSolicitud();
    const solic = await token("solicitante");
    const bod = await token("bodega");

    const ok = await app.inject({
      method: "PUT",
      url: `/api/com/solicitudes/${id}`,
      headers: bearer(solic),
      payload: { justificacion: "por el solicitante", version },
    });
    expect([401, 403]).not.toContain(ok.statusCode);

    const no = await app.inject({
      method: "PUT",
      url: `/api/com/solicitudes/${id}`,
      headers: bearer(bod),
      payload: { justificacion: "por bodega", version: version + 1 },
    });
    expect(no.statusCode).toBe(403);
  });
});

describe("PUT /api/com/rfq/:id", () => {
  it("edita la fecha límite mientras el RFQ está ABIERTO (200)", async () => {
    const { id } = await crearSolicitud();
    // aprobar 2 niveles -> EN_COTIZACION
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: "POST",
        url: `/api/com/solicitudes/${id}/aprobar`,
        headers: H,
        payload: { idEmpleado: fk.empleado },
      });
    }
    const provs = await app.inject({
      method: "GET",
      url: "/api/com/proveedores?pageSize=3",
      headers: H,
    });
    const ids = (provs.json() as { data: { idProveedor: number }[] }).data.map((p) => p.idProveedor);
    const rfq = await app.inject({
      method: "POST",
      url: "/api/com/rfq",
      headers: H,
      payload: { idSolicitud: id, fechaLimite: "2099-01-01", proveedores: ids },
    });
    expect(rfq.statusCode).toBe(201);
    const idRfq = (rfq.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;

    const res = await app.inject({
      method: "PUT",
      url: `/api/com/rfq/${idRfq}`,
      headers: H,
      payload: { fechaLimite: "2099-06-30" },
    });
    expect(res.statusCode).toBe(200);
    const rr = res.json() as { data: { fechaLimite: string } };
    expect(String(rr.data.fechaLimite).slice(0, 10)).toBe("2099-06-30");
  });
});

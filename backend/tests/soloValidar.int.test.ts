/**
 * Test de INTEGRACION - modo "solo validar" (cabecera X-Solo-Validar: 1).
 * El servicio ejecuta TODAS sus validaciones y no escribe: no crea el documento ni consume folios.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SYS_HEADERS, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const ids: Record<string, number> = {};
const dia = (n: number): string => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

beforeAll(async () => {
  app = await startTestApp();
  ids["empleado"] = await scalar("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'");
  ids["sucursal"] = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  ids["grupo"] = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  ids["termino"] = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  ids["articulo"] = await scalar("SELECT MIN(ID_ARTICULO) V FROM INV_ARTICULO WHERE ELIMINADO='N'");
  ids["unidad"] = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
});
afterAll(async () => {
  await stopTestApp(app);
});

function cuerpo(fechaRequerida: string): Record<string, unknown> {
  return {
    cabecera: {
      idEmpleadoSolicitante: ids["empleado"],
      idSucursal: ids["sucursal"],
      idGrupoCompra: ids["grupo"],
      idTerminoEntrega: ids["termino"],
      justificacion: "Validación sin registrar (test)",
      prioridad: 3,
    },
    detalles: [
      { idArticulo: ids["articulo"], descripcion: "Artículo", cantidadSolicitada: 2, idUnidadMedida: ids["unidad"], fechaRequerida },
    ],
  };
}

const conteo = (): Promise<number> => scalar("SELECT COUNT(*) V FROM COM_SOLICITUD_COMPRA");
const maxId = (): Promise<number> => scalar("SELECT NVL(MAX(ID_SOLICITUD),0) V FROM COM_SOLICITUD_COMPRA");

describe("modo solo validar", () => {
  it("un documento válido responde 200 { valido: true } y NO crea nada (el servicio revierte antes de escribir)", async () => {
    const antes = await conteo();
    const idAntes = await maxId();
    const res = await app.inject({
      method: "POST",
      url: "/api/com/solicitudes",
      headers: { ...SYS_HEADERS, "x-solo-validar": "1" },
      payload: cuerpo(dia(10)),
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { data: { valido: boolean } }).data.valido).toBe(true);
    expect(await conteo()).toBe(antes);

    expect(await maxId()).toBe(idAntes);
  });

  it("un documento inválido sigue devolviendo su error (422) con el motivo", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/solicitudes",
      headers: { ...SYS_HEADERS, "x-solo-validar": "1" },
      payload: cuerpo(dia(-3)),
    });
    expect(res.statusCode).toBe(422);
  });
});

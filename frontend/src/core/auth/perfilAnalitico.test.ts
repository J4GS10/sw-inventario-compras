import { describe, expect, it } from "vitest";
import { Permisos } from "./permisos.js";
import { PRIORIDAD_POR_PERFIL, perfilAnalitico, reportesVisibles } from "./perfilAnalitico.js";

const R = Permisos;
// Espejo de los permisos que da backend/src/common/auth/permissions.ts a cada rol.
const COMPRADOR = [R.SOLICITUD_VER, R.RFQ_GESTIONAR, R.COTIZACION_GESTIONAR, R.OC_GESTIONAR, R.CATALOGO_VER, R.ANALISIS_VER, R.REPORTE_EVALUACION, R.REPORTE_ENTREGAS, R.REPORTE_DESEMPENO];
const FINANCIERO = [R.SOLICITUD_VER, R.COTIZACION_ADJUDICAR, R.OC_GESTIONAR, R.CATALOGO_ADMIN, R.ANALISIS_VER, R.REPORTE_GASTO, R.REPORTE_ENTREGAS, R.REPORTE_RIESGO, R.REPORTE_INVENTARIO];
const AUDITOR = [R.SOLICITUD_VER, R.CATALOGO_VER, R.ANALISIS_VER, R.REPORTE_GASTO, R.REPORTE_DESEMPENO, R.REPORTE_RIESGO, R.REPORTE_INVENTARIO];
const GERENTE = [R.SOLICITUD_VER, R.SOLICITUD_APROBAR_GERENTE, R.CATALOGO_VER, R.ANALISIS_VER];
const JEFE = [R.SOLICITUD_CREAR, R.SOLICITUD_VER, R.SOLICITUD_APROBAR_JEFE, R.CATALOGO_VER, R.ANALISIS_VER];
const SOLICITANTE = [R.SOLICITUD_CREAR, R.SOLICITUD_VER, R.CATALOGO_VER, R.ANALISIS_VER];
const BODEGA = [R.RECEPCION_GESTIONAR, R.DEVOLUCION_GESTIONAR, R.CATALOGO_VER];

describe("perfilAnalitico", () => {
  it("deriva el perfil de los permisos de gestión", () => {
    expect(perfilAnalitico(COMPRADOR, ["COMPRADOR"])).toBe("comprador");
    expect(perfilAnalitico(FINANCIERO, ["GERENTE_FINANCIERO"])).toBe("financiero");
    expect(perfilAnalitico(GERENTE, ["GERENTE_AREA"])).toBe("gerencia");
    expect(perfilAnalitico(JEFE, ["JEFE_INMEDIATO"])).toBe("gerencia");
    expect(perfilAnalitico(SOLICITANTE, ["SOLICITANTE"])).toBe("solicitante");
    expect(perfilAnalitico(AUDITOR, ["AUDITOR"])).toBe("auditor");
    expect(perfilAnalitico(["*"], ["ADMIN_COMPRAS"])).toBe("total");
  });

  it("cada área ve SOLO los reportes que le corresponden (y son distintos entre sí)", () => {
    expect(reportesVisibles(COMPRADOR, [])).toEqual(["evaluacion", "pendientes", "desempeno"]);
    expect(reportesVisibles(FINANCIERO, [])).toEqual(["inventario", "gasto", "riesgo", "pendientes"]);
    expect(reportesVisibles(AUDITOR, ["AUDITOR"])).toEqual(["riesgo", "desempeno", "gasto", "inventario"]);
    expect(reportesVisibles(["*"], [])).toHaveLength(6);
  });

  it("gerencia de área, jefes, solicitantes y bodega no ven ningún reporte", () => {
    for (const p of [GERENTE, JEFE, SOLICITANTE, BODEGA]) expect(reportesVisibles(p, [])).toEqual([]);
  });

  it("cada perfil abre la evaluación con su enfoque", () => {
    expect(PRIORIDAD_POR_PERFIL.financiero).toBe("ahorro");
    expect(PRIORIDAD_POR_PERFIL.auditor).toBe("calidad");
  });
});

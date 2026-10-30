import { describe, expect, it } from "vitest";
import { Permisos } from "./permisos.js";
import { PRIORIDAD_POR_PERFIL, perfilAnalitico, reportesVisibles } from "./perfilAnalitico.js";

const R = Permisos;
// Espejo de los permisos que da backend/src/common/auth/permissions.ts a cada rol.
const COMPRADOR = [R.SOLICITUD_VER, R.RFQ_GESTIONAR, R.COTIZACION_GESTIONAR, R.OC_GESTIONAR, R.CATALOGO_VER, R.ANALISIS_VER, R.REPORTE_EVALUACION, R.REPORTE_ENTREGAS, R.REPORTE_DESEMPENO, R.REPORTE_DISPONIBILIDAD];
const FINANCIERO = [R.SOLICITUD_VER, R.COTIZACION_ADJUDICAR, R.OC_GESTIONAR, R.CATALOGO_ADMIN, R.ANALISIS_VER, R.REPORTE_GASTO, R.REPORTE_ENTREGAS, R.REPORTE_RIESGO, R.REPORTE_INVENTARIO, R.REPORTE_GASTO_AREA];
const AUDITOR = [R.SOLICITUD_VER, R.CATALOGO_VER, R.ANALISIS_VER, R.REPORTE_GASTO, R.REPORTE_DESEMPENO, R.REPORTE_RIESGO, R.REPORTE_INVENTARIO, R.REPORTE_AUDITORIA, R.REPORTE_GASTO_AREA];
const GERENTE = [R.SOLICITUD_VER, R.SOLICITUD_APROBAR_GERENTE, R.CATALOGO_VER, R.ANALISIS_VER, R.REPORTE_DISPONIBILIDAD, R.REPORTE_GASTO_AREA];
const JEFE = [R.SOLICITUD_CREAR, R.SOLICITUD_VER, R.SOLICITUD_APROBAR_JEFE, R.CATALOGO_VER, R.ANALISIS_VER, R.REPORTE_DISPONIBILIDAD, R.REPORTE_GASTO_AREA];
const SOLICITANTE = [R.SOLICITUD_CREAR, R.SOLICITUD_VER, R.CATALOGO_VER, R.ANALISIS_VER, R.REPORTE_DISPONIBILIDAD];
const BODEGA = [R.RECEPCION_GESTIONAR, R.DEVOLUCION_GESTIONAR, R.CATALOGO_VER, R.REPORTE_ENTREGAS, R.REPORTE_DISPONIBILIDAD];

describe("perfilAnalitico", () => {
  it("deriva el perfil de los permisos de gestión", () => {
    expect(perfilAnalitico(COMPRADOR, ["COMPRADOR"])).toBe("comprador");
    expect(perfilAnalitico(FINANCIERO, ["GERENTE_FINANCIERO"])).toBe("financiero");
    expect(perfilAnalitico(GERENTE, ["GERENTE_AREA"])).toBe("gerencia");
    expect(perfilAnalitico(JEFE, ["JEFE_INMEDIATO"])).toBe("gerencia");
    expect(perfilAnalitico(SOLICITANTE, ["SOLICITANTE"])).toBe("solicitante");
    expect(perfilAnalitico(BODEGA, ["BODEGA"])).toBe("bodega");
    expect(perfilAnalitico(AUDITOR, ["AUDITOR"])).toBe("auditor");
    expect(perfilAnalitico(["*"], ["ADMIN_COMPRAS"])).toBe("total");
  });

  it("cada área ve SOLO los reportes que le corresponden, en el orden de su decisión", () => {
    expect(reportesVisibles(COMPRADOR, [])).toEqual(["evaluacion", "disponibilidad", "pendientes", "desempeno"]);
    expect(reportesVisibles(FINANCIERO, [])).toEqual(["gasto", "area", "riesgo", "inventario", "pendientes"]);
    expect(reportesVisibles(AUDITOR, ["AUDITOR"])).toEqual(["auditoria", "riesgo", "gasto", "area", "desempeno", "inventario"]);
    expect(reportesVisibles(GERENTE, [])).toEqual(["area", "disponibilidad"]);
    expect(reportesVisibles(JEFE, [])).toEqual(["area", "disponibilidad"]);
    expect(reportesVisibles(SOLICITANTE, [])).toEqual(["disponibilidad"]);
    expect(reportesVisibles(BODEGA, [])).toEqual(["pendientes", "disponibilidad"]);
    expect(reportesVisibles(["*"], [])).toHaveLength(9);
  });

  it("ningún rol operativo ve la auditoría ni la evaluación comercial de otros", () => {
    for (const p of [GERENTE, JEFE, SOLICITANTE, BODEGA]) {
      expect(reportesVisibles(p, [])).not.toContain("auditoria");
      expect(reportesVisibles(p, [])).not.toContain("evaluacion");
    }
  });

  it("cada perfil abre la evaluación con su enfoque", () => {
    expect(PRIORIDAD_POR_PERFIL.financiero).toBe("ahorro");
    expect(PRIORIDAD_POR_PERFIL.auditor).toBe("calidad");
  });
});

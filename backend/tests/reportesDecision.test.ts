/**
 * Reportes para decidir: pesos elegidos por el usuario, requisitos minimos,
 * recomendacion de "¿conviene pedir?" y busqueda sin tildes. Sin base de datos:
 * se sustituye la lectura del repositorio por filas sinteticas.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CompraReadRepository,
  type DisponibilidadArticuloRow,
  type EvaluacionProveedorRow,
} from "../src/dal/repositories/com/CompraReadRepository.js";
import {
  ReporteService,
  clasificarDisponibilidad,
  coincideTexto,
  normalizarPesos,
} from "../src/bll/services/com/ReporteService.js";

afterEach(() => vi.restoreAllMocks());

function prov(p: Partial<EvaluacionProveedorRow> & { idProveedor: number; proveedor: string }): EvaluacionProveedorRow {
  return {
    nit: "1",
    calificacion: "A",
    diasCredito: 30,
    ordenes: 5,
    montoBruto: 10000,
    montoNeto: 10000,
    plazoPrometidoDias: 10,
    ordenesCompletas: 5,
    diasRealesEntrega: 10,
    ordenesATiempo: 5,
    cantidadRecibida: 100,
    cantidadRechazada: 0,
    ordenesConEnvio: 0,
    ordenesEnvioGratis: 0,
    costoEnvioTotal: 0,
    ...p,
  };
}

const PROVEEDORES: EvaluacionProveedorRow[] = [
  // Barato pero lento y con rechazo.
  prov({ idProveedor: 1, proveedor: "Barato", montoNeto: 8000, diasRealesEntrega: 20, cantidadRecibida: 80, cantidadRechazada: 20 }),
  // Caro pero rapido y sin rechazo.
  prov({ idProveedor: 2, proveedor: "Rápido", diasRealesEntrega: 2 }),
];

function conProveedores(): ReporteService {
  vi.spyOn(CompraReadRepository.prototype, "evaluacionProveedores").mockResolvedValue(PROVEEDORES);
  return new ReporteService();
}

describe("evaluación con pesos del usuario", () => {
  it("el ganador cambia según lo que el usuario dice que importa", async () => {
    const svc = conProveedores();
    const precio = await svc.evaluacionProveedores({
      prioridad: "personalizado",
      pesos: { descuento: 10, entrega: 0, cumplimiento: 0, calidad: 0, envio: 0 },
    });
    expect(precio.mejores.conveniencia?.proveedor).toBe("Barato");
    const rapidez = await svc.evaluacionProveedores({
      prioridad: "personalizado",
      pesos: { descuento: 0, entrega: 10, cumplimiento: 0, calidad: 0, envio: 0 },
    });
    expect(rapidez.mejores.conveniencia?.proveedor).toBe("Rápido");
    expect(rapidez.pesos.entrega).toBe(1);
  });

  it("los requisitos mínimos descartan a quien no los cumple", async () => {
    const r = await conProveedores().evaluacionProveedores({ maxRechazoPct: 5 });
    expect(r.proveedores.map((p) => p.proveedor)).toEqual(["Rápido"]);
    expect(r.descartados).toBe(1);
  });

  it("el enfoque personalizado exige pesos válidos", async () => {
    await expect(conProveedores().evaluacionProveedores({ prioridad: "personalizado" })).rejects.toThrow();
    expect(() => normalizarPesos({ descuento: 0, entrega: 0, cumplimiento: 0, calidad: 0, envio: 0 })).toThrow();
    const w = normalizarPesos({ descuento: 3, entrega: 1, cumplimiento: 0, calidad: 0, envio: 0 });
    expect(w.descuento).toBeCloseTo(0.75);
  });
});

function art(p: Partial<DisponibilidadArticuloRow>): DisponibilidadArticuloRow {
  return {
    idArticulo: 1,
    codigo: "A1",
    articulo: "Tornillo",
    idCategoria: 1,
    categoria: "Ferretería",
    unidad: "UND",
    stockMinimo: 10,
    stockMaximo: 50,
    existencia: 0,
    enTransito: 0,
    solicitado: 0,
    solicitudesEnCurso: 0,
    ultimoPrecio: null,
    ultimoProveedor: null,
    ultimaCompra: null,
    ...p,
  };
}

describe("¿conviene pedir?", () => {
  it("pide cuando no hay cobertura y nadie lo ha solicitado, y sugiere llegar al máximo", () => {
    const r = clasificarDisponibilidad(art({ existencia: 4 }));
    expect(r.accion).toBe("PEDIR");
    expect(r.sugeridoPedir).toBe(46);
  });
  it("no duplica: si ya hay una solicitud en trámite lo marca como en curso", () => {
    expect(clasificarDisponibilidad(art({ existencia: 2, solicitado: 30, solicitudesEnCurso: 1 })).accion).toBe("EN_CURSO");
  });
  it("si lo que viene en camino cubre el mínimo, no hay que pedir", () => {
    expect(clasificarDisponibilidad(art({ existencia: 5, enTransito: 20 })).accion).toBe("EN_TRANSITO");
  });
  it("sobre el máximo: no pedir", () => {
    expect(clasificarDisponibilidad(art({ existencia: 60 })).accion).toBe("EXCEDIDO");
    expect(clasificarDisponibilidad(art({ existencia: 30 })).accion).toBe("SUFICIENTE");
  });
});

describe("búsqueda de los reportes", () => {
  it("ignora tildes y mayúsculas y exige todas las palabras", () => {
    expect(coincideTexto("ferreteria fortaleza", "Ferretería La Fortaleza, S.A.")).toBe(true);
    expect(coincideTexto("ferreteria norte", "Ferretería La Fortaleza, S.A.")).toBe(false);
    expect(coincideTexto("", "lo que sea")).toBe(true);
  });

  it("el filtro de texto se aplica en el servidor (lo mismo que verá el PDF)", async () => {
    vi.spyOn(CompraReadRepository.prototype, "gastoPorProveedor").mockResolvedValue([
      { idProveedor: 1, proveedor: "Ferretería La Fortaleza", nit: "1", ordenes: 2, monto: 100 },
      { idProveedor: 2, proveedor: "Eléctricos del Norte", nit: "2", ordenes: 1, monto: 300 },
    ]);
    const r = await new ReporteService().gastoPorProveedor({ q: "ferreteria" });
    expect(r.proveedores.map((p) => p.proveedor)).toEqual(["Ferretería La Fortaleza"]);
    expect(r.montoTotal).toBe(100);
    expect(r.proveedores[0]?.porcentaje).toBe(100);
  });
});

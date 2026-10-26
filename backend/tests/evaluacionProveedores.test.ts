/**
 * Evaluacion de proveedores: ranking por criterio y score segun el enfoque.
 * Sin base de datos: se sustituye la lectura del repositorio por filas
 * sinteticas con variedad (la BD de desarrollo trae descuento 0 y entregas
 * del mismo dia, que no ejercitan el ranking).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CompraReadRepository,
  type EvaluacionProveedorRow,
} from "../src/dal/repositories/com/CompraReadRepository.js";
import { ReporteService } from "../src/bll/services/com/ReporteService.js";

function fila(p: Partial<EvaluacionProveedorRow> & { idProveedor: number; proveedor: string }): EvaluacionProveedorRow {
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

const FILAS: EvaluacionProveedorRow[] = [
  // Mucho descuento, lento, flete pagado.
  fila({ idProveedor: 1, proveedor: "Descuentera", montoBruto: 10000, montoNeto: 8800, diasRealesEntrega: 20, ordenesATiempo: 2, ordenesConEnvio: 5, ordenesEnvioGratis: 0, costoEnvioTotal: 500 }),
  // Rapido y con envio gratis, sin descuento.
  fila({ idProveedor: 2, proveedor: "Veloz", diasRealesEntrega: 3, ordenesConEnvio: 5, ordenesEnvioGratis: 5 }),
  // Mediocre en todo, con rechazo alto.
  fila({ idProveedor: 3, proveedor: "Regular", montoBruto: 10000, montoNeto: 9800, diasRealesEntrega: 12, ordenesATiempo: 3, cantidadRecibida: 90, cantidadRechazada: 10 }),
  // Una sola OC: excelente pero no compite con minOrdenes=2.
  fila({ idProveedor: 4, proveedor: "Suerte", ordenes: 1, ordenesCompletas: 1, ordenesATiempo: 1, montoBruto: 1000, montoNeto: 500, diasRealesEntrega: 1 }),
];

afterEach(() => vi.restoreAllMocks());

function conFilas(filas: EvaluacionProveedorRow[]): ReporteService {
  vi.spyOn(CompraReadRepository.prototype, "evaluacionProveedores").mockResolvedValue(filas);
  return new ReporteService();
}

describe("ReporteService.evaluacionProveedores", () => {
  it("elige un mejor distinto por criterio entre los elegibles", async () => {
    const r = await conFilas(FILAS).evaluacionProveedores({ minOrdenes: 2 });
    expect(r.mejores.descuento?.proveedor).toBe("Descuentera");
    expect(r.mejores.entrega?.proveedor).toBe("Veloz");
    expect(r.mejores.envio?.proveedor).toBe("Veloz");
    expect(r.mejores.calidad?.proveedor).not.toBe("Regular");
    expect(r.mejores.cumplimiento?.valor).toBe(100);
  });

  it("un proveedor con menos OC que el minimo no gana ni distorsiona la escala", async () => {
    const r = await conFilas(FILAS).evaluacionProveedores({ minOrdenes: 2 });
    const suerte = r.proveedores.find((p) => p.proveedor === "Suerte");
    expect(suerte?.elegible).toBe(false);
    expect(r.mejores.descuento?.proveedor).not.toBe("Suerte");
    expect(r.mejores.entrega?.proveedor).not.toBe("Suerte");
    // los no elegibles quedan al final de la lista
    expect(r.proveedores[r.proveedores.length - 1]?.proveedor).toBe("Suerte");
  });

  it("calcula descuento ponderado y ahorro en GTQ", async () => {
    const r = await conFilas(FILAS).evaluacionProveedores({ minOrdenes: 2 });
    const d = r.proveedores.find((p) => p.proveedor === "Descuentera");
    expect(d?.descuentoPct).toBe(12);
    expect(d?.ahorroDescuento).toBe(1200);
    expect(d?.porcentajeATiempo).toBe(40);
    expect(d?.costoEnvioPromedio).toBe(100);
    expect(d?.porcentajeEnvioGratis).toBe(0);
  });

  it("el enfoque cambia al ganador: ahorro favorece al de mayor descuento, rapidez al mas veloz", async () => {
    const svc = conFilas(FILAS);
    const ahorro = await svc.evaluacionProveedores({ minOrdenes: 2, prioridad: "ahorro" });
    const rapidez = await svc.evaluacionProveedores({ minOrdenes: 2, prioridad: "rapidez" });
    expect(rapidez.mejores.conveniencia?.proveedor).toBe("Veloz");
    expect(ahorro.proveedores[0]?.proveedor).not.toBe("Regular");
    expect(rapidez.proveedores[0]?.proveedor).toBe("Veloz");
  });

  it("sin costo de envio registrado no hay 'mejor envio' (sin datos, no inventa)", async () => {
    const sinEnvio = FILAS.map((f) => ({ ...f, ordenesConEnvio: 0, ordenesEnvioGratis: 0, costoEnvioTotal: 0 }));
    const r = await conFilas(sinEnvio).evaluacionProveedores({ minOrdenes: 2 });
    expect(r.mejores.envio).toBeNull();
    expect(r.proveedores.every((p) => p.porcentajeEnvioGratis === null)).toBe(true);
  });

  it("soloEnvioGratis deja unicamente a quien despacho alguna OC sin flete", async () => {
    const r = await conFilas(FILAS).evaluacionProveedores({ soloEnvioGratis: true });
    expect(r.proveedores.map((p) => p.proveedor)).toEqual(["Veloz"]);
  });

  it("usa el plazo prometido cuando aun no hay OC completas", async () => {
    const r = await conFilas([
      fila({ idProveedor: 9, proveedor: "Nuevo", ordenesCompletas: 0, ordenesATiempo: 0, diasRealesEntrega: null, plazoPrometidoDias: 15 }),
    ]).evaluacionProveedores();
    expect(r.proveedores[0]?.diasEntrega).toBe(15);
    expect(r.proveedores[0]?.diasEntregaEsPrometido).toBe(true);
    expect(r.proveedores[0]?.porcentajeATiempo).toBeNull();
  });

  it("si todos empatan (o nadie da descuento) no nombra ganador: no inventa diferencias", async () => {
    const planos = [1, 2, 3].map((i) => fila({ idProveedor: i, proveedor: `P${i}` }));
    const r = await conFilas(planos).evaluacionProveedores({ minOrdenes: 2 });
    expect(r.mejores.descuento).toBeNull();
    expect(r.mejores.entrega).toBeNull();
    expect(r.mejores.cumplimiento).toBeNull();
    expect(r.mejores.calidad).toBeNull();
    expect(r.mejores.envio).toBeNull();
  });

  it("un descuento maximo de 0 % no cuenta como 'mayor descuento'", async () => {
    const r = await conFilas([
      fila({ idProveedor: 1, proveedor: "A", diasRealesEntrega: 5 }),
      fila({ idProveedor: 2, proveedor: "B", diasRealesEntrega: 9 }),
    ]).evaluacionProveedores({ minOrdenes: 2 });
    expect(r.mejores.descuento).toBeNull();
    expect(r.mejores.entrega?.proveedor).toBe("A");
  });

  it("rechaza un enfoque desconocido", async () => {
    await expect(
      conFilas(FILAS).evaluacionProveedores({ prioridad: "x" as never }),
    ).rejects.toThrow(/Prioridad inválida/);
  });
});

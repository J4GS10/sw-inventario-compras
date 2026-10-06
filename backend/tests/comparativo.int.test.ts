/**
 * Test de INTEGRACION - Comparativo de cotizaciones + Historial por proveedor.
 * Escenario: 1 solicitud, 3 proveedores, 3 cotizaciones (las que compara el
 * director), criterios de evaluacion, adjudicacion y, tras una compra completa,
 * consulta del historial de precios (VW_COM_PRECIO_HISTORIAL).
 * Ejecutar:  pnpm exec vitest run --config vitest.int.config.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import oracledb from "oracledb";
import type { FastifyInstance } from "fastify";
import { SYS_HEADERS, oraclePool, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

void readFileSync; // (el .env ya lo carga testApp) evita import sin uso
void resolve;

let app: FastifyInstance;
const H = SYS_HEADERS;
const inTwoWeeks = new Date(Date.now() + 14 * 864e5).toISOString();

interface Ids {
  sucursal: number;
  empleado: number;
  articulo: number;
  unidadMedida: number;
  grupoCompra: number;
  terminoEntrega: number;
  moneda: number;
  condicionPago: number;
  bodega: number;
  proveedores: number[];
}
const ids = {} as Ids;

const state = {
  idSolicitud: 0,
  idSolicitudDetalle: 0,
  idRfq: 0,
  cotDetallePorProveedor: new Map<number, number>(),
  idCotizacionDetalleGanadora: 0,
};

const PRECIOS = new Map<number, number>(); // idProveedor -> precio unitario

/**
 * Proveedores DEDICADOS a esta corrida (NIT unico por ejecucion), en vez de
 * reutilizar los primeros 3 `COM_PROVEEDOR` compartidos con otras suites
 * (comFlujo, dashboard, y las validaciones E2E manuales). Evita el flake real
 * encontrado: "filtra por rango de fechas" asumia 0 recepciones antes de hoy
 * para un proveedor compartido, y con suficientes corridas acumuladas (o al
 * cruzar medianoche) esa cuenta deja de ser 0.
 */
async function crearProveedoresDePrueba(n: number): Promise<number[]> {
  return oraclePool().withTransaction(async (c) => {
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = await c.execute(
        `INSERT INTO COM_PROVEEDOR (NIT, RAZON_SOCIAL, ESTADO)
         VALUES (:nit, :razon, 'A')
         RETURNING ID_PROVEEDOR INTO :id`,
        {
          nit: `T${Date.now().toString(36)}${i}`,
          razon: `Proveedor de prueba - comparativo (aislado #${i + 1})`,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      ids.push((r.outBinds as { id: number[] }).id[0] as number);
    }
    return ids;
  });
}

async function ensureBodega(sucursal: number): Promise<number> {
  const existing = await scalar("SELECT MIN(ID_BODEGA) V FROM INV_BODEGA WHERE ELIMINADO='N'");
  if (Number.isFinite(existing)) return existing;
  return oraclePool().withTransaction(async (c) => {
    const r = await c.execute(
      `INSERT INTO INV_BODEGA (ID_SUCURSAL, NOMBRE, TIPO, ESTADO)
       VALUES (:s, 'Bodega Comparativo Test', 'CENTRAL', 'A')
       RETURNING ID_BODEGA INTO :id`,
      { s: sucursal, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    );
    return (r.outBinds as { id: number[] }).id[0] as number;
  });
}

beforeAll(async () => {
  app = await startTestApp();
  ids.sucursal = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  ids.empleado = await scalar("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'");
  ids.articulo = await scalar("SELECT MIN(ID_ARTICULO) V FROM INV_ARTICULO WHERE ELIMINADO='N'");
  ids.unidadMedida = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
  ids.grupoCompra = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  ids.terminoEntrega = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  ids.moneda = await scalar("SELECT MIN(ID_MONEDA) V FROM COM_MONEDA WHERE ELIMINADO='N'");
  ids.condicionPago = await scalar("SELECT MIN(ID_CONDICION_PAGO) V FROM COM_CONDICION_PAGO WHERE ELIMINADO='N'");
  ids.bodega = await ensureBodega(ids.sucursal);

  const provRows = await crearProveedoresDePrueba(3);
  ids.proveedores = provRows;
  PRECIOS.set(provRows[0]!, 30.0);
  PRECIOS.set(provRows[1]!, 25.5); // mejor precio
  PRECIOS.set(provRows[2]!, 28.0);
});

afterAll(async () => {
  // Borrado logico de los proveedores dedicados de esta corrida: sin esto
  // quedan visibles para siempre en el catalogo real de Proveedores (se
  // encontraron acumulados en pantalla real tras varias corridas).
  if (ids.proveedores?.length > 0) {
    await oraclePool().withTransaction(async (c) => {
      for (const id of ids.proveedores) {
        await c.execute("UPDATE COM_PROVEEDOR SET ELIMINADO='S' WHERE ID_PROVEEDOR = :id", { id });
      }
    });
  }
  await stopTestApp(app);
});

describe("Comparativo de 3 cotizaciones", () => {
  it("prepara solicitud aprobada en EN_COTIZACION", async () => {
    const sol = await app.inject({
      method: "POST",
      url: "/api/com/solicitudes",
      headers: H,
      payload: {
        cabecera: {
          idEmpleadoSolicitante: ids.empleado,
          idSucursal: ids.sucursal,
          idGrupoCompra: ids.grupoCompra,
          idTerminoEntrega: ids.terminoEntrega,
          justificacion: "Comparativo 3 cotizaciones (test)",
          prioridad: 1,
        },
        detalles: [
          {
            idArticulo: ids.articulo,
            descripcion: "Artículo comparado",
            cantidadSolicitada: 20,
            idUnidadMedida: ids.unidadMedida,
            fechaRequerida: inTwoWeeks.slice(0, 10),
          },
        ],
      },
    });
    expect(sol.statusCode).toBe(201);
    const body = sol.json() as {
      data: { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
    };
    state.idSolicitud = body.data.header.idSolicitud;
    state.idSolicitudDetalle = body.data.details[0]!.idSolicitudDetalle;

    for (let i = 0; i < 2; i++) {
      const ap = await app.inject({
        method: "POST",
        url: `/api/com/solicitudes/${state.idSolicitud}/aprobar`,
        headers: H,
        payload: { idEmpleado: ids.empleado },
      });
      expect(ap.statusCode).toBe(200);
    }
  });

  it("abre RFQ con los 3 proveedores", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/rfq",
      headers: H,
      payload: {
        idSolicitud: state.idSolicitud,
        fechaLimite: inTwoWeeks.slice(0, 10),
        proveedores: ids.proveedores,
      },
    });
    expect(res.statusCode).toBe(201);
    state.idRfq = (res.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;
  });

  it("registra las 3 cotizaciones", async () => {
    for (const idProveedor of ids.proveedores) {
      const res = await app.inject({
        method: "POST",
        url: "/api/com/cotizaciones",
        headers: H,
        payload: {
          idRfq: state.idRfq,
          idProveedor,
          idCondicionPago: ids.condicionPago,
          idMoneda: ids.moneda,
          tasaCambio: 1,
          fechaVencimiento: inTwoWeeks,
          lineas: [
            {
              idSolicitudDetalle: state.idSolicitudDetalle,
              precioUnitario: PRECIOS.get(idProveedor),
              cantidad: 20,
              idUnidadMedida: ids.unidadMedida,
              porcentajeImpuesto: 12,
            },
          ],
        },
      });
      expect(res.statusCode).toBe(201);
      const det = (res.json() as { data: { details: { idCotizacionDetalle: number }[] } }).data
        .details[0]!;
      state.cotDetallePorProveedor.set(idProveedor, det.idCotizacionDetalle);
    }
    expect(state.cotDetallePorProveedor.size).toBe(3);
  });

  it("1. el comparativo muestra 3 cotizaciones y 3 proveedores participantes", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/comparativo/solicitud/${state.idSolicitud}`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const comp = (res.json() as { data: Record<string, unknown> }).data;
    expect(comp["totalCotizaciones"]).toBe(3);
    expect((comp["proveedoresParticipantes"] as unknown[]).length).toBe(3);
  });

  it("2. la línea marca exactamente un mejor precio y aún no hay adjudicada", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/comparativo/solicitud/${state.idSolicitud}`,
      headers: H,
    });
    const comp = (res.json() as {
      data: {
        lineas: {
          cotizaciones: { precioUnitario: number; esMejorPrecio: boolean; adjudicado: boolean }[];
          adjudicadaIdCotizacionDetalle: number | null;
        }[];
      };
    }).data;
    const linea = comp.lineas[0]!;
    expect(linea.cotizaciones.length).toBe(3);
    const mejores = linea.cotizaciones.filter((c) => c.esMejorPrecio);
    expect(mejores.length).toBe(1);
    expect(mejores[0]!.precioUnitario).toBeCloseTo(25.5);
    expect(linea.adjudicadaIdCotizacionDetalle).toBeNull();
  });

  it("3. registra dos criterios del director y quedan trazados", async () => {
    const ganadora = state.cotDetallePorProveedor.get(ids.proveedores[1]!)!;
    for (const [criterio, puntuacion] of [
      ["Precio", 9],
      ["Plazo de entrega", 7],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/com/comparativo/criterios",
        headers: H,
        payload: {
          idSolicitud: state.idSolicitud,
          idCotizacionDetalle: ganadora,
          criterio,
          puntuacion,
          notas: "Evaluado por el director",
        },
      });
      expect(res.statusCode).toBe(201);
    }

    const list = await app.inject({
      method: "GET",
      url: `/api/com/comparativo/solicitud/${state.idSolicitud}/criterios`,
      headers: H,
    });
    expect(list.statusCode).toBe(200);
    const criterios = (list.json() as { data: { criterio: string; proveedor: string }[] }).data;
    expect(criterios.length).toBe(2);
    expect(criterios.map((c) => c.criterio).sort()).toEqual(["Plazo de entrega", "Precio"]);
    expect(criterios.every((c) => c.proveedor.length > 0)).toBe(true);
  });

  it("4. adjudica la mejor cotización y el comparativo lo refleja", async () => {
    const ganadora = state.cotDetallePorProveedor.get(ids.proveedores[1]!)!;
    state.idCotizacionDetalleGanadora = ganadora;
    const adj = await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/detalle/${ganadora}/adjudicar`,
      headers: H,
    });
    expect(adj.statusCode).toBe(200);

    const res = await app.inject({
      method: "GET",
      url: `/api/com/comparativo/solicitud/${state.idSolicitud}`,
      headers: H,
    });
    const comp = (res.json() as {
      data: { lineas: { adjudicadaIdCotizacionDetalle: number | null }[] };
    }).data;
    expect(comp.lineas[0]!.adjudicadaIdCotizacionDetalle).toBe(ganadora);
  });
});

describe("Historial de precios por proveedor", () => {
  const proveedorGanador = (): number => ids.proveedores[1]!;

  it("prepara una compra completa (OC -> Recepcion) para alimentar la vista", async () => {
    const oc = await app.inject({
      method: "POST",
      url: "/api/com/ordenes-compra",
      headers: H,
      payload: {
        idProveedor: proveedorGanador(),
        idEmpleadoGerenteFinanciero: ids.empleado,
        idMoneda: ids.moneda,
        tasaCambio: 1,
        fechaEntregaEsperada: inTwoWeeks,
        idSolicitud: state.idSolicitud,
        lineas: [
          {
            idArticulo: ids.articulo,
            descripcion: "Artículo comparado",
            cantidad: 20,
            idUnidadMedida: ids.unidadMedida,
            idCotizacionDetalle: state.idCotizacionDetalleGanadora,
          },
        ],
      },
    });
    expect(oc.statusCode).toBe(201);
    const ocBody = oc.json() as {
      data: { header: { idOrdenCompra: number }; details: { idOcDetalle: number }[] };
    };
    const idOrdenCompra = ocBody.data.header.idOrdenCompra;
    const idOcDetalle = ocBody.data.details[0]!.idOcDetalle;

    for (const estado of ["ENVIADA", "EN_TRANSITO"]) {
      const r = await app.inject({
        method: "POST",
        url: `/api/com/ordenes-compra/${idOrdenCompra}/estado`,
        headers: H,
        payload: { estado },
      });
      expect(r.statusCode).toBe(200);
    }

    const rec = await app.inject({
      method: "POST",
      url: "/api/com/recepciones",
      headers: H,
      payload: {
        idOrdenCompra,
        idBodega: ids.bodega,
        idEmpleadoRecibe: ids.empleado,
        lineas: [{ idOcDetalle, cantidadRecibida: 20 }],
      },
    });
    expect(rec.statusCode).toBe(201);
  });

  it("1. devuelve filas y resumen para el proveedor ganador", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/historial-precios?idProveedor=${proveedorGanador()}&pageSize=50`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: { proveedor: string; precioAcordado: number }[];
      meta: { total: number };
      resumen: { registros: number; precioPromedio: number | null; precioMin: number | null };
    };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.resumen.registros).toBeGreaterThanOrEqual(1);
    expect(body.resumen.precioPromedio).not.toBeNull();
    expect(body.data.every((r) => r.proveedor.length > 0)).toBe(true);
  });

  it("2. el precio histórico coincide con el adjudicado (25.5)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/historial-precios?idProveedor=${proveedorGanador()}&idArticulo=${ids.articulo}&pageSize=50`,
      headers: H,
    });
    const body = res.json() as { data: { precioAcordado: number }[] };
    expect(body.data.some((r) => Math.abs(r.precioAcordado - 25.5) < 1e-6)).toBe(true);
  });

  it("3. filtra por rango de fechas (hoy incluido, ayer excluye todo)", async () => {
    const gt = (n: number): string => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Guatemala" });
    const hoy = gt(0);
    const ayer = gt(-1);

    const conHoy = await app.inject({
      method: "GET",
      url: `/api/com/historial-precios?idProveedor=${proveedorGanador()}&desde=${ayer}&hasta=${hoy}T23:59:59`,
      headers: H,
    });
    expect((conHoy.json() as { resumen: { registros: number } }).resumen.registros).toBeGreaterThanOrEqual(1);

    const soloAyer = await app.inject({
      method: "GET",
      url: `/api/com/historial-precios?idProveedor=${proveedorGanador()}&hasta=${ayer}`,
      headers: H,
    });
    expect((soloAyer.json() as { resumen: { registros: number } }).resumen.registros).toBe(0);
  });
});

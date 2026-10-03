/**
 * Test de INTEGRACION - Dashboard: series temporales + indice de ahorro.
 * Monta un ciclo completo (Solicitud -> Aprobacion x2 -> RFQ 3 prov -> 3
 * cotizaciones -> adjudicar la mas barata -> OC -> ENVIADA/EN_TRANSITO ->
 * Recepcion) y verifica que `GET /api/com/dashboard/resumen` refleje:
 *   - compras del mes (monto GTQ de OC emitidas) en el bucket del mes actual,
 *   - rotacion (entradas por compra / existencia valorizada) del mes actual,
 *   - ahorro de adjudicacion > 0 (adjudica 25.5 frente a un maximo de 30).
 * Ejecutar:  pnpm --filter backend test:int
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import oracledb from "oracledb";
import { SYS_HEADERS, oraclePool, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const H = SYS_HEADERS;
const inTwoWeeks = new Date(Date.now() + 14 * 864e5).toISOString();
const mesActual = new Date().toISOString().slice(0, 7); // "YYYY-MM" (UTC)

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
const PRECIOS = new Map<number, number>();

async function ensureBodega(sucursal: number): Promise<number> {
  const existing = await scalar("SELECT MIN(ID_BODEGA) V FROM INV_BODEGA WHERE ELIMINADO='N'");
  if (Number.isFinite(existing)) return existing;
  return oraclePool().withTransaction(async (c) => {
    const r = await c.execute(
      `INSERT INTO INV_BODEGA (ID_SUCURSAL, NOMBRE, TIPO, ESTADO)
       VALUES (:s, 'Bodega Dashboard Test', 'CENTRAL', 'A')
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

  const provRows = await oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ ID_PROVEEDOR: number }>(
      "SELECT ID_PROVEEDOR FROM COM_PROVEEDOR WHERE ELIMINADO='N' ORDER BY ID_PROVEEDOR FETCH FIRST 3 ROWS ONLY",
    );
    return (r.rows ?? []).map((x) => x.ID_PROVEEDOR);
  });
  ids.proveedores = provRows;
  PRECIOS.set(provRows[0]!, 30.0);
  PRECIOS.set(provRows[1]!, 25.5); // mejor precio -> se adjudica
  PRECIOS.set(provRows[2]!, 28.0);
});

afterAll(async () => {
  await stopTestApp(app);
});

describe("Dashboard: resumen agregado", () => {
  it("monta un ciclo completo hasta la recepcion", async () => {
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
          justificacion: "Ciclo dashboard (test)",
          prioridad: 1,
        },
        detalles: [
          {
            idArticulo: ids.articulo,
            descripcion: "Articulo dashboard",
            cantidadSolicitada: 20,
            idUnidadMedida: ids.unidadMedida,
            fechaRequerida: inTwoWeeks.slice(0, 10),
          },
        ],
      },
    });
    expect(sol.statusCode).toBe(201);
    const solBody = sol.json() as {
      data: { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
    };
    const idSolicitud = solBody.data.header.idSolicitud;
    const idSolicitudDetalle = solBody.data.details[0]!.idSolicitudDetalle;

    for (let i = 0; i < 2; i++) {
      const ap = await app.inject({
        method: "POST",
        url: `/api/com/solicitudes/${idSolicitud}/aprobar`,
        headers: H,
        payload: { idEmpleado: ids.empleado },
      });
      expect(ap.statusCode).toBe(200);
    }

    const rfq = await app.inject({
      method: "POST",
      url: "/api/com/rfq",
      headers: H,
      payload: {
        idSolicitud,
        fechaLimite: inTwoWeeks.slice(0, 10),
        proveedores: ids.proveedores,
      },
    });
    expect(rfq.statusCode).toBe(201);
    const idRfq = (rfq.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;

    const cotDetalle = new Map<number, number>();
    for (const idProveedor of ids.proveedores) {
      const res = await app.inject({
        method: "POST",
        url: "/api/com/cotizaciones",
        headers: H,
        payload: {
          idRfq,
          idProveedor,
          idCondicionPago: ids.condicionPago,
          idMoneda: ids.moneda,
          tasaCambio: 1,
          fechaVencimiento: inTwoWeeks,
          lineas: [
            {
              idSolicitudDetalle,
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
      cotDetalle.set(idProveedor, det.idCotizacionDetalle);
    }

    const ganadora = cotDetalle.get(ids.proveedores[1]!)!;
    const adj = await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/detalle/${ganadora}/adjudicar`,
      headers: H,
    });
    expect(adj.statusCode).toBe(200);

    const oc = await app.inject({
      method: "POST",
      url: "/api/com/ordenes-compra",
      headers: H,
      payload: {
        idProveedor: ids.proveedores[1],
        idEmpleadoGerenteFinanciero: ids.empleado,
        idMoneda: ids.moneda,
        tasaCambio: 1,
        fechaEntregaEsperada: inTwoWeeks,
        idSolicitud,
        lineas: [
          {
            idArticulo: ids.articulo,
            descripcion: "Articulo dashboard",
            cantidad: 20,
            idUnidadMedida: ids.unidadMedida,
            idCotizacionDetalle: ganadora,
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

  it("1. compras por mes: 12 buckets y el mes actual con monto y ordenes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/dashboard/resumen", headers: H });
    expect(res.statusCode).toBe(200);
    const d = (res.json() as { data: Record<string, unknown> }).data as {
      meses: number;
      comprasPorMes: { periodo: string; label: string; monto: number; ordenes: number }[];
    };
    expect(d.meses).toBe(12);
    expect(d.comprasPorMes.length).toBe(12);
    expect(d.comprasPorMes.at(-1)!.periodo).toBe(mesActual);
    expect(d.comprasPorMes.every((p) => p.label.length > 0)).toBe(true);
    const actual = d.comprasPorMes.find((p) => p.periodo === mesActual)!;
    expect(actual.ordenes).toBeGreaterThanOrEqual(1);
    // 20 u x 25.5 x (1 - 0) x tasa 1 = 510 como minimo aportado por este ciclo.
    expect(actual.monto).toBeGreaterThanOrEqual(510);
  });

  it("2. rotacion: existencia valorizada > 0 y serie mensual de 12 puntos", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/dashboard/resumen", headers: H });
    const d = (res.json() as { data: Record<string, unknown> }).data as {
      rotacion: {
        porMes: { periodo: string; valorEntradas: number; rotacion: number }[];
        existenciaValorizada: number;
        valorEntradas12m: number;
        rotacion12m: number;
      };
    };
    expect(d.rotacion.porMes.length).toBe(12);
    expect(d.rotacion.existenciaValorizada).toBeGreaterThan(0);
    expect(d.rotacion.valorEntradas12m).toBeGreaterThan(0);
    expect(d.rotacion.rotacion12m).toBeGreaterThanOrEqual(0);
    const actual = d.rotacion.porMes.find((p) => p.periodo === mesActual)!;
    expect(actual.valorEntradas).toBeGreaterThan(0);
  });

  it("3. ahorro de adjudicacion: adjudica 25.5 frente a un maximo de 30 -> ahorro > 0", async () => {
    const res = await app.inject({ method: "GET", url: "/api/com/dashboard/resumen", headers: H });
    const d = (res.json() as { data: Record<string, unknown> }).data as {
      ahorroAdjudicacion: {
        lineasAdjudicadas: number;
        lineasConAlternativa: number;
        ahorroPromedioPct: number;
        ahorroPonderadoPct: number;
        montoEvitado: number;
      };
    };
    expect(d.ahorroAdjudicacion.lineasAdjudicadas).toBeGreaterThanOrEqual(1);
    expect(d.ahorroAdjudicacion.lineasConAlternativa).toBeGreaterThanOrEqual(1);
    expect(d.ahorroAdjudicacion.ahorroPonderadoPct).toBeGreaterThan(0);
    expect(d.ahorroAdjudicacion.ahorroPonderadoPct).toBeLessThanOrEqual(100);
    expect(d.ahorroAdjudicacion.ahorroPromedioPct).toBeGreaterThan(0);
    expect(d.ahorroAdjudicacion.montoEvitado).toBeGreaterThan(0);
  });

  it("4. el parametro ?meses acota la ventana", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/com/dashboard/resumen?meses=6",
      headers: H,
    });
    const d = (res.json() as { data: Record<string, unknown> }).data as {
      meses: number;
      comprasPorMes: unknown[];
      rotacion: { porMes: unknown[] };
    };
    expect(d.meses).toBe(6);
    expect(d.comprasPorMes.length).toBe(6);
    expect(d.rotacion.porMes.length).toBe(6);
  });
});

/**
 * Test de INTEGRACION end-to-end del flujo completo de compras contra Oracle
 * local. Ejecutar:  pnpm exec vitest run --config vitest.int.config.ts
 *
 * Recorrido: Solicitud -> Aprobacion (x2) -> RFQ -> Cotizacion -> Adjudicacion
 *            -> Orden de Compra (precio via Strategy) -> cambios de estado
 *            -> Recepcion -> (Observer) Kardex + CxP -> Devolucion.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import oracledb from "oracledb";
import type { FastifyInstance } from "fastify";

const envRaw = readFileSync(resolve(process.cwd(), "../.env"), "utf8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim();
}

const { oraclePool } = await import("../src/dal/OraclePool.js");
const { registerComprasSubscribers } = await import(
  "../src/bll/compras/subscribers/index.js"
);
const { buildApp } = await import("../src/app.js");

let app: FastifyInstance;
const H = { "x-dev-user": "0" };

interface Ids {
  sucursal: number;
  empleado: number;
  articulo: number;
  unidadMedida: number;
  grupoCompra: number;
  terminoEntrega: number;
  moneda: number;
  condicionPago: number;
  proveedor: number;
  proveedores: number[];
  bodega: number;
}
const ids = {} as Ids;

async function scalar(sql: string): Promise<number> {
  return oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ V: number | null }>(sql);
    const v = r.rows?.[0]?.V;
    return v === null || v === undefined ? Number.NaN : Number(v);
  });
}

beforeAll(async () => {
  await oraclePool().init();
  registerComprasSubscribers();
  app = await buildApp();
  await app.ready();

  ids.sucursal = await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  ids.empleado = await scalar("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'");
  ids.articulo = await scalar("SELECT MIN(ID_ARTICULO) V FROM INV_ARTICULO WHERE ELIMINADO='N'");
  ids.unidadMedida = await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
  ids.grupoCompra = await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  ids.terminoEntrega = await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  ids.moneda = await scalar("SELECT MIN(ID_MONEDA) V FROM COM_MONEDA WHERE ELIMINADO='N'");
  ids.condicionPago = await scalar("SELECT MIN(ID_CONDICION_PAGO) V FROM COM_CONDICION_PAGO WHERE ELIMINADO='N'");
  // El flujo exige tres cotizaciones: se necesitan >= 3 proveedores distintos.
  ids.proveedores = await oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ ID_PROVEEDOR: number }>(
      "SELECT ID_PROVEEDOR FROM COM_PROVEEDOR WHERE ELIMINADO='N' ORDER BY ID_PROVEEDOR FETCH FIRST 3 ROWS ONLY",
    );
    return (r.rows ?? []).map((x) => Number(x.ID_PROVEEDOR));
  });
  ids.proveedor = ids.proveedores[0]!;

  // Asegurar una bodega (la unica dependencia de master data que falta).
  const bodega = await scalar("SELECT MIN(ID_BODEGA) V FROM INV_BODEGA WHERE ELIMINADO='N'");
  if (Number.isFinite(bodega)) {
    ids.bodega = bodega;
  } else {
    ids.bodega = await oraclePool().withTransaction(async (c) => {
      const r = await c.execute(
        `INSERT INTO INV_BODEGA (ID_SUCURSAL, NOMBRE, TIPO, ESTADO)
         VALUES (:s, 'Bodega Central Test', 'CENTRAL', 'A')
         RETURNING ID_BODEGA INTO :id`,
        { s: ids.sucursal, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      );
      const out = r.outBinds as { id: number[] };
      return out.id[0] as number;
    });
  }
});

afterAll(async () => {
  await app.close();
  await oraclePool().close();
});

describe("Flujo de compras end-to-end", () => {
  const inTwoWeeks = new Date(Date.now() + 14 * 864e5).toISOString();
  let idSolicitud = 0;
  let idSolicitudDetalle = 0;
  let idRfq = 0;
  let idCotizacionDetalle = 0;
  let idOrdenCompra = 0;
  let idOcDetalle = 0;
  let idRecepcion = 0;
  let idRecepcionDetalle = 0;

  it("crea una solicitud de compra con detalle", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/solicitudes",
      headers: H,
      payload: {
        cabecera: {
          idEmpleadoSolicitante: ids.empleado,
          idSucursal: ids.sucursal,
          idGrupoCompra: ids.grupoCompra,
          idTerminoEntrega: ids.terminoEntrega,
          justificacion: "Reposicion de stock (test e2e)",
          prioridad: 2,
        },
        detalles: [
          {
            idArticulo: ids.articulo,
            descripcion: "Articulo de prueba",
            cantidadSolicitada: 10,
            idUnidadMedida: ids.unidadMedida,
            fechaRequerida: inTwoWeeks.slice(0, 10),
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      data: { header: { idSolicitud: number; estado: string }; details: { idSolicitudDetalle: number }[] };
    };
    expect(body.data.header.estado).toBe("PENDIENTE_JEFE");
    idSolicitud = body.data.header.idSolicitud;
    idSolicitudDetalle = body.data.details[0]!.idSolicitudDetalle;
  });

  it("aprueba en dos niveles hasta EN_COTIZACION", async () => {
    const a1 = await app.inject({
      method: "POST",
      url: `/api/com/solicitudes/${idSolicitud}/aprobar`,
      headers: H,
      payload: { idEmpleado: ids.empleado, comentario: "OK jefe" },
    });
    expect(a1.statusCode).toBe(200);
    expect((a1.json() as { data: { estado: string } }).data.estado).toBe("PENDIENTE_GERENTE");

    const a2 = await app.inject({
      method: "POST",
      url: `/api/com/solicitudes/${idSolicitud}/aprobar`,
      headers: H,
      payload: { idEmpleado: ids.empleado, comentario: "OK gerente" },
    });
    expect(a2.statusCode).toBe(200);
    expect((a2.json() as { data: { estado: string } }).data.estado).toBe("EN_COTIZACION");
  });

  it("registra la bitacora de aprobacion en COM_WORKFLOW_APROBACION", async () => {
    const n = await scalar(
      `SELECT COUNT(*) V FROM COM_WORKFLOW_APROBACION WHERE ID_SOLICITUD = ${idSolicitud}`,
    );
    expect(n).toBeGreaterThanOrEqual(3); // creada + 2 aprobaciones
  });

  it("abre un RFQ e invita a los tres proveedores", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/rfq",
      headers: H,
      payload: {
        idSolicitud,
        fechaLimite: inTwoWeeks.slice(0, 10),
        proveedores: ids.proveedores,
      },
    });
    expect(res.statusCode).toBe(201);
    idRfq = (res.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;
  });

  it("registra una cotizacion y adjudica la linea", async () => {
    const cot = await app.inject({
      method: "POST",
      url: "/api/com/cotizaciones",
      headers: H,
      payload: {
        idRfq,
        idProveedor: ids.proveedor,
        idCondicionPago: ids.condicionPago,
        idMoneda: ids.moneda,
        tasaCambio: 1,
        fechaVencimiento: inTwoWeeks,
        lineas: [
          {
            idSolicitudDetalle,
            precioUnitario: 25.5,
            cantidad: 10,
            idUnidadMedida: ids.unidadMedida,
            porcentajeImpuesto: 12,
          },
        ],
      },
    });
    expect(cot.statusCode).toBe(201);
    idCotizacionDetalle = (
      cot.json() as { data: { details: { idCotizacionDetalle: number }[] } }
    ).data.details[0]!.idCotizacionDetalle;

    const adj = await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/detalle/${idCotizacionDetalle}/adjudicar`,
      headers: H,
    });
    expect(adj.statusCode).toBe(200);
    expect((adj.json() as { data: { adjudicado: boolean } }).data.adjudicado).toBe(true);
  });

  it("genera la orden de compra tomando el precio de la cotizacion adjudicada (Strategy)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/ordenes-compra",
      headers: H,
      payload: {
        idProveedor: ids.proveedor,
        idEmpleadoGerenteFinanciero: ids.empleado,
        idMoneda: ids.moneda,
        tasaCambio: 1,
        fechaEntregaEsperada: inTwoWeeks,
        idSolicitud,
        lineas: [
          {
            idArticulo: ids.articulo,
            descripcion: "Articulo de prueba",
            cantidad: 10,
            idUnidadMedida: ids.unidadMedida,
            idCotizacionDetalle,
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      data: {
        header: { idOrdenCompra: number; estado: string };
        details: { idOcDetalle: number; precioUnitario: number; subtotalCalculado: number }[];
      };
    };
    expect(body.data.header.estado).toBe("EMITIDA");
    const linea = body.data.details[0]!;
    expect(linea.precioUnitario).toBeCloseTo(25.5);
    // columna VIRTUAL de Oracle: 10 * 25.5 * (1 - 0/100)
    expect(linea.subtotalCalculado).toBeCloseTo(255);
    idOrdenCompra = body.data.header.idOrdenCompra;
    idOcDetalle = linea.idOcDetalle;

    const sol = await scalar(
      `SELECT DECODE(ESTADO,'ORDEN_GENERADA',1,0) V FROM COM_SOLICITUD_COMPRA WHERE ID_SOLICITUD = ${idSolicitud}`,
    );
    expect(sol).toBe(1);
  });

  it("avanza el estado de la OC segun la maquina de estados", async () => {
    for (const estado of ["ENVIADA", "EN_TRANSITO"]) {
      const res = await app.inject({
        method: "POST",
        url: `/api/com/ordenes-compra/${idOrdenCompra}/estado`,
        headers: H,
        payload: { estado },
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: { estado: string } }).data.estado).toBe(estado);
    }

    const rechazo = await app.inject({
      method: "POST",
      url: `/api/com/ordenes-compra/${idOrdenCompra}/estado`,
      headers: H,
      payload: { estado: "EMITIDA" },
    });
    expect(rechazo.statusCode).toBe(409); // transicion no permitida
  });

  it("registra la recepcion total y cierra la OC como RECIBIDA_COMPLETA", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/recepciones",
      headers: H,
      payload: {
        idOrdenCompra,
        idBodega: ids.bodega,
        idEmpleadoRecibe: ids.empleado,
        lineas: [{ idOcDetalle, cantidadRecibida: 10 }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      data: { header: { idRecepcion: number }; details: { idRecepcionDetalle: number }[] };
    };
    idRecepcion = body.data.header.idRecepcion;
    idRecepcionDetalle = body.data.details[0]!.idRecepcionDetalle;

    const oc = await scalar(
      `SELECT DECODE(ESTADO,'RECIBIDA_COMPLETA',1,0) V FROM COM_ORDEN_COMPRA WHERE ID_ORDEN_COMPRA = ${idOrdenCompra}`,
    );
    expect(oc).toBe(1);
  });

  it("el Observer alimento el kardex y genero la factura de CxP", async () => {
    const kardex = await scalar(
      `SELECT COUNT(*) V FROM INV_KARDEX_MOVIMIENTO
       WHERE TIPO_DOCUMENTO_REF = 'COM_RECEPCION' AND ID_DOCUMENTO_REF = ${idRecepcion}`,
    );
    expect(kardex).toBe(1);

    const factura = await scalar(
      `SELECT COUNT(*) V FROM CXP_FACTURA_PROVEEDOR WHERE ID_RECEPCION = ${idRecepcion}`,
    );
    expect(factura).toBe(1);

    const recepcionAlimentada = await scalar(
      `SELECT DECODE(ESTADO,'ALIMENTADO_CXP',1,0) V FROM COM_RECEPCION WHERE ID_RECEPCION = ${idRecepcion}`,
    );
    expect(recepcionAlimentada).toBe(1);
  });

  it("registra una devolucion parcial al proveedor", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/devoluciones",
      headers: H,
      payload: {
        idRecepcion,
        motivo: "Producto danado (test)",
        idEmpleadoSolicita: ids.empleado,
        lineas: [{ idRecepcionDetalle, cantidadDevuelta: 2 }],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(
      (res.json() as { data: { details: unknown[] } }).data.details.length,
    ).toBe(1);
  });

  it("rechaza devolver mas de lo recibido (regla de negocio)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/devoluciones",
      headers: H,
      payload: {
        idRecepcion,
        motivo: "Exceso",
        idEmpleadoSolicita: ids.empleado,
        lineas: [{ idRecepcionDetalle, cantidadDevuelta: 999 }],
      },
    });
    expect(res.statusCode).toBe(409);
  });
});

/**
 * Test de INTEGRACION - Adjuntos de documentos (MinIO/FileStorage) + CRUD
 * completo de cotizaciones (PUT / DELETE con cerrojo por estado).
 *
 * Requiere, ademas de Oracle, un almacenamiento S3 compatible arriba:
 *   `pnpm minio`  (MinIO local en :9000, bucket com-adjuntos) o un S3 real.
 * Si S3 no esta configurado el backend usa memoria y el test igual pasa.
 *
 * Ejecutar:  pnpm --filter backend test:int
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import oracledb from "oracledb";
import { SYS_HEADERS, oraclePool, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

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
  proveedores: number[];
}
const ids = {} as Ids;

const state = {
  idSolicitud: 0,
  idSolicitudDetalle: 0,
  idRfq: 0,
  idCotA: 0,
  idCotB: 0,
  cotDetalleA: 0,
};

function multipart(
  filename: string,
  mime: string,
  content: Buffer,
): { headers: Record<string, string>; payload: Buffer } {
  const boundary = "----vitest" + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([head, content, tail]),
  };
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
  void oracledb;
  const provRows = await oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ ID_PROVEEDOR: number }>(
      "SELECT ID_PROVEEDOR FROM COM_PROVEEDOR WHERE ELIMINADO='N' ORDER BY ID_PROVEEDOR FETCH FIRST 3 ROWS ONLY",
    );
    return (r.rows ?? []).map((x) => x.ID_PROVEEDOR);
  });
  ids.proveedores = provRows;

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
        justificacion: "Adjuntos + CRUD (test)",
        prioridad: 1,
      },
      detalles: [
        {
          idArticulo: ids.articulo,
          descripcion: "Artículo adjuntos",
          cantidadSolicitada: 10,
          idUnidadMedida: ids.unidadMedida,
          fechaRequerida: inTwoWeeks.slice(0, 10),
        },
      ],
    },
  });
  const sb = sol.json() as {
    data: { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
  };
  state.idSolicitud = sb.data.header.idSolicitud;
  state.idSolicitudDetalle = sb.data.details[0]!.idSolicitudDetalle;
  for (let i = 0; i < 2; i++) {
    await app.inject({
      method: "POST",
      url: `/api/com/solicitudes/${state.idSolicitud}/aprobar`,
      headers: H,
      payload: { idEmpleado: ids.empleado },
    });
  }
  const rfq = await app.inject({
    method: "POST",
    url: "/api/com/rfq",
    headers: H,
    payload: { idSolicitud: state.idSolicitud, fechaLimite: inTwoWeeks.slice(0, 10), proveedores: ids.proveedores },
  });
  state.idRfq = (rfq.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;

  const mkCot = async (idProveedor: number, precio: number): Promise<{ id: number; det: number }> => {
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
            precioUnitario: precio,
            cantidad: 10,
            idUnidadMedida: ids.unidadMedida,
          },
        ],
      },
    });
    const b = res.json() as {
      data: { header: { idCotizacion: number }; details: { idCotizacionDetalle: number }[] };
    };
    return { id: b.data.header.idCotizacion, det: b.data.details[0]!.idCotizacionDetalle };
  };
  const a = await mkCot(ids.proveedores[0]!, 20);
  const b = await mkCot(ids.proveedores[1]!, 18);
  state.idCotA = a.id;
  state.cotDetalleA = a.det;
  state.idCotB = b.id;
});

afterAll(async () => {
  await stopTestApp(app);
});

describe("Adjuntos de cotizaciones", () => {
  let ref = "";

  it("1. sube un PDF y aparece en el listado", async () => {
    const mp = multipart("oferta.pdf", "application/pdf", Buffer.from("%PDF-1.4 contenido de prueba"));
    const res = await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/${state.idCotA}/adjuntos`,
      headers: { ...H, ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(201);
    const meta = (res.json() as { data: { ref: string; nombre: string; mime: string; bytes: number } }).data;
    expect(meta.nombre).toBe("oferta.pdf");
    expect(meta.mime).toBe("application/pdf");
    expect(meta.bytes).toBeGreaterThan(0);
    ref = meta.ref;

    const list = await app.inject({
      method: "GET",
      url: `/api/com/cotizaciones/${state.idCotA}/adjuntos`,
      headers: H,
    });
    expect(list.statusCode).toBe(200);
    const items = (list.json() as { data: { ref: string }[] }).data;
    expect(items.some((x) => x.ref === ref)).toBe(true);
  });

  it("2. descarga el binario tal cual se subio", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/cotizaciones/${state.idCotA}/adjuntos/${encodeURIComponent(ref)}`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.body).toContain("%PDF-1.4");
  });

  it("3. rechaza un tipo de archivo no permitido (422)", async () => {
    const mp = multipart("notas.txt", "text/plain", Buffer.from("hola"));
    const res = await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/${state.idCotA}/adjuntos`,
      headers: { ...H, ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(422);
  });

  it("4. elimina el adjunto y desaparece del listado", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: `/api/com/cotizaciones/${state.idCotA}/adjuntos/${encodeURIComponent(ref)}`,
      headers: H,
    });
    expect(del.statusCode).toBe(204);
    const list = await app.inject({
      method: "GET",
      url: `/api/com/cotizaciones/${state.idCotA}/adjuntos`,
      headers: H,
    });
    expect((list.json() as { data: unknown[] }).data.length).toBe(0);
  });

  it("5. adjuntar a una cotización inexistente da 404", async () => {
    const mp = multipart("x.pdf", "application/pdf", Buffer.from("%PDF-1.4"));
    const res = await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/99999999/adjuntos`,
      headers: { ...H, ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("CRUD de cotizaciones con cerrojo por estado", () => {
  it("1. PUT edita la cabecera mientras el RFQ está ABIERTO", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/com/cotizaciones/${state.idCotB}`,
      headers: H,
      payload: { tasaCambio: 7.85 },
    });
    expect(res.statusCode).toBe(200);
    const hdr = (res.json() as { data: { header: { tasaCambio: number } } }).data.header;
    expect(Number(hdr.tasaCambio)).toBeCloseTo(7.85);
  });

  it("1b. PUT reemplaza las líneas de la cotización (RFQ abierto, sin adjudicar)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/com/cotizaciones/${state.idCotB}`,
      headers: H,
      payload: {
        lineas: [
          {
            idSolicitudDetalle: state.idSolicitudDetalle,
            precioUnitario: 15.25,
            cantidad: 8,
            idUnidadMedida: ids.unidadMedida,
            porcentajeDescuento: 5,
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const det = (
      res.json() as { data: { details: { precioUnitario: number; cantidad: number }[] } }
    ).data.details;
    expect(det.length).toBe(1);
    expect(Number(det[0]!.precioUnitario)).toBeCloseTo(15.25);
    expect(Number(det[0]!.cantidad)).toBeCloseTo(8);
  });

  it("2. DELETE (borrado logico) de una cotizacion sin adjudicar", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/com/cotizaciones/${state.idCotB}`,
      headers: H,
    });
    expect(res.statusCode).toBe(204);
    const get = await app.inject({
      method: "GET",
      url: `/api/com/cotizaciones/${state.idCotB}`,
      headers: H,
    });
    expect(get.statusCode).toBe(404);
  });

  it("3. tras adjudicar una linea, PUT y DELETE quedan bloqueados (409)", async () => {
    const adj = await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/detalle/${state.cotDetalleA}/adjudicar`,
      headers: H,
    });
    expect(adj.statusCode).toBe(200);

    const put = await app.inject({
      method: "PUT",
      url: `/api/com/cotizaciones/${state.idCotA}`,
      headers: H,
      payload: { tasaCambio: 2 },
    });
    expect(put.statusCode).toBe(409);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/com/cotizaciones/${state.idCotA}`,
      headers: H,
    });
    expect(del.statusCode).toBe(409);
  });
});

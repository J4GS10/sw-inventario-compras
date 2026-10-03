/**
 * Test de INTEGRACION:
 *  - Adjuntos de documentos sobre DEVOLUCION a proveedor (mismo patron que los
 *    otros 4 documentos; MinIO/FileStorage o memoria).
 *  - Reversa de una recepcion que YA alimento CxP: anula la factura de
 *    proveedor, compensa el kardex con AJUSTE_NEGATIVO y deja la recepcion con
 *    borrado logico. Cerrojos: sin devoluciones y factura sin pagos.
 *
 * Requiere Oracle local + (opcional) un S3 (`pnpm minio`). Sin S3 usa memoria.
 * Ejecutar:  pnpm --filter backend test:int
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
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
  bodega: number;
  proveedores: number[];
}
const ids = {} as Ids;

const s = {
  idSolicitud: 0,
  idSolicitudDetalle: 0,
  idRfq: 0,
  cotDetalle: 0,
  idOrdenCompra: 0,
  idOcDetalle: 0,
  idRecepcionA: 0,
  idRecepcionB: 0,
  idRecepcionDetalleB: 0,
  idDevolucion: 0,
  facturaA: 0,
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
  ids.bodega = await scalar("SELECT MIN(ID_BODEGA) V FROM INV_BODEGA WHERE ELIMINADO='N'");
  ids.proveedores = await oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ ID_PROVEEDOR: number }>(
      "SELECT ID_PROVEEDOR FROM COM_PROVEEDOR WHERE ELIMINADO='N' ORDER BY ID_PROVEEDOR FETCH FIRST 3 ROWS ONLY",
    );
    return (r.rows ?? []).map((x) => Number(x.ID_PROVEEDOR));
  });

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
        justificacion: "Reversa + adjuntos devolucion (test)",
        prioridad: 2,
      },
      detalles: [
        {
          idArticulo: ids.articulo,
          descripcion: "Articulo reversa",
          cantidadSolicitada: 20,
          idUnidadMedida: ids.unidadMedida,
          fechaRequerida: inTwoWeeks.slice(0, 10),
        },
      ],
    },
  });
  const sb = sol.json() as {
    data: { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
  };
  s.idSolicitud = sb.data.header.idSolicitud;
  s.idSolicitudDetalle = sb.data.details[0]!.idSolicitudDetalle;

  for (let i = 0; i < 2; i++) {
    await app.inject({
      method: "POST",
      url: `/api/com/solicitudes/${s.idSolicitud}/aprobar`,
      headers: H,
      payload: { idEmpleado: ids.empleado },
    });
  }

  const rfq = await app.inject({
    method: "POST",
    url: "/api/com/rfq",
    headers: H,
    payload: {
      idSolicitud: s.idSolicitud,
      fechaLimite: inTwoWeeks.slice(0, 10),
      proveedores: ids.proveedores,
    },
  });
  s.idRfq = (rfq.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;

  const cot = await app.inject({
    method: "POST",
    url: "/api/com/cotizaciones",
    headers: H,
    payload: {
      idRfq: s.idRfq,
      idProveedor: ids.proveedores[0],
      idCondicionPago: ids.condicionPago,
      idMoneda: ids.moneda,
      tasaCambio: 1,
      fechaVencimiento: inTwoWeeks,
      lineas: [
        {
          idSolicitudDetalle: s.idSolicitudDetalle,
          precioUnitario: 25,
          cantidad: 20,
          idUnidadMedida: ids.unidadMedida,
        },
      ],
    },
  });
  s.cotDetalle = (
    cot.json() as { data: { details: { idCotizacionDetalle: number }[] } }
  ).data.details[0]!.idCotizacionDetalle;

  await app.inject({
    method: "POST",
    url: `/api/com/cotizaciones/detalle/${s.cotDetalle}/adjudicar`,
    headers: H,
  });

  const oc = await app.inject({
    method: "POST",
    url: "/api/com/ordenes-compra",
    headers: H,
    payload: {
      idProveedor: ids.proveedores[0],
      idEmpleadoGerenteFinanciero: ids.empleado,
      idMoneda: ids.moneda,
      tasaCambio: 1,
      fechaEntregaEsperada: inTwoWeeks,
      idSolicitud: s.idSolicitud,
      lineas: [
        {
          idArticulo: ids.articulo,
          descripcion: "Articulo reversa",
          cantidad: 20,
          idUnidadMedida: ids.unidadMedida,
          idCotizacionDetalle: s.cotDetalle,
        },
      ],
    },
  });
  const ob = oc.json() as {
    data: { header: { idOrdenCompra: number }; details: { idOcDetalle: number }[] };
  };
  s.idOrdenCompra = ob.data.header.idOrdenCompra;
  s.idOcDetalle = ob.data.details[0]!.idOcDetalle;

  await app.inject({
    method: "POST",
    url: `/api/com/ordenes-compra/${s.idOrdenCompra}/estado`,
    headers: H,
    payload: { estado: "ENVIADA" },
  });

  const mkRecepcion = async (): Promise<{ id: number; det: number }> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/recepciones",
      headers: H,
      payload: {
        idOrdenCompra: s.idOrdenCompra,
        idBodega: ids.bodega,
        idEmpleadoRecibe: ids.empleado,
        lineas: [{ idOcDetalle: s.idOcDetalle, cantidadRecibida: 10 }],
      },
    });
    const b = res.json() as {
      data: { header: { idRecepcion: number }; details: { idRecepcionDetalle: number }[] };
    };
    return { id: b.data.header.idRecepcion, det: b.data.details[0]!.idRecepcionDetalle };
  };
  const a = await mkRecepcion();
  const b = await mkRecepcion();
  s.idRecepcionA = a.id;
  s.idRecepcionB = b.id;
  s.idRecepcionDetalleB = b.det;
});

afterAll(async () => {
  await stopTestApp(app);
});

describe("Adjuntos en devolucion a proveedor", () => {
  let ref = "";

  it("1. registra una devolucion contra la recepcion B", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/com/devoluciones",
      headers: H,
      payload: {
        idRecepcion: s.idRecepcionB,
        motivo: "Producto danado (test)",
        idEmpleadoSolicita: ids.empleado,
        lineas: [{ idRecepcionDetalle: s.idRecepcionDetalleB, cantidadDevuelta: 2 }],
      },
    });
    expect(res.statusCode).toBe(201);
    s.idDevolucion = (res.json() as { data: { header: { idDevolucion: number } } }).data.header.idDevolucion;
    expect(s.idDevolucion).toBeGreaterThan(0);
  });

  it("2. sube un PDF a la devolucion y aparece en el listado", async () => {
    const mp = multipart("nota-devolucion.pdf", "application/pdf", Buffer.from("%PDF-1.4 devolucion"));
    const res = await app.inject({
      method: "POST",
      url: `/api/com/devoluciones/${s.idDevolucion}/adjuntos`,
      headers: { ...H, ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(201);
    const meta = (res.json() as { data: { ref: string; mime: string; bytes: number } }).data;
    expect(meta.mime).toBe("application/pdf");
    expect(meta.bytes).toBeGreaterThan(0);
    ref = meta.ref;

    const list = await app.inject({
      method: "GET",
      url: `/api/com/devoluciones/${s.idDevolucion}/adjuntos`,
      headers: H,
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { data: { ref: string }[] }).data.some((x) => x.ref === ref)).toBe(true);
  });

  it("3. descarga el binario tal cual se subio", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/devoluciones/${s.idDevolucion}/adjuntos/${encodeURIComponent(ref)}`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.body).toContain("%PDF-1.4");
  });

  it("4. lo previsualiza inline (Content-Disposition: inline)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/com/devoluciones/${s.idDevolucion}/adjuntos/${encodeURIComponent(ref)}?disposition=inline`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-disposition"])).toContain("inline");
  });

  it("5. elimina el adjunto y desaparece del listado", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: `/api/com/devoluciones/${s.idDevolucion}/adjuntos/${encodeURIComponent(ref)}`,
      headers: H,
    });
    expect(del.statusCode).toBe(204);
    const list = await app.inject({
      method: "GET",
      url: `/api/com/devoluciones/${s.idDevolucion}/adjuntos`,
      headers: H,
    });
    expect((list.json() as { data: unknown[] }).data.length).toBe(0);
  });

  it("6. adjuntar a una devolucion inexistente da 404", async () => {
    const mp = multipart("x.pdf", "application/pdf", Buffer.from("%PDF-1.4"));
    const res = await app.inject({
      method: "POST",
      url: `/api/com/devoluciones/99999999/adjuntos`,
      headers: { ...H, ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("Reversa de recepcion que ya alimento CxP", () => {
  it("1. la recepcion A esta ALIMENTADO_CXP con factura y kardex", async () => {
    const alimentada = await scalar(
      `SELECT DECODE(ESTADO,'ALIMENTADO_CXP',1,0) V FROM COM_RECEPCION WHERE ID_RECEPCION = ${s.idRecepcionA}`,
    );
    expect(alimentada).toBe(1);
    s.facturaA = await scalar(
      `SELECT MAX(ID_FACTURA_PROVEEDOR) V FROM CXP_FACTURA_PROVEEDOR WHERE ID_RECEPCION = ${s.idRecepcionA} AND ELIMINADO='N'`,
    );
    expect(s.facturaA).toBeGreaterThan(0);
    const kardex = await scalar(
      `SELECT COUNT(*) V FROM INV_KARDEX_MOVIMIENTO WHERE TIPO_DOCUMENTO_REF='COM_RECEPCION' AND ID_DOCUMENTO_REF = ${s.idRecepcionA}`,
    );
    expect(kardex).toBe(1);
  });

  it("2. reversa la recepcion A: anula la factura, compensa el kardex y borra logico", async () => {
    const existenciaAntes = await scalar(
      `SELECT NVL(SUM(CANTIDAD_ACTUAL),0) V FROM INV_EXISTENCIA_BODEGA WHERE ID_ARTICULO = ${ids.articulo} AND ID_BODEGA = ${ids.bodega}`,
    );

    const res = await app.inject({
      method: "POST",
      url: `/api/com/recepciones/${s.idRecepcionA}/reversar`,
      headers: H,
    });
    expect(res.statusCode).toBe(200);
    const data = (res.json() as { data: { idFacturaAnulada: number | null } }).data;
    expect(data.idFacturaAnulada).toBe(s.facturaA);

    const recepBorrada = await scalar(
      `SELECT DECODE(ELIMINADO,'S',1,0) V FROM COM_RECEPCION WHERE ID_RECEPCION = ${s.idRecepcionA}`,
    );
    expect(recepBorrada).toBe(1);

    const facturaAnulada = await scalar(
      `SELECT DECODE(ESTADO,'ANULADA',1,0) V FROM CXP_FACTURA_PROVEEDOR WHERE ID_FACTURA_PROVEEDOR = ${s.facturaA}`,
    );
    expect(facturaAnulada).toBe(1);
    const facturaBorrada = await scalar(
      `SELECT DECODE(ELIMINADO,'S',1,0) V FROM CXP_FACTURA_PROVEEDOR WHERE ID_FACTURA_PROVEEDOR = ${s.facturaA}`,
    );
    expect(facturaBorrada).toBe(1);

    const ajuste = await scalar(
      `SELECT COUNT(*) V FROM INV_KARDEX_MOVIMIENTO
       WHERE TIPO_MOVIMIENTO='AJUSTE_NEGATIVO' AND TIPO_DOCUMENTO_REF='COM_RECEPCION_REVERSA'
         AND ID_DOCUMENTO_REF = ${s.idRecepcionA}`,
    );
    expect(ajuste).toBe(1);

    const existenciaDespues = await scalar(
      `SELECT NVL(SUM(CANTIDAD_ACTUAL),0) V FROM INV_EXISTENCIA_BODEGA WHERE ID_ARTICULO = ${ids.articulo} AND ID_BODEGA = ${ids.bodega}`,
    );
    expect(existenciaDespues).toBeCloseTo(existenciaAntes - 10, 2);

    // La OC (linea de 20) solo tiene ya los 10 de la recepcion B -> RECIBIDA_PARCIAL
    // (antes de este fix quedaba encallada en RECIBIDA_COMPLETA).
    const ocParcial = await scalar(
      `SELECT DECODE(ESTADO,'RECIBIDA_PARCIAL',1,0) V FROM COM_ORDEN_COMPRA WHERE ID_ORDEN_COMPRA = ${s.idOrdenCompra}`,
    );
    expect(ocParcial).toBe(1);
  });

  it("3. reversar de nuevo la recepcion A da 404 (ya no existe)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/com/recepciones/${s.idRecepcionA}/reversar`,
      headers: H,
    });
    expect(res.statusCode).toBe(404);
  });

  it("4. no se puede reversar la recepcion B: tiene una devolucion registrada (409)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/com/recepciones/${s.idRecepcionB}/reversar`,
      headers: H,
    });
    expect(res.statusCode).toBe(409);
  });
});

describe("Rollback completo del estado de la OC (sin recepciones activas -> ENVIADA)", () => {
  it("una OC recibida al 100% y luego reversada vuelve a ENVIADA y admite recibir de nuevo", async () => {
    // Ciclo aparte, mas simple: una sola linea, una sola recepcion total.
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
          justificacion: "Rollback total de OC (test)",
          prioridad: 3,
        },
        detalles: [
          {
            idArticulo: ids.articulo,
            descripcion: "Articulo rollback total",
            cantidadSolicitada: 5,
            idUnidadMedida: ids.unidadMedida,
            fechaRequerida: inTwoWeeks.slice(0, 10),
          },
        ],
      },
    });
    const sb = sol.json() as {
      data: { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
    };
    const idSolicitud = sb.data.header.idSolicitud;
    const idSolicitudDetalle = sb.data.details[0]!.idSolicitudDetalle;
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: "POST",
        url: `/api/com/solicitudes/${idSolicitud}/aprobar`,
        headers: H,
        payload: { idEmpleado: ids.empleado },
      });
    }
    const rfq = await app.inject({
      method: "POST",
      url: "/api/com/rfq",
      headers: H,
      payload: { idSolicitud, fechaLimite: inTwoWeeks.slice(0, 10), proveedores: ids.proveedores },
    });
    const idRfq = (rfq.json() as { data: { header: { idRfq: number } } }).data.header.idRfq;
    const cot = await app.inject({
      method: "POST",
      url: "/api/com/cotizaciones",
      headers: H,
      payload: {
        idRfq,
        idProveedor: ids.proveedores[0],
        idCondicionPago: ids.condicionPago,
        idMoneda: ids.moneda,
        tasaCambio: 1,
        fechaVencimiento: inTwoWeeks,
        lineas: [{ idSolicitudDetalle, precioUnitario: 12, cantidad: 5, idUnidadMedida: ids.unidadMedida }],
      },
    });
    const cotDetalle = (
      cot.json() as { data: { details: { idCotizacionDetalle: number }[] } }
    ).data.details[0]!.idCotizacionDetalle;
    await app.inject({
      method: "POST",
      url: `/api/com/cotizaciones/detalle/${cotDetalle}/adjudicar`,
      headers: H,
    });
    const oc = await app.inject({
      method: "POST",
      url: "/api/com/ordenes-compra",
      headers: H,
      payload: {
        idProveedor: ids.proveedores[0],
        idEmpleadoGerenteFinanciero: ids.empleado,
        idMoneda: ids.moneda,
        tasaCambio: 1,
        fechaEntregaEsperada: inTwoWeeks,
        idSolicitud,
        lineas: [
          {
            idArticulo: ids.articulo,
            descripcion: "Articulo rollback total",
            cantidad: 5,
            idUnidadMedida: ids.unidadMedida,
            idCotizacionDetalle: cotDetalle,
          },
        ],
      },
    });
    const ob = oc.json() as {
      data: { header: { idOrdenCompra: number }; details: { idOcDetalle: number }[] };
    };
    const idOrdenCompra = ob.data.header.idOrdenCompra;
    const idOcDetalle = ob.data.details[0]!.idOcDetalle;
    await app.inject({
      method: "POST",
      url: `/api/com/ordenes-compra/${idOrdenCompra}/estado`,
      headers: H,
      payload: { estado: "ENVIADA" },
    });

    const rec = await app.inject({
      method: "POST",
      url: "/api/com/recepciones",
      headers: H,
      payload: {
        idOrdenCompra,
        idBodega: ids.bodega,
        idEmpleadoRecibe: ids.empleado,
        lineas: [{ idOcDetalle, cantidadRecibida: 5 }],
      },
    });
    const idRecepcion = (rec.json() as { data: { header: { idRecepcion: number } } }).data.header.idRecepcion;

    const completa = await scalar(
      `SELECT DECODE(ESTADO,'RECIBIDA_COMPLETA',1,0) V FROM COM_ORDEN_COMPRA WHERE ID_ORDEN_COMPRA = ${idOrdenCompra}`,
    );
    expect(completa).toBe(1);

    const reversa = await app.inject({
      method: "POST",
      url: `/api/com/recepciones/${idRecepcion}/reversar`,
      headers: H,
    });
    expect(reversa.statusCode).toBe(200);

    const vuelveAEnviada = await scalar(
      `SELECT DECODE(ESTADO,'ENVIADA',1,0) V FROM COM_ORDEN_COMPRA WHERE ID_ORDEN_COMPRA = ${idOrdenCompra}`,
    );
    expect(vuelveAEnviada).toBe(1);

    // Con la OC de nuevo en ENVIADA, se puede recibir otra vez sin problema.
    const rec2 = await app.inject({
      method: "POST",
      url: "/api/com/recepciones",
      headers: H,
      payload: {
        idOrdenCompra,
        idBodega: ids.bodega,
        idEmpleadoRecibe: ids.empleado,
        lineas: [{ idOcDetalle, cantidadRecibida: 5 }],
      },
    });
    expect(rec2.statusCode).toBe(201);
    const completaOtraVez = await scalar(
      `SELECT DECODE(ESTADO,'RECIBIDA_COMPLETA',1,0) V FROM COM_ORDEN_COMPRA WHERE ID_ORDEN_COMPRA = ${idOrdenCompra}`,
    );
    expect(completaOtraVez).toBe(1);
  });
});

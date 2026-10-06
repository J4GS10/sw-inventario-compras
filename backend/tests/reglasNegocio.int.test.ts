/**
 * Test de INTEGRACION - coherencia de documentos y fechas, buscador y orden.
 *
 *  1. Fechas: nada vencido al registrarse (requerida / limite / vencimiento /
 *     entrega) y nada anterior al documento del que nace.
 *  2. Cantidades: > 0, sin duplicar lineas, acumulado de devoluciones.
 *  3. Listados: lo mas reciente primero, orden explicito, buscador global.
 *
 * Todo contra el Oracle local, igual que el resto de *.int.test.ts.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { oraclePool, scalar, startTestApp, stopTestApp } from "./helpers/testApp.js";

let app: FastifyInstance;
const H = { "x-dev-user": "1", "content-type": "application/json" } as const;
const dia = (n: number): string => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Guatemala" });

interface Ids {
  empleado: number;
  sucursal: number;
  grupoCompra: number;
  terminoEntrega: number;
  moneda: number;
  condicionPago: number;
  unidadMedida: number;
  bodega: number;
  proveedores: number[];
}
const ids = {} as Ids;

async function post(url: string, payload: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await app.inject({ method: "POST", url, headers: H, payload: payload as object });
  return { status: res.statusCode, json: res.json() as Record<string, unknown> };
}
async function get(url: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await app.inject({ method: "GET", url, headers: H });
  return { status: res.statusCode, json: res.json() as Record<string, unknown> };
}
const mensaje = (r: { json: Record<string, unknown> }): string =>
  String((r.json["error"] as { message?: string } | undefined)?.message ?? "");
const campos = (r: { json: Record<string, unknown> }): string[] =>
  ((r.json["error"] as { details?: { field?: string }[] } | undefined)?.details ?? []).map((d) => d.field ?? "");

function solicitudBody(fechaRequerida: string, extra: Record<string, unknown> = {}, lineas = 1): unknown {
  return {
    cabecera: {
      idEmpleadoSolicitante: ids.empleado,
      idSucursal: ids.sucursal,
      idGrupoCompra: ids.grupoCompra,
      idTerminoEntrega: ids.terminoEntrega,
      justificacion: "Prueba de reglas de negocio",
      prioridad: 3,
      ...extra,
    },
    detalles: Array.from({ length: lineas }, (_, i) => ({
      descripcion: `Item ${i + 1}`,
      cantidadSolicitada: 4,
      idUnidadMedida: ids.unidadMedida,
      fechaRequerida,
    })),
  };
}

/** Solicitud ya aprobada por jefe y gerente (EN_COTIZACION). */
async function solicitudAprobada(fechaRequerida = dia(20)): Promise<{ idSolicitud: number; renglones: number[] }> {
  const c = await post("/api/com/solicitudes", solicitudBody(fechaRequerida));
  expect(c.status).toBe(201);
  const data = c.json["data"] as { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
  for (let i = 0; i < 2; i++) {
    const ap = await post(`/api/com/solicitudes/${data.header.idSolicitud}/aprobar`, { idEmpleado: ids.empleado });
    expect(ap.status).toBe(200);
  }
  return { idSolicitud: data.header.idSolicitud, renglones: data.details.map((d) => d.idSolicitudDetalle) };
}

async function rfqAbierto(idSolicitud: number, fechaLimite = dia(10)): Promise<number> {
  const r = await post("/api/com/rfq", { idSolicitud, fechaLimite, proveedores: ids.proveedores });
  expect(r.status, mensaje(r)).toBe(201);
  return (r.json["data"] as { header: { idRfq: number } }).header.idRfq;
}

function cotizacionBody(idRfq: number, idProveedor: number, renglon: number, extra: Record<string, unknown> = {}): unknown {
  return {
    idRfq,
    idProveedor,
    idCondicionPago: ids.condicionPago,
    idMoneda: ids.moneda,
    tasaCambio: 1,
    fechaVencimiento: dia(15),
    lineas: [{ idSolicitudDetalle: renglon, precioUnitario: 10, cantidad: 4, idUnidadMedida: ids.unidadMedida }],
    ...extra,
  };
}

beforeAll(async () => {
  app = await startTestApp();
  const one = (sql: string): Promise<number> => scalar(sql);
  ids.empleado = await one("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'");
  ids.sucursal = await one("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'");
  ids.grupoCompra = await one("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'");
  ids.terminoEntrega = await one("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'");
  ids.moneda = await one("SELECT MIN(ID_MONEDA) V FROM COM_MONEDA WHERE ELIMINADO='N'");
  ids.condicionPago = await one("SELECT MIN(ID_CONDICION_PAGO) V FROM COM_CONDICION_PAGO WHERE ELIMINADO='N'");
  ids.unidadMedida = await one("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'");
  ids.bodega = await one("SELECT MIN(ID_BODEGA) V FROM INV_BODEGA WHERE ELIMINADO='N'");
  const provs: number[] = [];
  for (let i = 0; i < 4; i++) {
    provs.push(
      await one(
        `SELECT MIN(ID_PROVEEDOR) V FROM COM_PROVEEDOR WHERE ELIMINADO='N' AND ESTADO='A'` +
          (provs.length ? ` AND ID_PROVEEDOR > ${provs[provs.length - 1]!}` : ""),
      ),
    );
  }
  ids.proveedores = provs.slice(0, 3);
  (ids as unknown as { cuarto: number }).cuarto = provs[3]!;
});

afterAll(async () => {
  await stopTestApp(app);
});

describe("Solicitud: fechas y cantidades", () => {
  it("rechaza una fecha requerida pasada, con mensaje de negocio y campo", async () => {
    const r = await post("/api/com/solicitudes", solicitudBody(dia(-1)));
    expect(r.status).toBe(422);
    expect(mensaje(r)).toMatch(/anterior a hoy/);
    expect(campos(r)).toContain("detalles[0].fechaRequerida");
  });

  it("acepta fecha requerida = hoy (limite inclusivo)", async () => {
    const r = await post("/api/com/solicitudes", solicitudBody(dia(0)));
    expect(r.status, mensaje(r)).toBe(201);
  });

  it("rechaza fechas inexistentes y absurdas (2206)", async () => {
    expect((await post("/api/com/solicitudes", solicitudBody("2026-02-30"))).status).toBe(422);
    expect((await post("/api/com/solicitudes", solicitudBody("2206-10-05"))).status).toBe(422);
  });

  it("rechaza cantidad 0 / negativa y prioridad fuera de 1-5, todo junto", async () => {
    const body = solicitudBody(dia(5), { prioridad: 9 }) as { detalles: { cantidadSolicitada: number }[] };
    body.detalles[0]!.cantidadSolicitada = 0;
    const r = await post("/api/com/solicitudes", body);
    expect(r.status).toBe(422);
    expect(campos(r)).toEqual(expect.arrayContaining(["prioridad", "detalles[0].cantidadSolicitada"]));
  });

  it("rechaza una justificación de relleno y un texto que excede el DDL", async () => {
    expect((await post("/api/com/solicitudes", solicitudBody(dia(5), { justificacion: "x" }))).status).toBe(422);
    expect((await post("/api/com/solicitudes", solicitudBody(dia(5), { justificacion: "x".repeat(501) }))).status).toBe(422);
  });
});

describe("RFQ: fecha límite y estado de la solicitud", () => {
  it("fecha limite pasada -> 422", async () => {
    const { idSolicitud } = await solicitudAprobada();
    const r = await post("/api/com/rfq", { idSolicitud, fechaLimite: dia(-1), proveedores: ids.proveedores });
    expect(r.status).toBe(422);
    expect(mensaje(r)).toMatch(/anterior a hoy/);
  });

  it("fecha limite posterior a cuando se necesita la mercaderia -> 422", async () => {
    const { idSolicitud } = await solicitudAprobada(dia(10));
    const r = await post("/api/com/rfq", { idSolicitud, fechaLimite: dia(11), proveedores: ids.proveedores });
    expect(r.status).toBe(422);
    expect(mensaje(r)).toMatch(/última fecha/);
  });

  it("solicitud aun sin aprobar no admite RFQ -> 409", async () => {
    const c = await post("/api/com/solicitudes", solicitudBody(dia(20)));
    const id = (c.json["data"] as { header: { idSolicitud: number } }).header.idSolicitud;
    const r = await post("/api/com/rfq", { idSolicitud: id, fechaLimite: dia(5), proveedores: ids.proveedores });
    expect(r.status).toBe(409);
    expect(mensaje(r)).toMatch(/aprobación/);
  });

  it("editar la fecha limite a una fecha pasada -> 422", async () => {
    const { idSolicitud } = await solicitudAprobada();
    const idRfq = await rfqAbierto(idSolicitud);
    const res = await app.inject({ method: "PUT", url: `/api/com/rfq/${idRfq}`, headers: H, payload: { fechaLimite: dia(-3) } });
    expect(res.statusCode).toBe(422);
  });

  it("no se invita dos veces al mismo proveedor", async () => {
    const { idSolicitud } = await solicitudAprobada();
    const idRfq = await rfqAbierto(idSolicitud);
    const r = await post(`/api/com/rfq/${idRfq}/invitar`, { idProveedor: ids.proveedores[0] });
    expect(r.status).toBe(409);
    expect(mensaje(r)).toMatch(/ya fue invitado/);
  });
});

describe("Cotización: vigencia, invitados, duplicados y renglones", () => {
  let sol: { idSolicitud: number; renglones: number[] };
  let idRfq: number;

  beforeAll(async () => {
    sol = await solicitudAprobada();
    idRfq = await rfqAbierto(sol.idSolicitud);
  });

  it("vencimiento pasado -> 422", async () => {
    const r = await post("/api/com/cotizaciones", cotizacionBody(idRfq, ids.proveedores[0]!, sol.renglones[0]!, { fechaVencimiento: dia(-2) }));
    expect(r.status).toBe(422);
    expect(campos(r)).toContain("fechaVencimiento");
  });

  it("proveedor no invitado -> 409", async () => {
    const cuarto = (ids as unknown as { cuarto: number }).cuarto;
    const r = await post("/api/com/cotizaciones", cotizacionBody(idRfq, cuarto, sol.renglones[0]!));
    expect(r.status).toBe(409);
    expect(mensaje(r)).toMatch(/no fue invitado/);
  });

  it("renglon de OTRA solicitud -> 422", async () => {
    const otra = await solicitudAprobada();
    const r = await post("/api/com/cotizaciones", cotizacionBody(idRfq, ids.proveedores[0]!, otra.renglones[0]!));
    expect(r.status).toBe(422);
    expect(mensaje(r)).toMatch(/no pertenece/);
  });

  it("precio 0, descuento 150% y renglon repetido -> 422 con todos los campos", async () => {
    const r = await post(
      "/api/com/cotizaciones",
      cotizacionBody(idRfq, ids.proveedores[0]!, sol.renglones[0]!, {
        lineas: [
          { idSolicitudDetalle: sol.renglones[0], precioUnitario: 0, cantidad: 1, porcentajeDescuento: 150, idUnidadMedida: ids.unidadMedida },
          { idSolicitudDetalle: sol.renglones[0], precioUnitario: 5, cantidad: 1, idUnidadMedida: ids.unidadMedida },
        ],
      }),
    );
    expect(r.status).toBe(422);
    expect(campos(r)).toEqual(expect.arrayContaining(["lineas[0].precioUnitario", "lineas[0].porcentajeDescuento", "lineas[1].idSolicitudDetalle"]));
  });

  it("una vez cotizado, el mismo proveedor no puede registrar otra (se edita la existente)", async () => {
    const ok = await post("/api/com/cotizaciones", cotizacionBody(idRfq, ids.proveedores[0]!, sol.renglones[0]!));
    expect(ok.status, mensaje(ok)).toBe(201);
    const dup = await post("/api/com/cotizaciones", cotizacionBody(idRfq, ids.proveedores[0]!, sol.renglones[0]!));
    expect(dup.status).toBe(409);
    expect(mensaje(dup)).toMatch(/ya cotizó/);
  });

  it("el RFQ con plazo vencido ya no recibe ofertas", async () => {
    const s2 = await solicitudAprobada();
    const rfq2 = await rfqAbierto(s2.idSolicitud, dia(5));
    await oraclePool().withConnection(async (c) => {
      await c.execute(`UPDATE COM_RFQ_CABECERA SET FECHA_LIMITE = TRUNC(SYSDATE) - 2 WHERE ID_RFQ = :id`, { id: rfq2 });
      await c.commit();
    });
    const r = await post("/api/com/cotizaciones", cotizacionBody(rfq2, ids.proveedores[1]!, s2.renglones[0]!));
    expect(r.status).toBe(409);
    expect(mensaje(r)).toMatch(/plazo del RFQ/);
  });
});

describe("Orden de compra, recepción y devolución", () => {
  let idOc: number;
  let idOcDetalle: number;
  let idCotDetalle: number;
  let idCotizacion: number;
  const proveedor = (): number => ids.proveedores[0]!;

  beforeAll(async () => {
    const sol = await solicitudAprobada();
    const idRfq = await rfqAbierto(sol.idSolicitud);
    const cot = await post("/api/com/cotizaciones", cotizacionBody(idRfq, proveedor(), sol.renglones[0]!));
    expect(cot.status, mensaje(cot)).toBe(201);
    const data = cot.json["data"] as { header: { idCotizacion: number }; details: { idCotizacionDetalle: number }[] };
    idCotizacion = data.header.idCotizacion;
    idCotDetalle = data.details[0]!.idCotizacionDetalle;
    const adj = await post(`/api/com/cotizaciones/detalle/${idCotDetalle}/adjudicar`, {});
    expect(adj.status).toBe(200);
  });

  const ocBody = (extra: Record<string, unknown> = {}, linea: Record<string, unknown> = {}): unknown => ({
    idProveedor: proveedor(),
    idEmpleadoGerenteFinanciero: ids.empleado,
    idMoneda: ids.moneda,
    tasaCambio: 1,
    fechaEntregaEsperada: dia(14),
    lineas: [
      {
        descripcion: "Item 1",
        cantidad: 4,
        idUnidadMedida: ids.unidadMedida,
        idCotizacionDetalle: idCotDetalle,
        ...linea,
      },
    ],
    ...extra,
  });

  it("OC: entrega en el pasado -> 422", async () => {
    const r = await post("/api/com/ordenes-compra", ocBody({ fechaEntregaEsperada: dia(-1) }));
    expect(r.status).toBe(422);
    expect(mensaje(r)).toMatch(/anterior a hoy/);
  });

  it("OC: cantidad 0, tasa 0 y descuento 120% -> 422 con todos los campos", async () => {
    const r = await post(
      "/api/com/ordenes-compra",
      ocBody({ tasaCambio: 0 }, { cantidad: 0, precioUnitario: 5, porcentajeDescuento: 120 }),
    );
    expect(r.status).toBe(422);
    expect(campos(r)).toEqual(expect.arrayContaining(["tasaCambio", "lineas[0].cantidad", "lineas[0].porcentajeDescuento"]));
  });

  it("OC: la oferta de OTRO proveedor no sirve -> 409", async () => {
    const r = await post("/api/com/ordenes-compra", ocBody({ idProveedor: ids.proveedores[1] }));
    expect(r.status).toBe(409);
    expect(mensaje(r)).toMatch(/otro proveedor/);
  });

  it("OC: una oferta vencida no sirve -> 409", async () => {
    await oraclePool().withConnection(async (c) => {
      await c.execute(`UPDATE COM_COTIZACION_PROVEEDOR SET FECHA_VENCIMIENTO = SYSDATE - 3 WHERE ID_COTIZACION = :id`, { id: idCotizacion });
      await c.commit();
    });
    const r = await post("/api/com/ordenes-compra", ocBody());
    expect(r.status).toBe(409);
    expect(mensaje(r)).toMatch(/venció/);
    await oraclePool().withConnection(async (c) => {
      await c.execute(`UPDATE COM_COTIZACION_PROVEEDOR SET FECHA_VENCIMIENTO = SYSDATE + 10 WHERE ID_COTIZACION = :id`, { id: idCotizacion });
      await c.commit();
    });
  });

  it("OC valida -> se crea y editar la entrega al pasado -> 422", async () => {
    const r = await post("/api/com/ordenes-compra", ocBody());
    expect(r.status, mensaje(r)).toBe(201);
    const data = r.json["data"] as { header: { idOrdenCompra: number }; details: { idOcDetalle: number }[] };
    idOc = data.header.idOrdenCompra;
    idOcDetalle = data.details[0]!.idOcDetalle;
    const ed = await app.inject({ method: "PUT", url: `/api/com/ordenes-compra/${idOc}`, headers: H, payload: { fechaEntregaEsperada: dia(-1) } });
    expect(ed.statusCode).toBe(422);
    const ok = await app.inject({ method: "PUT", url: `/api/com/ordenes-compra/${idOc}`, headers: H, payload: { fechaEntregaEsperada: dia(30) } });
    expect(ok.statusCode).toBe(200);
  });

  const recBody = (lineas: unknown[]): unknown => ({
    idOrdenCompra: idOc,
    idBodega: ids.bodega,
    idEmpleadoRecibe: ids.empleado,
    lineas,
  });

  it("Recepción: rechazada negativa, cantidad 0 y línea repetida -> 422", async () => {
    const r = await post("/api/com/recepciones", recBody([{ idOcDetalle, cantidadRecibida: 1, cantidadRechazada: -5 }]));
    expect(r.status).toBe(422);
    const z = await post("/api/com/recepciones", recBody([{ idOcDetalle, cantidadRecibida: 0 }]));
    expect(z.status).toBe(422);
    // 3 + 3 > 4 pendientes: antes eludia el tope por venir en lineas separadas
    const d = await post("/api/com/recepciones", recBody([{ idOcDetalle, cantidadRecibida: 3 }, { idOcDetalle, cantidadRecibida: 3 }]));
    expect(d.status).toBe(422);
    expect(mensaje(d)).toMatch(/repetida/);
  });

  it("Recepción de más de lo pendiente -> 409; recepción valida -> 201", async () => {
    const mas = await post("/api/com/recepciones", recBody([{ idOcDetalle, cantidadRecibida: 5 }]));
    expect(mas.status).toBe(409);
    const ok = await post("/api/com/recepciones", recBody([{ idOcDetalle, cantidadRecibida: 4 }]));
    expect(ok.status, mensaje(ok)).toBe(201);
    const data = ok.json["data"] as { header: { idRecepcion: number }; details: { idRecepcionDetalle: number }[] };
    (ids as unknown as { rec: number; recDet: number }).rec = data.header.idRecepcion;
    (ids as unknown as { rec: number; recDet: number }).recDet = data.details[0]!.idRecepcionDetalle;
  });

  it("Devolución: el acumulado cuenta (no se devuelve lo mismo dos veces)", async () => {
    const x = ids as unknown as { rec: number; recDet: number };
    const dev = (cant: number): unknown => ({
      idRecepcion: x.rec,
      motivo: "Mercadería danada",
      idEmpleadoSolicita: ids.empleado,
      lineas: [{ idRecepcionDetalle: x.recDet, cantidadDevuelta: cant }],
    });
    expect((await post("/api/com/devoluciones", dev(3))).status).toBe(201);
    const otra = await post("/api/com/devoluciones", dev(3)); // 3 + 3 > 4 recibidas
    expect(otra.status).toBe(409);
    expect(mensaje(otra)).toMatch(/quedan 1 por devolver/);
    expect((await post("/api/com/devoluciones", dev(1))).status).toBe(201);
    const llena = await post("/api/com/devoluciones", dev(1));
    expect(llena.status).toBe(409);
    expect(mensaje(llena)).toMatch(/ya fue devuelta por completo/);
  });

  it("Cuentas por pagar: documento anterior a la OC o futuro, y pago antes del documento -> 422", async () => {
    const x = ids as unknown as { rec: number };
    const idFactura = await scalar(`SELECT ID_FACTURA_PROVEEDOR V FROM COM_RECEPCION WHERE ID_RECEPCION = ${x.rec}`);
    expect(idFactura).toBeGreaterThan(0);
    const base = {
      numeroDte: "ABC123", serieDte: "A", montoTotal: 40, formaPago: "TRANSFERENCIA", banco: "Banco Industrial", numeroReferencia: "REF-1",
    };
    const url = `/api/com/cxp/${idFactura}/liquidar`;
    const antes = await post(url, { ...base, fechaEmision: dia(-60), fechaDocumento: dia(-60), fechaPago: dia(0) });
    expect(antes.status).toBe(422);
    expect(mensaje(antes)).toMatch(/anterior a la fecha de la orden de compra/);
    const futuro = await post(url, { ...base, fechaEmision: dia(0), fechaDocumento: dia(3), fechaPago: dia(5) });
    expect(futuro.status).toBe(422);
    expect(mensaje(futuro)).toMatch(/posterior a hoy/);
    const pagoPrevio = await post(url, { ...base, fechaEmision: dia(0), fechaDocumento: dia(0), fechaPago: dia(-1) });
    expect(pagoPrevio.status).toBe(422);
    expect(mensaje(pagoPrevio)).toMatch(/anterior a la fecha del documento/);
    const monto = await post(url, { ...base, montoTotal: 0, fechaEmision: dia(0), fechaDocumento: dia(0), fechaPago: dia(0) });
    expect(monto.status).toBe(422);
    const ok = await post(url, { ...base, fechaEmision: dia(0), fechaDocumento: dia(0), fechaPago: dia(0) });
    expect(ok.status, mensaje(ok)).toBe(200);
  });

  it("Devolución: motivo vacío y cantidad negativa -> 422", async () => {
    const x = ids as unknown as { rec: number; recDet: number };
    const r = await post("/api/com/devoluciones", {
      idRecepcion: x.rec,
      motivo: "  ",
      idEmpleadoSolicita: ids.empleado,
      lineas: [{ idRecepcionDetalle: x.recDet, cantidadDevuelta: -1 }],
    });
    expect(r.status).toBe(422);
    expect(campos(r)).toEqual(expect.arrayContaining(["motivo", "lineas[0].cantidadDevuelta"]));
  });
});

describe("Catálogos: reglas cruzadas", () => {
  it("acuerdo marco: fin antes del inicio -> 422; solape con otro vigente -> 409", async () => {
    const idProveedor = ids.proveedores[2]!;
    const idArticulo = await scalar("SELECT MAX(ID_ARTICULO) V FROM INV_ARTICULO WHERE ELIMINADO='N'");
    const base = { idProveedor, idArticulo, precioFijo: 5, activo: true };
    const mal = await post("/api/com/acuerdos-proveedor", { ...base, fechaInicio: dia(10), fechaFin: dia(5) });
    expect(mal.status).toBe(422);
    expect(mensaje(mal)).toMatch(/anterior a la fecha de inicio/);
    // limpieza previa para que el solape sea determinista
    await oraclePool().withConnection(async (c) => {
      await c.execute(`UPDATE COM_ACUERDO_PROVEEDOR SET ELIMINADO='S' WHERE ID_PROVEEDOR=:p AND ID_ARTICULO=:a`, { p: idProveedor, a: idArticulo });
      await c.commit();
    });
    const a = await post("/api/com/acuerdos-proveedor", { ...base, fechaInicio: dia(0), fechaFin: dia(30) });
    expect(a.status, mensaje(a)).toBe(201);
    const b = await post("/api/com/acuerdos-proveedor", { ...base, fechaInicio: dia(20), fechaFin: dia(60) });
    expect(b.status).toBe(409);
    expect(mensaje(b)).toMatch(/Se solapa/);
    const c = await post("/api/com/acuerdos-proveedor", { ...base, fechaInicio: dia(31), fechaFin: dia(60) });
    expect(c.status, mensaje(c)).toBe(201);
    // no dejar acuerdos vigentes: otras suites usan el mismo catalogo y el solape los rechazaria
    await oraclePool().withConnection(async (conn) => {
      await conn.execute(`UPDATE COM_ACUERDO_PROVEEDOR SET ELIMINADO='S' WHERE ID_PROVEEDOR=:p AND ID_ARTICULO=:a`, { p: idProveedor, a: idArticulo });
      await conn.commit();
    });
  });

  it("proveedor: correo y dias de credito invalidos -> 422", async () => {
    const r = await post("/api/com/proveedores", {
      nit: "T" + Date.now().toString().slice(-8),
      razonSocial: "Proveedor de prueba",
      email: "no-es-correo",
      diasCredito: 999,
      estado: "A",
    });
    expect(r.status).toBe(422);
    expect(campos(r)).toEqual(expect.arrayContaining(["email", "diasCredito"]));
  });

  it("excepción: al resolverla el sistema pone la fecha de resolución", async () => {
    const idOrdenCompra = await scalar("SELECT MAX(ID_ORDEN_COMPRA) V FROM COM_ORDEN_COMPRA WHERE ELIMINADO='N'");
    const c = await post("/api/com/excepciones-orden", {
      idOrdenCompra,
      tipo: "RETRASO",
      descripcion: "Retraso de prueba",
      idEmpleadoReporta: ids.empleado,
      resuelta: false,
    });
    expect(c.status, mensaje(c)).toBe(201);
    const id = (c.json["data"] as { idExcepcion: number }).idExcepcion;
    const res = await app.inject({ method: "PUT", url: `/api/com/excepciones-orden/${id}`, headers: H, payload: { resuelta: true } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { data: { fechaResolucion: string | null } }).data.fechaResolucion).not.toBeNull();
  });
});

describe("Listados: lo último primero, orden explícito y buscador", () => {
  const idsDe = (r: { json: Record<string, unknown> }, campo: string): number[] =>
    (r.json["data"] as Record<string, number>[]).map((x) => x[campo]!);

  it("sin parámetros: el id más alto primero, en documentos y en catálogos", async () => {
    for (const [url, campo] of [
      ["/api/com/solicitudes", "idSolicitud"],
      ["/api/com/ordenes-compra", "idOrdenCompra"],
      ["/api/com/cotizaciones", "idCotizacion"],
      ["/api/com/rfq", "idRfq"],
      ["/api/com/recepciones", "idRecepcion"],
      ["/api/com/proveedores", "idProveedor"],
    ] as const) {
      const r = await get(`${url}?pageSize=15`);
      expect(r.status, url).toBe(200);
      const v = idsDe(r, campo);
      expect(v, url).toEqual([...v].sort((a, b) => b - a));
    }
  });

  it("la primera página trae el documento recién creado", async () => {
    const c = await post("/api/com/solicitudes", solicitudBody(dia(9), { justificacion: "Recién creada para orden" }));
    const id = (c.json["data"] as { header: { idSolicitud: number } }).header.idSolicitud;
    const r = await get("/api/com/solicitudes?pageSize=5");
    expect(idsDe(r, "idSolicitud")[0]).toBe(id);
  });

  it("orden explícito asc/desc por columna permitida", async () => {
    const asc = idsDe(await get("/api/com/ordenes-compra?sort=idOrdenCompra&order=asc&pageSize=10"), "idOrdenCompra");
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    // columna no permitida: se ignora (no hay inyeccion) y cae al orden por defecto
    const bad = await get("/api/com/ordenes-compra?sort=idOrdenCompra;DROP%20TABLE%20X&pageSize=5");
    expect(bad.status).toBe(200);
  });

  it("paginación estable: ninguna fila se repite entre paginas", async () => {
    const vistos = new Set<number>();
    for (let p = 1; p <= 3; p++) {
      for (const id of idsDe(await get(`/api/com/proveedores?page=${p}&pageSize=2&sort=razonSocial&order=asc`), "idProveedor")) {
        expect(vistos.has(id), `id ${id} repetido en la página ${p}`).toBe(false);
        vistos.add(id);
      }
    }
  });

  it("buscador de OC: por nombre del proveedor, por numero, por estado; sin acentos", async () => {
    const oc = (await get("/api/com/ordenes-compra?pageSize=1")).json["data"] as { idOrdenCompra: number; idProveedor: number }[];
    const { idOrdenCompra, idProveedor } = oc[0]!;
    const prov = (await get(`/api/com/proveedores/${idProveedor}`)).json["data"] as { razonSocial: string };
    const palabra = prov.razonSocial.split(/\s+/).find((w) => w.length > 3) ?? prov.razonSocial;

    const porProveedor = idsDe(await get(`/api/com/ordenes-compra?q=${encodeURIComponent(palabra)}&pageSize=200`), "idOrdenCompra");
    expect(porProveedor).toContain(idOrdenCompra);

    const porSinAcento = idsDe(
      await get(`/api/com/ordenes-compra?q=${encodeURIComponent(palabra.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())}&pageSize=200`),
      "idOrdenCompra",
    );
    expect(porSinAcento).toContain(idOrdenCompra);

    expect(idsDe(await get(`/api/com/ordenes-compra?q=OC-${idOrdenCompra}`), "idOrdenCompra")).toEqual([idOrdenCompra]);
    expect(idsDe(await get(`/api/com/ordenes-compra?q=${idOrdenCompra}`), "idOrdenCompra")).toContain(idOrdenCompra);

    const meta = (await get(`/api/com/ordenes-compra?q=emitida&pageSize=200`)).json["data"] as { estado: string }[];
    expect(meta.every((o) => o.estado === "EMITIDA")).toBe(true);
  });

  it("todas las palabras deben coincidir (AND); un texto imposible no trae nada", async () => {
    const r = await get("/api/com/ordenes-compra?q=emitida%20zzzzzimposible");
    expect((r.json["meta"] as { total: number }).total).toBe(0);
  });

  it("% y _ se buscan como texto, no como comodín", async () => {
    const r = await get("/api/com/proveedores?q=%25");
    expect((r.json["meta"] as { total: number }).total).toBe(0);
  });

  it("buscador de solicitudes por lo que se pidió (línea) y de proveedores por NIT / activo", async () => {
    const c = await post("/api/com/solicitudes", {
      ...(solicitudBody(dia(9)) as object),
      detalles: [{ descripcion: "Martillo galvanizado XJ9", cantidadSolicitada: 2, idUnidadMedida: ids.unidadMedida, fechaRequerida: dia(9) }],
    });
    expect(c.status, mensaje(c)).toBe(201);
    const id = (c.json["data"] as { header: { idSolicitud: number } }).header.idSolicitud;
    expect(idsDe(await get("/api/com/solicitudes?q=martillo%20xj9"), "idSolicitud")).toContain(id);
    expect(idsDe(await get(`/api/com/solicitudes?q=SOL-${id}`), "idSolicitud")).toEqual([id]);
    const activos = (await get("/api/com/proveedores?q=activo&pageSize=200")).json["data"] as { estado: string }[];
    expect(activos.length).toBeGreaterThan(0);
    expect(activos.every((p) => p.estado === "A")).toBe(true);
  });

  it("reportes e historial: rango invertido o basura -> 422 (antes: 500 ORA-01861)", async () => {
    expect((await get("/api/com/reportes/gasto-proveedor?desde=2026-02-01&hasta=2026-01-01")).status).toBe(422);
    expect((await get("/api/com/reportes/desempeno-proveedores?desde=abc")).status).toBe(422);
    expect((await get("/api/com/historial-precios?desde=2026-02-30")).status).toBe(422);
    expect((await get("/api/com/reportes/gasto-proveedor?desde=2026-01-01&hasta=2026-12-31")).status).toBe(200);
  });

  it("page/pageSize inválidos no rompen el listado (antes: 500)", async () => {
    const r = await get("/api/com/ordenes-compra?page=abc&pageSize=xyz");
    expect(r.status).toBe(200);
  });
});

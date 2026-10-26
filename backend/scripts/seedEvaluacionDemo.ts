/**
 * Datos de prueba ADITIVOS para Dashboard y Reportes (Capa 1 / operacion).
 *
 * A diferencia de `seedFlujoDemo.ts`, NO borra nada: agrega 15 ciclos completos
 * de compra (solicitud -> aprobaciones -> RFQ -> 3 cotizaciones -> adjudicacion
 * -> OC -> envio -> recepcion) con proveedores, articulos y precios reales del
 * catalogo, y con la variedad que necesitan los reportes de decision:
 * descuentos distintos, fletes (gratis / con costo / sin registrar), entregas
 * a tiempo y atrasadas, rechazos, recepciones parciales y ordenes aun abiertas.
 *
 * Todo se crea por los endpoints reales (mismas reglas, maquinas de estado y
 * suscriptores de kardex/CxP). Como la API fecha lo creado "ahora", al final se
 * reubican las fechas de cada ciclo entre hace 10 dias y dentro de 10 dias
 * (emision desde hace 10 dias hasta hoy; entrega esperada hasta +10 dias).
 *
 * Marca: NUMERO_REFERENCIA = 'DEMO-EVAL-01' ... '-15'. Si ya existen, no repite.
 *
 * Uso:  pnpm --filter backend exec tsx scripts/seedEvaluacionDemo.ts
 *   o:  pnpm db:seed:evaluacion    (desde la raiz)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";

const envRaw = readFileSync(resolve(process.cwd(), "../.env"), "utf8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (t === "" || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim();
}

const { oraclePool } = await import("../src/dal/OraclePool.js");
const { registerComprasSubscribers } = await import("../src/bll/compras/subscribers/index.js");
const { buildApp } = await import("../src/app.js");

const H = { "x-dev-user": "0" } as const;

// -- Proveedores del catalogo (ids reales) y como se comportan ------------------
const FORTALEZA = 22; // Ferreteria La Fortaleza
const ELECTRICOS = 23; // Suministros Electricos del Norte
const PINTURAS = 24; // Pinturas y Acabados Profesionales
const CEMENTO = 25; // Distribuidora de Cemento Guatemala
const INATELSA = 162;
const METALURGICA = 501; // Distribuidora Metalurgica Central
const IMPORTACIONES = 502; // Importaciones Industriales del Sur

/** Condicion de pago del catalogo por proveedor (ids de COM_CONDICION_PAGO). */
const CONDICION: Record<number, number> = {
  [FORTALEZA]: 3, // 30 dias
  [ELECTRICOS]: 4, // 60 dias
  [PINTURAS]: 2, // 15 dias
  [CEMENTO]: 7, // contado
  [INATELSA]: 3,
  [METALURGICA]: 3,
  [IMPORTACIONES]: 2,
};

interface Oferta {
  prov: number;
  precio: number;
  desc: number; // % de descuento
}
type Estado = "RECIBIDA" | "PARCIAL" | "EN_TRANSITO" | "ENVIADA" | "EMITIDA";
interface Ciclo {
  art: number; // id de INV_ARTICULO
  nombre: string;
  cantidad: number;
  ofertas: [Oferta, Oferta, Oferta];
  /** Flete cobrado en la OC; undefined = no registrado. 0 = envio gratuito. */
  envio?: number;
  /** Dia de emision de la OC respecto de hoy (-10..0). */
  emis: number;
  /** Dias prometidos de entrega desde la emision. */
  plazo: number;
  estado: Estado;
  /** Dias desde la emision hasta la recepcion (solo RECIBIDA/PARCIAL). */
  rec?: number;
  /** Fraccion rechazada de lo procesado (0-1). */
  rechazo?: number;
  /** Fraccion recibida cuando es PARCIAL. */
  parcial?: number;
  motivo: string;
}

const CICLOS: readonly Ciclo[] = [
  { art: 101, nombre: "Clavo de Acero 2 Pulgadas Reforzado", cantidad: 800, motivo: "Reposicion de clavos para obra gris, sucursal Casa Matriz.",
    ofertas: [{ prov: FORTALEZA, precio: 1.85, desc: 0 }, { prov: METALURGICA, precio: 1.8, desc: 4 }, { prov: IMPORTACIONES, precio: 1.6, desc: 0 }],
    emis: -10, plazo: 7, estado: "RECIBIDA", rec: 9 },
  { art: 4, nombre: "Tornillo hexagonal M6 x 40mm", cantidad: 1200, motivo: "Tornillería para ensamble de estructuras metálicas.",
    ofertas: [{ prov: FORTALEZA, precio: 1.1, desc: 0 }, { prov: METALURGICA, precio: 1.12, desc: 6 }, { prov: IMPORTACIONES, precio: 1.09, desc: 0 }],
    envio: 90, emis: -9, plazo: 6, estado: "RECIBIDA", rec: 5 },
  { art: 5, nombre: "Tubo PVC 1 pulgada x 6m", cantidad: 60, motivo: "Instalación hidráulica de la bodega nueva.",
    ofertas: [{ prov: FORTALEZA, precio: 70, desc: 0 }, { prov: METALURGICA, precio: 74, desc: 3 }, { prov: IMPORTACIONES, precio: 71, desc: 0 }],
    envio: 0, emis: -8, plazo: 4, estado: "RECIBIDA", rec: 4 },
  { art: 6, nombre: "Pintura látex blanca", cantidad: 25, motivo: "Repintado de oficinas administrativas.",
    ofertas: [{ prov: PINTURAS, precio: 210, desc: 0 }, { prov: FORTALEZA, precio: 205, desc: 0 }, { prov: INATELSA, precio: 225, desc: 10 }],
    envio: 0, emis: -8, plazo: 6, estado: "RECIBIDA", rec: 6 },
  { art: 7, nombre: "Cemento gris tipo I", cantidad: 200, motivo: "Fundición de losa del área de carga.",
    ofertas: [{ prov: CEMENTO, precio: 88, desc: 3 }, { prov: FORTALEZA, precio: 90, desc: 0 }, { prov: IMPORTACIONES, precio: 86, desc: 0 }],
    envio: 250, emis: -7, plazo: 3, estado: "RECIBIDA", rec: 5 },
  { art: 8, nombre: "Cable eléctrico THHN #12", cantidad: 15, motivo: "Cableado del tercer nivel del edificio central.",
    ofertas: [{ prov: ELECTRICOS, precio: 640, desc: 8 }, { prov: INATELSA, precio: 610, desc: 10 }, { prov: FORTALEZA, precio: 655, desc: 0 }],
    envio: 0, emis: -6, plazo: 5, estado: "RECIBIDA", rec: 5 },
  { art: 9, nombre: "Guantes de nitrilo (par)", cantidad: 300, motivo: "Equipo de protección personal para bodega.",
    ofertas: [{ prov: FORTALEZA, precio: 11.5, desc: 0 }, { prov: IMPORTACIONES, precio: 9.8, desc: 0 }, { prov: INATELSA, precio: 10.5, desc: 10 }],
    envio: 0, emis: -5, plazo: 4, estado: "PARCIAL", rec: 4, parcial: 0.7 },
  { art: 10, nombre: "Papel bond carta 75g", cantidad: 400, motivo: "Consumo trimestral de papelería.",
    ofertas: [{ prov: INATELSA, precio: 38, desc: 10 }, { prov: IMPORTACIONES, precio: 33, desc: 0 }, { prov: FORTALEZA, precio: 36, desc: 0 }],
    emis: -5, plazo: 3, estado: "RECIBIDA", rec: 5, rechazo: 0.1 },
  { art: 8, nombre: "Cable eléctrico THHN #12", cantidad: 10, motivo: "Ampliación de tomacorrientes en sala de ventas.",
    ofertas: [{ prov: ELECTRICOS, precio: 600, desc: 8 }, { prov: INATELSA, precio: 640, desc: 10 }, { prov: FORTALEZA, precio: 650, desc: 0 }],
    envio: 120, emis: -4, plazo: 9, estado: "EN_TRANSITO" },
  { art: 6, nombre: "Pintura látex blanca", cantidad: 40, motivo: "Pintura de fachada, segunda etapa.",
    ofertas: [{ prov: PINTURAS, precio: 190, desc: 0 }, { prov: FORTALEZA, precio: 205, desc: 0 }, { prov: INATELSA, precio: 222, desc: 12 }],
    envio: 0, emis: -3, plazo: 4, estado: "RECIBIDA", rec: 3 },
  { art: 5, nombre: "Tubo PVC 1 pulgada x 6m", cantidad: 40, motivo: "Reparación de línea de agua del patio.",
    ofertas: [{ prov: FORTALEZA, precio: 77, desc: 0 }, { prov: METALURGICA, precio: 75, desc: 4 }, { prov: IMPORTACIONES, precio: 72.5, desc: 0 }],
    envio: 90, emis: -2, plazo: 7, estado: "ENVIADA" },
  { art: 7, nombre: "Cemento gris tipo I", cantidad: 150, motivo: "Reparación de rampa de descarga.",
    ofertas: [{ prov: CEMENTO, precio: 90, desc: 3 }, { prov: FORTALEZA, precio: 91, desc: 0 }, { prov: IMPORTACIONES, precio: 84, desc: 0 }],
    emis: -1, plazo: 10, estado: "ENVIADA" },
  { art: 101, nombre: "Clavo de Acero 2 Pulgadas Reforzado", cantidad: 1500, motivo: "Pedido grande de clavos para temporada alta de construcción.",
    ofertas: [{ prov: FORTALEZA, precio: 1.65, desc: 5 }, { prov: METALURGICA, precio: 1.78, desc: 4 }, { prov: IMPORTACIONES, precio: 1.7, desc: 0 }],
    envio: 0, emis: 0, plazo: 6, estado: "EMITIDA" },
  { art: 9, nombre: "Guantes de nitrilo (par)", cantidad: 500, motivo: "Reposición mensual de guantes para todas las bodegas.",
    ofertas: [{ prov: FORTALEZA, precio: 11.2, desc: 0 }, { prov: IMPORTACIONES, precio: 9.9, desc: 0 }, { prov: INATELSA, precio: 10.6, desc: 12 }],
    envio: 0, emis: 0, plazo: 5, estado: "EMITIDA" },
  { art: 4, nombre: "Tornillo hexagonal M6 x 40mm", cantidad: 2000, motivo: "Lote para el contrato de estanterías industriales.",
    ofertas: [{ prov: FORTALEZA, precio: 1.08, desc: 0 }, { prov: METALURGICA, precio: 1.02, desc: 6 }, { prov: IMPORTACIONES, precio: 1.0, desc: 0 }],
    envio: 90, emis: 0, plazo: 10, estado: "EMITIDA" },
];

// -- helpers ---------------------------------------------------------------------
let app: FastifyInstance;

async function inj(method: "GET" | "POST", url: string, payload?: object): Promise<Record<string, unknown>> {
  const res = await app.inject({ method, url, headers: { ...H }, payload });
  if (res.statusCode >= 300) throw new Error(`${method} ${url} -> ${res.statusCode}: ${res.body}`);
  return res.json() as Record<string, unknown>;
}

async function scalar(sql: string, binds: Record<string, unknown> = {}): Promise<number> {
  return oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ V: number | null }>(sql, binds as never);
    const v = r.rows?.[0]?.V;
    return v === null || v === undefined ? Number.NaN : Number(v);
  });
}

const diasDesdeHoy = (d: number): string => new Date(Date.now() + d * 864e5).toISOString();
const neto = (o: Oferta): number => o.precio * (1 - o.desc / 100);

/** Reubica las fechas del ciclo. Los offsets son dias respecto de hoy; las horas son fijas y plausibles. */
async function reubicarFechas(
  c: Ciclo,
  ids: { sol: number; rfq: number; oc: number; recepciones: number[] },
): Promise<void> {
  const dia = (off: number, horas: number): string => `(TRUNC(SYSDATE) + ${off} + ${horas}/24)`;
  const pasos: { sql: string; binds: Record<string, number> }[] = [
    { sql: `UPDATE COM_SOLICITUD_COMPRA SET FECHA_CREACION = ${dia(c.emis - 3, 9)} WHERE ID_SOLICITUD = :id`, binds: { id: ids.sol } },
    { sql: `UPDATE COM_WORKFLOW_APROBACION SET FECHA = ${dia(c.emis - 3, 11)} WHERE ID_SOLICITUD = :id`, binds: { id: ids.sol } },
    { sql: `UPDATE COM_RFQ_CABECERA SET FECHA_EMISION = ${dia(c.emis - 2, 9)}, FECHA_LIMITE = TRUNC(SYSDATE) + ${c.emis - 1} WHERE ID_RFQ = :id`, binds: { id: ids.rfq } },
    { sql: `UPDATE COM_COTIZACION_PROVEEDOR SET FECHA_COTIZACION = ${dia(c.emis - 1, 10)}, FECHA_VENCIMIENTO = ${dia(c.emis + 14, 0)} WHERE ID_RFQ = :id`, binds: { id: ids.rfq } },
    {
      sql: `UPDATE COM_ORDEN_COMPRA SET FECHA_EMISION = ${dia(c.emis, 7)}, FECHA_CREACION = ${dia(c.emis, 7)},
              FECHA_ENTREGA_ESPERADA = ${dia(c.emis + c.plazo, 0)} WHERE ID_ORDEN_COMPRA = :id`,
      binds: { id: ids.oc },
    },
  ];
  if (c.rec !== undefined) {
    const off = c.emis + c.rec;
    pasos.push(
      { sql: `UPDATE COM_RECEPCION SET FECHA_RECEPCION = ${dia(off, 7.5)} WHERE ID_ORDEN_COMPRA = :id`, binds: { id: ids.oc } },
      {
        sql: `UPDATE CXP_FACTURA_PROVEEDOR f SET FECHA_EMISION = TRUNC(SYSDATE) + ${off}, FECHA_DOCUMENTO = TRUNC(SYSDATE) + ${off},
                FECHA_VENCIMIENTO = TRUNC(SYSDATE) + ${off} + (SELECT NVL(p.DIAS_CREDITO, 0) FROM COM_PROVEEDOR p WHERE p.ID_PROVEEDOR = f.ID_PROVEEDOR)
              WHERE f.ID_RECEPCION IN (SELECT ID_RECEPCION FROM COM_RECEPCION WHERE ID_ORDEN_COMPRA = :id)`,
        binds: { id: ids.oc },
      },
      {
        sql: `UPDATE INV_KARDEX_MOVIMIENTO SET FECHA_MOVIMIENTO = ${dia(off, 7.5)}
              WHERE TIPO_MOVIMIENTO = 'ENTRADA_COMPRA'
                AND ID_DOCUMENTO_REF IN (SELECT ID_RECEPCION FROM COM_RECEPCION WHERE ID_ORDEN_COMPRA = :id)`,
        binds: { id: ids.oc },
      },
    );
  }
  await oraclePool().withTransaction(async (conn) => {
    for (const p of pasos) {
      try {
        await conn.execute(p.sql, p.binds);
      } catch (e) {
        console.warn(`    (fecha omitida: ${(e as Error).message.split("\n")[0]})`);
      }
    }
  });
}

interface Maestros {
  sucursal: number;
  empleado: number;
  bodega: number;
  grupoCompra: number;
  terminoEntrega: number;
  centroCosto: number;
  moneda: number;
  unidad: Map<number, number>;
}

async function maestros(): Promise<Maestros> {
  const m = {
    sucursal: await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'"),
    empleado: await scalar("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'"),
    bodega: await scalar("SELECT MIN(ID_BODEGA) V FROM INV_BODEGA WHERE ELIMINADO='N'"),
    grupoCompra: await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'"),
    terminoEntrega: await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'"),
    centroCosto: await scalar("SELECT MIN(ID_CENTRO_COSTO) V FROM COM_CENTRO_COSTO WHERE ELIMINADO='N'"),
    moneda: await scalar("SELECT ID_MONEDA V FROM COM_MONEDA WHERE CODIGO='GTQ' AND ELIMINADO='N' FETCH FIRST 1 ROWS ONLY"),
  };
  for (const [k, v] of Object.entries(m)) if (Number.isNaN(v)) throw new Error(`Falta el maestro '${k}'. Corre 'pnpm db:deploy'.`);
  const unidad = new Map<number, number>();
  for (const a of new Set(CICLOS.map((c) => c.art))) {
    const u = await scalar("SELECT ID_UNIDAD_MEDIDA V FROM INV_ARTICULO WHERE ID_ARTICULO = :a", { a });
    if (Number.isNaN(u)) throw new Error(`El articulo ${a} no existe en INV_ARTICULO.`);
    unidad.set(a, u);
  }
  for (const p of Object.keys(CONDICION)) {
    const n = await scalar("SELECT COUNT(*) V FROM COM_PROVEEDOR WHERE ID_PROVEEDOR = :p AND ELIMINADO='N'", { p: Number(p) });
    if (n !== 1) throw new Error(`El proveedor ${p} no existe o esta eliminado.`);
  }
  return { ...m, unidad };
}

async function crear(m: Maestros, c: Ciclo, n: number): Promise<string> {
  const ref = `DEMO-EVAL-${String(n).padStart(2, "0")}`;
  const unidad = m.unidad.get(c.art)!;
  const mejor = c.ofertas.reduce((a, b) => (neto(b) < neto(a) ? b : a));
  const mejorIdx = c.ofertas.indexOf(mejor);

  const sol = (
    await inj("POST", "/api/com/solicitudes", {
      cabecera: {
        idEmpleadoSolicitante: m.empleado,
        idSucursal: m.sucursal,
        idGrupoCompra: m.grupoCompra,
        idTerminoEntrega: m.terminoEntrega,
        idCentroCosto: m.centroCosto,
        justificacion: c.motivo,
        prioridad: 3,
        montoEstimado: Math.round(c.cantidad * c.ofertas[0].precio),
      },
      detalles: [{ idArticulo: c.art, descripcion: c.nombre, cantidadSolicitada: c.cantidad, idUnidadMedida: unidad, fechaRequerida: diasDesdeHoy(14).slice(0, 10) }],
    })
  )["data"] as { header: { idSolicitud: number }; details: { idSolicitudDetalle: number }[] };
  const idSolicitud = sol.header.idSolicitud;
  const idSolicitudDetalle = sol.details[0]!.idSolicitudDetalle;

  await inj("POST", `/api/com/solicitudes/${idSolicitud}/aprobar`, { idEmpleado: m.empleado, comentario: "Aprobado por el jefe inmediato" });
  await inj("POST", `/api/com/solicitudes/${idSolicitud}/aprobar`, { idEmpleado: m.empleado, comentario: "Aprobado por el gerente de área" });

  const rfq = (
    await inj("POST", "/api/com/rfq", { idSolicitud, fechaLimite: diasDesdeHoy(10).slice(0, 10), proveedores: c.ofertas.map((o) => o.prov) })
  )["data"] as { header: { idRfq: number } };
  const idRfq = rfq.header.idRfq;

  const dets: number[] = [];
  for (const o of c.ofertas) {
    const cot = (
      await inj("POST", "/api/com/cotizaciones", {
        idRfq,
        idProveedor: o.prov,
        idCondicionPago: CONDICION[o.prov],
        idMoneda: m.moneda,
        tasaCambio: 1,
        fechaVencimiento: diasDesdeHoy(20),
        lineas: [{ idSolicitudDetalle, precioUnitario: o.precio, cantidad: c.cantidad, idUnidadMedida: unidad, porcentajeDescuento: o.desc, porcentajeImpuesto: 12 }],
      })
    )["data"] as { details: { idCotizacionDetalle: number }[] };
    dets.push(cot.details[0]!.idCotizacionDetalle);
  }
  try {
    await inj("POST", "/api/com/comparativo/criterios", {
      idSolicitud,
      idCotizacionDetalle: dets[mejorIdx],
      criterio: "Precio neto",
      puntuacion: 9,
      notas: `Menor precio neto tras descuento (Q ${neto(mejor).toFixed(2)} c/u)`,
    });
  } catch (e) {
    console.warn(`    (criterio omitido: ${(e as Error).message})`);
  }

  await inj("POST", `/api/com/cotizaciones/detalle/${dets[mejorIdx]}/adjudicar`);

  const oc = (
    await inj("POST", "/api/com/ordenes-compra", {
      idProveedor: mejor.prov,
      idEmpleadoGerenteFinanciero: m.empleado,
      idMoneda: m.moneda,
      tasaCambio: 1,
      fechaEntregaEsperada: diasDesdeHoy(20),
      numeroReferencia: ref,
      ...(c.envio !== undefined ? { costoEnvio: c.envio } : {}),
      idSolicitud,
      lineas: [{ idArticulo: c.art, descripcion: c.nombre, cantidad: c.cantidad, idUnidadMedida: unidad, idCotizacionDetalle: dets[mejorIdx] }],
    })
  )["data"] as { header: { idOrdenCompra: number }; details: { idOcDetalle: number }[] };
  const idOc = oc.header.idOrdenCompra;
  const idOcDetalle = oc.details[0]!.idOcDetalle;

  const estadoOc = async (estado: string): Promise<void> => {
    await inj("POST", `/api/com/ordenes-compra/${idOc}/estado`, { estado });
  };
  if (c.estado !== "EMITIDA") await estadoOc("ENVIADA");
  if (c.estado === "EN_TRANSITO") await estadoOc("EN_TRANSITO");

  if (c.estado === "RECIBIDA" || c.estado === "PARCIAL") {
    const procesado = c.estado === "PARCIAL" ? Math.round(c.cantidad * (c.parcial ?? 0.7)) : c.cantidad;
    const rechazada = Math.round(procesado * (c.rechazo ?? 0));
    await inj("POST", "/api/com/recepciones", {
      idOrdenCompra: idOc,
      idBodega: m.bodega,
      idEmpleadoRecibe: m.empleado,
      lineas: [{ idOcDetalle, cantidadRecibida: procesado - rechazada, ...(rechazada > 0 ? { cantidadRechazada: rechazada } : {}) }],
    });
  }

  await reubicarFechas(c, { sol: idSolicitud, rfq: idRfq, oc: idOc, recepciones: [] });
  const dias = c.rec !== undefined ? `, recibida a los ${c.rec} d (prometió ${c.plazo})` : `, entrega esperada en ${c.emis + c.plazo >= 0 ? "+" : ""}${c.emis + c.plazo} d`;
  return `${ref}  OC-${idOc}  ${c.nombre} x${c.cantidad} -> prov ${mejor.prov} (${c.estado}${dias})`;
}

async function main(): Promise<void> {
  await oraclePool().init();
  registerComprasSubscribers();
  app = await buildApp();
  await app.ready();
  try {
    const previos = await scalar("SELECT COUNT(*) V FROM COM_ORDEN_COMPRA WHERE NUMERO_REFERENCIA LIKE 'DEMO-EVAL-%' AND ELIMINADO='N'");
    if (previos > 0) {
      console.log(`Ya existen ${previos} OC 'DEMO-EVAL-*'. No se agrega nada (evita duplicar).`);
      return;
    }
    const m = await maestros();
    console.log(`== Creando ${CICLOS.length} ciclos de compra (hace 10 dias .. proximos 10 dias) ==`);
    for (const [i, c] of CICLOS.entries()) {
      console.log(`  OK  ${await crear(m, c, i + 1)}`);
    }
    console.log("\nListo. Revisa Dashboard y Reportes > Evaluacion de proveedores.");
  } finally {
    await app.close();
    await oraclePool().close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});

/**
 * Herramienta de datos de demostracion (Capa 1 / operacion).
 *
 * 1. LIMPIA la data transaccional del modulo de Compras y sus efectos en INV_/CXP_
 *    (kardex, existencia, facturas de proveedor). NO toca catalogos, maestros,
 *    RBAC ni el esquema (DDL congelado).
 * 2. GENERA 5 registros limpios y completos que recorren el flujo del modulo a
 *    distintas profundidades, para validar cada pantalla con datos reales:
 *
 *      #1  Ciclo completo -> Recepcion total -> CxP + Kardex   (OC RECIBIDA_COMPLETA)
 *      #2  Ciclo completo -> Recepcion total -> CxP + Devolucion parcial
 *      #3  Solicitud aprobada -> RFQ -> 3 cotizaciones -> OC EMITIDA -> ENVIADA
 *      #4  Solicitud aprobada -> RFQ ABIERTO con 3 cotizaciones (sin adjudicar)
 *      #5  Solicitud aprobada por el jefe -> PENDIENTE_GERENTE (bandeja de aprobacion)
 *
 * Todo se crea por los endpoints reales (mismas reglas de negocio, state
 * machines y suscriptores de eventos que en produccion).
 *
 * Uso:  pnpm --filter backend exec tsx scripts/seedFlujoDemo.ts
 *   o:  pnpm db:seed:flujo         (desde la raiz)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import oracledb from "oracledb";

// -- .env (raiz del repo) --------------------------------------------------
const envRaw = readFileSync(resolve(process.cwd(), "../.env"), "utf8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (t === "" || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim();
}

const { oraclePool } = await import("../src/dal/OraclePool.js");
const { registerComprasSubscribers } = await import(
  "../src/bll/compras/subscribers/index.js"
);
const { buildApp } = await import("../src/app.js");

const H = { "x-dev-user": "0" } as const;

// -- helpers -------------------------------------------------------------
async function scalar(sql: string): Promise<number> {
  return oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ V: number | null }>(sql);
    const v = r.rows?.[0]?.V;
    return v === null || v === undefined ? Number.NaN : Number(v);
  });
}

async function idsTop(sql: string): Promise<number[]> {
  return oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ V: number }>(sql);
    return (r.rows ?? []).map((x) => Number(x.V));
  });
}

/** DELETE de la data transaccional, en orden seguro de FKs (hijos -> padres). */
async function limpiar(): Promise<void> {
  const pasos: readonly string[] = [
    // Rompe la FK circular COM_RECEPCION <-> CXP_FACTURA_PROVEEDOR.
    "UPDATE COM_RECEPCION SET ID_FACTURA_PROVEEDOR = NULL",
    "DELETE FROM INV_ALERTA_ESCASEZ",
    "DELETE FROM COM_DEVOLUCION_DETALLE",
    "DELETE FROM COM_DEVOLUCION_PROVEEDOR",
    "DELETE FROM CXP_CHEQUE",
    "DELETE FROM CXP_CONTRASENA_PAGO",
    "DELETE FROM CXP_RETENCION",
    "DELETE FROM CXP_FACTURA_PROVEEDOR_DETALLE",
    "DELETE FROM CXP_FACTURA_PROVEEDOR",
    "DELETE FROM COM_RECEPCION_DETALLE",
    "DELETE FROM COM_RECEPCION",
    "DELETE FROM COM_SEGUIMIENTO_ORDEN",
    "DELETE FROM COM_EXCEPCION_ORDEN",
    "DELETE FROM COM_ORDEN_COMPRA_DETALLE",
    "DELETE FROM COM_ORDEN_COMPRA",
    "DELETE FROM COM_COMPARATIVO_COTIZACIONES",
    "DELETE FROM COM_COTIZACION_DETALLE",
    "DELETE FROM COM_COTIZACION_PROVEEDOR",
    "DELETE FROM COM_RFQ_PROVEEDOR",
    "DELETE FROM COM_RFQ_CABECERA",
    "DELETE FROM COM_WORKFLOW_APROBACION",
    "DELETE FROM COM_SOLICITUD_DETALLE",
    "DELETE FROM COM_SOLICITUD_COMPRA",
    "DELETE FROM INV_KARDEX_MOVIMIENTO",
    "DELETE FROM INV_EXISTENCIA_BODEGA",
  ];
  await oraclePool().withTransaction(async (c) => {
    for (const sql of pasos) {
      try {
        const r = await c.execute(sql);
        const n = r.rowsAffected ?? 0;
        if (n > 0) console.log(`  ${sql.padEnd(48)} -> ${n} fila(s)`);
      } catch (error) {
        const num = (error as { errorNum?: number }).errorNum;
        if (num === 942) continue; // tabla inexistente: se ignora
        throw error;
      }
    }
  });
  console.log("Limpieza completa.");
}

interface Masters {
  sucursal: number;
  empleado: number;
  bodega: number;
  grupoCompra: number;
  terminoEntrega: number;
  centroCosto: number;
  moneda: number;
  condicionPago: number;
  unidadMedida: number;
  articulos: number[];
  proveedores: number[];
}

async function resolverMaestros(): Promise<Masters> {
  const [articulos, proveedores] = await Promise.all([
    idsTop(
      "SELECT ID_ARTICULO V FROM INV_ARTICULO WHERE ELIMINADO='N' ORDER BY ID_ARTICULO FETCH FIRST 5 ROWS ONLY",
    ),
    idsTop(
      "SELECT ID_PROVEEDOR V FROM COM_PROVEEDOR WHERE ELIMINADO='N' ORDER BY ID_PROVEEDOR FETCH FIRST 3 ROWS ONLY",
    ),
  ]);
  const m: Masters = {
    sucursal: await scalar("SELECT MIN(ID_SUCURSAL) V FROM NOM_SUCURSAL WHERE ELIMINADO='N'"),
    empleado: await scalar("SELECT MIN(ID_EMPLEADO) V FROM NOM_EMPLEADO WHERE ELIMINADO='N'"),
    bodega: await scalar("SELECT MIN(ID_BODEGA) V FROM INV_BODEGA WHERE ELIMINADO='N'"),
    grupoCompra: await scalar("SELECT MIN(ID_GRUPO_COMPRA) V FROM COM_GRUPO_COMPRA WHERE ELIMINADO='N'"),
    terminoEntrega: await scalar("SELECT MIN(ID_TERMINO_ENTREGA) V FROM COM_TERMINO_ENTREGA WHERE ELIMINADO='N'"),
    centroCosto: await scalar("SELECT MIN(ID_CENTRO_COSTO) V FROM COM_CENTRO_COSTO WHERE ELIMINADO='N'"),
    moneda: await scalar("SELECT MIN(ID_MONEDA) V FROM COM_MONEDA WHERE ELIMINADO='N'"),
    condicionPago: await scalar("SELECT MIN(ID_CONDICION_PAGO) V FROM COM_CONDICION_PAGO WHERE ELIMINADO='N'"),
    unidadMedida: await scalar("SELECT MIN(ID_UNIDAD_MEDIDA) V FROM INV_UNIDAD_MEDIDA WHERE ELIMINADO='N'"),
    articulos,
    proveedores,
  };
  if (Number.isNaN(m.bodega)) {
    m.bodega = await oraclePool().withTransaction(async (c) => {
      const r = await c.execute(
        `INSERT INTO INV_BODEGA (ID_SUCURSAL, NOMBRE, TIPO, ESTADO)
         VALUES (:s, 'Bodega Central', 'CENTRAL', 'A')
         RETURNING ID_BODEGA INTO :id`,
        { s: m.sucursal, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      );
      return (r.outBinds as { id: number[] }).id[0] as number;
    });
  }
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === "number" && Number.isNaN(v)) {
      throw new Error(`Falta el maestro '${k}'. Corre 'pnpm db:deploy' primero.`);
    }
  }
  if (m.articulos.length < 5 || m.proveedores.length < 3) {
    throw new Error(
      "Se necesitan >= 5 articulos y >= 3 proveedores sembrados. Corre 'pnpm db:deploy'.",
    );
  }
  return m;
}

type Stage =
  | "APROBACION_GERENTE"
  | "RFQ_COTIZADO"
  | "OC_ENVIADA"
  | "RECIBIDO_CXP"
  | "CON_DEVOLUCION";

interface CicloSpec {
  titulo: string;
  articuloIdx: number;
  cantidad: number;
  precios: [number, number, number];
  prioridad: number;
  justificacion: string;
  hasta: Stage;
}

let app: FastifyInstance;

async function inj(
  method: "GET" | "POST",
  url: string,
  payload?: object,
): Promise<Record<string, unknown>> {
  const res = await app.inject({ method, url, headers: { ...H }, payload });
  if (res.statusCode >= 300) {
    throw new Error(`${method} ${url} -> ${res.statusCode}: ${res.body}`);
  }
  return res.json() as Record<string, unknown>;
}

function daysFromNow(d: number): string {
  return new Date(Date.now() + d * 864e5).toISOString();
}

async function crearCiclo(m: Masters, spec: CicloSpec): Promise<string> {
  const idArticulo = m.articulos[spec.articuloIdx]!;
  const [pA, pB, pC] = spec.precios;
  const medio = Math.round((pA + pB + pC) / 3);

  // 1) Solicitud -----------------------------------------------------------
  const sol = (
    await inj("POST", "/api/com/solicitudes", {
      cabecera: {
        idEmpleadoSolicitante: m.empleado,
        idSucursal: m.sucursal,
        idGrupoCompra: m.grupoCompra,
        idTerminoEntrega: m.terminoEntrega,
        idCentroCosto: m.centroCosto,
        justificacion: spec.justificacion,
        prioridad: spec.prioridad,
        montoEstimado: spec.cantidad * medio,
      },
      detalles: [
        {
          idArticulo,
          descripcion: spec.titulo,
          cantidadSolicitada: spec.cantidad,
          idUnidadMedida: m.unidadMedida,
          fechaRequerida: daysFromNow(14).slice(0, 10),
        },
      ],
    })
  )["data"] as {
    header: { idSolicitud: number };
    details: { idSolicitudDetalle: number }[];
  };
  const idSolicitud = sol.header.idSolicitud;
  const idSolicitudDetalle = sol.details[0]!.idSolicitudDetalle;

  // 2) Aprobacion jefe -> PENDIENTE_GERENTE ------------------------------
  await inj("POST", `/api/com/solicitudes/${idSolicitud}/aprobar`, {
    idEmpleado: m.empleado,
    comentario: "Aprobado por el jefe inmediato",
  });
  if (spec.hasta === "APROBACION_GERENTE") {
    return `#${idSolicitud} ${spec.titulo} -> PENDIENTE_GERENTE`;
  }

  // 3) Aprobacion gerente -> EN_COTIZACION -------------------------------
  await inj("POST", `/api/com/solicitudes/${idSolicitud}/aprobar`, {
    idEmpleado: m.empleado,
    comentario: "Aprobado por el gerente de area",
  });

  // 4) RFQ + 3 proveedores ---------------------------------------------
  const rfq = (
    await inj("POST", "/api/com/rfq", {
      idSolicitud,
      fechaLimite: daysFromNow(10).slice(0, 10),
      proveedores: m.proveedores,
    })
  )["data"] as { header: { idRfq: number } };
  const idRfq = rfq.header.idRfq;

  // 5) 3 cotizaciones -------------------------------------------------
  const dets: number[] = [];
  for (let i = 0; i < 3; i++) {
    const cot = (
      await inj("POST", "/api/com/cotizaciones", {
        idRfq,
        idProveedor: m.proveedores[i],
        idCondicionPago: m.condicionPago,
        idMoneda: m.moneda,
        tasaCambio: 1,
        fechaVencimiento: daysFromNow(20),
        lineas: [
          {
            idSolicitudDetalle,
            precioUnitario: spec.precios[i],
            cantidad: spec.cantidad,
            idUnidadMedida: m.unidadMedida,
            porcentajeImpuesto: 12,
          },
        ],
      })
    )["data"] as { details: { idCotizacionDetalle: number }[] };
    dets.push(cot.details[0]!.idCotizacionDetalle);
  }

  // Criterios del comparativo (trazabilidad; best-effort) --------------
  try {
    await inj("POST", "/api/com/comparativo/criterios", {
      idSolicitud,
      idCotizacionDetalle: dets[0],
      criterio: "Precio",
      puntuacion: 8,
      notas: "Oferta base",
    });
    const mejorIdx = spec.precios.indexOf(Math.min(...spec.precios));
    await inj("POST", "/api/com/comparativo/criterios", {
      idSolicitud,
      idCotizacionDetalle: dets[mejorIdx],
      criterio: "Plazo de entrega",
      puntuacion: 9,
      notas: "Mejor precio neto y plazo",
    });
  } catch (e) {
    console.warn(`  (criterios omitidos: ${(e as Error).message})`);
  }

  if (spec.hasta === "RFQ_COTIZADO") {
    return `#${idSolicitud} ${spec.titulo} -> RFQ ${idRfq} ABIERTO con 3 cotizaciones (sin adjudicar)`;
  }

  // 6) Adjudicar la cotizacion mas barata ----------------------------
  const mejorIdx = spec.precios.indexOf(Math.min(...spec.precios));
  await inj(
    "POST",
    `/api/com/cotizaciones/detalle/${dets[mejorIdx]}/adjudicar`,
  );

  // 7) Orden de compra ----------------------------------------------
  const oc = (
    await inj("POST", "/api/com/ordenes-compra", {
      idProveedor: m.proveedores[mejorIdx],
      idEmpleadoGerenteFinanciero: m.empleado,
      idMoneda: m.moneda,
      tasaCambio: 1,
      fechaEntregaEsperada: daysFromNow(21),
      numeroReferencia: `OC-DEMO-${idSolicitud}`,
      idSolicitud,
      lineas: [
        {
          idArticulo,
          descripcion: spec.titulo,
          cantidad: spec.cantidad,
          idUnidadMedida: m.unidadMedida,
          idCotizacionDetalle: dets[mejorIdx],
        },
      ],
    })
  )["data"] as {
    header: { idOrdenCompra: number };
    details: { idOcDetalle: number }[];
  };
  const idOrdenCompra = oc.header.idOrdenCompra;
  const idOcDetalle = oc.details[0]!.idOcDetalle;

  // 8) OC -> ENVIADA ----------------------------------------------
  await inj("POST", `/api/com/ordenes-compra/${idOrdenCompra}/estado`, {
    estado: "ENVIADA",
  });
  if (spec.hasta === "OC_ENVIADA") {
    return `#${idSolicitud} ${spec.titulo} -> OC ${idOrdenCompra} ENVIADA (pendiente de recepcion)`;
  }

  // 9) Recepcion total -> (suscriptores) Kardex + CxP -----------------
  const rec = (
    await inj("POST", "/api/com/recepciones", {
      idOrdenCompra,
      idBodega: m.bodega,
      idEmpleadoRecibe: m.empleado,
      lineas: [{ idOcDetalle, cantidadRecibida: spec.cantidad }],
    })
  )["data"] as {
    header: { idRecepcion: number };
    details: { idRecepcionDetalle: number }[];
  };
  const idRecepcion = rec.header.idRecepcion;
  const idRecepcionDetalle = rec.details[0]!.idRecepcionDetalle;
  if (spec.hasta === "RECIBIDO_CXP") {
    return `#${idSolicitud} ${spec.titulo} -> OC ${idOrdenCompra} RECIBIDA_COMPLETA + CxP + Kardex`;
  }

  // 10) Devolucion parcial (10%) -------------------------------------
  const devuelto = Math.max(1, Math.round(spec.cantidad * 0.1));
  await inj("POST", "/api/com/devoluciones", {
    idRecepcion,
    motivo: "Producto danado",
    idEmpleadoSolicita: m.empleado,
    lineas: [{ idRecepcionDetalle, cantidadDevuelta: devuelto }],
  });
  return `#${idSolicitud} ${spec.titulo} -> completo + Devolucion de ${devuelto} u.`;
}

const CICLOS: readonly CicloSpec[] = [
  {
    titulo: "Laptops Dell Latitude 5450",
    articuloIdx: 0,
    cantidad: 12,
    precios: [8500, 8190, 8790],
    prioridad: 2,
    justificacion: "Renovacion de equipos del area de ventas (12 puestos).",
    hasta: "RECIBIDO_CXP",
  },
  {
    titulo: "Sillas ergonomicas ejecutivas",
    articuloIdx: 1,
    cantidad: 40,
    precios: [950, 899, 1015],
    prioridad: 3,
    justificacion: "Mobiliario para la nueva planta administrativa.",
    hasta: "CON_DEVOLUCION",
  },
  {
    titulo: "Impresoras multifuncion laser",
    articuloIdx: 2,
    cantidad: 6,
    precios: [3200, 3050, 3410],
    prioridad: 3,
    justificacion: "Reposicion de impresoras fuera de garantia en sucursales.",
    hasta: "OC_ENVIADA",
  },
  {
    titulo: "Resmas de papel bond carta",
    articuloIdx: 3,
    cantidad: 500,
    precios: [38.5, 35.9, 41.2],
    prioridad: 4,
    justificacion: "Consumo trimestral de papeleria (todas las areas).",
    hasta: "RFQ_COTIZADO",
  },
  {
    titulo: "Cable UTP Cat 6 (caja 305 m)",
    articuloIdx: 4,
    cantidad: 20,
    precios: [1450, 1380, 1520],
    prioridad: 2,
    justificacion: "Cableado estructurado del tercer nivel del edificio central.",
    hasta: "APROBACION_GERENTE",
  },
];

async function main(): Promise<void> {
  await oraclePool().init();
  registerComprasSubscribers();
  app = await buildApp();
  await app.ready();

  try {
    console.log("== Limpiando data transaccional de Compras (INV_/CXP_ incluidos) ==");
    await limpiar();

    console.log("\n== Resolviendo maestros ==");
    const m = await resolverMaestros();
    console.log(
      `  articulos=${m.articulos.join(",")}  proveedores=${m.proveedores.join(",")}  bodega=${m.bodega}`,
    );

    console.log("\n== Generando 5 registros del flujo ==");
    const resumen: string[] = [];
    for (const spec of CICLOS) {
      resumen.push(await crearCiclo(m, spec));
      console.log(`  OK  ${resumen[resumen.length - 1]}`);
    }

    // Conteos finales
    const [sol, rfq, cot, oc, rec, dev, fac, kar] = await Promise.all([
      scalar("SELECT COUNT(*) V FROM COM_SOLICITUD_COMPRA WHERE ELIMINADO='N'"),
      scalar("SELECT COUNT(*) V FROM COM_RFQ_CABECERA WHERE ELIMINADO='N'"),
      scalar("SELECT COUNT(*) V FROM COM_COTIZACION_PROVEEDOR WHERE ELIMINADO='N'"),
      scalar("SELECT COUNT(*) V FROM COM_ORDEN_COMPRA WHERE ELIMINADO='N'"),
      scalar("SELECT COUNT(*) V FROM COM_RECEPCION WHERE ELIMINADO='N'"),
      scalar("SELECT COUNT(*) V FROM COM_DEVOLUCION_PROVEEDOR WHERE ELIMINADO='N'"),
      scalar("SELECT COUNT(*) V FROM CXP_FACTURA_PROVEEDOR WHERE ELIMINADO='N'"),
      scalar("SELECT COUNT(*) V FROM INV_KARDEX_MOVIMIENTO WHERE ELIMINADO='N'"),
    ]);

    console.log("\n== Resumen ==");
    for (const r of resumen) console.log(`  ${r}`);
    console.log("\n== Conteos ==");
    console.log(
      `  Solicitudes=${sol}  RFQ=${rfq}  Cotizaciones=${cot}  OC=${oc}  ` +
        `Recepciones=${rec}  Devoluciones=${dev}  FacturasCxP=${fac}  Kardex=${kar}`,
    );
    console.log("\nListo. Entra al sistema y valida el flujo por pantalla.");
  } finally {
    await app.close();
    await oraclePool().close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

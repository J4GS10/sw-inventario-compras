/**
 * Capa 2 - Acceso a Datos / compras (modelo de lectura).
 *
 * Consultas de solo lectura con joins para analitica del modulo. Separadas del
 * CRUD (BaseOracleRepository) por responsabilidad: aqui vive SQL parametrizado
 * optimizado para respuesta rapida.
 *
 * Todas las consultas se apoyan en los indices de FK creados por el DDL (fase 3
 * de SCRIPT_DDL.sql) y usan bind variables. La vista VW_COM_PRECIO_HISTORIAL ya
 * resuelve el join recepcion -> detalle -> OC.
 */

import type { BindParameters, Connection } from "oracledb";
import { oraclePool } from "../../OraclePool.js";
import { mapOracleError } from "../../../common/errors/OracleErrorAdapter.js";

function asBinds(map: Record<string, unknown>): BindParameters {
  return map as unknown as BindParameters;
}

export interface CotizacionComparada {
  readonly idSolicitudDetalle: number;
  readonly descripcionLinea: string;
  readonly cantidadSolicitada: number;
  readonly idCotizacion: number;
  readonly idCotizacionDetalle: number;
  readonly idProveedor: number;
  readonly proveedor: string;
  readonly nitProveedor: string;
  readonly idMoneda: number;
  readonly monedaCodigo: string;
  readonly tasaCambio: number;
  readonly condicionPagoDias: number;
  readonly precioUnitario: number;
  readonly cantidad: number;
  readonly porcentajeDescuento: number;
  readonly porcentajeImpuesto: number;
  readonly precioNeto: number;
  readonly precioNetoMoneda: number;
  readonly totalLinea: number;
  readonly adjudicado: boolean;
  readonly fechaCotizacion: string;
}

export interface CriterioComparativo {
  readonly idComparativo: number;
  readonly idSolicitud: number;
  readonly idCotizacionDetalle: number;
  readonly idProveedor: number;
  readonly proveedor: string;
  readonly criterio: string;
  readonly puntuacion: number | null;
  readonly notas: string | null;
}

export interface HistorialPrecioRow {
  readonly idProveedor: number;
  readonly proveedor: string;
  readonly idArticulo: number;
  readonly articuloCodigo: string;
  readonly articulo: string;
  readonly precioAcordado: number;
  readonly porcentajeDescuento: number;
  readonly porcentajeImpuesto: number;
  readonly cantidadRealComprada: number;
  readonly fechaCompra: string;
  readonly idMoneda: number;
  readonly tasaCambio: number;
  /** De donde sale esta linea — sin esto dos compras iguales en fecha/precio
   *  son indistinguibles en pantalla aunque sean recepciones reales distintas. */
  readonly idOrdenCompra: number;
  readonly idRecepcion: number;
}

export interface HistorialResumen {
  readonly registros: number;
  readonly precioMin: number | null;
  readonly precioMax: number | null;
  readonly precioPromedio: number | null;
  readonly cantidadTotal: number;
}

export interface HistorialQuery {
  readonly idProveedor?: number;
  readonly idArticulo?: number;
  readonly desde?: string;
  readonly hasta?: string;
  readonly page: number;
  readonly pageSize: number;
}

/** Una compra mensual: monto (GTQ) y numero de ordenes emitidas ese mes. */
export interface CompraMesRow {
  readonly periodo: string; // "YYYY-MM"
  readonly monto: number;
  readonly ordenes: number;
}

/** Valor (mismo costo-base que el kardex) de las entradas por compra de un mes. */
export interface EntradaMesRow {
  readonly periodo: string; // "YYYY-MM"
  readonly valor: number;
}

/** Agregado del ahorro obtenido al adjudicar la cotizacion mas conveniente. */
export interface AhorroAdjudicacionRow {
  readonly lineasAdjudicadas: number;
  readonly lineasConAlternativa: number;
  readonly ahorroPromedioPct: number | null;
  readonly montoAdjudicado: number;
  readonly montoSiMasCaro: number;
}

/** Alerta de escasez abierta, con faltante y cantidad sugerida ya calculados. */
export interface AlertaEscasezRow {
  readonly idAlerta: number;
  readonly idArticulo: number;
  readonly idBodega: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly bodega: string;
  readonly cantidadActual: number;
  readonly stockMinimo: number;
  readonly stockMaximo: number;
  readonly faltante: number;
  readonly cantidadSugerida: number;
}

/** Factura de proveedor pendiente de liquidar (bandeja de Cuentas por Pagar). */
export interface FacturaPendienteLiquidacionRow {
  readonly idFacturaProveedor: number;
  readonly idOrdenCompra: number;
  readonly idRecepcion: number;
  readonly proveedor: string;
  readonly fechaRecepcion: string;
  readonly montoTotal: number;
  readonly saldoPendiente: number;
  readonly estado: string;
}

/**
 * Quien tiene en su cancha el siguiente paso de una Solicitud — para que el
 * solicitante (o quien acaba de decidir) sepa a quien puede pedirle que
 * continue. `nombre` null cuando el responsable es un departamento entero
 * (Compras), no una persona especifica.
 */
/** Un hito del recorrido completo de una solicitud (de la peticion al pago). */
export interface HitoTrazabilidad {
  readonly tipo:
    | "SOLICITUD"
    | "APROBACION"
    | "RFQ"
    | "COTIZACION"
    | "ORDEN"
    | "RECEPCION"
    | "DEVOLUCION"
    | "FACTURA"
    | "PAGO";
  readonly fecha: string;
  readonly titulo: string;
  readonly quien: string | null;
  readonly detalle: string | null;
  readonly ref: number;
}

export interface DecisionSolicitudRow {
  readonly idWorkflow: number;
  readonly idSolicitud: number;
  readonly estadoAnterior: string;
  readonly estadoNuevo: string;
  readonly comentario: string | null;
  readonly fecha: string;
  readonly por: string;
  readonly resumen: string;
}

export interface ResponsableSolicitud {
  readonly rol: string;
  readonly nombre: string | null;
}

/** Cabecera de Recepcion resuelta para la Nota de Ingreso (nombres legibles). */
export interface RecepcionPdfHeaderRow {
  readonly idRecepcion: number;
  readonly idOrdenCompra: number;
  readonly fechaRecepcion: string;
  readonly estado: string;
  readonly bodega: string;
  readonly proveedor: string;
  readonly proveedorNit: string;
  readonly recibe: string;
}
/** Renglon de Recepcion resuelto para la Nota de Ingreso. */
export interface RecepcionPdfLineaRow {
  readonly idRecepcionDetalle: number;
  readonly descripcion: string;
  readonly unidadMedida: string;
  readonly cantidadRecibida: number;
  readonly cantidadRechazada: number;
}

/** Solicitud resuelta (nombres legibles) para su PDF. */
export interface SolicitudPdfRow {
  readonly header: {
    readonly idSolicitud: number;
    readonly estado: string;
    readonly justificacion: string;
    readonly prioridad: number;
    readonly montoEstimado: number | null;
    readonly fechaCreacion: string;
    readonly solicitante: string;
    readonly sucursal: string;
    readonly grupoCompra: string;
  };
  readonly lineas: readonly {
    readonly articulo: string;
    readonly descripcion: string;
    readonly unidadMedida: string;
    readonly cantidadSolicitada: number;
    readonly cantidadAutorizada: number | null;
    readonly fechaRequerida: string;
  }[];
}

/** Cabecera de OC resuelta para el PDF (nombres legibles, no ids crudos). */
export interface OrdenCompraPdfHeaderRow {
  readonly idOrdenCompra: number;
  readonly estado: string;
  readonly fechaEmision: string;
  readonly fechaEntregaEsperada: string;
  readonly numeroReferencia: string | null;
  readonly tasaCambio: number;
  readonly proveedor: string;
  readonly proveedorNit: string;
  readonly proveedorDireccion: string | null;
  readonly proveedorTelefono: string | null;
  readonly proveedorEmail: string | null;
  readonly monedaCodigo: string;
  readonly monedaSimbolo: string | null;
  readonly autoriza: string;
}
/** Renglon de OC resuelto para el PDF. */
export interface OrdenCompraPdfLineaRow {
  readonly idOcDetalle: number;
  readonly articuloCodigo: string | null;
  readonly descripcion: string;
  readonly cantidad: number;
  readonly unidadMedida: string;
  readonly precioUnitario: number;
  readonly porcentajeDescuento: number;
  readonly porcentajeImpuesto: number;
  readonly subtotal: number;
}

/** Renglon de OC con lo ya procesado (recibido+rechazado) y lo pendiente. */
export interface LineaPendienteOcRow {
  readonly idOcDetalle: number;
  readonly descripcion: string;
  /** Codigo del articulo (para identificar el renglon al escanear). */
  readonly codigo: string | null;
  readonly cantidad: number;
  readonly cantidadProcesada: number;
  readonly cantidadPendiente: number;
}

/** Gasto (GTQ) agrupado por proveedor en un rango de fechas de emision de OC. */
export interface GastoProveedorRow {
  readonly idProveedor: number;
  readonly proveedor: string;
  readonly nit: string;
  readonly ordenes: number;
  readonly monto: number;
}

/** Orden de compra aun no recibida por completo, con dias transcurridos. */
export interface OcPendienteRow {
  readonly idOrdenCompra: number;
  readonly proveedor: string;
  readonly estado: string;
  readonly fechaEmision: string;
  readonly fechaEntregaEsperada: string;
  readonly diasTranscurridos: number;
  readonly diasVencida: number;
  readonly monto: number;
}

/** Desempeno de un proveedor: tiempo de entrega y calidad de lo recibido. */
export interface DesempenoProveedorRow {
  readonly idProveedor: number;
  readonly proveedor: string;
  readonly ordenesRecibidas: number;
  readonly diasPromedioEntrega: number | null;
  readonly cantidadRecibida: number;
  readonly cantidadRechazada: number;
  readonly porcentajeRechazo: number;
}

/** Insumos crudos para el score de riesgo (todo el historico, sin filtro de fecha). */
export interface RiesgoProveedorInsumo {
  readonly idProveedor: number;
  readonly proveedor: string;
  readonly calificacion: string | null;
  readonly ordenesRecibidas: number;
  readonly diasPromedioEntrega: number | null;
  readonly porcentajeRechazo: number;
  readonly tieneArticulosEnEscasez: boolean;
}

/** Monto de CxP pendiente agrupado por cuando vence (proyeccion de pagos). */
export interface BucketPagoRow {
  readonly bucket: "VENCIDA" | "SEM1" | "SEM2" | "SEM3" | "SEM4" | "DESPUES" | "SIN_FECHA";
  readonly monto: number;
  readonly facturas: number;
}

type Row = Record<string, unknown>;

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return v === null || v === undefined ? "" : String(v);
}

export class CompraReadRepository {
  // ---- Alcance por departamento / equipo (Fase 6.2) --------------------

  /** Departamento del empleado (NULL si no tiene). */
  public async departamentoDeEmpleado(
    idEmpleado: number,
    conn?: Connection,
  ): Promise<number | null> {
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(
          `SELECT ID_DEPARTAMENTO AS V FROM NOM_EMPLEADO
           WHERE ID_EMPLEADO = :id AND ELIMINADO = 'N'`,
          { id: idEmpleado },
        );
        const v = res.rows?.[0]?.["V"];
        return v === null || v === undefined ? null : Number(v);
      } catch (error) {
        throw mapOracleError(error, "NOM_EMPLEADO");
      }
    }, conn);
  }

  /** Ids de empleados activos de un departamento. */
  public async empleadosDeDepartamento(
    idDepartamento: number,
    conn?: Connection,
  ): Promise<readonly number[]> {
    return this.idEmpleados(
      `SELECT ID_EMPLEADO AS V FROM NOM_EMPLEADO
       WHERE ID_DEPARTAMENTO = :p AND ELIMINADO = 'N'`,
      idDepartamento,
      conn,
    );
  }

  /** Ids de empleados cuyo jefe inmediato es `idJefe`. */
  public async empleadosBajoJefe(
    idJefe: number,
    conn?: Connection,
  ): Promise<readonly number[]> {
    return this.idEmpleados(
      `SELECT ID_EMPLEADO AS V FROM NOM_EMPLEADO
       WHERE ID_JEFE_INMEDIATO = :p AND ELIMINADO = 'N'`,
      idJefe,
      conn,
    );
  }

  private async idEmpleados(
    sql: string,
    p: number,
    conn?: Connection,
  ): Promise<readonly number[]> {
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { p });
        return (res.rows ?? []).map((r) => Number(r["V"]));
      } catch (error) {
        throw mapOracleError(error, "NOM_EMPLEADO");
      }
    }, conn);
  }

  /** Ids de solicitudes cuyo solicitante esta en `empleadoIds` (alcance por depto). */
  public async solicitudIdsDeEmpleados(
    empleadoIds: readonly number[],
    conn?: Connection,
  ): Promise<readonly number[]> {
    return this.idsIn(
      "SELECT ID_SOLICITUD AS V FROM COM_SOLICITUD_COMPRA",
      "ID_EMPLEADO_SOLICITANTE",
      empleadoIds,
      "COM_SOLICITUD_COMPRA",
      conn,
    );
  }

  /** Ids de RFQ ligados a un conjunto de solicitudes (alcance por depto). */
  public async rfqIdsDeSolicitudes(
    solicitudIds: readonly number[],
    conn?: Connection,
  ): Promise<readonly number[]> {
    return this.idsIn(
      "SELECT ID_RFQ AS V FROM COM_RFQ_CABECERA",
      "ID_SOLICITUD",
      solicitudIds,
      "COM_RFQ_CABECERA",
      conn,
    );
  }

  private async idsIn(
    selectFrom: string,
    col: string,
    values: readonly number[],
    tabla: string,
    conn?: Connection,
  ): Promise<readonly number[]> {
    if (values.length === 0) return [];
    const binds: Record<string, number> = {};
    const names = values.map((v, i) => {
      binds[`p${i}`] = v;
      return `:p${i}`;
    });
    const sql = `${selectFrom} WHERE ${col} IN (${names.join(", ")}) AND ELIMINADO = 'N'`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, binds);
        return (res.rows ?? []).map((r) => Number(r["V"]));
      } catch (error) {
        throw mapOracleError(error, tabla);
      }
    }, conn);
  }

  // ---- Bandeja de pendientes (notificaciones derivadas del estado) -------

  /**
   * Solicitudes en `estado`, opcionalmente acotadas a un conjunto de empleados
   * solicitantes (equipo/departamento). Devuelve un preview corto.
   */
  public async solicitudesEnEstado(
    estado: string,
    empleadoIds: readonly number[] | null,
    conn?: Connection,
  ): Promise<readonly { idSolicitud: number; resumen: string }[]> {
    const acota =
      empleadoIds === null
        ? ""
        : empleadoIds.length === 0
          ? "AND 1 = 0"
          : `AND ID_EMPLEADO_SOLICITANTE IN (${empleadoIds.map((_, i) => `:e${i}`).join(", ")})`;
    const binds: Record<string, unknown> = { estado };
    (empleadoIds ?? []).forEach((id, i) => (binds[`e${i}`] = id));
    const sql =
      `SELECT ID_SOLICITUD AS ID, SUBSTR(JUSTIFICACION, 1, 80) AS RESUMEN ` +
      `FROM COM_SOLICITUD_COMPRA WHERE ESTADO = :estado AND ELIMINADO = 'N' ${acota} ` +
      `ORDER BY PRIORIDAD DESC, ID_SOLICITUD DESC FETCH FIRST 25 ROWS ONLY`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, asBinds(binds));
        return (res.rows ?? []).map((r) => ({
          idSolicitud: num(r["ID"]),
          resumen: str(r["RESUMEN"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_SOLICITUD_COMPRA");
      }
    }, conn);
  }

  /** Solicitudes EN_COTIZACION que aun no tienen un RFQ creado. */
  public async solicitudesSinRfq(
    conn?: Connection,
  ): Promise<readonly { idSolicitud: number; resumen: string }[]> {
    const sql = `
      SELECT sc.ID_SOLICITUD AS ID, SUBSTR(sc.JUSTIFICACION, 1, 80) AS RESUMEN
      FROM COM_SOLICITUD_COMPRA sc
      WHERE sc.ESTADO = 'EN_COTIZACION' AND sc.ELIMINADO = 'N'
        AND NOT EXISTS (
          SELECT 1 FROM COM_RFQ_CABECERA r
          WHERE r.ID_SOLICITUD = sc.ID_SOLICITUD AND r.ELIMINADO = 'N'
        )
      ORDER BY sc.ID_SOLICITUD DESC FETCH FIRST 25 ROWS ONLY`;
    return this.previewSolicitudes(sql, conn);
  }

  /**
   * Solicitudes EN_COTIZACION con al menos una cotizacion registrada y ningun
   * renglon adjudicado todavia (listas para que el financiero adjudique).
   */
  public async solicitudesParaAdjudicar(
    conn?: Connection,
  ): Promise<readonly { idSolicitud: number; resumen: string }[]> {
    const sql = `
      SELECT sc.ID_SOLICITUD AS ID, SUBSTR(sc.JUSTIFICACION, 1, 80) AS RESUMEN
      FROM COM_SOLICITUD_COMPRA sc
      WHERE sc.ESTADO = 'EN_COTIZACION' AND sc.ELIMINADO = 'N'
        AND EXISTS (
          SELECT 1
          FROM COM_SOLICITUD_DETALLE sd
          JOIN COM_COTIZACION_DETALLE cd
            ON cd.ID_SOLICITUD_DETALLE = sd.ID_SOLICITUD_DETALLE AND cd.ELIMINADO = 'N'
          WHERE sd.ID_SOLICITUD = sc.ID_SOLICITUD AND sd.ELIMINADO = 'N'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM COM_SOLICITUD_DETALLE sx
          JOIN COM_COTIZACION_DETALLE cx
            ON cx.ID_SOLICITUD_DETALLE = sx.ID_SOLICITUD_DETALLE AND cx.ELIMINADO = 'N'
          WHERE sx.ID_SOLICITUD = sc.ID_SOLICITUD AND cx.ADJUDICADO = 'S'
        )
      ORDER BY sc.ID_SOLICITUD DESC FETCH FIRST 25 ROWS ONLY`;
    return this.previewSolicitudes(sql, conn);
  }

  /**
   * Solicitudes EN_COTIZACION con al menos un renglon ya adjudicado — el
   * financiero ya decidio, le toca a Compras generar la Orden de Compra.
   */
  public async solicitudesAdjudicadasSinOrden(
    conn?: Connection,
  ): Promise<readonly { idSolicitud: number; resumen: string }[]> {
    const sql = `
      SELECT sc.ID_SOLICITUD AS ID, SUBSTR(sc.JUSTIFICACION, 1, 80) AS RESUMEN
      FROM COM_SOLICITUD_COMPRA sc
      WHERE sc.ESTADO = 'EN_COTIZACION' AND sc.ELIMINADO = 'N'
        AND EXISTS (
          SELECT 1
          FROM COM_SOLICITUD_DETALLE sd
          JOIN COM_COTIZACION_DETALLE cd
            ON cd.ID_SOLICITUD_DETALLE = sd.ID_SOLICITUD_DETALLE AND cd.ELIMINADO = 'N'
          WHERE sd.ID_SOLICITUD = sc.ID_SOLICITUD AND sd.ELIMINADO = 'N' AND cd.ADJUDICADO = 'S'
        )
      ORDER BY sc.ID_SOLICITUD DESC FETCH FIRST 25 ROWS ONLY`;
    return this.previewSolicitudes(sql, conn);
  }

  /** Ordenes de compra enviadas / en transito, a la espera de recepcion. */
  public async ordenesPorRecibir(
    conn?: Connection,
  ): Promise<readonly { idOrdenCompra: number; estado: string }[]> {
    const sql = `
      SELECT ID_ORDEN_COMPRA AS ID, ESTADO AS ESTADO
      FROM COM_ORDEN_COMPRA
      WHERE ESTADO IN ('ENVIADA', 'EN_TRANSITO', 'RECIBIDA_PARCIAL')
        AND ELIMINADO = 'N'
      ORDER BY ID_ORDEN_COMPRA DESC FETCH FIRST 25 ROWS ONLY`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          idOrdenCompra: num(r["ID"]),
          estado: str(r["ESTADO"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_ORDEN_COMPRA");
      }
    }, conn);
  }

  private previewSolicitudes(
    sql: string,
    conn?: Connection,
  ): Promise<readonly { idSolicitud: number; resumen: string }[]> {
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          idSolicitud: num(r["ID"]),
          resumen: str(r["RESUMEN"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_SOLICITUD_COMPRA");
      }
    }, conn);
  }

  /** Cotizaciones de todas las lineas de una solicitud, listas para comparar. */
  public async cotizacionesComparadas(
    idSolicitud: number,
    conn?: Connection,
  ): Promise<readonly CotizacionComparada[]> {
    const sql = `
      SELECT
        sd.ID_SOLICITUD_DETALLE      AS ID_SOLICITUD_DETALLE,
        sd.DESCRIPCION               AS DESCRIPCION_LINEA,
        sd.CANTIDAD_SOLICITADA       AS CANTIDAD_SOLICITADA,
        cp.ID_COTIZACION             AS ID_COTIZACION,
        cd.ID_COTIZACION_DETALLE     AS ID_COTIZACION_DETALLE,
        p.ID_PROVEEDOR               AS ID_PROVEEDOR,
        p.RAZON_SOCIAL               AS PROVEEDOR,
        p.NIT                        AS NIT_PROVEEDOR,
        cp.ID_MONEDA                 AS ID_MONEDA,
        m.CODIGO                     AS MONEDA_CODIGO,
        cp.TASA_CAMBIO               AS TASA_CAMBIO,
        pago.DIAS                    AS CONDICION_PAGO_DIAS,
        cd.PRECIO_UNITARIO           AS PRECIO_UNITARIO,
        cd.CANTIDAD                  AS CANTIDAD,
        cd.PORCENTAJE_DESCUENTO      AS PORCENTAJE_DESCUENTO,
        cd.PORCENTAJE_IMPUESTO       AS PORCENTAJE_IMPUESTO,
        cd.ADJUDICADO                AS ADJUDICADO,
        cp.FECHA_COTIZACION          AS FECHA_COTIZACION,
        (cd.PRECIO_UNITARIO * (1 - cd.PORCENTAJE_DESCUENTO / 100))            AS PRECIO_NETO,
        (cd.PRECIO_UNITARIO * (1 - cd.PORCENTAJE_DESCUENTO / 100) * cp.TASA_CAMBIO) AS PRECIO_NETO_MONEDA,
        (cd.CANTIDAD * cd.PRECIO_UNITARIO * (1 - cd.PORCENTAJE_DESCUENTO / 100)
          * (1 + cd.PORCENTAJE_IMPUESTO / 100))                              AS TOTAL_LINEA
      FROM COM_SOLICITUD_DETALLE sd
      JOIN COM_COTIZACION_DETALLE cd  ON cd.ID_SOLICITUD_DETALLE = sd.ID_SOLICITUD_DETALLE AND cd.ELIMINADO = 'N'
      JOIN COM_COTIZACION_PROVEEDOR cp ON cp.ID_COTIZACION = cd.ID_COTIZACION AND cp.ELIMINADO = 'N'
      JOIN COM_PROVEEDOR p            ON p.ID_PROVEEDOR = cp.ID_PROVEEDOR
      JOIN COM_MONEDA m              ON m.ID_MONEDA = cp.ID_MONEDA
      JOIN COM_CONDICION_PAGO pago    ON pago.ID_CONDICION_PAGO = cp.ID_CONDICION_PAGO
      WHERE sd.ID_SOLICITUD = :idSolicitud
        AND sd.ELIMINADO = 'N'
      ORDER BY sd.ID_SOLICITUD_DETALLE, PRECIO_NETO_MONEDA`;

    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { idSolicitud });
        return (res.rows ?? []).map((r) => this.mapCotizacion(r));
      } catch (error) {
        throw mapOracleError(error, "VW_COMPARATIVO_COTIZACIONES");
      }
    }, conn);
  }

  /** Lineas de la solicitud vinculada a un RFQ (para cotizar cada renglon). */
  public async lineasSolicitudDeRfq(
    idRfq: number,
    conn?: Connection,
  ): Promise<
    readonly {
      idSolicitudDetalle: number;
      descripcion: string;
      cantidadSolicitada: number;
      unidadMedida: string;
      idUnidadMedida: number;
    }[]
  > {
    const sql = `
      SELECT
        sd.ID_SOLICITUD_DETALLE AS ID_SOLICITUD_DETALLE,
        sd.DESCRIPCION          AS DESCRIPCION,
        sd.CANTIDAD_SOLICITADA  AS CANTIDAD_SOLICITADA,
        sd.ID_UNIDAD_MEDIDA     AS ID_UNIDAD_MEDIDA,
        um.NOMBRE               AS UNIDAD_MEDIDA
      FROM COM_RFQ_CABECERA rfq
      JOIN COM_SOLICITUD_DETALLE sd ON sd.ID_SOLICITUD = rfq.ID_SOLICITUD AND sd.ELIMINADO = 'N'
      LEFT JOIN INV_UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA = sd.ID_UNIDAD_MEDIDA
      WHERE rfq.ID_RFQ = :idRfq
      ORDER BY sd.ID_SOLICITUD_DETALLE`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { idRfq });
        return (res.rows ?? []).map((r) => ({
          idSolicitudDetalle: num(r["ID_SOLICITUD_DETALLE"]),
          descripcion: str(r["DESCRIPCION"]),
          cantidadSolicitada: num(r["CANTIDAD_SOLICITADA"]),
          idUnidadMedida: num(r["ID_UNIDAD_MEDIDA"]),
          unidadMedida: str(r["UNIDAD_MEDIDA"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_SOLICITUD_DETALLE");
      }
    }, conn);
  }

  /** Proveedores invitados a un RFQ (para acotar el select de la cotizacion). */
  public async proveedoresDeRfq(
    idRfq: number,
    conn?: Connection,
  ): Promise<readonly { idProveedor: number; razonSocial: string; nit: string }[]> {
    const sql = `
      SELECT p.ID_PROVEEDOR AS ID_PROVEEDOR, p.RAZON_SOCIAL AS RAZON_SOCIAL, p.NIT AS NIT
      FROM COM_RFQ_PROVEEDOR rp
      JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = rp.ID_PROVEEDOR AND p.ELIMINADO = 'N'
      WHERE rp.ID_RFQ = :idRfq AND rp.ELIMINADO = 'N'
      ORDER BY p.RAZON_SOCIAL`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { idRfq });
        return (res.rows ?? []).map((r) => ({
          idProveedor: num(r["ID_PROVEEDOR"]),
          razonSocial: str(r["RAZON_SOCIAL"]),
          nit: str(r["NIT"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_RFQ_PROVEEDOR");
      }
    }, conn);
  }

  /**
   * RFQ para elegir al registrar una cotizacion suelta (fuera del asistente
   * guiado) — con la justificacion de la solicitud y cuantos proveedores
   * invito, no solo el numero de RFQ: el usuario necesita distinguir UN RFQ
   * de otro por lo que pidieron, no por su id.
   */
  public async rfqSeleccionables(
    conn?: Connection,
  ): Promise<
    readonly {
      idRfq: number;
      resumen: string;
      fechaLimite: string;
      estado: string;
      proveedoresInvitados: number;
    }[]
  > {
    const sql = `
      SELECT
        r.ID_RFQ                                                        AS ID_RFQ,
        SUBSTR(sc.JUSTIFICACION, 1, 70)                                 AS RESUMEN,
        r.FECHA_LIMITE                                                  AS FECHA_LIMITE,
        r.ESTADO                                                        AS ESTADO,
        (SELECT COUNT(*) FROM COM_RFQ_PROVEEDOR rp
          WHERE rp.ID_RFQ = r.ID_RFQ AND rp.ELIMINADO = 'N')             AS PROVEEDORES
      FROM COM_RFQ_CABECERA r
      JOIN COM_SOLICITUD_COMPRA sc ON sc.ID_SOLICITUD = r.ID_SOLICITUD
      WHERE r.ELIMINADO = 'N'
      ORDER BY r.ID_RFQ DESC
      FETCH FIRST 100 ROWS ONLY`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          idRfq: num(r["ID_RFQ"]),
          resumen: str(r["RESUMEN"]),
          fechaLimite: iso(r["FECHA_LIMITE"]).slice(0, 10),
          estado: str(r["ESTADO"]),
          proveedoresInvitados: num(r["PROVEEDORES"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_RFQ_CABECERA");
      }
    }, conn);
  }

  /**
   * Proveedores ordenados con los "habituales" primero: ya suministraron
   * alguno de los articulos de esta solicitud antes (catalogo
   * COM_ARTICULO_PROVEEDOR, un acuerdo marco, o una OC previa — las mismas 3
   * fuentes que `familiasPorProveedor`). Autorrelleno declarativo para el
   * paso de invitar proveedores al RFQ: no oculta a nadie, solo ordena.
   */
  public async proveedoresSugeridos(
    idSolicitud: number,
    conn?: Connection,
  ): Promise<readonly { idProveedor: number; etiqueta: string }[]> {
    const sql = `
      WITH articulos_solicitud AS (
        SELECT DISTINCT sd.ID_ARTICULO AS ID_ARTICULO
        FROM COM_SOLICITUD_DETALLE sd
        WHERE sd.ID_SOLICITUD = :idSolicitud AND sd.ELIMINADO = 'N' AND sd.ID_ARTICULO IS NOT NULL
      ),
      habituales AS (
        SELECT DISTINCT ID_PROVEEDOR FROM (
          SELECT ap.ID_PROVEEDOR AS ID_PROVEEDOR
            FROM COM_ARTICULO_PROVEEDOR ap
           WHERE ap.ELIMINADO = 'N' AND ap.ID_ARTICULO IN (SELECT ID_ARTICULO FROM articulos_solicitud)
          UNION
          SELECT acp.ID_PROVEEDOR
            FROM COM_ACUERDO_PROVEEDOR acp
           WHERE acp.ELIMINADO = 'N' AND acp.ID_ARTICULO IN (SELECT ID_ARTICULO FROM articulos_solicitud)
          UNION
          SELECT oc.ID_PROVEEDOR
            FROM COM_ORDEN_COMPRA oc
            JOIN COM_ORDEN_COMPRA_DETALLE ocd
              ON ocd.ID_ORDEN_COMPRA = oc.ID_ORDEN_COMPRA AND ocd.ELIMINADO = 'N'
           WHERE oc.ELIMINADO = 'N' AND ocd.ID_ARTICULO IN (SELECT ID_ARTICULO FROM articulos_solicitud)
        )
      )
      SELECT
        p.ID_PROVEEDOR                                           AS ID_PROVEEDOR,
        p.RAZON_SOCIAL                                           AS RAZON_SOCIAL,
        CASE WHEN h.ID_PROVEEDOR IS NOT NULL THEN 1 ELSE 0 END   AS HABITUAL
      FROM COM_PROVEEDOR p
      LEFT JOIN habituales h ON h.ID_PROVEEDOR = p.ID_PROVEEDOR
      WHERE p.ELIMINADO = 'N' AND p.ESTADO = 'A'
      ORDER BY HABITUAL DESC, p.RAZON_SOCIAL ASC`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { idSolicitud });
        return (res.rows ?? []).map((r) => {
          const habitual = num(r["HABITUAL"]) === 1;
          const razonSocial = str(r["RAZON_SOCIAL"]);
          return {
            idProveedor: num(r["ID_PROVEEDOR"]),
            etiqueta: habitual
              ? `${razonSocial} · ya suministró algo de esta solicitud`
              : razonSocial,
          };
        });
      } catch (error) {
        throw mapOracleError(error, "COM_PROVEEDOR");
      }
    }, conn);
  }

  /** Lineas de cotizacion ADJUDICADAS de una solicitud (para armar la OC). */
  public async cotizacionesAdjudicadas(
    idSolicitud: number,
    conn?: Connection,
  ): Promise<
    readonly {
      idCotizacionDetalle: number;
      idSolicitudDetalle: number;
      idProveedor: number;
      proveedor: string;
      idMoneda: number;
      tasaCambio: number;
      descripcion: string;
      precioUnitario: number;
      porcentajeDescuento: number;
      porcentajeImpuesto: number;
      cantidad: number;
      idUnidadMedida: number;
    }[]
  > {
    const sql = `
      SELECT
        cd.ID_COTIZACION_DETALLE AS ID_COTIZACION_DETALLE,
        cd.ID_SOLICITUD_DETALLE  AS ID_SOLICITUD_DETALLE,
        cp.ID_PROVEEDOR          AS ID_PROVEEDOR,
        p.RAZON_SOCIAL           AS PROVEEDOR,
        cp.ID_MONEDA             AS ID_MONEDA,
        cp.TASA_CAMBIO           AS TASA_CAMBIO,
        sd.DESCRIPCION           AS DESCRIPCION,
        cd.PRECIO_UNITARIO       AS PRECIO_UNITARIO,
        cd.PORCENTAJE_DESCUENTO  AS PORCENTAJE_DESCUENTO,
        cd.PORCENTAJE_IMPUESTO   AS PORCENTAJE_IMPUESTO,
        cd.CANTIDAD              AS CANTIDAD,
        cd.ID_UNIDAD_MEDIDA      AS ID_UNIDAD_MEDIDA
      FROM COM_COTIZACION_DETALLE cd
      JOIN COM_COTIZACION_PROVEEDOR cp ON cp.ID_COTIZACION = cd.ID_COTIZACION AND cp.ELIMINADO = 'N'
      JOIN COM_RFQ_CABECERA rfq        ON rfq.ID_RFQ = cp.ID_RFQ
      JOIN COM_PROVEEDOR p             ON p.ID_PROVEEDOR = cp.ID_PROVEEDOR
      JOIN COM_SOLICITUD_DETALLE sd    ON sd.ID_SOLICITUD_DETALLE = cd.ID_SOLICITUD_DETALLE
      WHERE rfq.ID_SOLICITUD = :idSolicitud
        AND cd.ADJUDICADO = 'S'
        AND cd.ELIMINADO = 'N'
      ORDER BY cd.ID_SOLICITUD_DETALLE`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { idSolicitud });
        return (res.rows ?? []).map((r) => ({
          idCotizacionDetalle: num(r["ID_COTIZACION_DETALLE"]),
          idSolicitudDetalle: num(r["ID_SOLICITUD_DETALLE"]),
          idProveedor: num(r["ID_PROVEEDOR"]),
          proveedor: str(r["PROVEEDOR"]),
          idMoneda: num(r["ID_MONEDA"]),
          tasaCambio: num(r["TASA_CAMBIO"]),
          descripcion: str(r["DESCRIPCION"]),
          precioUnitario: num(r["PRECIO_UNITARIO"]),
          porcentajeDescuento: num(r["PORCENTAJE_DESCUENTO"]),
          porcentajeImpuesto: num(r["PORCENTAJE_IMPUESTO"]),
          cantidad: num(r["CANTIDAD"]),
          idUnidadMedida: num(r["ID_UNIDAD_MEDIDA"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_COTIZACION_DETALLE");
      }
    }, conn);
  }

  /** Criterios de puntuacion que registro el director sobre las cotizaciones. */
  public async criteriosComparativos(
    idSolicitud: number,
    conn?: Connection,
  ): Promise<readonly CriterioComparativo[]> {
    const sql = `
      SELECT
        cc.ID_COMPARATIVO         AS ID_COMPARATIVO,
        cc.ID_SOLICITUD           AS ID_SOLICITUD,
        cc.ID_COTIZACION_DETALLE  AS ID_COTIZACION_DETALLE,
        p.ID_PROVEEDOR            AS ID_PROVEEDOR,
        p.RAZON_SOCIAL            AS PROVEEDOR,
        cc.CRITERIO               AS CRITERIO,
        cc.PUNTUACION             AS PUNTUACION,
        cc.NOTAS                  AS NOTAS
      FROM COM_COMPARATIVO_COTIZACIONES cc
      JOIN COM_COTIZACION_DETALLE cd  ON cd.ID_COTIZACION_DETALLE = cc.ID_COTIZACION_DETALLE
      JOIN COM_COTIZACION_PROVEEDOR cp ON cp.ID_COTIZACION = cd.ID_COTIZACION
      JOIN COM_PROVEEDOR p            ON p.ID_PROVEEDOR = cp.ID_PROVEEDOR
      WHERE cc.ID_SOLICITUD = :idSolicitud
        AND cc.ELIMINADO = 'N'
      ORDER BY cc.CRITERIO, cc.PUNTUACION DESC NULLS LAST`;

    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { idSolicitud });
        return (res.rows ?? []).map((r) => ({
          idComparativo: num(r["ID_COMPARATIVO"]),
          idSolicitud: num(r["ID_SOLICITUD"]),
          idCotizacionDetalle: num(r["ID_COTIZACION_DETALLE"]),
          idProveedor: num(r["ID_PROVEEDOR"]),
          proveedor: str(r["PROVEEDOR"]),
          criterio: str(r["CRITERIO"]),
          puntuacion: r["PUNTUACION"] === null ? null : num(r["PUNTUACION"]),
          notas: r["NOTAS"] === null ? null : str(r["NOTAS"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_COMPARATIVO_COTIZACIONES");
      }
    }, conn);
  }

  /**
   * Historial de precios reales de compra. Mismas 4 tablas base que arma
   * VW_COM_PRECIO_HISTORIAL, consultadas directamente (en vez de la vista)
   * para poder devolver tambien ID_ORDEN_COMPRA/ID_RECEPCION — el origen
   * exacto de cada linea, que la vista no expone y que la UI necesita para
   * distinguir compras que coinciden en fecha/precio (dos recepciones reales
   * el mismo dia al mismo precio son normales, no un error de datos).
   */
  public async historialPrecios(
    q: HistorialQuery,
    conn?: Connection,
  ): Promise<{ rows: readonly HistorialPrecioRow[]; total: number; resumen: HistorialResumen }> {
    const filtros: string[] = [];
    const binds: Record<string, unknown> = {};
    if (q.idProveedor !== undefined) {
      filtros.push("o.ID_PROVEEDOR = :idProveedor");
      binds["idProveedor"] = q.idProveedor;
    }
    if (q.idArticulo !== undefined) {
      filtros.push("od.ID_ARTICULO = :idArticulo");
      binds["idArticulo"] = q.idArticulo;
    }
    // `desde`/`hasta` son DIAS (YYYY-MM-DD) y `hasta` es INCLUSIVO, igual que en los
    // reportes de gasto/desempeno: "hasta hoy" incluye lo registrado hoy. Antes se
    // comparaba contra la medianoche y el filtro por la UI excluia el dia final.
    if (q.desde !== undefined) {
      filtros.push("r.FECHA_RECEPCION >= TO_DATE(:desde, 'YYYY-MM-DD')");
      binds["desde"] = q.desde;
    }
    if (q.hasta !== undefined) {
      filtros.push("r.FECHA_RECEPCION < TO_DATE(:hasta, 'YYYY-MM-DD') + 1");
      binds["hasta"] = q.hasta;
    }
    const andFiltros = filtros.length > 0 ? `AND ${filtros.join(" AND ")}` : "";
    const offset = (q.page - 1) * q.pageSize;

    const base = `
      FROM COM_RECEPCION r
      JOIN COM_RECEPCION_DETALLE rd ON r.ID_RECEPCION = rd.ID_RECEPCION
      JOIN COM_ORDEN_COMPRA_DETALLE od ON rd.ID_OC_DETALLE = od.ID_OC_DETALLE
      JOIN COM_ORDEN_COMPRA o ON od.ID_ORDEN_COMPRA = o.ID_ORDEN_COMPRA
      JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = o.ID_PROVEEDOR
      JOIN INV_ARTICULO a  ON a.ID_ARTICULO = od.ID_ARTICULO
      WHERE od.ID_ARTICULO IS NOT NULL
        AND rd.CANTIDAD_RECIBIDA > 0
        ${andFiltros}`;

    const dataSql = `
      SELECT
        o.ID_PROVEEDOR            AS ID_PROVEEDOR,
        p.RAZON_SOCIAL            AS PROVEEDOR,
        od.ID_ARTICULO            AS ID_ARTICULO,
        a.CODIGO                  AS ARTICULO_CODIGO,
        a.NOMBRE                  AS ARTICULO,
        od.PRECIO_UNITARIO        AS PRECIO_ACORDADO,
        od.PORCENTAJE_DESCUENTO   AS PORCENTAJE_DESCUENTO,
        od.PORCENTAJE_IMPUESTO    AS PORCENTAJE_IMPUESTO,
        rd.CANTIDAD_RECIBIDA      AS CANTIDAD_REAL_COMPRADA,
        r.FECHA_RECEPCION         AS FECHA_COMPRA,
        o.ID_MONEDA               AS ID_MONEDA,
        o.TASA_CAMBIO             AS TASA_CAMBIO,
        o.ID_ORDEN_COMPRA         AS ID_ORDEN_COMPRA,
        r.ID_RECEPCION            AS ID_RECEPCION
      ${base}
      ORDER BY r.FECHA_RECEPCION DESC
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

    const aggSql = `
      SELECT
        COUNT(*)                              AS REGISTROS,
        MIN(od.PRECIO_UNITARIO)                AS PRECIO_MIN,
        MAX(od.PRECIO_UNITARIO)                AS PRECIO_MAX,
        AVG(od.PRECIO_UNITARIO)                AS PRECIO_PROMEDIO,
        NVL(SUM(rd.CANTIDAD_RECIBIDA), 0)      AS CANTIDAD_TOTAL
      ${base}`;

    return oraclePool().withConnection(async (c) => {
      try {
        const dataRes = await c.execute<Row>(
          dataSql,
          asBinds({ ...binds, offset, limit: q.pageSize }),
        );
        const aggRes = await c.execute<Row>(aggSql, asBinds(binds));
        const agg = aggRes.rows?.[0] ?? {};
        const total = num(agg["REGISTROS"]);
        return {
          rows: (dataRes.rows ?? []).map((r) => this.mapHistorial(r)),
          total,
          resumen: {
            registros: total,
            precioMin: agg["PRECIO_MIN"] === null ? null : num(agg["PRECIO_MIN"]),
            precioMax: agg["PRECIO_MAX"] === null ? null : num(agg["PRECIO_MAX"]),
            precioPromedio:
              agg["PRECIO_PROMEDIO"] === null
                ? null
                : Number(num(agg["PRECIO_PROMEDIO"]).toFixed(4)),
            cantidadTotal: num(agg["CANTIDAD_TOTAL"]),
          },
        };
      } catch (error) {
        throw mapOracleError(error, "COM_RECEPCION");
      }
    }, conn);
  }

  // ---- Dashboard: series temporales + indice de ahorro -----------------

  /**
   * Monto (GTQ) y numero de ordenes de compra EMITIDAS por mes de emision,
   * en la ventana de los ultimos `meses` meses calendario (incluye el actual).
   * El monto usa el neto de linea (cantidad x precio x (1 - desc)) convertido a
   * GTQ con la tasa de cambio de la orden. Solo devuelve los meses con datos.
   */
  public async comprasPorMesOc(
    meses: number,
    conn?: Connection,
  ): Promise<readonly CompraMesRow[]> {
    const sql = `
      SELECT
        TO_CHAR(TRUNC(oc.FECHA_EMISION, 'MM'), 'YYYY-MM')                        AS PERIODO,
        NVL(SUM(od.CANTIDAD * od.PRECIO_UNITARIO
                * (1 - od.PORCENTAJE_DESCUENTO / 100) * oc.TASA_CAMBIO), 0)       AS MONTO,
        COUNT(DISTINCT oc.ID_ORDEN_COMPRA)                                        AS ORDENES
      FROM COM_ORDEN_COMPRA oc
      JOIN COM_ORDEN_COMPRA_DETALLE od
        ON od.ID_ORDEN_COMPRA = oc.ID_ORDEN_COMPRA AND od.ELIMINADO = 'N'
      WHERE oc.ELIMINADO = 'N'
        AND oc.FECHA_EMISION >= ADD_MONTHS(TRUNC(SYSTIMESTAMP, 'MM'), -(:meses - 1))
      GROUP BY TRUNC(oc.FECHA_EMISION, 'MM')
      ORDER BY TRUNC(oc.FECHA_EMISION, 'MM')`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { meses });
        return (res.rows ?? []).map((r) => ({
          periodo: str(r["PERIODO"]),
          monto: Number(num(r["MONTO"]).toFixed(2)),
          ordenes: num(r["ORDENES"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_ORDEN_COMPRA");
      }
    }, conn);
  }

  /**
   * Valor de las entradas por compra (ENTRADA_COMPRA en el kardex) por mes de
   * movimiento, en la ventana de los ultimos `meses` meses. Mismo costo-base que
   * el kardex / la existencia (no re-normalizado a GTQ), para que la razon
   * entradas / existencia sea consistente. Solo devuelve los meses con datos.
   */
  public async valorEntradasPorMes(
    meses: number,
    conn?: Connection,
  ): Promise<readonly EntradaMesRow[]> {
    const sql = `
      SELECT
        TO_CHAR(TRUNC(k.FECHA_MOVIMIENTO, 'MM'), 'YYYY-MM')  AS PERIODO,
        NVL(SUM(k.CANTIDAD * k.COSTO_UNITARIO), 0)           AS VALOR
      FROM INV_KARDEX_MOVIMIENTO k
      WHERE k.ELIMINADO = 'N'
        AND k.TIPO_MOVIMIENTO = 'ENTRADA_COMPRA'
        AND k.FECHA_MOVIMIENTO >= ADD_MONTHS(TRUNC(SYSTIMESTAMP, 'MM'), -(:meses - 1))
      GROUP BY TRUNC(k.FECHA_MOVIMIENTO, 'MM')
      ORDER BY TRUNC(k.FECHA_MOVIMIENTO, 'MM')`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { meses });
        return (res.rows ?? []).map((r) => ({
          periodo: str(r["PERIODO"]),
          valor: Number(num(r["VALOR"]).toFixed(2)),
        }));
      } catch (error) {
        throw mapOracleError(error, "INV_KARDEX_MOVIMIENTO");
      }
    }, conn);
  }

  /** Existencia valorizada actual: SUM(cantidad x costo promedio) en todas las bodegas. */
  public async existenciaValorizada(conn?: Connection): Promise<number> {
    const sql = `
      SELECT NVL(SUM(CANTIDAD_ACTUAL * COSTO_PROMEDIO_ACTUAL), 0) AS V
      FROM INV_EXISTENCIA_BODEGA WHERE ELIMINADO = 'N'`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return Number(num(res.rows?.[0]?.["V"]).toFixed(2));
      } catch (error) {
        throw mapOracleError(error, "INV_EXISTENCIA_BODEGA");
      }
    }, conn);
  }

  /**
   * Ahorro de adjudicacion: por cada linea de solicitud con una cotizacion
   * adjudicada Y al menos una alternativa, compara el precio neto (GTQ) de la
   * adjudicada contra el mas caro cotizado para esa linea.
   *  - `ahorroPromedioPct`  : promedio simple del ahorro % por linea.
   *  - `montoSiMasCaro - montoAdjudicado` : ahorro absoluto ponderado por cantidad.
   */
  public async ahorroAdjudicacion(conn?: Connection): Promise<AhorroAdjudicacionRow> {
    const sql = `
      WITH cot AS (
        SELECT
          cd.ID_SOLICITUD_DETALLE                                             AS ID_SD,
          cd.ADJUDICADO                                                       AS ADJUDICADO,
          cd.CANTIDAD                                                         AS CANTIDAD,
          (cd.PRECIO_UNITARIO * (1 - cd.PORCENTAJE_DESCUENTO / 100)
            * cp.TASA_CAMBIO)                                                 AS PRECIO_NETO_GTQ
        FROM COM_COTIZACION_DETALLE cd
        JOIN COM_COTIZACION_PROVEEDOR cp
          ON cp.ID_COTIZACION = cd.ID_COTIZACION AND cp.ELIMINADO = 'N'
        WHERE cd.ELIMINADO = 'N'
      ),
      linea AS (
        SELECT
          ID_SD,
          COUNT(*)                                                     AS N_COT,
          MAX(PRECIO_NETO_GTQ)                                         AS PRECIO_MAX,
          MAX(CASE WHEN ADJUDICADO = 'S' THEN PRECIO_NETO_GTQ END)     AS PRECIO_ADJ,
          MAX(CASE WHEN ADJUDICADO = 'S' THEN CANTIDAD END)            AS CANT_ADJ
        FROM cot
        GROUP BY ID_SD
      )
      SELECT
        COUNT(CASE WHEN PRECIO_ADJ IS NOT NULL THEN 1 END)                       AS LINEAS_ADJ,
        COUNT(CASE WHEN PRECIO_ADJ IS NOT NULL AND N_COT >= 2 THEN 1 END)        AS LINEAS_ALT,
        AVG(CASE WHEN PRECIO_ADJ IS NOT NULL AND N_COT >= 2 AND PRECIO_MAX > 0
                 THEN (PRECIO_MAX - PRECIO_ADJ) / PRECIO_MAX * 100 END)          AS AHORRO_PROM_PCT,
        NVL(SUM(CASE WHEN PRECIO_ADJ IS NOT NULL AND N_COT >= 2
                     THEN PRECIO_ADJ * NVL(CANT_ADJ, 0) END), 0)                 AS MONTO_ADJ,
        NVL(SUM(CASE WHEN PRECIO_ADJ IS NOT NULL AND N_COT >= 2
                     THEN PRECIO_MAX * NVL(CANT_ADJ, 0) END), 0)                 AS MONTO_MAX
      FROM linea`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        const r = res.rows?.[0] ?? {};
        return {
          lineasAdjudicadas: num(r["LINEAS_ADJ"]),
          lineasConAlternativa: num(r["LINEAS_ALT"]),
          ahorroPromedioPct:
            r["AHORRO_PROM_PCT"] === null || r["AHORRO_PROM_PCT"] === undefined
              ? null
              : Number(num(r["AHORRO_PROM_PCT"]).toFixed(2)),
          montoAdjudicado: Number(num(r["MONTO_ADJ"]).toFixed(2)),
          montoSiMasCaro: Number(num(r["MONTO_MAX"]).toFixed(2)),
        };
      } catch (error) {
        throw mapOracleError(error, "COM_COTIZACION_DETALLE");
      }
    }, conn);
  }

  /**
   * Vincula alertas de escasez con la solicitud que las cubre: dejan de ofrecerse (mientras la
   * solicitud no sea rechazada) y no se vuelve a pedir lo mismo dos veces.
   */
  public async vincularAlertasEscasez(idSolicitud: number, idAlertas: readonly number[]): Promise<number> {
    if (idAlertas.length === 0) return 0;
    return oraclePool().withTransaction(async (c) => {
      let n = 0;
      for (const id of idAlertas) {
        const r = await c.execute(
          `UPDATE INV_ALERTA_ESCASEZ SET ID_SOLICITUD_GENERADA = :s
            WHERE ID_ALERTA = :a AND ELIMINADO = 'N' AND ESTADO = 'PENDIENTE'`,
          asBinds({ s: idSolicitud, a: id }),
        );
        n += r.rowsAffected ?? 0;
      }
      return n;
    });
  }

  /**
   * Alertas de escasez abiertas (INV_ALERTA_ESCASEZ.ESTADO = 'PENDIENTE'), con
   * el faltante y la cantidad sugerida de reposicion ya calculados
   * (`stockMaximo - cantidadActual`, viva vs. INV_EXISTENCIA_BODEGA — no la
   * foto de deteccion de la alerta, que puede haber quedado desactualizada).
   */
  public async alertasEscasezPendientes(
    conn?: Connection,
  ): Promise<readonly AlertaEscasezRow[]> {
    const sql = `
      SELECT
        a.ID_ALERTA                    AS ID_ALERTA,
        a.ID_ARTICULO                  AS ID_ARTICULO,
        a.ID_BODEGA                    AS ID_BODEGA,
        art.CODIGO                     AS CODIGO,
        art.NOMBRE                     AS NOMBRE,
        bod.NOMBRE                     AS BODEGA,
        NVL(ex.CANTIDAD_ACTUAL, 0)     AS CANTIDAD_ACTUAL,
        art.STOCK_MINIMO               AS STOCK_MINIMO,
        art.STOCK_MAXIMO               AS STOCK_MAXIMO
      FROM INV_ALERTA_ESCASEZ a
      JOIN INV_ARTICULO art ON art.ID_ARTICULO = a.ID_ARTICULO
      JOIN INV_BODEGA bod ON bod.ID_BODEGA = a.ID_BODEGA
      LEFT JOIN INV_EXISTENCIA_BODEGA ex
        ON ex.ID_ARTICULO = a.ID_ARTICULO AND ex.ID_BODEGA = a.ID_BODEGA AND ex.ELIMINADO = 'N'
      WHERE a.ELIMINADO = 'N' AND a.ESTADO = 'PENDIENTE'
        AND NOT EXISTS (
          SELECT 1 FROM COM_SOLICITUD_COMPRA s
           WHERE s.ID_SOLICITUD = a.ID_SOLICITUD_GENERADA AND s.ELIMINADO = 'N' AND s.ESTADO <> 'RECHAZADA')
      ORDER BY a.FECHA_DETECCION DESC FETCH FIRST 50 ROWS ONLY`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => {
          const cantidadActual = num(r["CANTIDAD_ACTUAL"]);
          const stockMinimo = num(r["STOCK_MINIMO"]);
          const stockMaximo = num(r["STOCK_MAXIMO"]);
          const faltante = Math.max(stockMinimo - cantidadActual, 0);
          const sugerido = Math.max(stockMaximo - cantidadActual, faltante);
          return {
            idAlerta: num(r["ID_ALERTA"]),
            idArticulo: num(r["ID_ARTICULO"]),
            idBodega: num(r["ID_BODEGA"]),
            codigo: str(r["CODIGO"]),
            nombre: str(r["NOMBRE"]),
            bodega: str(r["BODEGA"]),
            cantidadActual,
            stockMinimo,
            stockMaximo,
            faltante: Number(faltante.toFixed(2)),
            cantidadSugerida: Number(sugerido.toFixed(2)),
          };
        });
      } catch (error) {
        throw mapOracleError(error, "INV_ALERTA_ESCASEZ");
      }
    }, conn);
  }

  // ---- RFQ: si admite Eliminar ---------------------------------------------

  /**
   * Por cada RFQ activo, si admite Eliminar: el mismo cerrojo exacto que
   * `RfqService.eliminar` (ABIERTO y sin ninguna cotizacion registrada) — el
   * estado por si solo no alcanza (un RFQ ABIERTO con cotizaciones ya
   * registradas igual se rechaza con 409).
   */
  public async rfqEliminable(
    conn?: Connection,
  ): Promise<readonly { idRfq: number; eliminable: boolean }[]> {
    const sql = `
      SELECT
        r.ID_RFQ AS ID_RFQ,
        CASE
          WHEN r.ESTADO = 'ABIERTO'
           AND NOT EXISTS (
             SELECT 1 FROM COM_COTIZACION_PROVEEDOR cp
             WHERE cp.ID_RFQ = r.ID_RFQ AND cp.ELIMINADO = 'N'
           )
          THEN 1 ELSE 0
        END AS ELIMINABLE
      FROM COM_RFQ_CABECERA r
      WHERE r.ELIMINADO = 'N'`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          idRfq: num(r["ID_RFQ"]),
          eliminable: num(r["ELIMINABLE"]) === 1,
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_RFQ_CABECERA");
      }
    }, conn);
  }

  // ---- Cotizacion: si admite Editar/Eliminar ------------------------------

  /**
   * Por cada cotizacion activa, si admite Editar/Eliminar: el mismo cerrojo
   * exacto que `CotizacionService.assertEditable` (RFQ ABIERTO y ninguna
   * linea adjudicada) — para que el frontend pueda ocultar esas acciones en
   * vez de ofrecerlas y que el backend las rechace con 409.
   */
  public async cotizacionesEditables(
    conn?: Connection,
  ): Promise<readonly { idCotizacion: number; editable: boolean }[]> {
    const sql = `
      SELECT
        cp.ID_COTIZACION AS ID_COTIZACION,
        CASE
          WHEN r.ESTADO = 'ABIERTO'
           AND NOT EXISTS (
             SELECT 1 FROM COM_COTIZACION_DETALLE cd
             WHERE cd.ID_COTIZACION = cp.ID_COTIZACION
               AND cd.ELIMINADO = 'N' AND cd.ADJUDICADO = 'S'
           )
          THEN 1 ELSE 0
        END AS EDITABLE
      FROM COM_COTIZACION_PROVEEDOR cp
      JOIN COM_RFQ_CABECERA r ON r.ID_RFQ = cp.ID_RFQ
      WHERE cp.ELIMINADO = 'N'`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          idCotizacion: num(r["ID_COTIZACION"]),
          editable: num(r["EDITABLE"]) === 1,
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_COTIZACION_PROVEEDOR");
      }
    }, conn);
  }

  // ---- Orden de compra: datos resueltos para el PDF ----------------------

  /**
   * Cabecera + renglones de una OC con nombres legibles (proveedor, moneda,
   * artículo, unidad de medida, quien autoriza) en vez de ids crudos — lo que
   * `OrdenCompraService.obtener` devuelve no alcanza para un documento
   * imprimible. `null` si la OC no existe o está eliminada.
   */
  public async ordenCompraParaPdf(
    idOrdenCompra: number,
    conn?: Connection,
  ): Promise<{
    readonly header: OrdenCompraPdfHeaderRow;
    readonly lineas: readonly OrdenCompraPdfLineaRow[];
  } | null> {
    return oraclePool().withConnection(async (c) => {
      try {
        const h = await c.execute<Row>(
          `SELECT
             oc.ID_ORDEN_COMPRA           AS ID_ORDEN_COMPRA,
             oc.ESTADO                    AS ESTADO,
             oc.FECHA_EMISION             AS FECHA_EMISION,
             oc.FECHA_ENTREGA_ESPERADA    AS FECHA_ENTREGA_ESPERADA,
             oc.NUMERO_REFERENCIA         AS NUMERO_REFERENCIA,
             oc.TASA_CAMBIO               AS TASA_CAMBIO,
             p.RAZON_SOCIAL               AS PROVEEDOR,
             p.NIT                        AS PROVEEDOR_NIT,
             p.DIRECCION                  AS PROVEEDOR_DIRECCION,
             p.TELEFONO                   AS PROVEEDOR_TELEFONO,
             p.EMAIL                      AS PROVEEDOR_EMAIL,
             m.CODIGO                     AS MONEDA_CODIGO,
             m.SIMBOLO                    AS MONEDA_SIMBOLO,
             (e.NOMBRES || ' ' || e.APELLIDOS) AS AUTORIZA
           FROM COM_ORDEN_COMPRA oc
           JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = oc.ID_PROVEEDOR
           JOIN COM_MONEDA m ON m.ID_MONEDA = oc.ID_MONEDA
           JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = oc.ID_EMPLEADO_GERENTE_FINANCIERO
           WHERE oc.ID_ORDEN_COMPRA = :id AND oc.ELIMINADO = 'N'`,
          { id: idOrdenCompra },
        );
        const hr = h.rows?.[0];
        if (hr === undefined) return null;

        const d = await c.execute<Row>(
          `SELECT
             od.ID_OC_DETALLE           AS ID_OC_DETALLE,
             od.DESCRIPCION             AS DESCRIPCION,
             od.CANTIDAD                AS CANTIDAD,
             od.PRECIO_UNITARIO         AS PRECIO_UNITARIO,
             od.PORCENTAJE_DESCUENTO    AS PORCENTAJE_DESCUENTO,
             od.PORCENTAJE_IMPUESTO     AS PORCENTAJE_IMPUESTO,
             od.SUBTOTAL_CALCULADO      AS SUBTOTAL,
             a.CODIGO                   AS ARTICULO_CODIGO,
             NVL(u.ABREVIATURA, u.CODIGO) AS UNIDAD_MEDIDA
           FROM COM_ORDEN_COMPRA_DETALLE od
           LEFT JOIN INV_ARTICULO a ON a.ID_ARTICULO = od.ID_ARTICULO
           JOIN INV_UNIDAD_MEDIDA u ON u.ID_UNIDAD_MEDIDA = od.ID_UNIDAD_MEDIDA
           WHERE od.ID_ORDEN_COMPRA = :id AND od.ELIMINADO = 'N'
           ORDER BY od.ID_OC_DETALLE`,
          { id: idOrdenCompra },
        );

        const header: OrdenCompraPdfHeaderRow = {
          idOrdenCompra: num(hr["ID_ORDEN_COMPRA"]),
          estado: str(hr["ESTADO"]),
          fechaEmision: iso(hr["FECHA_EMISION"]),
          fechaEntregaEsperada: iso(hr["FECHA_ENTREGA_ESPERADA"]),
          numeroReferencia: hr["NUMERO_REFERENCIA"] === null ? null : str(hr["NUMERO_REFERENCIA"]),
          tasaCambio: num(hr["TASA_CAMBIO"]),
          proveedor: str(hr["PROVEEDOR"]),
          proveedorNit: str(hr["PROVEEDOR_NIT"]),
          proveedorDireccion: hr["PROVEEDOR_DIRECCION"] === null ? null : str(hr["PROVEEDOR_DIRECCION"]),
          proveedorTelefono: hr["PROVEEDOR_TELEFONO"] === null ? null : str(hr["PROVEEDOR_TELEFONO"]),
          proveedorEmail: hr["PROVEEDOR_EMAIL"] === null ? null : str(hr["PROVEEDOR_EMAIL"]),
          monedaCodigo: str(hr["MONEDA_CODIGO"]),
          monedaSimbolo: hr["MONEDA_SIMBOLO"] === null ? null : str(hr["MONEDA_SIMBOLO"]),
          autoriza: str(hr["AUTORIZA"]),
        };
        const lineas: OrdenCompraPdfLineaRow[] = (d.rows ?? []).map((r) => ({
          idOcDetalle: num(r["ID_OC_DETALLE"]),
          articuloCodigo: r["ARTICULO_CODIGO"] === null ? null : str(r["ARTICULO_CODIGO"]),
          descripcion: str(r["DESCRIPCION"]),
          cantidad: num(r["CANTIDAD"]),
          unidadMedida: str(r["UNIDAD_MEDIDA"]),
          precioUnitario: num(r["PRECIO_UNITARIO"]),
          porcentajeDescuento: num(r["PORCENTAJE_DESCUENTO"]),
          porcentajeImpuesto: num(r["PORCENTAJE_IMPUESTO"]),
          subtotal: Number(num(r["SUBTOTAL"]).toFixed(2)),
        }));
        return { header, lineas };
      } catch (error) {
        throw mapOracleError(error, "COM_ORDEN_COMPRA");
      }
    }, conn);
  }

  /** Datos resueltos de una Recepcion para la Nota de Ingreso oficial (PDF). */
  public async solicitudParaPdf(idSolicitud: number, conn?: Connection): Promise<SolicitudPdfRow | null> {
    return oraclePool().withConnection(async (c) => {
      try {
        const h = await c.execute<Row>(
          `SELECT sc.ID_SOLICITUD, sc.ESTADO, sc.JUSTIFICACION, sc.PRIORIDAD, sc.MONTO_ESTIMADO, sc.FECHA_CREACION,
                  (e.NOMBRES || ' ' || e.APELLIDOS) AS SOLICITANTE, s.NOMBRE AS SUCURSAL, g.NOMBRE AS GRUPO
             FROM COM_SOLICITUD_COMPRA sc
             JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = sc.ID_EMPLEADO_SOLICITANTE
             JOIN NOM_SUCURSAL s ON s.ID_SUCURSAL = sc.ID_SUCURSAL
             JOIN COM_GRUPO_COMPRA g ON g.ID_GRUPO_COMPRA = sc.ID_GRUPO_COMPRA
            WHERE sc.ID_SOLICITUD = :id AND sc.ELIMINADO = 'N'`,
          { id: idSolicitud },
        );
        const hr = h.rows?.[0];
        if (hr === undefined) return null;
        const d = await c.execute<Row>(
          `SELECT NVL(a.CODIGO || ' — ' || a.NOMBRE, '—') AS ARTICULO, sd.DESCRIPCION, NVL(u.ABREVIATURA, u.CODIGO) AS UNIDAD,
                  sd.CANTIDAD_SOLICITADA, sd.CANTIDAD_AUTORIZADA, sd.FECHA_REQUERIDA
             FROM COM_SOLICITUD_DETALLE sd
             LEFT JOIN INV_ARTICULO a ON a.ID_ARTICULO = sd.ID_ARTICULO
             JOIN INV_UNIDAD_MEDIDA u ON u.ID_UNIDAD_MEDIDA = sd.ID_UNIDAD_MEDIDA
            WHERE sd.ID_SOLICITUD = :id AND sd.ELIMINADO = 'N'
            ORDER BY sd.ID_SOLICITUD_DETALLE`,
          { id: idSolicitud },
        );
        return {
          header: {
            idSolicitud: num(hr["ID_SOLICITUD"]),
            estado: str(hr["ESTADO"]),
            justificacion: str(hr["JUSTIFICACION"]),
            prioridad: num(hr["PRIORIDAD"]),
            montoEstimado: hr["MONTO_ESTIMADO"] === null || hr["MONTO_ESTIMADO"] === undefined ? null : num(hr["MONTO_ESTIMADO"]),
            fechaCreacion: iso(hr["FECHA_CREACION"]),
            solicitante: str(hr["SOLICITANTE"]),
            sucursal: str(hr["SUCURSAL"]),
            grupoCompra: str(hr["GRUPO"]),
          },
          lineas: (d.rows ?? []).map((r) => ({
            articulo: str(r["ARTICULO"]),
            descripcion: str(r["DESCRIPCION"]),
            unidadMedida: str(r["UNIDAD"]),
            cantidadSolicitada: num(r["CANTIDAD_SOLICITADA"]),
            cantidadAutorizada: r["CANTIDAD_AUTORIZADA"] === null || r["CANTIDAD_AUTORIZADA"] === undefined ? null : num(r["CANTIDAD_AUTORIZADA"]),
            fechaRequerida: iso(r["FECHA_REQUERIDA"]),
          })),
        };
      } catch (error) {
        throw mapOracleError(error, "COM_SOLICITUD_COMPRA");
      }
    }, conn);
  }

  public async recepcionParaPdf(
    idRecepcion: number,
    conn?: Connection,
  ): Promise<{
    readonly header: RecepcionPdfHeaderRow;
    readonly lineas: readonly RecepcionPdfLineaRow[];
  } | null> {
    return oraclePool().withConnection(async (c) => {
      try {
        const h = await c.execute<Row>(
          `SELECT
             r.ID_RECEPCION      AS ID_RECEPCION,
             r.ID_ORDEN_COMPRA   AS ID_ORDEN_COMPRA,
             r.FECHA_RECEPCION   AS FECHA_RECEPCION,
             r.ESTADO            AS ESTADO,
             b.NOMBRE            AS BODEGA,
             p.RAZON_SOCIAL      AS PROVEEDOR,
             p.NIT               AS PROVEEDOR_NIT,
             (e.NOMBRES || ' ' || e.APELLIDOS) AS RECIBE
           FROM COM_RECEPCION r
           JOIN INV_BODEGA b ON b.ID_BODEGA = r.ID_BODEGA
           JOIN COM_ORDEN_COMPRA oc ON oc.ID_ORDEN_COMPRA = r.ID_ORDEN_COMPRA
           JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = oc.ID_PROVEEDOR
           JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = r.ID_EMPLEADO_RECIBE
           WHERE r.ID_RECEPCION = :id AND r.ELIMINADO = 'N'`,
          { id: idRecepcion },
        );
        const hr = h.rows?.[0];
        if (hr === undefined) return null;

        const d = await c.execute<Row>(
          `SELECT
             rd.ID_RECEPCION_DETALLE    AS ID_RECEPCION_DETALLE,
             od.DESCRIPCION             AS DESCRIPCION,
             NVL(u.ABREVIATURA, u.CODIGO) AS UNIDAD_MEDIDA,
             rd.CANTIDAD_RECIBIDA       AS CANTIDAD_RECIBIDA,
             rd.CANTIDAD_RECHAZADA      AS CANTIDAD_RECHAZADA
           FROM COM_RECEPCION_DETALLE rd
           JOIN COM_ORDEN_COMPRA_DETALLE od ON od.ID_OC_DETALLE = rd.ID_OC_DETALLE
           JOIN INV_UNIDAD_MEDIDA u ON u.ID_UNIDAD_MEDIDA = od.ID_UNIDAD_MEDIDA
           WHERE rd.ID_RECEPCION = :id AND rd.ELIMINADO = 'N'
           ORDER BY rd.ID_RECEPCION_DETALLE`,
          { id: idRecepcion },
        );

        const header: RecepcionPdfHeaderRow = {
          idRecepcion: num(hr["ID_RECEPCION"]),
          idOrdenCompra: num(hr["ID_ORDEN_COMPRA"]),
          fechaRecepcion: iso(hr["FECHA_RECEPCION"]),
          estado: str(hr["ESTADO"]),
          bodega: str(hr["BODEGA"]),
          proveedor: str(hr["PROVEEDOR"]),
          proveedorNit: str(hr["PROVEEDOR_NIT"]),
          recibe: str(hr["RECIBE"]),
        };
        const lineas: RecepcionPdfLineaRow[] = (d.rows ?? []).map((r) => ({
          idRecepcionDetalle: num(r["ID_RECEPCION_DETALLE"]),
          descripcion: str(r["DESCRIPCION"]),
          unidadMedida: str(r["UNIDAD_MEDIDA"]),
          cantidadRecibida: num(r["CANTIDAD_RECIBIDA"]),
          cantidadRechazada: num(r["CANTIDAD_RECHAZADA"]),
        }));
        return { header, lineas };
      } catch (error) {
        throw mapOracleError(error, "COM_RECEPCION");
      }
    }, conn);
  }

  /**
   * Facturas de proveedor listas para liquidar (Cuentas por Pagar): ya tienen
   * recepcion fisica registrada y todavia no estan pagadas por completo.
   */
  public async facturasPendientesLiquidacion(
    conn?: Connection,
  ): Promise<readonly FacturaPendienteLiquidacionRow[]> {
    const sql = `
      SELECT
        f.ID_FACTURA_PROVEEDOR AS ID_FACTURA_PROVEEDOR,
        r.ID_ORDEN_COMPRA      AS ID_ORDEN_COMPRA,
        f.ID_RECEPCION         AS ID_RECEPCION,
        p.RAZON_SOCIAL         AS PROVEEDOR,
        r.FECHA_RECEPCION      AS FECHA_RECEPCION,
        f.MONTO_TOTAL          AS MONTO_TOTAL,
        f.SALDO_PENDIENTE      AS SALDO_PENDIENTE,
        f.ESTADO               AS ESTADO
      FROM CXP_FACTURA_PROVEEDOR f
      JOIN COM_RECEPCION r ON r.ID_RECEPCION = f.ID_RECEPCION
      JOIN COM_ORDEN_COMPRA oc ON oc.ID_ORDEN_COMPRA = r.ID_ORDEN_COMPRA
      JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = oc.ID_PROVEEDOR
      WHERE f.ELIMINADO = 'N' AND f.ESTADO IN ('PENDIENTE', 'PAGADA_PARCIAL')
      ORDER BY r.FECHA_RECEPCION DESC
      FETCH FIRST 100 ROWS ONLY`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          idFacturaProveedor: num(r["ID_FACTURA_PROVEEDOR"]),
          idOrdenCompra: num(r["ID_ORDEN_COMPRA"]),
          idRecepcion: num(r["ID_RECEPCION"]),
          proveedor: str(r["PROVEEDOR"]),
          fechaRecepcion: iso(r["FECHA_RECEPCION"]),
          montoTotal: num(r["MONTO_TOTAL"]),
          saldoPendiente: num(r["SALDO_PENDIENTE"]),
          estado: str(r["ESTADO"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "CXP_FACTURA_PROVEEDOR");
      }
    }, conn);
  }

  /**
   * Recorrido completo de una solicitud: creada, aprobaciones, RFQ, cotizaciones, ordenes que
   * nacieron de ellas, recepciones, devoluciones, facturas y pagos — en orden cronologico.
   * Se arma enlazando los documentos reales (no hay tabla de "eventos").
   */
  public async trazabilidadSolicitud(idSolicitud: number, conn?: Connection): Promise<readonly HitoTrazabilidad[]> {
    const ocs = `(SELECT od.ID_ORDEN_COMPRA
                  FROM COM_ORDEN_COMPRA_DETALLE od
                  JOIN COM_COTIZACION_DETALLE cd ON cd.ID_COTIZACION_DETALLE = od.ID_COTIZACION_DETALLE
                  JOIN COM_COTIZACION_PROVEEDOR c ON c.ID_COTIZACION = cd.ID_COTIZACION
                  JOIN COM_RFQ_CABECERA r ON r.ID_RFQ = c.ID_RFQ
                 WHERE r.ID_SOLICITUD = :id AND od.ELIMINADO = 'N')`;
    const recs = `(SELECT re.ID_RECEPCION FROM COM_RECEPCION re WHERE re.ELIMINADO = 'N' AND re.ID_ORDEN_COMPRA IN ${ocs})`;
    const sql = `
      SELECT * FROM (
        SELECT 'SOLICITUD' AS TIPO, CAST(sc.FECHA_CREACION AS TIMESTAMP) AS FECHA,
               'Solicitud SOL-' || sc.ID_SOLICITUD || ' creada' AS TITULO,
               TRIM(e.NOMBRES || ' ' || e.APELLIDOS) AS QUIEN, SUBSTR(sc.JUSTIFICACION, 1, 200) AS DETALLE, sc.ID_SOLICITUD AS REF
          FROM COM_SOLICITUD_COMPRA sc LEFT JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = sc.ID_EMPLEADO_SOLICITANTE
         WHERE sc.ID_SOLICITUD = :id AND sc.ELIMINADO = 'N'
        UNION ALL
        SELECT 'APROBACION', CAST(w.FECHA AS TIMESTAMP),
               CASE WHEN w.ESTADO_NUEVO = 'RECHAZADA' THEN 'Rechazada' WHEN w.ESTADO_NUEVO = 'PENDIENTE_GERENTE' THEN 'Aprobada por el jefe'
                    WHEN w.ESTADO_NUEVO = 'EN_COTIZACION' THEN 'Aprobada por el gerente' ELSE 'Cambio a ' || w.ESTADO_NUEVO END,
               TRIM(e.NOMBRES || ' ' || e.APELLIDOS), w.COMENTARIO, w.ID_WORKFLOW_APROBACION
          FROM COM_WORKFLOW_APROBACION w LEFT JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = w.ID_EMPLEADO_REALIZA
         WHERE w.ID_SOLICITUD = :id AND w.ESTADO_ANTERIOR IS NOT NULL AND w.ELIMINADO = 'N'
        UNION ALL
        SELECT 'RFQ', CAST(r.FECHA_EMISION AS TIMESTAMP),
               'RFQ-' || r.ID_RFQ || ' enviado a ' || (SELECT COUNT(*) FROM COM_RFQ_PROVEEDOR p WHERE p.ID_RFQ = r.ID_RFQ AND p.ELIMINADO = 'N') || ' proveedores',
               NULL, 'Estado: ' || r.ESTADO, r.ID_RFQ
          FROM COM_RFQ_CABECERA r WHERE r.ID_SOLICITUD = :id AND r.ELIMINADO = 'N'
        UNION ALL
        SELECT 'COTIZACION', CAST(c.FECHA_COTIZACION AS TIMESTAMP), 'Cotización de ' || p.RAZON_SOCIAL, NULL, NULL, c.ID_COTIZACION
          FROM COM_COTIZACION_PROVEEDOR c
          JOIN COM_RFQ_CABECERA r ON r.ID_RFQ = c.ID_RFQ AND r.ELIMINADO = 'N'
          JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = c.ID_PROVEEDOR
         WHERE r.ID_SOLICITUD = :id AND c.ELIMINADO = 'N'
        UNION ALL
        SELECT 'ORDEN', CAST(oc.FECHA_EMISION AS TIMESTAMP), 'Orden OC-' || oc.ID_ORDEN_COMPRA || ' emitida a ' || p.RAZON_SOCIAL,
               NULL, 'Estado: ' || oc.ESTADO, oc.ID_ORDEN_COMPRA
          FROM COM_ORDEN_COMPRA oc JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = oc.ID_PROVEEDOR
         WHERE oc.ELIMINADO = 'N' AND oc.ID_ORDEN_COMPRA IN ${ocs}
        UNION ALL
        SELECT 'RECEPCION', CAST(re.FECHA_RECEPCION AS TIMESTAMP), 'Recepción REC-' || re.ID_RECEPCION || ' de OC-' || re.ID_ORDEN_COMPRA,
               TRIM(e.NOMBRES || ' ' || e.APELLIDOS), NULL, re.ID_RECEPCION
          FROM COM_RECEPCION re LEFT JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = re.ID_EMPLEADO_RECIBE
         WHERE re.ELIMINADO = 'N' AND re.ID_ORDEN_COMPRA IN ${ocs}
        UNION ALL
        SELECT 'DEVOLUCION', CAST(d.FECHA_DEVOLUCION AS TIMESTAMP), 'Devolución DEV-' || d.ID_DEVOLUCION || ' al proveedor',
               TRIM(e.NOMBRES || ' ' || e.APELLIDOS), SUBSTR(d.MOTIVO, 1, 200), d.ID_DEVOLUCION
          FROM COM_DEVOLUCION_PROVEEDOR d LEFT JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = d.ID_EMPLEADO_SOLICITA
         WHERE d.ELIMINADO = 'N' AND d.ID_RECEPCION IN ${recs}
        UNION ALL
        SELECT 'FACTURA', CAST(re.FECHA_RECEPCION AS TIMESTAMP) + INTERVAL '1' SECOND,
               CASE WHEN f.NUMERO_DTE IS NULL THEN 'Factura generada por REC-' || re.ID_RECEPCION ELSE 'Factura ' || f.NUMERO_DTE END, NULL,
               CASE f.ESTADO WHEN 'PAGADA' THEN 'Pagada' WHEN 'ANULADA' THEN 'Anulada' ELSE 'Pendiente de liquidar' END, f.ID_FACTURA_PROVEEDOR
          FROM CXP_FACTURA_PROVEEDOR f JOIN COM_RECEPCION re ON re.ID_RECEPCION = f.ID_RECEPCION
         WHERE f.ELIMINADO = 'N' AND f.ID_RECEPCION IN ${recs}
        UNION ALL
        SELECT 'PAGO', CAST(cp.FECHA AS TIMESTAMP), 'Pago registrado (' || cp.FORMA_PAGO || ')',
               NULL, 'Monto: ' || TO_CHAR(cp.MONTO, 'FM999G999G990D00'), cp.ID_CONTRASENA
          FROM CXP_CONTRASENA_PAGO cp JOIN CXP_FACTURA_PROVEEDOR f ON f.ID_FACTURA_PROVEEDOR = cp.ID_FACTURA_PROVEEDOR
         WHERE cp.ELIMINADO = 'N' AND f.ELIMINADO = 'N' AND f.ID_RECEPCION IN ${recs}
      ) ORDER BY FECHA, REF`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { id: idSolicitud });
        return (res.rows ?? []).map((r) => ({
          tipo: str(r["TIPO"]) as HitoTrazabilidad["tipo"],
          fecha: r["FECHA"] instanceof Date ? r["FECHA"].toISOString() : str(r["FECHA"]),
          titulo: str(r["TITULO"]),
          quien: str(r["QUIEN"]).trim() === "" ? null : str(r["QUIEN"]).trim(),
          detalle: str(r["DETALLE"]) === "" ? null : str(r["DETALLE"]),
          ref: num(r["REF"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "trazabilidad");
      }
    }, conn);
  }

  /** Usuario (SEG_USUARIO) ligado a un empleado, o null. Para dirigir una notificacion a la persona. */
  public async usuarioDeEmpleado(idEmpleado: number, conn?: Connection): Promise<number | null> {
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(
          `SELECT ID_USUARIO FROM SEG_USUARIO WHERE ID_EMPLEADO = :e AND ELIMINADO = 'N' AND (ESTADO IS NULL OR ESTADO = 'A')`,
          { e: idEmpleado },
        );
        const r = res.rows?.[0];
        return r === undefined ? null : num(r["ID_USUARIO"]);
      } catch (error) {
        throw mapOracleError(error, "SEG_USUARIO");
      }
    }, conn);
  }

  /** "Nombre Apellido" de un empleado ("" si no existe). */
  public async nombreDeEmpleado(idEmpleado: number, conn?: Connection): Promise<string> {
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(
          `SELECT TRIM(NOMBRES || ' ' || APELLIDOS) AS N FROM NOM_EMPLEADO WHERE ID_EMPLEADO = :e`,
          { e: idEmpleado },
        );
        const r = res.rows?.[0];
        return r === undefined ? "" : str(r["N"]);
      } catch (error) {
        throw mapOracleError(error, "NOM_EMPLEADO");
      }
    }, conn);
  }

  /**
   * Decisiones (aprobo / rechazo) tomadas en los ULTIMOS `dias` sobre las
   * solicitudes de un empleado, mas recientes primero. Se deriva del historial
   * de aprobacion (COM_WORKFLOW_APROBACION): no hay tabla de notificaciones, asi
   * que sobrevive a reinicios y a estar desconectado.
   */
  public async decisionesSobreSolicitudesDe(
    idEmpleado: number,
    dias: number,
    conn?: Connection,
  ): Promise<readonly DecisionSolicitudRow[]> {
    const sql = `
      SELECT w.ID_WORKFLOW_APROBACION AS ID, w.ID_SOLICITUD AS ID_SOLICITUD,
             w.ESTADO_ANTERIOR AS ANTERIOR, w.ESTADO_NUEVO AS NUEVO, w.COMENTARIO AS COMENTARIO,
             w.FECHA AS FECHA, TRIM(e.NOMBRES || ' ' || e.APELLIDOS) AS POR,
             SUBSTR(sc.JUSTIFICACION, 1, 80) AS RESUMEN
        FROM COM_WORKFLOW_APROBACION w
        JOIN COM_SOLICITUD_COMPRA sc ON sc.ID_SOLICITUD = w.ID_SOLICITUD AND sc.ELIMINADO = 'N'
        LEFT JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = w.ID_EMPLEADO_REALIZA
       WHERE w.ELIMINADO = 'N'
         AND w.ESTADO_ANTERIOR IS NOT NULL
         AND sc.ID_EMPLEADO_SOLICITANTE = :emp
         AND w.ID_EMPLEADO_REALIZA <> :emp
         AND w.FECHA >= SYSTIMESTAMP - NUMTODSINTERVAL(:dias, 'DAY')
       ORDER BY w.FECHA DESC, w.ID_WORKFLOW_APROBACION DESC
       FETCH FIRST 30 ROWS ONLY`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { emp: idEmpleado, dias });
        return (res.rows ?? []).map((r) => ({
          idWorkflow: num(r["ID"]),
          idSolicitud: num(r["ID_SOLICITUD"]),
          estadoAnterior: str(r["ANTERIOR"]),
          estadoNuevo: str(r["NUEVO"]),
          comentario: str(r["COMENTARIO"]) === "" ? null : str(r["COMENTARIO"]),
          fecha: r["FECHA"] instanceof Date ? r["FECHA"].toISOString() : str(r["FECHA"]),
          por: str(r["POR"]),
          resumen: str(r["RESUMEN"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_WORKFLOW_APROBACION");
      }
    }, conn);
  }

  /**
   * Responsable del siguiente paso de cada solicitud, segun su estado:
   *  - PENDIENTE_JEFE    -> el jefe inmediato del solicitante (persona).
   *  - PENDIENTE_GERENTE -> el gerente del departamento del solicitante.
   *  - EN_COTIZACION     -> el Departamento de Compras (sin persona especifica).
   *  - cualquier otro estado (RECHAZADA, ORDEN_GENERADA) -> ya resuelto, null.
   * Usado para que el solicitante (o quien acaba de decidir) sepa a quien
   * puede pedirle que continue, en vez de adivinar.
   */
  public async responsablesDeSolicitudes(
    ids: readonly number[],
    conn?: Connection,
  ): Promise<Record<number, ResponsableSolicitud | null>> {
    if (ids.length === 0) return {};
    const sql = `
      SELECT
        sc.ID_SOLICITUD AS ID_SOLICITUD,
        sc.ESTADO       AS ESTADO,
        (je.NOMBRES || ' ' || je.APELLIDOS) AS JEFE_NOMBRE,
        (ge.NOMBRES || ' ' || ge.APELLIDOS) AS GERENTE_NOMBRE
      FROM COM_SOLICITUD_COMPRA sc
      JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = sc.ID_EMPLEADO_SOLICITANTE
      LEFT JOIN NOM_EMPLEADO je ON je.ID_EMPLEADO = e.ID_JEFE_INMEDIATO
      LEFT JOIN NOM_DEPARTAMENTO d ON d.ID_DEPARTAMENTO = e.ID_DEPARTAMENTO
      LEFT JOIN NOM_EMPLEADO ge ON ge.ID_EMPLEADO = d.ID_GERENTE
      WHERE sc.ELIMINADO = 'N'
        AND sc.ID_SOLICITUD IN (${ids.map((_, i) => `:p${i}`).join(",")})`;
    const binds = Object.fromEntries(ids.map((id, i) => [`p${i}`, id]));
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, binds);
        const out: Record<number, ResponsableSolicitud | null> = {};
        for (const r of res.rows ?? []) {
          const idSolicitud = num(r["ID_SOLICITUD"]);
          const estado = str(r["ESTADO"]);
          // Oracle concatena NULL como cadena vacia (NULL || ' ' || NULL = ' '),
          // no NULL -- por eso se recorta y se trata "" como sin nombre.
          const nombreOrNull = (v: unknown): string | null => {
            const s = str(v).trim();
            return s === "" ? null : s;
          };
          if (estado === "PENDIENTE_JEFE") {
            out[idSolicitud] = { rol: "Jefe inmediato", nombre: nombreOrNull(r["JEFE_NOMBRE"]) };
          } else if (estado === "PENDIENTE_GERENTE") {
            out[idSolicitud] = { rol: "Gerente de área", nombre: nombreOrNull(r["GERENTE_NOMBRE"]) };
          } else if (estado === "EN_COTIZACION") {
            out[idSolicitud] = { rol: "Departamento de Compras", nombre: null };
          } else {
            out[idSolicitud] = null;
          }
        }
        return out;
      } catch (error) {
        throw mapOracleError(error, "COM_SOLICITUD_COMPRA");
      }
    }, conn);
  }

  /**
   * "Familias de productos" por proveedor — no existe una relacion directa
   * proveedor<->categoria en el DDL (esta congelado, no se agrega tabla
   * nueva). Se DERIVA de lo que el proveedor ya ha suministrado, cruzando
   * las 3 fuentes reales de esa relacion en el esquema (Articulo-Proveedor,
   * Acuerdo marco, y lineas de Orden de Compra reales) contra la categoria
   * del articulo (`INV_ARTICULO.ID_CATEGORIA`). Sin cambios de esquema.
   */
  public async familiasPorProveedor(
    ids: readonly number[],
    conn?: Connection,
  ): Promise<Record<number, readonly string[]>> {
    if (ids.length === 0) return {};
    const sql = `
      SELECT DISTINCT ID_PROVEEDOR, NOMBRE FROM (
        SELECT ap.ID_PROVEEDOR AS ID_PROVEEDOR, cat.NOMBRE AS NOMBRE
          FROM COM_ARTICULO_PROVEEDOR ap
          JOIN INV_ARTICULO art ON art.ID_ARTICULO = ap.ID_ARTICULO AND art.ELIMINADO = 'N'
          JOIN INV_CATEGORIA cat ON cat.ID_CATEGORIA = art.ID_CATEGORIA AND cat.ELIMINADO = 'N'
         WHERE ap.ELIMINADO = 'N'
        UNION
        SELECT acp.ID_PROVEEDOR, cat.NOMBRE
          FROM COM_ACUERDO_PROVEEDOR acp
          JOIN INV_ARTICULO art ON art.ID_ARTICULO = acp.ID_ARTICULO AND art.ELIMINADO = 'N'
          JOIN INV_CATEGORIA cat ON cat.ID_CATEGORIA = art.ID_CATEGORIA AND cat.ELIMINADO = 'N'
         WHERE acp.ELIMINADO = 'N'
        UNION
        SELECT oc.ID_PROVEEDOR, cat.NOMBRE
          FROM COM_ORDEN_COMPRA oc
          JOIN COM_ORDEN_COMPRA_DETALLE ocd ON ocd.ID_ORDEN_COMPRA = oc.ID_ORDEN_COMPRA AND ocd.ELIMINADO = 'N'
          JOIN INV_ARTICULO art ON art.ID_ARTICULO = ocd.ID_ARTICULO AND art.ELIMINADO = 'N'
          JOIN INV_CATEGORIA cat ON cat.ID_CATEGORIA = art.ID_CATEGORIA AND cat.ELIMINADO = 'N'
         WHERE oc.ELIMINADO = 'N'
      )
      WHERE ID_PROVEEDOR IN (${ids.map((_, i) => `:p${i}`).join(",")})
      ORDER BY ID_PROVEEDOR, NOMBRE`;
    const binds = Object.fromEntries(ids.map((id, i) => [`p${i}`, id]));
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, binds);
        const out: Record<number, string[]> = {};
        for (const r of res.rows ?? []) {
          const id = num(r["ID_PROVEEDOR"]);
          (out[id] ??= []).push(str(r["NOMBRE"]));
        }
        return out;
      } catch (error) {
        throw mapOracleError(error, "COM_PROVEEDOR");
      }
    }, conn);
  }

  // ---- Bodega: OC receptibles (referencia acotada, no el documento) ------

  /**
   * Ordenes de compra que todavia admiten una recepcion (mismo criterio que
   * `RecepcionService.registrar`: cualquier estado salvo CANCELADA/RECHAZADA/
   * RECIBIDA_COMPLETA). Alimenta el selector de OC del formulario de
   * Recepcion — Bodega no gestiona la OC (no tiene `OC_GESTIONAR`) asi que no
   * puede listar el documento completo; esto es una referencia minima
   * (id + proveedor + estado) para elegir una, gateada por
   * `RECEPCION_GESTIONAR` en vez de por ver Ordenes de compra.
   */
  public async ordenesReceptibles(
    conn?: Connection,
  ): Promise<readonly { idOrdenCompra: number; proveedor: string; estado: string }[]> {
    const sql = `
      SELECT oc.ID_ORDEN_COMPRA AS ID_ORDEN_COMPRA, p.RAZON_SOCIAL AS PROVEEDOR, oc.ESTADO AS ESTADO
      FROM COM_ORDEN_COMPRA oc
      JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = oc.ID_PROVEEDOR
      WHERE oc.ELIMINADO = 'N'
        AND oc.ESTADO NOT IN ('CANCELADA', 'RECHAZADA', 'RECIBIDA_COMPLETA')
      ORDER BY oc.ID_ORDEN_COMPRA DESC`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          idOrdenCompra: num(r["ID_ORDEN_COMPRA"]),
          proveedor: str(r["PROVEEDOR"]),
          estado: str(r["ESTADO"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_ORDEN_COMPRA");
      }
    }, conn);
  }

  // ---- Recepcion: cantidades pendientes ---------------------------------

  /**
   * Renglones de una OC con lo ya procesado (recibido+rechazado, sumando
   * TODAS sus recepciones activas) y lo que queda pendiente. Base del
   * selector de renglon en el formulario de Recepcion (evita elegir un
   * renglon ya completo) y del cerrojo de sobre-recepcion en `RecepcionService`.
   */
  public async lineasPendientesOc(
    idOrdenCompra: number,
    conn?: Connection,
  ): Promise<readonly LineaPendienteOcRow[]> {
    const sql = `
      WITH procesado AS (
        SELECT rd.ID_OC_DETALLE AS ID_OC_DETALLE,
               SUM(rd.CANTIDAD_RECIBIDA + rd.CANTIDAD_RECHAZADA) AS PROCESADA
        FROM COM_RECEPCION_DETALLE rd
        JOIN COM_RECEPCION r ON r.ID_RECEPCION = rd.ID_RECEPCION AND r.ELIMINADO = 'N'
        WHERE rd.ELIMINADO = 'N'
        GROUP BY rd.ID_OC_DETALLE
      )
      SELECT
        od.ID_OC_DETALLE                       AS ID_OC_DETALLE,
        od.DESCRIPCION                          AS DESCRIPCION,
        art.CODIGO                              AS CODIGO,
        od.CANTIDAD                             AS CANTIDAD,
        NVL(p.PROCESADA, 0)                     AS PROCESADA
      FROM COM_ORDEN_COMPRA_DETALLE od
      LEFT JOIN INV_ARTICULO art ON art.ID_ARTICULO = od.ID_ARTICULO
      LEFT JOIN procesado p ON p.ID_OC_DETALLE = od.ID_OC_DETALLE
      WHERE od.ID_ORDEN_COMPRA = :idOrdenCompra AND od.ELIMINADO = 'N'
      ORDER BY od.ID_OC_DETALLE`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, { idOrdenCompra });
        return (res.rows ?? []).map((r) => {
          const cantidad = num(r["CANTIDAD"]);
          const procesada = num(r["PROCESADA"]);
          return {
            idOcDetalle: num(r["ID_OC_DETALLE"]),
            descripcion: str(r["DESCRIPCION"]),
            codigo: r["CODIGO"] === null || r["CODIGO"] === undefined ? null : str(r["CODIGO"]),
            cantidad,
            cantidadProcesada: procesada,
            cantidadPendiente: Math.max(0, Number((cantidad - procesada).toFixed(2))),
          };
        });
      } catch (error) {
        throw mapOracleError(error, "COM_ORDEN_COMPRA_DETALLE");
      }
    }, conn);
  }

  // ---- Reportes ----------------------------------------------------------

  /**
   * Gasto (GTQ, neto de descuento) por proveedor en OC emitidas dentro del
   * rango de fechas (ambos limites opcionales), excluyendo OC canceladas o
   * rechazadas. Ordenado de mayor a menor gasto.
   */
  public async gastoPorProveedor(
    desde: string | undefined,
    hasta: string | undefined,
    conn?: Connection,
  ): Promise<readonly GastoProveedorRow[]> {
    const sql = `
      SELECT
        p.ID_PROVEEDOR                                                            AS ID_PROVEEDOR,
        p.RAZON_SOCIAL                                                            AS PROVEEDOR,
        p.NIT                                                                     AS NIT,
        COUNT(DISTINCT oc.ID_ORDEN_COMPRA)                                        AS ORDENES,
        NVL(SUM(od.CANTIDAD * od.PRECIO_UNITARIO
                * (1 - od.PORCENTAJE_DESCUENTO / 100) * oc.TASA_CAMBIO), 0)       AS MONTO
      FROM COM_ORDEN_COMPRA oc
      JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = oc.ID_PROVEEDOR
      JOIN COM_ORDEN_COMPRA_DETALLE od
        ON od.ID_ORDEN_COMPRA = oc.ID_ORDEN_COMPRA AND od.ELIMINADO = 'N'
      WHERE oc.ELIMINADO = 'N'
        AND oc.ESTADO NOT IN ('CANCELADA', 'RECHAZADA')
        AND (:desde IS NULL OR oc.FECHA_EMISION >= TO_DATE(:desde, 'YYYY-MM-DD'))
        AND (:hasta IS NULL OR oc.FECHA_EMISION < TO_DATE(:hasta, 'YYYY-MM-DD') + 1)
      GROUP BY p.ID_PROVEEDOR, p.RAZON_SOCIAL, p.NIT
      ORDER BY MONTO DESC`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, {
          desde: desde ?? null,
          hasta: hasta ?? null,
        });
        return (res.rows ?? []).map((r) => ({
          idProveedor: num(r["ID_PROVEEDOR"]),
          proveedor: str(r["PROVEEDOR"]),
          nit: str(r["NIT"]),
          ordenes: num(r["ORDENES"]),
          monto: Number(num(r["MONTO"]).toFixed(2)),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_ORDEN_COMPRA");
      }
    }, conn);
  }

  /**
   * Ordenes de compra activas (no CANCELADA/RECHAZADA/RECIBIDA_COMPLETA) con
   * dias transcurridos desde su emision y dias de retraso sobre la fecha de
   * entrega esperada (0 si aun no vence). Ordenado por mas atrasada primero.
   */
  public async ocPendientesRecibir(
    conn?: Connection,
  ): Promise<readonly OcPendienteRow[]> {
    const sql = `
      SELECT
        oc.ID_ORDEN_COMPRA                                                        AS ID_ORDEN_COMPRA,
        p.RAZON_SOCIAL                                                            AS PROVEEDOR,
        oc.ESTADO                                                                 AS ESTADO,
        oc.FECHA_EMISION                                                          AS FECHA_EMISION,
        oc.FECHA_ENTREGA_ESPERADA                                                 AS FECHA_ENTREGA_ESPERADA,
        TRUNC(SYSTIMESTAMP) - TRUNC(oc.FECHA_EMISION)                             AS DIAS_TRANSCURRIDOS,
        GREATEST(0, TRUNC(SYSTIMESTAMP) - TRUNC(oc.FECHA_ENTREGA_ESPERADA))       AS DIAS_VENCIDA,
        NVL(SUM(od.CANTIDAD * od.PRECIO_UNITARIO
                * (1 - od.PORCENTAJE_DESCUENTO / 100) * oc.TASA_CAMBIO), 0)       AS MONTO
      FROM COM_ORDEN_COMPRA oc
      JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = oc.ID_PROVEEDOR
      JOIN COM_ORDEN_COMPRA_DETALLE od
        ON od.ID_ORDEN_COMPRA = oc.ID_ORDEN_COMPRA AND od.ELIMINADO = 'N'
      WHERE oc.ELIMINADO = 'N'
        AND oc.ESTADO NOT IN ('CANCELADA', 'RECHAZADA', 'RECIBIDA_COMPLETA')
      GROUP BY oc.ID_ORDEN_COMPRA, p.RAZON_SOCIAL, oc.ESTADO, oc.FECHA_EMISION,
               oc.FECHA_ENTREGA_ESPERADA
      ORDER BY DIAS_VENCIDA DESC, DIAS_TRANSCURRIDOS DESC`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          idOrdenCompra: num(r["ID_ORDEN_COMPRA"]),
          proveedor: str(r["PROVEEDOR"]),
          estado: str(r["ESTADO"]),
          fechaEmision: iso(r["FECHA_EMISION"]),
          fechaEntregaEsperada: iso(r["FECHA_ENTREGA_ESPERADA"]),
          diasTranscurridos: num(r["DIAS_TRANSCURRIDOS"]),
          diasVencida: num(r["DIAS_VENCIDA"]),
          monto: Number(num(r["MONTO"]).toFixed(2)),
        }));
      } catch (error) {
        throw mapOracleError(error, "COM_ORDEN_COMPRA");
      }
    }, conn);
  }

  /**
   * Desempeno por proveedor: dias promedio entre emision y ultima recepcion
   * de cada OC que llego a RECIBIDA_COMPLETA (tiempo de entrega real) y
   * porcentaje de unidades rechazadas sobre lo recibido, en el rango de
   * fechas de emision indicado (ambos limites opcionales).
   */
  public async desempenoProveedores(
    desde: string | undefined,
    hasta: string | undefined,
    conn?: Connection,
  ): Promise<readonly DesempenoProveedorRow[]> {
    const sql = `
      WITH entrega AS (
        SELECT
          rd.ID_RECEPCION_DETALLE                                       AS X,
          od.ID_ORDEN_COMPRA                                            AS ID_ORDEN_COMPRA,
          rd.CANTIDAD_RECIBIDA                                          AS CANTIDAD_RECIBIDA,
          rd.CANTIDAD_RECHAZADA                                         AS CANTIDAD_RECHAZADA,
          r.FECHA_RECEPCION                                             AS FECHA_RECEPCION
        FROM COM_RECEPCION_DETALLE rd
        JOIN COM_RECEPCION r ON r.ID_RECEPCION = rd.ID_RECEPCION AND r.ELIMINADO = 'N'
        JOIN COM_ORDEN_COMPRA_DETALLE od
          ON od.ID_OC_DETALLE = rd.ID_OC_DETALLE AND od.ELIMINADO = 'N'
        WHERE rd.ELIMINADO = 'N'
      ),
      por_oc AS (
        SELECT
          oc.ID_ORDEN_COMPRA                                            AS ID_ORDEN_COMPRA,
          oc.ID_PROVEEDOR                                               AS ID_PROVEEDOR,
          oc.FECHA_EMISION                                              AS FECHA_EMISION,
          MAX(e.FECHA_RECEPCION)                                        AS ULTIMA_RECEPCION,
          SUM(e.CANTIDAD_RECIBIDA)                                      AS CANTIDAD_RECIBIDA,
          SUM(e.CANTIDAD_RECHAZADA)                                     AS CANTIDAD_RECHAZADA
        FROM COM_ORDEN_COMPRA oc
        JOIN entrega e ON e.ID_ORDEN_COMPRA = oc.ID_ORDEN_COMPRA
        WHERE oc.ELIMINADO = 'N'
          AND (:desde IS NULL OR oc.FECHA_EMISION >= TO_DATE(:desde, 'YYYY-MM-DD'))
          AND (:hasta IS NULL OR oc.FECHA_EMISION < TO_DATE(:hasta, 'YYYY-MM-DD') + 1)
        GROUP BY oc.ID_ORDEN_COMPRA, oc.ID_PROVEEDOR, oc.FECHA_EMISION
      )
      SELECT
        p.ID_PROVEEDOR                                                  AS ID_PROVEEDOR,
        p.RAZON_SOCIAL                                                  AS PROVEEDOR,
        COUNT(DISTINCT po.ID_ORDEN_COMPRA)                              AS ORDENES,
        AVG(TRUNC(po.ULTIMA_RECEPCION) - TRUNC(po.FECHA_EMISION))       AS DIAS_PROMEDIO,
        NVL(SUM(po.CANTIDAD_RECIBIDA), 0)                               AS CANTIDAD_RECIBIDA,
        NVL(SUM(po.CANTIDAD_RECHAZADA), 0)                              AS CANTIDAD_RECHAZADA
      FROM por_oc po
      JOIN COM_PROVEEDOR p ON p.ID_PROVEEDOR = po.ID_PROVEEDOR
      GROUP BY p.ID_PROVEEDOR, p.RAZON_SOCIAL
      ORDER BY DIAS_PROMEDIO NULLS LAST`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql, {
          desde: desde ?? null,
          hasta: hasta ?? null,
        });
        return (res.rows ?? []).map((r) => {
          const recibida = num(r["CANTIDAD_RECIBIDA"]);
          const rechazada = num(r["CANTIDAD_RECHAZADA"]);
          const total = recibida + rechazada;
          return {
            idProveedor: num(r["ID_PROVEEDOR"]),
            proveedor: str(r["PROVEEDOR"]),
            ordenesRecibidas: num(r["ORDENES"]),
            diasPromedioEntrega:
              r["DIAS_PROMEDIO"] === null || r["DIAS_PROMEDIO"] === undefined
                ? null
                : Number(num(r["DIAS_PROMEDIO"]).toFixed(1)),
            cantidadRecibida: recibida,
            cantidadRechazada: rechazada,
            porcentajeRechazo: total > 0 ? Number(((rechazada / total) * 100).toFixed(2)) : 0,
          };
        });
      } catch (error) {
        throw mapOracleError(error, "COM_RECEPCION_DETALLE");
      }
    }, conn);
  }

  /**
   * Insumos de riesgo por proveedor, TODO el historico (no admite rango de
   * fechas: el riesgo se evalua con la trayectoria completa, no una foto del
   * mes). Solo proveedores con al menos una OC recibida — sin eso no hay con
   * que medir desempeno real. El score/nivel se calcula en `ReporteService`
   * (es negocio, no SQL).
   */
  public async riesgoProveedoresInsumos(
    conn?: Connection,
  ): Promise<readonly RiesgoProveedorInsumo[]> {
    const sql = `
      WITH entrega AS (
        SELECT
          rd.ID_RECEPCION_DETALLE                                       AS X,
          od.ID_ORDEN_COMPRA                                            AS ID_ORDEN_COMPRA,
          rd.CANTIDAD_RECIBIDA                                          AS CANTIDAD_RECIBIDA,
          rd.CANTIDAD_RECHAZADA                                         AS CANTIDAD_RECHAZADA,
          r.FECHA_RECEPCION                                             AS FECHA_RECEPCION
        FROM COM_RECEPCION_DETALLE rd
        JOIN COM_RECEPCION r ON r.ID_RECEPCION = rd.ID_RECEPCION AND r.ELIMINADO = 'N'
        JOIN COM_ORDEN_COMPRA_DETALLE od
          ON od.ID_OC_DETALLE = rd.ID_OC_DETALLE AND od.ELIMINADO = 'N'
        WHERE rd.ELIMINADO = 'N'
      ),
      por_oc AS (
        SELECT
          oc.ID_ORDEN_COMPRA                                            AS ID_ORDEN_COMPRA,
          oc.ID_PROVEEDOR                                               AS ID_PROVEEDOR,
          oc.FECHA_EMISION                                              AS FECHA_EMISION,
          MAX(e.FECHA_RECEPCION)                                        AS ULTIMA_RECEPCION,
          SUM(e.CANTIDAD_RECIBIDA)                                      AS CANTIDAD_RECIBIDA,
          SUM(e.CANTIDAD_RECHAZADA)                                     AS CANTIDAD_RECHAZADA
        FROM COM_ORDEN_COMPRA oc
        JOIN entrega e ON e.ID_ORDEN_COMPRA = oc.ID_ORDEN_COMPRA
        WHERE oc.ELIMINADO = 'N'
        GROUP BY oc.ID_ORDEN_COMPRA, oc.ID_PROVEEDOR, oc.FECHA_EMISION
      )
      SELECT
        p.ID_PROVEEDOR                                                  AS ID_PROVEEDOR,
        p.RAZON_SOCIAL                                                  AS PROVEEDOR,
        p.CALIFICACION                                                  AS CALIFICACION,
        COUNT(DISTINCT po.ID_ORDEN_COMPRA)                              AS ORDENES,
        AVG(TRUNC(po.ULTIMA_RECEPCION) - TRUNC(po.FECHA_EMISION))       AS DIAS_PROMEDIO,
        NVL(SUM(po.CANTIDAD_RECIBIDA), 0)                               AS CANTIDAD_RECIBIDA,
        NVL(SUM(po.CANTIDAD_RECHAZADA), 0)                              AS CANTIDAD_RECHAZADA,
        CASE WHEN EXISTS (
          SELECT 1 FROM COM_ARTICULO_PROVEEDOR ap
          JOIN INV_ALERTA_ESCASEZ ae ON ae.ID_ARTICULO = ap.ID_ARTICULO AND ae.ELIMINADO = 'N' AND ae.ESTADO = 'PENDIENTE'
          WHERE ap.ID_PROVEEDOR = p.ID_PROVEEDOR AND ap.ELIMINADO = 'N'
        ) THEN 1 ELSE 0 END                                             AS EN_ESCASEZ
      FROM COM_PROVEEDOR p
      LEFT JOIN por_oc po ON po.ID_PROVEEDOR = p.ID_PROVEEDOR
      WHERE p.ELIMINADO = 'N'
      GROUP BY p.ID_PROVEEDOR, p.RAZON_SOCIAL, p.CALIFICACION
      HAVING COUNT(DISTINCT po.ID_ORDEN_COMPRA) > 0
      ORDER BY p.RAZON_SOCIAL`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => {
          const recibida = num(r["CANTIDAD_RECIBIDA"]);
          const rechazada = num(r["CANTIDAD_RECHAZADA"]);
          const procesado = recibida + rechazada;
          return {
            idProveedor: num(r["ID_PROVEEDOR"]),
            proveedor: str(r["PROVEEDOR"]),
            calificacion: r["CALIFICACION"] === null ? null : str(r["CALIFICACION"]),
            ordenesRecibidas: num(r["ORDENES"]),
            diasPromedioEntrega:
              r["DIAS_PROMEDIO"] === null || r["DIAS_PROMEDIO"] === undefined
                ? null
                : Number(num(r["DIAS_PROMEDIO"]).toFixed(1)),
            porcentajeRechazo: procesado > 0 ? Number(((rechazada / procesado) * 100).toFixed(2)) : 0,
            tieneArticulosEnEscasez: num(r["EN_ESCASEZ"]) === 1,
          };
        });
      } catch (error) {
        throw mapOracleError(error, "COM_PROVEEDOR");
      }
    }, conn);
  }

  /**
   * CxP pendiente agrupada por cuando vence (proyeccion de flujo de pagos):
   * vencidas, semana 1-4 desde hoy, despues de 4 semanas, sin fecha. Las
   * etiquetas y el orden final los arma `LiquidacionService` (aqui solo el
   * agregado SQL).
   */
  public async proyeccionPagos(conn?: Connection): Promise<readonly BucketPagoRow[]> {
    const sql = `
      SELECT
        CASE
          WHEN f.FECHA_VENCIMIENTO IS NULL THEN 'SIN_FECHA'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN 'VENCIDA'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 7 THEN 'SEM1'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 14 THEN 'SEM2'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 21 THEN 'SEM3'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 28 THEN 'SEM4'
          ELSE 'DESPUES'
        END                           AS BUCKET,
        SUM(f.SALDO_PENDIENTE)        AS MONTO,
        COUNT(*)                      AS N
      FROM CXP_FACTURA_PROVEEDOR f
      WHERE f.ELIMINADO = 'N' AND f.ESTADO IN ('PENDIENTE', 'PAGADA_PARCIAL')
      GROUP BY
        CASE
          WHEN f.FECHA_VENCIMIENTO IS NULL THEN 'SIN_FECHA'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN 'VENCIDA'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 7 THEN 'SEM1'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 14 THEN 'SEM2'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 21 THEN 'SEM3'
          WHEN f.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 28 THEN 'SEM4'
          ELSE 'DESPUES'
        END`;
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(sql);
        return (res.rows ?? []).map((r) => ({
          bucket: str(r["BUCKET"]) as BucketPagoRow["bucket"],
          monto: Number(num(r["MONTO"]).toFixed(2)),
          facturas: num(r["N"]),
        }));
      } catch (error) {
        throw mapOracleError(error, "CXP_FACTURA_PROVEEDOR");
      }
    }, conn);
  }

  // ------------------------------------------------------------------------

  private mapCotizacion(r: Row): CotizacionComparada {
    return {
      idSolicitudDetalle: num(r["ID_SOLICITUD_DETALLE"]),
      descripcionLinea: str(r["DESCRIPCION_LINEA"]),
      cantidadSolicitada: num(r["CANTIDAD_SOLICITADA"]),
      idCotizacion: num(r["ID_COTIZACION"]),
      idCotizacionDetalle: num(r["ID_COTIZACION_DETALLE"]),
      idProveedor: num(r["ID_PROVEEDOR"]),
      proveedor: str(r["PROVEEDOR"]),
      nitProveedor: str(r["NIT_PROVEEDOR"]),
      idMoneda: num(r["ID_MONEDA"]),
      monedaCodigo: str(r["MONEDA_CODIGO"]),
      tasaCambio: num(r["TASA_CAMBIO"]),
      condicionPagoDias: num(r["CONDICION_PAGO_DIAS"]),
      precioUnitario: num(r["PRECIO_UNITARIO"]),
      cantidad: num(r["CANTIDAD"]),
      porcentajeDescuento: num(r["PORCENTAJE_DESCUENTO"]),
      porcentajeImpuesto: num(r["PORCENTAJE_IMPUESTO"]),
      precioNeto: Number(num(r["PRECIO_NETO"]).toFixed(5)),
      precioNetoMoneda: Number(num(r["PRECIO_NETO_MONEDA"]).toFixed(5)),
      totalLinea: Number(num(r["TOTAL_LINEA"]).toFixed(2)),
      adjudicado: r["ADJUDICADO"] === "S",
      fechaCotizacion: iso(r["FECHA_COTIZACION"]),
    };
  }

  private mapHistorial(r: Row): HistorialPrecioRow {
    return {
      idProveedor: num(r["ID_PROVEEDOR"]),
      proveedor: str(r["PROVEEDOR"]),
      idArticulo: num(r["ID_ARTICULO"]),
      articuloCodigo: str(r["ARTICULO_CODIGO"]),
      articulo: str(r["ARTICULO"]),
      precioAcordado: num(r["PRECIO_ACORDADO"]),
      porcentajeDescuento: num(r["PORCENTAJE_DESCUENTO"]),
      porcentajeImpuesto: num(r["PORCENTAJE_IMPUESTO"]),
      cantidadRealComprada: num(r["CANTIDAD_REAL_COMPRADA"]),
      fechaCompra: iso(r["FECHA_COMPRA"]),
      idMoneda: num(r["ID_MONEDA"]),
      tasaCambio: num(r["TASA_CAMBIO"]),
      idOrdenCompra: num(r["ID_ORDEN_COMPRA"]),
      idRecepcion: num(r["ID_RECEPCION"]),
    };
  }
}

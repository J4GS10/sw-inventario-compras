/**
 * Capa 3 - Logica de Negocio / compras (analitica).
 *
 * Caso de uso: trazabilidad de la decision de compra.
 *  - `comparativoSolicitud`  : las N cotizaciones de cada linea, lado a lado,
 *                              con la mas conveniente marcada y los criterios que
 *                              registro el director.
 *  - `registrarCriterio`     : anota un criterio/puntuacion sobre una cotizacion
 *                              (queda en COM_COMPARATIVO_COTIZACIONES).
 *  - `historialProveedor`    : precios reales de compra historicos por proveedor
 *                              (VW_COM_PRECIO_HISTORIAL) + resumen.
 *
 * Herencia de TransactionalService para la escritura de criterios.
 */

import { puntuarRenglon, type SugerenciaRenglon } from "../../compras/adjudicacionSugerida.js";
import { ReporteService } from "./ReporteService.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  NotFoundError,
  ValidationError,
} from "../../../common/errors/AppError.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import { solicitudRepository } from "../../../dal/repositories/com/index.js";
import {
  CompraReadRepository,
  type CotizacionComparada,
  type CriterioComparativo,
  type HistorialPrecioRow,
  type HistorialResumen,
} from "../../../dal/repositories/com/CompraReadRepository.js";
import { TransactionalService } from "../../support/TransactionalService.js";
import { validarRangoFechas } from "../../compras/reglasDocumentos.js";

export interface CotizacionEnComparativo {
  readonly idCotizacion: number;
  readonly idCotizacionDetalle: number;
  readonly idProveedor: number;
  readonly proveedor: string;
  readonly nitProveedor: string;
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
  readonly esMejorPrecio: boolean;
  readonly fechaCotizacion: string;
}

export interface LineaComparativo {
  readonly idSolicitudDetalle: number;
  readonly descripcion: string;
  readonly cantidadSolicitada: number;
  readonly cotizaciones: readonly CotizacionEnComparativo[];
  readonly adjudicadaIdCotizacionDetalle: number | null;
}

export interface ComparativoSolicitud {
  readonly idSolicitud: number;
  readonly estadoSolicitud: string;
  readonly totalCotizaciones: number;
  readonly proveedoresParticipantes: readonly {
    readonly idProveedor: number;
    readonly proveedor: string;
  }[];
  readonly lineas: readonly LineaComparativo[];
  readonly criterios: readonly CriterioComparativo[];
}

export interface HistorialProveedorResult {
  readonly data: readonly HistorialPrecioRow[];
  readonly meta: { readonly page: number; readonly pageSize: number; readonly total: number; readonly totalPages: number };
  readonly resumen: HistorialResumen;
}

export class ComparativoService extends TransactionalService {
  private readonly read = new CompraReadRepository();

  private readonly solicitudRepo = solicitudRepository();

  private readonly criterioRepo = repositoryFactory().get(
    "comparativoCotizaciones",
  );

  private readonly cotizacionDetalleRepo = repositoryFactory().get(
    "cotizacionDetalle",
  );

  public async comparativoSolicitud(idSolicitud: number): Promise<ComparativoSolicitud> {
    const solicitud = (await this.solicitudRepo.findById(idSolicitud)) as
      | { idSolicitud: number; estado: string }
      | null;
    if (solicitud === null) {
      throw new NotFoundError("COM_SOLICITUD_COMPRA", idSolicitud);
    }

    const [comparadas, criterios] = await Promise.all([
      this.read.cotizacionesComparadas(idSolicitud),
      this.read.criteriosComparativos(idSolicitud),
    ]);

    const lineas = this.agruparPorLinea(comparadas);
    const participantes = this.proveedoresUnicos(comparadas);

    return {
      idSolicitud,
      estadoSolicitud: solicitud.estado,
      totalCotizaciones: new Set(comparadas.map((c) => c.idCotizacion)).size,
      proveedoresParticipantes: participantes,
      lineas,
      criterios,
    };
  }

  /**
   * Sugerencia de adjudicacion por renglon aun sin adjudicar: pondera precio, confiabilidad historica
   * del proveedor y credito (ver `adjudicacionSugerida.ts`). No adjudica nada: solo propone.
   */
  public async sugerenciaAdjudicacion(idSolicitud: number): Promise<{
    readonly idSolicitud: number;
    readonly renglones: readonly (SugerenciaRenglon & { idSolicitudDetalle: number; descripcion: string })[];
  }> {
    const comp = await this.comparativoSolicitud(idSolicitud);
    const riesgo = await new ReporteService().riesgoProveedores();
    const conf = new Map<number, number>(riesgo.proveedores.map((p) => [p.idProveedor, p.score]));
    const renglones = comp.lineas
      .filter((l) => l.adjudicadaIdCotizacionDetalle === null)
      .map((l) => ({
        idSolicitudDetalle: l.idSolicitudDetalle,
        descripcion: l.descripcion,
        ...puntuarRenglon(
          l.cotizaciones.map((c) => ({
            idCotizacionDetalle: c.idCotizacionDetalle,
            idProveedor: c.idProveedor,
            proveedor: c.proveedor,
            precioNetoMoneda: c.precioNetoMoneda,
            condicionPagoDias: c.condicionPagoDias,
          })),
          (idProveedor) => conf.get(idProveedor) ?? null,
        ),
      }));
    return { idSolicitud, renglones };
  }

  public async listarCriterios(
    idSolicitud: number,
  ): Promise<readonly CriterioComparativo[]> {
    return this.read.criteriosComparativos(idSolicitud);
  }

  /** Registra un criterio de evaluacion sobre una cotizacion (trazabilidad). */
  public async registrarCriterio(
    body: unknown,
    ctx: AuditContext,
  ): Promise<CriterioComparativo> {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    const dto = validateAgainstDescriptor(
      COM_DESCRIPTORS.comparativoCotizaciones,
      body,
      "create",
    );

    return this.runInTransaction(async ({ conn }) => {
      const idCotizacionDetalle = Number(dto["idCotizacionDetalle"]);
      const existeDetalle = await this.cotizacionDetalleRepo.exists(
        idCotizacionDetalle,
        conn,
      );
      if (!existeDetalle) {
        throw new NotFoundError("COM_COTIZACION_DETALLE", idCotizacionDetalle);
      }
      const created = (await this.criterioRepo.create(dto, ctx, conn)) as {
        idComparativo: number;
      };
      const detalles = await this.read.criteriosComparativos(
        Number(dto["idSolicitud"]),
        conn,
      );
      const row = detalles.find((d) => d.idComparativo === created.idComparativo);
      if (row === undefined) {
        throw new NotFoundError("COM_COMPARATIVO_COTIZACIONES", created.idComparativo);
      }
      return row;
    });
  }

  public async historialProveedor(raw: {
    idProveedor?: number;
    idArticulo?: number;
    desde?: string;
    hasta?: string;
    page?: number;
    pageSize?: number;
  }): Promise<HistorialProveedorResult> {
    const page = Math.max(1, Math.trunc(raw.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Math.trunc(raw.pageSize ?? 25)));
    const query: {
      idProveedor?: number;
      idArticulo?: number;
      desde?: string;
      hasta?: string;
      page: number;
      pageSize: number;
    } = { page, pageSize };
    if (raw.idProveedor !== undefined && Number.isFinite(raw.idProveedor)) {
      query.idProveedor = raw.idProveedor;
    }
    if (raw.idArticulo !== undefined && Number.isFinite(raw.idArticulo)) {
      query.idArticulo = raw.idArticulo;
    }
    const rango = validarRangoFechas(raw.desde, raw.hasta);
    if (rango.desde !== undefined) query.desde = rango.desde;
    if (rango.hasta !== undefined) query.hasta = rango.hasta;

    const { rows, total, resumen } = await this.read.historialPrecios(query);
    return {
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      resumen,
    };
  }

  // ------------------------------------------------------------------------

  private agruparPorLinea(
    comparadas: readonly CotizacionComparada[],
  ): readonly LineaComparativo[] {
    const porLinea = new Map<number, CotizacionComparada[]>();
    for (const c of comparadas) {
      const arr = porLinea.get(c.idSolicitudDetalle) ?? [];
      arr.push(c);
      porLinea.set(c.idSolicitudDetalle, arr);
    }

    const lineas: LineaComparativo[] = [];
    for (const [idSolicitudDetalle, cotizaciones] of porLinea) {
      const mejorNeto = Math.min(...cotizaciones.map((c) => c.precioNetoMoneda));
      const primera = cotizaciones[0];
      const adjudicada = cotizaciones.find((c) => c.adjudicado);
      lineas.push({
        idSolicitudDetalle,
        descripcion: primera?.descripcionLinea ?? "",
        cantidadSolicitada: primera?.cantidadSolicitada ?? 0,
        adjudicadaIdCotizacionDetalle: adjudicada?.idCotizacionDetalle ?? null,
        cotizaciones: cotizaciones.map((c) => ({
          idCotizacion: c.idCotizacion,
          idCotizacionDetalle: c.idCotizacionDetalle,
          idProveedor: c.idProveedor,
          proveedor: c.proveedor,
          nitProveedor: c.nitProveedor,
          monedaCodigo: c.monedaCodigo,
          tasaCambio: c.tasaCambio,
          condicionPagoDias: c.condicionPagoDias,
          precioUnitario: c.precioUnitario,
          cantidad: c.cantidad,
          porcentajeDescuento: c.porcentajeDescuento,
          porcentajeImpuesto: c.porcentajeImpuesto,
          precioNeto: c.precioNeto,
          precioNetoMoneda: c.precioNetoMoneda,
          totalLinea: c.totalLinea,
          adjudicado: c.adjudicado,
          esMejorPrecio: Math.abs(c.precioNetoMoneda - mejorNeto) < 1e-6,
          fechaCotizacion: c.fechaCotizacion,
        })),
      });
    }
    lineas.sort((a, b) => a.idSolicitudDetalle - b.idSolicitudDetalle);
    return lineas;
  }

  private proveedoresUnicos(
    comparadas: readonly CotizacionComparada[],
  ): readonly { idProveedor: number; proveedor: string }[] {
    const map = new Map<number, string>();
    for (const c of comparadas) map.set(c.idProveedor, c.proveedor);
    return [...map.entries()].map(([idProveedor, proveedor]) => ({
      idProveedor,
      proveedor,
    }));
  }
}

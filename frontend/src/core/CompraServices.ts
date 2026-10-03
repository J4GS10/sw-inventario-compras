/**
 * Capa 3 (frontend) - Servicios de aplicacion del modulo de Compras.
 *
 *  - `ComparativoAppService`: lee el comparativo, adjudica, registra criterios,
 *    y delega la exportacion PDF en `DocumentDownloadService` (Facade).
 *  - `HistorialAppService`: consulta el historial de precios.
 *  - `catalogService(...)`: fabrica un `CrudService` por catalogo (Factory).
 */

import { HttpClient } from "./HttpClient.js";
import { CrudService } from "./CrudService.js";
import { DocumentDownloadService } from "./DownloadService.js";
import { AppEvents, eventBus } from "./EventBus.js";
import { repositoryFactory } from "./Repository.js";

/* ---- Catalogos ---------------------------------------------------------- */

const catalogCache = new Map<string, CrudService<Record<string, unknown>>>();

export function catalogService(
  resource: string,
  idField: string,
  versioned = false,
): CrudService<Record<string, unknown>> {
  const key = `${resource}#${idField}#${versioned}`;
  let svc = catalogCache.get(key);
  if (svc === undefined) {
    svc = new CrudService<Record<string, unknown>>({ resource, idField, versioned });
    catalogCache.set(key, svc);
  }
  return svc;
}

/* ---- Comparativo (Facade) -------------------------------------------- */

export interface ComparativoDTO {
  idSolicitud: number;
  estadoSolicitud: string;
  totalCotizaciones: number;
  proveedoresParticipantes: { idProveedor: number; proveedor: string }[];
  lineas: Array<{
    idSolicitudDetalle: number;
    descripcion: string;
    cantidadSolicitada: number;
    adjudicadaIdCotizacionDetalle: number | null;
    cotizaciones: Array<{
      idCotizacion: number;
      idCotizacionDetalle: number;
      idProveedor: number;
      proveedor: string;
      nitProveedor: string;
      monedaCodigo: string;
      tasaCambio: number;
      condicionPagoDias: number;
      precioUnitario: number;
      cantidad: number;
      porcentajeDescuento: number;
      porcentajeImpuesto: number;
      precioNeto: number;
      precioNetoMoneda: number;
      totalLinea: number;
      adjudicado: boolean;
      esMejorPrecio: boolean;
    }>;
  }>;
  criterios: Array<{
    idComparativo: number;
    idCotizacionDetalle: number;
    proveedor: string;
    criterio: string;
    puntuacion: number | null;
    notas: string | null;
  }>;
}

export class ComparativoAppService {
  private static instance: ComparativoAppService | undefined;

  private constructor(
    private readonly http = HttpClient.getInstance(),
    private readonly downloads = DocumentDownloadService.getInstance(),
  ) {}

  public static getInstance(): ComparativoAppService {
    if (ComparativoAppService.instance === undefined) {
      ComparativoAppService.instance = new ComparativoAppService();
    }
    return ComparativoAppService.instance;
  }

  public getComparativo(idSolicitud: number): Promise<ComparativoDTO> {
    return this.http.get<ComparativoDTO>(
      `/api/com/comparativo/solicitud/${idSolicitud}`,
    );
  }

  public async adjudicar(idCotizacionDetalle: number): Promise<void> {
    await this.http.post(
      `/api/com/cotizaciones/detalle/${idCotizacionDetalle}/adjudicar`,
    );
    eventBus.emit(AppEvents.EntityUpdated, { resource: "cotizacion-detalle" });
  }

  public async registrarCriterio(input: {
    idSolicitud: number;
    idCotizacionDetalle: number;
    criterio: string;
    puntuacion: number | null;
    notas: string | null;
  }): Promise<void> {
    await this.http.post("/api/com/comparativo/criterios", input);
    eventBus.emit(AppEvents.EntityCreated, { resource: "comparativo-criterio" });
  }

  public descargarPdf(idSolicitud: number): Promise<void> {
    return this.downloads.descargarComparativoPdf(idSolicitud);
  }
  public guardarPdf(idSolicitud: number): Promise<{ url: string; storage: string; filename: string }> {
    return this.downloads.guardarComparativoPdf(idSolicitud);
  }
}

/* ---- Historial ------------------------------------------------------- */

export interface HistorialResumen {
  registros: number;
  precioMin: number | null;
  precioMax: number | null;
  precioPromedio: number | null;
  cantidadTotal: number;
}
export interface HistorialResp {
  data: Array<{
    proveedor: string;
    articuloCodigo: string;
    articulo: string;
    precioAcordado: number;
    porcentajeDescuento: number;
    porcentajeImpuesto: number;
    cantidadRealComprada: number;
    fechaCompra: string;
    idMoneda: number;
    tasaCambio: number;
    idOrdenCompra: number;
    idRecepcion: number;
  }>;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  resumen: HistorialResumen;
}

export class HistorialAppService {
  private static instance: HistorialAppService | undefined;
  private constructor(private readonly http = HttpClient.getInstance()) {}
  public static getInstance(): HistorialAppService {
    if (HistorialAppService.instance === undefined) {
      HistorialAppService.instance = new HistorialAppService();
    }
    return HistorialAppService.instance;
  }

  public consultar(filtros: {
    idProveedor?: string;
    idArticulo?: string;
    desde?: string;
    hasta?: string;
    page: number;
    pageSize: number;
  }): Promise<HistorialResp> {
    const q: Record<string, string | number> = {
      page: filtros.page,
      pageSize: filtros.pageSize,
    };
    for (const k of ["idProveedor", "idArticulo", "desde", "hasta"] as const) {
      const v = filtros[k];
      if (v !== undefined && v !== "") q[k] = v;
    }
    return this.http.raw<HistorialResp>("/api/com/historial-precios", q);
  }

  public referencias(resource: string): Promise<{ data: Array<Record<string, unknown>> }> {
    return this.http.list<Record<string, unknown>>(resource, { pageSize: 300 }).then((p) => ({
      data: [...p.data],
    }));
  }
}

/* ---- Dashboard (series temporales + indice de ahorro) ------------- */

export interface PuntoCompraMes {
  periodo: string;
  label: string;
  monto: number;
  ordenes: number;
}
export interface PuntoRotacionMes {
  periodo: string;
  label: string;
  valorEntradas: number;
  rotacion: number;
}
export interface ProyeccionGastoMensual {
  proximoMes: number;
  rangoMin: number;
  rangoMax: number;
  tendencia: "alza" | "baja" | "estable";
  pendienteMensual: number;
}
export interface DashboardResumen {
  meses: number;
  comprasPorMes: PuntoCompraMes[];
  proyeccionGasto: ProyeccionGastoMensual | null;
  rotacion: {
    porMes: PuntoRotacionMes[];
    existenciaValorizada: number;
    valorEntradas12m: number;
    rotacion12m: number;
  };
  ahorroAdjudicacion: {
    lineasAdjudicadas: number;
    lineasConAlternativa: number;
    ahorroPromedioPct: number;
    ahorroPonderadoPct: number;
    montoAdjudicado: number;
    montoEvitado: number;
  };
  generadoEn: string;
}

export class DashboardAppService {
  private static instance: DashboardAppService | undefined;
  private constructor(private readonly http = HttpClient.getInstance()) {}
  public static getInstance(): DashboardAppService {
    if (DashboardAppService.instance === undefined) {
      DashboardAppService.instance = new DashboardAppService();
    }
    return DashboardAppService.instance;
  }

  public resumen(meses?: number): Promise<DashboardResumen> {
    const q = meses !== undefined ? { meses } : undefined;
    return this.http.get<DashboardResumen>("/api/com/dashboard/resumen", q);
  }
}

/* ---- Reportes (Facade + descarga PDF) ------------------------------- */

export interface GastoProveedorItem {
  idProveedor: number;
  proveedor: string;
  nit: string;
  ordenes: number;
  monto: number;
  porcentaje: number;
}
export interface ReporteGastoProveedor {
  desde: string | null;
  hasta: string | null;
  montoTotal: number;
  ordenesTotal: number;
  proveedores: GastoProveedorItem[];
  generadoEn: string;
}

export interface OcPendienteItem {
  idOrdenCompra: number;
  proveedor: string;
  estado: string;
  fechaEmision: string;
  fechaEntregaEsperada: string;
  diasTranscurridos: number;
  diasVencida: number;
  monto: number;
}
export interface ReporteOcPendientes {
  totalOrdenes: number;
  totalVencidas: number;
  montoTotal: number;
  ordenes: OcPendienteItem[];
  generadoEn: string;
}

export interface DesempenoProveedorItem {
  idProveedor: number;
  proveedor: string;
  ordenesRecibidas: number;
  diasPromedioEntrega: number | null;
  cantidadRecibida: number;
  cantidadRechazada: number;
  porcentajeRechazo: number;
}
export interface ReporteDesempenoProveedores {
  desde: string | null;
  hasta: string | null;
  diasPromedioGeneral: number | null;
  proveedores: DesempenoProveedorItem[];
  generadoEn: string;
}

export type NivelRiesgo = "bajo" | "medio" | "alto";
export interface RiesgoProveedorItem {
  idProveedor: number;
  proveedor: string;
  calificacion: string | null;
  ordenesRecibidas: number;
  diasPromedioEntrega: number | null;
  porcentajeRechazo: number;
  tieneArticulosEnEscasez: boolean;
  score: number;
  nivel: NivelRiesgo;
}
export interface ReporteRiesgoProveedores {
  diasPromedioGeneral: number | null;
  proveedores: RiesgoProveedorItem[];
  generadoEn: string;
}

export class ReporteAppService {
  private static instance: ReporteAppService | undefined;
  private constructor(
    private readonly http = HttpClient.getInstance(),
    private readonly downloads = DocumentDownloadService.getInstance(),
  ) {}
  public static getInstance(): ReporteAppService {
    if (ReporteAppService.instance === undefined) {
      ReporteAppService.instance = new ReporteAppService();
    }
    return ReporteAppService.instance;
  }

  private rango(desde?: string, hasta?: string): Record<string, string> {
    const q: Record<string, string> = {};
    if (desde !== undefined && desde !== "") q["desde"] = desde;
    if (hasta !== undefined && hasta !== "") q["hasta"] = hasta;
    return q;
  }

  public gastoPorProveedor(desde?: string, hasta?: string): Promise<ReporteGastoProveedor> {
    return this.http.get<ReporteGastoProveedor>("/api/com/reportes/gasto-proveedor", this.rango(desde, hasta));
  }
  public descargarGastoProveedorPdf(desde?: string, hasta?: string): Promise<void> {
    return this.downloads.descargarReportePdf("gasto-proveedor", this.rango(desde, hasta));
  }

  public ocPendientesRecibir(): Promise<ReporteOcPendientes> {
    return this.http.get<ReporteOcPendientes>("/api/com/reportes/oc-pendientes");
  }
  public descargarOcPendientesPdf(): Promise<void> {
    return this.downloads.descargarReportePdf("oc-pendientes", {});
  }

  public desempenoProveedores(desde?: string, hasta?: string): Promise<ReporteDesempenoProveedores> {
    return this.http.get<ReporteDesempenoProveedores>(
      "/api/com/reportes/desempeno-proveedores",
      this.rango(desde, hasta),
    );
  }
  public descargarDesempenoProveedoresPdf(desde?: string, hasta?: string): Promise<void> {
    return this.downloads.descargarReportePdf("desempeno-proveedores", this.rango(desde, hasta));
  }

  public riesgoProveedores(): Promise<ReporteRiesgoProveedores> {
    return this.http.get<ReporteRiesgoProveedores>("/api/com/reportes/riesgo-proveedores");
  }
  public descargarRiesgoProveedoresPdf(): Promise<void> {
    return this.downloads.descargarReportePdf("riesgo-proveedores", {});
  }
}

/* ---- Adjuntos de documentos (MinIO / FileStorage) ------------------ */

export type TipoDocAdjunto =
  | "solicitudes"
  | "cotizaciones"
  | "ordenes-compra"
  | "recepciones"
  | "devoluciones";

export interface AdjuntoMeta {
  ref: string;
  nombre: string;
  mime: string;
  bytes: number;
  subidoPor: number;
  subidoEn: string;
}

export class AdjuntoAppService {
  private static instance: AdjuntoAppService | undefined;
  private constructor(private readonly http = HttpClient.getInstance()) {}
  public static getInstance(): AdjuntoAppService {
    if (AdjuntoAppService.instance === undefined) {
      AdjuntoAppService.instance = new AdjuntoAppService();
    }
    return AdjuntoAppService.instance;
  }

  private base(tipo: TipoDocAdjunto, id: number): string {
    return `/api/com/${tipo}/${id}/adjuntos`;
  }

  public listar(tipo: TipoDocAdjunto, id: number): Promise<AdjuntoMeta[]> {
    return this.http.get<AdjuntoMeta[]>(this.base(tipo, id));
  }
  public subir(tipo: TipoDocAdjunto, id: number, file: File): Promise<AdjuntoMeta> {
    return this.http.upload<AdjuntoMeta>(this.base(tipo, id), file);
  }
  public eliminar(tipo: TipoDocAdjunto, id: number, ref: string): Promise<void> {
    return this.http.delete(`${this.base(tipo, id)}/${encodeURIComponent(ref)}`);
  }
  public async descargar(tipo: TipoDocAdjunto, id: number, a: AdjuntoMeta): Promise<void> {
    const blob = await this.http.blob(`${this.base(tipo, id)}/${encodeURIComponent(a.ref)}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.nombre;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  /**
   * Abre el adjunto para vista previa embebida (PDF en iframe, imagen en <img>).
   * Devuelve un object URL; el llamador debe invocar `revoke()` al cerrar.
   */
  public async abrir(
    tipo: TipoDocAdjunto,
    id: number,
    a: AdjuntoMeta,
  ): Promise<{ url: string; revoke: () => void }> {
    const blob = await this.http.blob(
      `${this.base(tipo, id)}/${encodeURIComponent(a.ref)}`,
      { disposition: "inline" },
    );
    const url = URL.createObjectURL(blob);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  }
}

/* ---- Documentos del ciclo de compra -------------------------------- */

export class DocumentoAppService {
  constructor(private readonly resource: string, private readonly http = HttpClient.getInstance()) {}

  public list(
    page: number,
    pageSize = 20,
    extra?: Record<string, string | number>,
  ): ReturnType<HttpClient["list"]> {
    return this.http.list(this.resource, { page, pageSize, ...extra });
  }
  public obtener(id: number): Promise<unknown> {
    return this.http.get(`${this.resource}/${id}`);
  }
  public crear(payload: unknown): Promise<unknown> {
    return this.http.post(this.resource, payload);
  }
  public actualizar(id: number, payload: unknown): Promise<unknown> {
    return this.http.put(`${this.resource}/${id}`, payload);
  }
  public eliminar(id: number): Promise<void> {
    return this.http.delete(`${this.resource}/${id}`);
  }
  public accion(subpath: string, payload?: unknown): Promise<unknown> {
    return this.http.post(`${this.resource}/${subpath}`, payload);
  }
}

export const comparativoService = ComparativoAppService.getInstance();
export const historialService = HistorialAppService.getInstance();
export const dashboardService = DashboardAppService.getInstance();
export const adjuntoService = AdjuntoAppService.getInstance();
export const reporteService = ReporteAppService.getInstance();
export { repositoryFactory };

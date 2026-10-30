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
  idProveedor: number;
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
  /** Entrega esperada en los proximos 7 dias (aun no vencidas). */
  proximas7Dias: number;
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
export type RecomendacionRiesgo = "MANTENER" | "VIGILAR" | "RESTRINGIR";
export interface RiesgoProveedorItem {
  idProveedor: number;
  proveedor: string;
  /** 'A' activo, 'I' restringido (no se le emiten OC). */
  estado: string;
  recomendacion: RecomendacionRiesgo;
  motivos: string[];
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

export interface InventarioCategoriaItem {
  idCategoria: number | null;
  categoria: string;
  articulos: number;
  unidades: number;
  valor: number;
  porcentaje: number;
}
export interface ReporteInventarioCategoria {
  valorTotal: number;
  unidadesTotal: number;
  articulosTotal: number;
  categorias: InventarioCategoriaItem[];
  generadoEn: string;
}

export type PrioridadEvaluacion = "equilibrado" | "ahorro" | "rapidez" | "calidad" | "personalizado";

/** Cuanto pesa cada criterio (cualquier escala; el servidor los normaliza a 100 %). */
export interface PesosEvaluacion {
  descuento: number;
  entrega: number;
  cumplimiento: number;
  calidad: number;
  envio: number;
}

/** Filtros de la evaluacion de proveedores (se envian como query; vacios se omiten). */
export interface FiltroEvaluacion {
  desde?: string;
  hasta?: string;
  idCategoria?: number | null;
  idProveedor?: number | null;
  q?: string;
  minOrdenes?: number;
  prioridad?: PrioridadEvaluacion;
  /** Solo con prioridad "personalizado". */
  pesos?: PesosEvaluacion;
  soloEnvioGratis?: boolean;
  /** Requisitos minimos: quien no los cumple queda fuera. */
  maxRechazo?: number | null;
  minATiempo?: number | null;
  maxDias?: number | null;
}

export interface EvaluacionProveedorItem {
  idProveedor: number;
  proveedor: string;
  nit: string;
  calificacion: string | null;
  diasCredito: number;
  ordenes: number;
  montoBruto: number;
  montoNeto: number;
  plazoPrometidoDias: number | null;
  ordenesCompletas: number;
  diasRealesEntrega: number | null;
  ordenesATiempo: number;
  cantidadRecibida: number;
  cantidadRechazada: number;
  ordenesConEnvio: number;
  ordenesEnvioGratis: number;
  costoEnvioTotal: number;
  descuentoPct: number;
  ahorroDescuento: number;
  diasEntrega: number | null;
  diasEntregaEsPrometido: boolean;
  porcentajeATiempo: number | null;
  porcentajeRechazo: number | null;
  porcentajeEnvioGratis: number | null;
  costoEnvioPromedio: number | null;
  score: number;
  elegible: boolean;
}
export interface MejorProveedor {
  idProveedor: number;
  proveedor: string;
  valor: number;
}
export interface ReporteEvaluacionProveedores {
  desde: string | null;
  hasta: string | null;
  idCategoria: number | null;
  prioridad: PrioridadEvaluacion;
  /** Pesos efectivos (suman 1). */
  pesos: PesosEvaluacion;
  minOrdenes: number;
  /** Proveedores que no cumplieron los requisitos minimos. */
  descartados: number;
  resumen: {
    proveedores: number;
    montoNeto: number;
    ahorroDescuento: number;
    descuentoPromedioPct: number;
    diasEntregaPromedio: number | null;
    porcentajeATiempo: number | null;
    ordenesConEnvio: number;
    ordenesEnvioGratis: number;
  };
  mejores: {
    descuento: MejorProveedor | null;
    entrega: MejorProveedor | null;
    cumplimiento: MejorProveedor | null;
    calidad: MejorProveedor | null;
    envio: MejorProveedor | null;
    conveniencia: MejorProveedor | null;
  };
  proveedores: EvaluacionProveedorItem[];
  generadoEn: string;
}

export type AccionDisponibilidad = "PEDIR" | "EN_CURSO" | "EN_TRANSITO" | "SUFICIENTE" | "EXCEDIDO";
export interface DisponibilidadArticuloItem {
  idArticulo: number;
  codigo: string;
  articulo: string;
  idCategoria: number | null;
  categoria: string;
  unidad: string;
  stockMinimo: number;
  stockMaximo: number;
  existencia: number;
  enTransito: number;
  solicitado: number;
  solicitudesEnCurso: number;
  ultimoPrecio: number | null;
  ultimoProveedor: string | null;
  ultimaCompra: string | null;
  cobertura: number;
  accion: AccionDisponibilidad;
  sugeridoPedir: number | null;
  motivo: string;
}
export interface ReporteDisponibilidad {
  articulos: DisponibilidadArticuloItem[];
  resumen: Record<AccionDisponibilidad, number>;
  generadoEn: string;
}

export interface AreaItem {
  idDepartamento: number | null;
  departamento: string;
  solicitudes: number;
  porAprobar: number;
  aprobadas: number;
  rechazadas: number;
  porcentajeRechazo: number | null;
  montoEstimado: number;
  diasPromedioAprobacion: number | null;
  ordenes: number;
  montoComprometido: number;
  porcentajeGasto: number;
}
export interface ArticuloCompradoItem {
  articulo: string;
  cantidad: number;
  monto: number;
  ordenes: number;
}
export interface ReporteGastoArea {
  desde: string | null;
  hasta: string | null;
  /** true: el usuario solo ve su equipo o su departamento. */
  acotado: boolean;
  montoTotal: number;
  solicitudesTotal: number;
  porAprobarTotal: number;
  areas: AreaItem[];
  articulosTop: ArticuloCompradoItem[];
  generadoEn: string;
}

export type TipoHallazgo =
  | "AUTOAPROBACION"
  | "SIN_COMPETENCIA"
  | "NO_MAS_BARATA"
  | "SOBREPRECIO_HISTORICO"
  | "RECHAZO_ALTO"
  | "PROVEEDOR_RIESGO";
export type SeveridadHallazgo = "alta" | "media" | "baja";
export interface HallazgoItem {
  tipo: TipoHallazgo;
  severidad: SeveridadHallazgo;
  codigo: string;
  documento: "SOL" | "OC" | "REC";
  idDocumento: number;
  fecha: string;
  idProveedor: number | null;
  proveedor: string | null;
  monto: number;
  porcentaje: number | null;
  referencia: string | null;
  detalle: string;
}
export interface ReporteAuditoria {
  desde: string | null;
  hasta: string | null;
  hallazgos: HallazgoItem[];
  porSeveridad: Record<SeveridadHallazgo, number>;
  porTipo: Record<string, number>;
  montoEnRiesgo: number;
  generadoEn: string;
}

/** Ruta de cada reporte bajo /api/com/reportes (JSON) y /pdf. */
export type RutaReporte =
  | "gasto-proveedor"
  | "oc-pendientes"
  | "desempeno-proveedores"
  | "riesgo-proveedores"
  | "inventario-categoria"
  | "evaluacion-proveedores"
  | "disponibilidad-articulos"
  | "gasto-area"
  | "auditoria-compras";

/** Filtros tal como viajan en la query: los vacios, null y false se omiten. */
export type FiltrosReporte = Readonly<Record<string, string | number | boolean | null | undefined>>;

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

  /** Query de un reporte: un solo lugar decide que viaja, para la pantalla Y el PDF. */
  public query(f: FiltrosReporte = {}): Record<string, string> {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) {
      if (v === undefined || v === null || v === false) continue;
      const texto = v === true ? "1" : String(v).trim();
      if (texto !== "") q[k] = texto;
    }
    return q;
  }

  public consultar<T>(ruta: RutaReporte, f: FiltrosReporte = {}): Promise<T> {
    return this.http.get<T>(`/api/com/reportes/${ruta}`, this.query(f));
  }

  /** PDF con los MISMOS filtros que la pantalla; `filtrosTexto` los describe en el encabezado. */
  public descargarPdf(ruta: RutaReporte, f: FiltrosReporte = {}, filtrosTexto?: string): Promise<void> {
    const q = this.query(f);
    if (filtrosTexto !== undefined && filtrosTexto.trim() !== "") q["filtrosTexto"] = filtrosTexto.trim();
    return this.downloads.descargarReportePdf(ruta, q);
  }

  public gastoPorProveedor(f: FiltrosReporte = {}): Promise<ReporteGastoProveedor> {
    return this.consultar("gasto-proveedor", f);
  }
  public ocPendientesRecibir(f: FiltrosReporte = {}): Promise<ReporteOcPendientes> {
    return this.consultar("oc-pendientes", f);
  }
  public desempenoProveedores(f: FiltrosReporte = {}): Promise<ReporteDesempenoProveedores> {
    return this.consultar("desempeno-proveedores", f);
  }
  public riesgoProveedores(f: FiltrosReporte = {}): Promise<ReporteRiesgoProveedores> {
    return this.consultar("riesgo-proveedores", f);
  }
  public inventarioPorCategoria(f: FiltrosReporte = {}): Promise<ReporteInventarioCategoria> {
    return this.consultar("inventario-categoria", f);
  }
  public disponibilidadArticulos(f: FiltrosReporte = {}): Promise<ReporteDisponibilidad> {
    return this.consultar("disponibilidad-articulos", f);
  }
  public gastoPorArea(f: FiltrosReporte = {}): Promise<ReporteGastoArea> {
    return this.consultar("gasto-area", f);
  }
  public auditoriaCompras(f: FiltrosReporte = {}): Promise<ReporteAuditoria> {
    return this.consultar("auditoria-compras", f);
  }

  /** Evaluacion: aplana pesos y requisitos minimos a la query. */
  public filtroEvaluacion(f: FiltroEvaluacion): FiltrosReporte {
    return {
      desde: f.desde,
      hasta: f.hasta,
      idCategoria: f.idCategoria,
      idProveedor: f.idProveedor,
      q: f.q,
      minOrdenes: f.minOrdenes !== undefined && f.minOrdenes > 1 ? f.minOrdenes : undefined,
      prioridad: f.prioridad,
      soloEnvioGratis: f.soloEnvioGratis,
      maxRechazo: f.maxRechazo,
      minATiempo: f.minATiempo,
      maxDias: f.maxDias,
      ...(f.prioridad === "personalizado" && f.pesos !== undefined
        ? {
            pDescuento: f.pesos.descuento,
            pEntrega: f.pesos.entrega,
            pCumplimiento: f.pesos.cumplimiento,
            pCalidad: f.pesos.calidad,
            pEnvio: f.pesos.envio,
          }
        : {}),
    };
  }
  public evaluacionProveedores(f: FiltroEvaluacion = {}): Promise<ReporteEvaluacionProveedores> {
    return this.consultar("evaluacion-proveedores", this.filtroEvaluacion(f));
  }
  public descargarEvaluacionProveedoresPdf(f: FiltroEvaluacion = {}, filtrosTexto?: string): Promise<void> {
    return this.descargarPdf("evaluacion-proveedores", this.filtroEvaluacion(f), filtrosTexto);
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

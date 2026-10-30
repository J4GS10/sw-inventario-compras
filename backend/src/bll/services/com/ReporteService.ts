/**
 * Capa 3 - Logica de Negocio / compras (reporteria).
 *
 * Solo lectura (como `DashboardService`): compone `CompraReadRepository` y le
 * agrega lo que una consulta SQL no debe cargar (porcentaje de participacion,
 * totales del periodo, recomendaciones). No hereda de `TransactionalService`.
 *
 * Cada reporte recibe UN objeto de filtros y lo aplica entero aqui: el JSON de
 * la pantalla y el PDF llaman al mismo metodo con los mismos filtros, asi el
 * PDF trae exactamente las filas que el usuario ve (ni una mas).
 */

import {
  CompraReadRepository,
  type ArticuloCompradoRow,
  type DesempenoProveedorRow,
  type DisponibilidadArticuloRow,
  type EvaluacionProveedorRow,
  type GastoProveedorRow,
  type HallazgoAuditoriaRow,
  type InventarioCategoriaRow,
  type OcPendienteRow,
  type RiesgoProveedorInsumo,
  type TipoHallazgo,
} from "../../../dal/repositories/com/CompraReadRepository.js";
import { validarRangoFechas } from "../../compras/reglasDocumentos.js";
import { ValidationError } from "../../../common/errors/AppError.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import { empleadosEnAlcance } from "./alcance.js";

/* ---- Filtros ------------------------------------------------------------ */

/** Filtros comunes a todos los reportes (cada uno usa los que le aplican). */
export interface FiltroReporte {
  readonly desde?: string;
  readonly hasta?: string;
  readonly idProveedor?: number;
  readonly idCategoria?: number;
  /** Texto libre: proveedor, NIT, articulo, documento, estado... */
  readonly q?: string;
}

export interface FiltroPendientes extends FiltroReporte {
  /** Solo las que ya pasaron su fecha de entrega. */
  readonly soloVencidas?: boolean;
}

export interface FiltroRiesgo extends FiltroReporte {
  readonly nivel?: NivelRiesgo;
  /** Minimo de OC recibidas para que el score sea representativo. */
  readonly minOrdenes?: number;
  /** Oculta los proveedores ya restringidos (estado I). */
  readonly soloActivos?: boolean;
}

export type AccionDisponibilidad = "PEDIR" | "EN_CURSO" | "EN_TRANSITO" | "SUFICIENTE" | "EXCEDIDO";

export interface FiltroDisponibilidad extends FiltroReporte {
  readonly accion?: AccionDisponibilidad;
}

export interface FiltroGastoArea extends FiltroReporte {
  readonly idDepartamento?: number;
}

export type SeveridadHallazgo = "alta" | "media" | "baja";

export interface FiltroAuditoria extends FiltroReporte {
  readonly tipo?: TipoHallazgo | "PROVEEDOR_RIESGO";
  readonly severidad?: SeveridadHallazgo;
}

/** Valida el rango (dias reales, desde <= hasta) y lo deja normalizado. */
function normRango(desde: string | undefined, hasta: string | undefined): { d?: string; h?: string } {
  const r = validarRangoFechas(desde, hasta);
  return { ...(r.desde !== undefined ? { d: r.desde } : {}), ...(r.hasta !== undefined ? { h: r.hasta } : {}) };
}

/** Minusculas y sin tildes: "Ferretería" coincide con "ferreteria". */
function plano(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** true si `q` esta vacio o TODAS sus palabras aparecen en alguno de los campos. */
export function coincideTexto(q: string | undefined, ...campos: readonly (string | number | null | undefined)[]): boolean {
  if (q === undefined || q.trim() === "") return true;
  const texto = plano(campos.filter((c) => c !== null && c !== undefined).join(" "));
  return plano(q)
    .split(/\s+/)
    .filter((w) => w !== "")
    .every((w) => texto.includes(w));
}

const redondea = (n: number, d = 1): number => Number(n.toFixed(d));

/* ---- Tipos de salida ---------------------------------------------------- */

export interface GastoProveedorItem extends GastoProveedorRow {
  readonly porcentaje: number;
}
export interface ReporteGastoProveedor {
  readonly desde: string | null;
  readonly hasta: string | null;
  readonly montoTotal: number;
  readonly ordenesTotal: number;
  readonly proveedores: readonly GastoProveedorItem[];
  readonly generadoEn: string;
}

export interface InventarioCategoriaItem extends InventarioCategoriaRow {
  /** Participacion de la categoria en el valor total del inventario (0-100). */
  readonly porcentaje: number;
}
export interface ReporteInventarioCategoria {
  readonly valorTotal: number;
  readonly unidadesTotal: number;
  readonly articulosTotal: number;
  readonly categorias: readonly InventarioCategoriaItem[];
  readonly generadoEn: string;
}

export interface ReporteOcPendientes {
  readonly totalOrdenes: number;
  readonly totalVencidas: number;
  readonly montoTotal: number;
  /** OC con entrega esperada en los proximos 7 dias (aun no vencidas). */
  readonly proximas7Dias: number;
  readonly ordenes: readonly OcPendienteRow[];
  readonly generadoEn: string;
}

export interface ReporteDesempenoProveedores {
  readonly desde: string | null;
  readonly hasta: string | null;
  readonly diasPromedioGeneral: number | null;
  readonly proveedores: readonly DesempenoProveedorRow[];
  readonly generadoEn: string;
}

export type NivelRiesgo = "bajo" | "medio" | "alto";

/** Que hacer con el proveedor, segun su nivel de riesgo. */
export type RecomendacionRiesgo = "MANTENER" | "VIGILAR" | "RESTRINGIR";

export interface RiesgoProveedorItem extends RiesgoProveedorInsumo {
  /** 0-100, mas alto = mas confiable. Formula documentada en `calcularScore`. */
  readonly score: number;
  readonly nivel: NivelRiesgo;
  readonly recomendacion: RecomendacionRiesgo;
  /** Por que: los factores que le restaron puntos, en lenguaje llano. */
  readonly motivos: readonly string[];
}
export interface ReporteRiesgoProveedores {
  readonly diasPromedioGeneral: number | null;
  readonly proveedores: readonly RiesgoProveedorItem[];
  readonly generadoEn: string;
}

export interface DisponibilidadArticuloItem extends DisponibilidadArticuloRow {
  /** existencia + en transito. */
  readonly cobertura: number;
  readonly accion: AccionDisponibilidad;
  /** Cantidad sugerida para llegar al maximo (o al minimo); null sin politica de stock. */
  readonly sugeridoPedir: number | null;
  readonly motivo: string;
}
export interface ReporteDisponibilidad {
  readonly articulos: readonly DisponibilidadArticuloItem[];
  readonly resumen: Readonly<Record<AccionDisponibilidad, number>>;
  readonly generadoEn: string;
}

export interface AreaItem {
  readonly idDepartamento: number | null;
  readonly departamento: string;
  readonly solicitudes: number;
  readonly porAprobar: number;
  readonly aprobadas: number;
  readonly rechazadas: number;
  /** % rechazadas sobre las ya decididas (aprobadas + rechazadas). */
  readonly porcentajeRechazo: number | null;
  readonly montoEstimado: number;
  readonly diasPromedioAprobacion: number | null;
  readonly ordenes: number;
  readonly montoComprometido: number;
  readonly porcentajeGasto: number;
}
export interface ReporteGastoArea {
  readonly desde: string | null;
  readonly hasta: string | null;
  /** true cuando el usuario solo ve su equipo o su departamento. */
  readonly acotado: boolean;
  readonly montoTotal: number;
  readonly solicitudesTotal: number;
  readonly porAprobarTotal: number;
  readonly areas: readonly AreaItem[];
  readonly articulosTop: readonly ArticuloCompradoRow[];
  readonly generadoEn: string;
}

export interface HallazgoItem extends Omit<HallazgoAuditoriaRow, "tipo"> {
  readonly tipo: TipoHallazgo | "PROVEEDOR_RIESGO";
  readonly severidad: SeveridadHallazgo;
  /** Codigo legible del documento: SOL-12, OC-40, REC-7, PROV-3. */
  readonly codigo: string;
  readonly detalle: string;
}
export interface ReporteAuditoria {
  readonly desde: string | null;
  readonly hasta: string | null;
  readonly hallazgos: readonly HallazgoItem[];
  readonly porSeveridad: Readonly<Record<SeveridadHallazgo, number>>;
  readonly porTipo: Readonly<Record<string, number>>;
  readonly montoEnRiesgo: number;
  readonly generadoEn: string;
}

/* ---- Riesgo ------------------------------------------------------------- */

const CALIFICACION_SCORE: Record<string, number> = {
  "A+": 100,
  A: 85,
  B: 70,
  C: 50,
  Nuevo: 60,
};

/**
 * Score de riesgo (0-100, mas alto = mas confiable), transparente y
 * explicable — no una caja negra:
 *  - Parte de 100.
 *  - Resta hasta 30 pts si tarda mas que el promedio del resto de
 *    proveedores (proporcional al % de desvio sobre ese promedio).
 *  - Resta hasta 40 pts por % de rechazo (2 pts por cada 1% rechazado).
 *  - Ajusta +/-15 segun la calificacion declarada del proveedor.
 *  - NO penaliza por tener articulos en escasez (`tieneArticulosEnEscasez`
 *    es informativo: puede ser por demanda alta, no por culpa del
 *    proveedor) — se muestra aparte, no se mezcla en el numero.
 */
function calcularScore(p: RiesgoProveedorInsumo, promedioGeneral: number | null): number {
  let score = 100;
  if (p.diasPromedioEntrega !== null && promedioGeneral !== null && promedioGeneral > 0) {
    const desvioPct = (p.diasPromedioEntrega - promedioGeneral) / promedioGeneral;
    score -= Math.max(0, Math.min(30, desvioPct * 40));
  }
  score -= Math.min(40, p.porcentajeRechazo * 2);
  const calScore = CALIFICACION_SCORE[p.calificacion ?? ""] ?? 60;
  score += (calScore - 70) / 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function nivelDe(score: number): NivelRiesgo {
  if (score >= 75) return "bajo";
  if (score >= 50) return "medio";
  return "alto";
}

const RECOMENDACION: Record<NivelRiesgo, RecomendacionRiesgo> = {
  bajo: "MANTENER",
  medio: "VIGILAR",
  alto: "RESTRINGIR",
};

/** Los mismos factores de `calcularScore`, explicados. */
function motivosRiesgo(p: RiesgoProveedorInsumo, promedioGeneral: number | null): string[] {
  const m: string[] = [];
  if (p.diasPromedioEntrega !== null && promedioGeneral !== null && promedioGeneral > 0) {
    const desvio = ((p.diasPromedioEntrega - promedioGeneral) / promedioGeneral) * 100;
    if (desvio >= 10) m.push(`Entrega ${Math.round(desvio)} % más lento que el promedio (${p.diasPromedioEntrega} d vs ${promedioGeneral} d)`);
  }
  if (p.porcentajeRechazo > 0) m.push(`Rechazo de ${redondea(p.porcentajeRechazo)} % de lo recibido`);
  if (p.calificacion === "C") m.push("Calificación declarada baja (C)");
  if (p.calificacion === null || p.calificacion === "Nuevo") m.push("Sin calificación consolidada");
  if (p.tieneArticulosEnEscasez) m.push("Surte artículos que hoy están en escasez");
  if (m.length === 0) m.push("Sin factores de riesgo relevantes");
  return m;
}

/* ---- Evaluacion --------------------------------------------------------- */

/** Enfoque con el que se ordena la evaluacion de proveedores (pesos de cada criterio). */
export type PrioridadEvaluacion = "equilibrado" | "ahorro" | "rapidez" | "calidad" | "personalizado";
export const PRIORIDADES_EVALUACION: readonly PrioridadEvaluacion[] = [
  "equilibrado",
  "ahorro",
  "rapidez",
  "calidad",
  "personalizado",
];

export interface PesosEvaluacion {
  readonly descuento: number;
  readonly entrega: number;
  readonly cumplimiento: number;
  readonly calidad: number;
  readonly envio: number;
}

/** Cada fila suma 1. `envio` premia el flete bajo o gratuito; `entrega`, los dias bajos. */
const PESOS: Record<Exclude<PrioridadEvaluacion, "personalizado">, PesosEvaluacion> = {
  equilibrado: { descuento: 0.25, entrega: 0.25, cumplimiento: 0.2, calidad: 0.15, envio: 0.15 },
  ahorro: { descuento: 0.45, entrega: 0.1, cumplimiento: 0.1, calidad: 0.1, envio: 0.25 },
  rapidez: { descuento: 0.1, entrega: 0.4, cumplimiento: 0.3, calidad: 0.1, envio: 0.1 },
  calidad: { descuento: 0.1, entrega: 0.15, cumplimiento: 0.25, calidad: 0.4, envio: 0.1 },
};

/** Pesos que eligio el usuario (cualquier escala, p. ej. 0-10) llevados a que sumen 1. */
export function normalizarPesos(p: PesosEvaluacion): PesosEvaluacion {
  const vals = [p.descuento, p.entrega, p.cumplimiento, p.calidad, p.envio];
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) {
    throw new ValidationError("Los pesos de la evaluación deben ser números mayores o iguales a 0");
  }
  const total = vals.reduce((a, v) => a + v, 0);
  if (total <= 0) throw new ValidationError("Asigna peso a al menos un criterio de la evaluación");
  return {
    descuento: p.descuento / total,
    entrega: p.entrega / total,
    cumplimiento: p.cumplimiento / total,
    calidad: p.calidad / total,
    envio: p.envio / total,
  };
}

export interface EvaluacionProveedorItem extends EvaluacionProveedorRow {
  /** Descuento ponderado por monto: (bruto - neto) / bruto, en %. */
  readonly descuentoPct: number;
  /** GTQ que el descuento le ahorro a la empresa: bruto - neto. */
  readonly ahorroDescuento: number;
  /** Dias reales emision -> ultima recepcion; si no hay OC completas, el plazo prometido. */
  readonly diasEntrega: number | null;
  /** `true` si `diasEntrega` es el plazo prometido (aun sin OC completas), no el real. */
  readonly diasEntregaEsPrometido: boolean;
  /** % de OC completas recibidas en o antes de la fecha prometida. null si no hay completas. */
  readonly porcentajeATiempo: number | null;
  /** % de unidades rechazadas sobre lo procesado. null si no hay recepciones. */
  readonly porcentajeRechazo: number | null;
  /** % de las OC con flete registrado que fueron envio gratuito. null si ninguna lo registro. */
  readonly porcentajeEnvioGratis: number | null;
  /** Flete promedio (GTQ) por OC con flete registrado. null si ninguna lo registro. */
  readonly costoEnvioPromedio: number | null;
  /** 0-100 segun la prioridad pedida; compara solo contra los proveedores elegibles del resultado. */
  readonly score: number;
  /** Cumple `minOrdenes`; los que no, se listan pero no compiten por "mejor". */
  readonly elegible: boolean;
}

export interface MejorProveedor {
  readonly idProveedor: number;
  readonly proveedor: string;
  /** Valor numerico del criterio (para mostrar). */
  readonly valor: number;
}

export interface ReporteEvaluacionProveedores {
  readonly desde: string | null;
  readonly hasta: string | null;
  readonly idCategoria: number | null;
  readonly prioridad: PrioridadEvaluacion;
  /** Pesos efectivos (suman 1) con los que se calculo el score. */
  readonly pesos: PesosEvaluacion;
  readonly minOrdenes: number;
  /** Proveedores que no cumplieron los requisitos minimos pedidos (rechazo, a tiempo, dias). */
  readonly descartados: number;
  readonly resumen: {
    readonly proveedores: number;
    readonly montoNeto: number;
    readonly ahorroDescuento: number;
    readonly descuentoPromedioPct: number;
    readonly diasEntregaPromedio: number | null;
    readonly porcentajeATiempo: number | null;
    readonly ordenesConEnvio: number;
    readonly ordenesEnvioGratis: number;
  };
  /** null cuando ningun proveedor elegible tiene el dato del criterio. */
  readonly mejores: {
    readonly descuento: MejorProveedor | null;
    readonly entrega: MejorProveedor | null;
    readonly cumplimiento: MejorProveedor | null;
    readonly calidad: MejorProveedor | null;
    readonly envio: MejorProveedor | null;
    readonly conveniencia: MejorProveedor | null;
  };
  /** Elegibles primero, por `score` descendente. */
  readonly proveedores: readonly EvaluacionProveedorItem[];
  readonly generadoEn: string;
}

export interface EvaluacionProveedoresInput {
  readonly desde?: string;
  readonly hasta?: string;
  readonly idCategoria?: number;
  readonly prioridad?: PrioridadEvaluacion;
  /** Obligatorio con prioridad "personalizado": cuanto pesa cada criterio (cualquier escala). */
  readonly pesos?: PesosEvaluacion;
  readonly minOrdenes?: number;
  /** Deja solo proveedores que registraron al menos un envio gratuito. */
  readonly soloEnvioGratis?: boolean;
  /** Requisitos minimos: quien no los cumple queda fuera del resultado. */
  readonly maxRechazoPct?: number;
  readonly minATiempoPct?: number;
  readonly maxDiasEntrega?: number;
  readonly idProveedor?: number;
  readonly q?: string;
}

/** Normaliza a 0..1 entre los valores presentes; `mayorEsMejor=false` invierte. Sin dato: 0.5 (neutro). */
function normalizador(
  valores: readonly (number | null)[],
  mayorEsMejor: boolean,
): (v: number | null) => number {
  const presentes = valores.filter((v): v is number => v !== null);
  if (presentes.length === 0) return () => 0.5;
  const min = Math.min(...presentes);
  const max = Math.max(...presentes);
  return (v) => {
    if (v === null) return 0.5;
    if (max === min) return 1;
    const x = (v - min) / (max - min);
    return mayorEsMejor ? x : 1 - x;
  };
}

/**
 * Mejor proveedor en un criterio, o null si no hay con quien compararlo: sin
 * dato, un solo proveedor con dato, o todos empatados (nombrar ganador al
 * primero de la lista seria inventar una diferencia). `minimo` exige ademas
 * que el valor ganador sea real (p. ej. un "mayor descuento" de 0 % no es nada).
 */
function mejorPor(
  items: readonly EvaluacionProveedorItem[],
  valor: (p: EvaluacionProveedorItem) => number | null,
  mayorEsMejor: boolean,
  desempate?: (p: EvaluacionProveedorItem) => number,
  minimo?: number,
): MejorProveedor | null {
  const valores = items.map(valor).filter((v): v is number => v !== null);
  if (valores.length < 2 || Math.min(...valores) === Math.max(...valores)) return null;
  let mejor: EvaluacionProveedorItem | null = null;
  let mejorV = 0;
  for (const p of items) {
    const v = valor(p);
    if (v === null) continue;
    const gana =
      mejor === null ||
      (mayorEsMejor ? v > mejorV : v < mejorV) ||
      (v === mejorV && desempate !== undefined && desempate(p) < desempate(mejor));
    if (gana) {
      mejor = p;
      mejorV = v;
    }
  }
  if (mejor === null || (minimo !== undefined && mejorV <= minimo)) return null;
  return { idProveedor: mejor.idProveedor, proveedor: mejor.proveedor, valor: mejorV };
}

/* ---- Disponibilidad ----------------------------------------------------- */

/**
 * Que conviene hacer con un articulo antes de pedirlo:
 *  - cobertura = existencia + en transito.
 *  - PEDIR: la cobertura no llega al minimo (o es 0) y nadie lo ha solicitado.
 *  - EN_CURSO: falta, pero ya hay una solicitud en tramite (no duplicar).
 *  - EN_TRANSITO: la existencia esta bajo el minimo, pero lo que viene lo cubre.
 *  - EXCEDIDO: la cobertura ya supera el maximo: no pedir.
 *  - SUFICIENTE: hay existencia sobre el minimo.
 */
export function clasificarDisponibilidad(a: DisponibilidadArticuloRow): Pick<DisponibilidadArticuloItem, "cobertura" | "accion" | "sugeridoPedir" | "motivo"> {
  const cobertura = redondea(a.existencia + a.enTransito, 2);
  const min = a.stockMinimo;
  const max = a.stockMaximo;
  const objetivo = max > 0 ? max : min;
  const sugerido = objetivo > 0 ? Math.max(0, redondea(objetivo - cobertura - a.solicitado, 2)) : null;
  const falta = cobertura === 0 || (min > 0 && cobertura <= min);
  if (falta && a.solicitudesEnCurso > 0) {
    return {
      cobertura,
      accion: "EN_CURSO",
      sugeridoPedir: sugerido,
      motivo: `Ya hay ${a.solicitudesEnCurso} solicitud(es) en trámite por ${a.solicitado}: no dupliques el pedido`,
    };
  }
  if (falta) {
    return {
      cobertura,
      accion: "PEDIR",
      sugeridoPedir: sugerido,
      motivo: min > 0 ? `Cobertura ${cobertura} por debajo del mínimo ${min}` : "Sin existencia ni pedidos en camino",
    };
  }
  if (min > 0 && a.existencia <= min) {
    return {
      cobertura,
      accion: "EN_TRANSITO",
      sugeridoPedir: 0,
      motivo: `Existencia ${a.existencia} bajo el mínimo, pero vienen ${a.enTransito} en camino`,
    };
  }
  if (max > 0 && cobertura > max) {
    return { cobertura, accion: "EXCEDIDO", sugeridoPedir: 0, motivo: `Cobertura ${cobertura} supera el máximo ${max}: no pedir` };
  }
  return {
    cobertura,
    accion: "SUFICIENTE",
    sugeridoPedir: 0,
    motivo: a.enTransito > 0 ? `Hay ${a.existencia} en existencia y ${a.enTransito} en camino` : `Hay ${a.existencia} en existencia`,
  };
}

/* ---- Auditoria ---------------------------------------------------------- */

export const TITULO_HALLAZGO: Record<TipoHallazgo | "PROVEEDOR_RIESGO", string> = {
  AUTOAPROBACION: "Autoaprobación",
  SIN_COMPETENCIA: "Compra sin competencia",
  NO_MAS_BARATA: "No se adjudicó la oferta más baja",
  SOBREPRECIO_HISTORICO: "Precio sobre el histórico",
  RECHAZO_ALTO: "Recepción con rechazo alto",
  PROVEEDOR_RIESGO: "Compras a proveedor de riesgo alto",
};

const fmtQ = (n: number): string => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Monto a partir del cual una compra sin competencia deja de ser menor. */
const UMBRAL_SIN_COMPETENCIA = 10000;

function clasificarHallazgo(h: HallazgoAuditoriaRow): HallazgoItem {
  const pct = h.porcentaje ?? 0;
  const base = { ...h, codigo: `${h.documento}-${h.idDocumento}` };
  switch (h.tipo) {
    case "AUTOAPROBACION":
      return {
        ...base,
        severidad: "alta",
        detalle: `El solicitante aprobó su propia solicitud (${h.referencia ?? "—"}). Falta segregación de funciones.`,
      };
    case "SIN_COMPETENCIA":
      return {
        ...base,
        severidad: h.monto >= UMBRAL_SIN_COMPETENCIA ? "media" : "baja",
        detalle: `Adjudicada con una sola cotización (${h.referencia ?? ""}). Pedir al menos 2 ofertas.`,
      };
    case "NO_MAS_BARATA":
      return {
        ...base,
        severidad: pct >= 10 ? "alta" : "media",
        detalle: `Se pagó hasta ${redondea(pct)} % más que la oferta más baja; sobrecosto ${fmtQ(h.monto)}. Verificar la justificación en el comparativo.`,
      };
    case "SOBREPRECIO_HISTORICO":
      return {
        ...base,
        severidad: pct >= 30 ? "alta" : "media",
        detalle: `${h.referencia ?? "Artículo"}: ${redondea(pct)} % sobre su precio promedio histórico (sobrecosto ${fmtQ(h.monto)}).`,
      };
    case "RECHAZO_ALTO":
      return {
        ...base,
        severidad: pct >= 25 ? "alta" : "media",
        detalle: `Se rechazó ${redondea(pct)} % de lo recibido (${h.referencia ?? ""}); valor rechazado ${fmtQ(h.monto)}.`,
      };
  }
}

const SEVERIDAD_ORDEN: Record<SeveridadHallazgo, number> = { alta: 0, media: 1, baja: 2 };

/* ---- Servicio ----------------------------------------------------------- */

export class ReporteService {
  private readonly read = new CompraReadRepository();

  public async gastoPorProveedor(f: FiltroReporte = {}): Promise<ReporteGastoProveedor> {
    const { d, h } = normRango(f.desde, f.hasta);
    const filas = (
      await this.read.gastoPorProveedor(d, h, {
        ...(f.idCategoria !== undefined ? { idCategoria: f.idCategoria } : {}),
        ...(f.idProveedor !== undefined ? { idProveedor: f.idProveedor } : {}),
      })
    ).filter((r) => coincideTexto(f.q, r.proveedor, r.nit));
    const montoTotal = Number(filas.reduce((a, r) => a + r.monto, 0).toFixed(2));
    const ordenesTotal = filas.reduce((a, r) => a + r.ordenes, 0);
    return {
      desde: d ?? null,
      hasta: h ?? null,
      montoTotal,
      ordenesTotal,
      proveedores: filas.map((r) => ({
        ...r,
        porcentaje: montoTotal > 0 ? Number(((r.monto / montoTotal) * 100).toFixed(1)) : 0,
      })),
      generadoEn: new Date().toISOString(),
    };
  }

  /** Cuanto inventario hay y cuanto vale, por categoria, con su % del valor total. */
  public async inventarioPorCategoria(f: FiltroReporte = {}): Promise<ReporteInventarioCategoria> {
    const filas = (await this.read.inventarioPorCategoria()).filter(
      (r) => (f.idCategoria === undefined || r.idCategoria === f.idCategoria) && coincideTexto(f.q, r.categoria),
    );
    const valorTotal = Number(filas.reduce((a, r) => a + r.valor, 0).toFixed(2));
    return {
      valorTotal,
      unidadesTotal: Number(filas.reduce((a, r) => a + r.unidades, 0).toFixed(2)),
      articulosTotal: filas.reduce((a, r) => a + r.articulos, 0),
      categorias: filas.map((r) => ({
        ...r,
        porcentaje: valorTotal > 0 ? Number(((r.valor / valorTotal) * 100).toFixed(1)) : 0,
      })),
      generadoEn: new Date().toISOString(),
    };
  }

  /**
   * OC por recibir. `desde`/`hasta` acotan la FECHA DE ENTREGA ESPERADA (lo que
   * llega en ese rango), que es lo que planifica bodega.
   */
  public async ocPendientesRecibir(f: FiltroPendientes = {}): Promise<ReporteOcPendientes> {
    const { d, h } = normRango(f.desde, f.hasta);
    const filas = (await this.read.ocPendientesRecibir()).filter((r) => {
      const entrega = r.fechaEntregaEsperada.slice(0, 10);
      return (
        (f.idProveedor === undefined || r.idProveedor === f.idProveedor) &&
        (f.soloVencidas !== true || r.diasVencida > 0) &&
        (d === undefined || entrega >= d) &&
        (h === undefined || entrega <= h) &&
        coincideTexto(f.q, r.proveedor, r.estado, `OC-${r.idOrdenCompra}`)
      );
    });
    const hoy = new Date();
    const en7 = new Date(hoy.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const hoyIso = hoy.toISOString().slice(0, 10);
    return {
      totalOrdenes: filas.length,
      totalVencidas: filas.filter((r) => r.diasVencida > 0).length,
      montoTotal: Number(filas.reduce((a, r) => a + r.monto, 0).toFixed(2)),
      proximas7Dias: filas.filter((r) => {
        const e = r.fechaEntregaEsperada.slice(0, 10);
        return r.diasVencida === 0 && e >= hoyIso && e <= en7;
      }).length,
      ordenes: filas,
      generadoEn: hoy.toISOString(),
    };
  }

  public async desempenoProveedores(f: FiltroReporte = {}): Promise<ReporteDesempenoProveedores> {
    const { d, h } = normRango(f.desde, f.hasta);
    const filas = (
      await this.read.desempenoProveedores(d, h, {
        ...(f.idCategoria !== undefined ? { idCategoria: f.idCategoria } : {}),
        ...(f.idProveedor !== undefined ? { idProveedor: f.idProveedor } : {}),
      })
    ).filter((r) => coincideTexto(f.q, r.proveedor));
    const conDato = filas.filter((r) => r.diasPromedioEntrega !== null);
    const diasPromedioGeneral =
      conDato.length > 0
        ? Number(
            (
              conDato.reduce((a, r) => a + (r.diasPromedioEntrega ?? 0), 0) / conDato.length
            ).toFixed(1),
          )
        : null;
    return {
      desde: d ?? null,
      hasta: h ?? null,
      diasPromedioGeneral,
      proveedores: filas,
      generadoEn: new Date().toISOString(),
    };
  }

  /**
   * Riesgo por proveedor: todo el historico (ver `riesgoProveedoresInsumos`).
   * El score se calcula contra TODOS los proveedores; los filtros solo deciden
   * cuales se muestran (filtrar no cambia el score de nadie).
   */
  public async riesgoProveedores(f: FiltroRiesgo = {}): Promise<ReporteRiesgoProveedores> {
    const filas = await this.read.riesgoProveedoresInsumos();
    const conDias = filas.filter((x) => x.diasPromedioEntrega !== null);
    const promedioGeneral =
      conDias.length > 0
        ? Number(
            (conDias.reduce((a, x) => a + (x.diasPromedioEntrega ?? 0), 0) / conDias.length).toFixed(1),
          )
        : null;

    const proveedores = filas
      .map((x) => {
        const score = calcularScore(x, promedioGeneral);
        const nivel = nivelDe(score);
        return { ...x, score, nivel, recomendacion: RECOMENDACION[nivel], motivos: motivosRiesgo(x, promedioGeneral) };
      })
      .filter(
        (x) =>
          (f.nivel === undefined || x.nivel === f.nivel) &&
          (f.idProveedor === undefined || x.idProveedor === f.idProveedor) &&
          (f.minOrdenes === undefined || x.ordenesRecibidas >= f.minOrdenes) &&
          (f.soloActivos !== true || x.estado === "A") &&
          coincideTexto(f.q, x.proveedor, x.calificacion),
      )
      .sort((a, b) => a.score - b.score); // mas riesgoso primero

    return { diasPromedioGeneral: promedioGeneral, proveedores, generadoEn: new Date().toISOString() };
  }

  /** ¿Conviene pedir? Existencia, lo que viene en camino y lo ya solicitado, por articulo. */
  public async disponibilidadArticulos(f: FiltroDisponibilidad = {}): Promise<ReporteDisponibilidad> {
    const filas = await this.read.disponibilidadArticulos({
      ...(f.idCategoria !== undefined ? { idCategoria: f.idCategoria } : {}),
    });
    const todos = filas
      .filter((a) => coincideTexto(f.q, a.codigo, a.articulo, a.categoria, a.ultimoProveedor))
      .map((a) => ({ ...a, ...clasificarDisponibilidad(a) }));
    const resumen: Record<AccionDisponibilidad, number> = { PEDIR: 0, EN_CURSO: 0, EN_TRANSITO: 0, SUFICIENTE: 0, EXCEDIDO: 0 };
    for (const a of todos) resumen[a.accion]++;
    const orden: Record<AccionDisponibilidad, number> = { PEDIR: 0, EN_CURSO: 1, EN_TRANSITO: 2, SUFICIENTE: 3, EXCEDIDO: 4 };
    return {
      // El resumen cuenta todo lo que coincide con el texto/categoria; la lista respeta ademas la accion pedida.
      articulos: todos
        .filter((a) => f.accion === undefined || a.accion === f.accion)
        .sort((a, b) => orden[a.accion] - orden[b.accion] || a.articulo.localeCompare(b.articulo)),
      resumen,
      generadoEn: new Date().toISOString(),
    };
  }

  /**
   * Gasto y aprobaciones por departamento. Jefes y gerentes ven SOLO su equipo o
   * su departamento (mismo alcance que en las solicitudes); compras, finanzas y
   * auditoria ven todas las areas.
   */
  public async gastoPorArea(f: FiltroGastoArea, ctx: AuditContext | undefined): Promise<ReporteGastoArea> {
    const { d, h } = normRango(f.desde, f.hasta);
    const empleados = await empleadosEnAlcance(ctx, this.read);
    const filtro = {
      ...(d !== undefined ? { desde: d } : {}),
      ...(h !== undefined ? { hasta: h } : {}),
      ...(f.idDepartamento !== undefined ? { idDepartamento: f.idDepartamento } : {}),
      empleados,
    };
    const [sol, gasto, top] = await Promise.all([
      this.read.solicitudesPorArea(filtro),
      this.read.gastoPorArea(filtro),
      this.read.articulosMasComprados(filtro, 10),
    ]);
    const gastoPorDep = new Map(gasto.map((g) => [g.idDepartamento, g]));
    const ids = new Set<number | null>([...sol.map((s) => s.idDepartamento), ...gasto.map((g) => g.idDepartamento)]);
    const nombre = new Map(sol.map((s) => [s.idDepartamento, s.departamento]));
    const montoTotal = redondea(gasto.reduce((a, g) => a + g.monto, 0), 2);
    const areas: AreaItem[] = [...ids]
      .map((id) => {
        const s = sol.find((x) => x.idDepartamento === id);
        const g = gastoPorDep.get(id);
        const decididas = (s?.aprobadas ?? 0) + (s?.rechazadas ?? 0);
        const monto = g?.monto ?? 0;
        return {
          idDepartamento: id,
          departamento: nombre.get(id) ?? (id === null ? "Sin departamento" : `Departamento ${id}`),
          solicitudes: s?.solicitudes ?? 0,
          porAprobar: s?.porAprobar ?? 0,
          aprobadas: s?.aprobadas ?? 0,
          rechazadas: s?.rechazadas ?? 0,
          porcentajeRechazo: decididas > 0 ? redondea(((s?.rechazadas ?? 0) / decididas) * 100) : null,
          montoEstimado: s?.montoEstimado ?? 0,
          diasPromedioAprobacion: s?.diasPromedioAprobacion ?? null,
          ordenes: g?.ordenes ?? 0,
          montoComprometido: monto,
          porcentajeGasto: montoTotal > 0 ? redondea((monto / montoTotal) * 100) : 0,
        };
      })
      .filter((a) => coincideTexto(f.q, a.departamento))
      .sort((a, b) => b.montoComprometido - a.montoComprometido || b.solicitudes - a.solicitudes);
    return {
      desde: d ?? null,
      hasta: h ?? null,
      acotado: empleados !== null,
      montoTotal: redondea(areas.reduce((a, x) => a + x.montoComprometido, 0), 2),
      solicitudesTotal: areas.reduce((a, x) => a + x.solicitudes, 0),
      porAprobarTotal: areas.reduce((a, x) => a + x.porAprobar, 0),
      areas,
      articulosTop: top,
      generadoEn: new Date().toISOString(),
    };
  }

  /**
   * Hallazgos de control interno del periodo, ya clasificados por severidad.
   * Suma un hallazgo por cada proveedor de riesgo ALTO que aun recibe OC
   * (para decidir si se le restringe la compra).
   */
  public async auditoriaCompras(f: FiltroAuditoria = {}): Promise<ReporteAuditoria> {
    const { d, h } = normRango(f.desde, f.hasta);
    const rango = { ...(d !== undefined ? { desde: d } : {}), ...(h !== undefined ? { hasta: h } : {}) };
    const [crudos, riesgo, gasto] = await Promise.all([
      this.read.hallazgosAuditoria(rango),
      this.riesgoProveedores({ nivel: "alto" }),
      this.read.gastoPorProveedor(d, h),
    ]);
    const gastoProv = new Map(gasto.map((g) => [g.idProveedor, g]));
    const deRiesgo: HallazgoItem[] = riesgo.proveedores
      .filter((p) => gastoProv.has(p.idProveedor))
      .map((p) => {
        const g = gastoProv.get(p.idProveedor)!;
        const restringido = p.estado !== "A";
        return {
          tipo: "PROVEEDOR_RIESGO" as const,
          documento: "OC" as const,
          idDocumento: p.idProveedor,
          codigo: `PROV-${p.idProveedor}`,
          fecha: new Date().toISOString(),
          idProveedor: p.idProveedor,
          proveedor: p.proveedor,
          monto: g.monto,
          porcentaje: p.score,
          referencia: `${g.ordenes} OC`,
          severidad: restringido ? ("baja" as const) : ("alta" as const),
          detalle: restringido
            ? `Ya restringido. Recibió ${g.ordenes} OC por ${fmtQ(g.monto)} en el periodo (score ${p.score}).`
            : `${g.ordenes} OC por ${fmtQ(g.monto)} a un proveedor de riesgo alto (score ${p.score}): ${p.motivos.join("; ")}. Considerar restringirlo.`,
        };
      });
    const hallazgos = [...crudos.map(clasificarHallazgo), ...deRiesgo]
      .filter(
        (x) =>
          (f.tipo === undefined || x.tipo === f.tipo) &&
          (f.severidad === undefined || x.severidad === f.severidad) &&
          (f.idProveedor === undefined || x.idProveedor === f.idProveedor) &&
          coincideTexto(f.q, x.codigo, x.proveedor, x.referencia, x.detalle, TITULO_HALLAZGO[x.tipo]),
      )
      .sort((a, b) => SEVERIDAD_ORDEN[a.severidad] - SEVERIDAD_ORDEN[b.severidad] || b.monto - a.monto);
    const porSeveridad: Record<SeveridadHallazgo, number> = { alta: 0, media: 0, baja: 0 };
    const porTipo: Record<string, number> = {};
    for (const x of hallazgos) {
      porSeveridad[x.severidad]++;
      porTipo[x.tipo] = (porTipo[x.tipo] ?? 0) + 1;
    }
    return {
      desde: d ?? null,
      hasta: h ?? null,
      hallazgos,
      porSeveridad,
      porTipo,
      montoEnRiesgo: redondea(
        hallazgos.filter((x) => x.tipo !== "AUTOAPROBACION" && x.tipo !== "SIN_COMPETENCIA").reduce((a, x) => a + x.monto, 0),
        2,
      ),
      generadoEn: new Date().toISOString(),
    };
  }

  /**
   * Evaluacion comparativa de proveedores: descuento, entrega, cumplimiento,
   * calidad y envio, mas un score 0-100 segun la `prioridad` (o los pesos que
   * elija el usuario). Pensado para decidir a quien comprarle: quien da mas
   * descuento, entrega mas rapido, cumple la fecha prometida, rechaza menos o
   * cobra menos flete. Los requisitos minimos (rechazo maximo, % a tiempo,
   * dias maximos) DESCARTAN a quien no los cumple antes de rankear.
   */
  public async evaluacionProveedores(
    input: EvaluacionProveedoresInput = {},
  ): Promise<ReporteEvaluacionProveedores> {
    const { d, h } = normRango(input.desde, input.hasta);
    const prioridad = input.prioridad ?? "equilibrado";
    if (!PRIORIDADES_EVALUACION.includes(prioridad)) {
      throw new ValidationError(`Prioridad inválida: use ${PRIORIDADES_EVALUACION.join(", ")}`);
    }
    let w: PesosEvaluacion;
    if (prioridad === "personalizado") {
      if (input.pesos === undefined) {
        throw new ValidationError("Con el enfoque personalizado indica el peso de cada criterio");
      }
      w = normalizarPesos(input.pesos);
    } else {
      w = PESOS[prioridad];
    }
    const minOrdenes = Math.max(1, Math.trunc(input.minOrdenes ?? 1));
    const filas = await this.read.evaluacionProveedores({
      ...(d !== undefined ? { desde: d } : {}),
      ...(h !== undefined ? { hasta: h } : {}),
      ...(input.idCategoria !== undefined ? { idCategoria: input.idCategoria } : {}),
    });

    const calculados = filas
      .filter((f) => input.soloEnvioGratis !== true || f.ordenesEnvioGratis > 0)
      .filter((f) => (input.idProveedor === undefined || f.idProveedor === input.idProveedor) && coincideTexto(input.q, f.proveedor, f.nit))
      .map((f) => {
        const procesado = f.cantidadRecibida + f.cantidadRechazada;
        const usaReal = f.diasRealesEntrega !== null;
        return {
          ...f,
          descuentoPct: f.montoBruto > 0 ? redondea(((f.montoBruto - f.montoNeto) / f.montoBruto) * 100, 2) : 0,
          ahorroDescuento: redondea(f.montoBruto - f.montoNeto, 2),
          diasEntrega: usaReal ? f.diasRealesEntrega : f.plazoPrometidoDias,
          diasEntregaEsPrometido: !usaReal,
          porcentajeATiempo: f.ordenesCompletas > 0 ? redondea((f.ordenesATiempo / f.ordenesCompletas) * 100) : null,
          porcentajeRechazo: procesado > 0 ? redondea((f.cantidadRechazada / procesado) * 100, 2) : null,
          porcentajeEnvioGratis:
            f.ordenesConEnvio > 0 ? redondea((f.ordenesEnvioGratis / f.ordenesConEnvio) * 100) : null,
          costoEnvioPromedio: f.ordenesConEnvio > 0 ? redondea(f.costoEnvioTotal / f.ordenesConEnvio, 2) : null,
          elegible: f.ordenes >= minOrdenes,
        };
      });

    // Requisitos minimos del usuario: sin dato no se descarta (no hay evidencia en contra).
    const cumple = (p: (typeof calculados)[number]): boolean =>
      (input.maxRechazoPct === undefined || p.porcentajeRechazo === null || p.porcentajeRechazo <= input.maxRechazoPct) &&
      (input.minATiempoPct === undefined || p.porcentajeATiempo === null || p.porcentajeATiempo >= input.minATiempoPct) &&
      (input.maxDiasEntrega === undefined || p.diasEntrega === null || p.diasEntrega <= input.maxDiasEntrega);
    const base = calculados.filter(cumple);
    const descartados = calculados.length - base.length;

    // La escala se arma solo con los elegibles: un proveedor de 1 sola OC no la distorsiona.
    const comp = base.filter((b) => b.elegible);
    const nDesc = normalizador(comp.map((p) => p.descuentoPct), true);
    const nEnt = normalizador(comp.map((p) => p.diasEntrega), false);
    const nCum = normalizador(comp.map((p) => p.porcentajeATiempo), true);
    const nCal = normalizador(comp.map((p) => p.porcentajeRechazo), false);
    const nEnv = normalizador(comp.map((p) => p.costoEnvioPromedio), false);

    const proveedores: EvaluacionProveedorItem[] = base
      .map((p) => ({
        ...p,
        score: Math.round(
          100 *
            (w.descuento * nDesc(p.descuentoPct) +
              w.entrega * nEnt(p.diasEntrega) +
              w.cumplimiento * nCum(p.porcentajeATiempo) +
              w.calidad * nCal(p.porcentajeRechazo) +
              w.envio * nEnv(p.costoEnvioPromedio)),
        ),
      }))
      .sort((a, b) => Number(b.elegible) - Number(a.elegible) || b.score - a.score || b.montoNeto - a.montoNeto);

    const el = proveedores.filter((p) => p.elegible);
    const montoNeto = redondea(proveedores.reduce((a, p) => a + p.montoNeto, 0), 2);
    const montoBruto = proveedores.reduce((a, p) => a + p.montoBruto, 0);
    const conDias = proveedores.filter((p) => p.diasEntrega !== null);
    const completas = proveedores.reduce((a, p) => a + p.ordenesCompletas, 0);

    return {
      desde: d ?? null,
      hasta: h ?? null,
      idCategoria: input.idCategoria ?? null,
      prioridad,
      pesos: {
        descuento: redondea(w.descuento, 3),
        entrega: redondea(w.entrega, 3),
        cumplimiento: redondea(w.cumplimiento, 3),
        calidad: redondea(w.calidad, 3),
        envio: redondea(w.envio, 3),
      },
      minOrdenes,
      descartados,
      resumen: {
        proveedores: proveedores.length,
        montoNeto,
        ahorroDescuento: redondea(montoBruto - montoNeto, 2),
        descuentoPromedioPct: montoBruto > 0 ? redondea(((montoBruto - montoNeto) / montoBruto) * 100, 2) : 0,
        diasEntregaPromedio:
          conDias.length > 0
            ? redondea(conDias.reduce((a, p) => a + (p.diasEntrega ?? 0), 0) / conDias.length)
            : null,
        porcentajeATiempo:
          completas > 0
            ? redondea((proveedores.reduce((a, p) => a + p.ordenesATiempo, 0) / completas) * 100)
            : null,
        ordenesConEnvio: proveedores.reduce((a, p) => a + p.ordenesConEnvio, 0),
        ordenesEnvioGratis: proveedores.reduce((a, p) => a + p.ordenesEnvioGratis, 0),
      },
      mejores: {
        descuento: mejorPor(el, (p) => p.descuentoPct, true, undefined, 0),
        entrega: mejorPor(el, (p) => p.diasEntrega, false),
        cumplimiento: mejorPor(el, (p) => p.porcentajeATiempo, true),
        calidad: mejorPor(el, (p) => p.porcentajeRechazo, false),
        envio: mejorPor(el, (p) => p.porcentajeEnvioGratis, true, (p) => p.costoEnvioPromedio ?? Infinity, 0),
        conveniencia: mejorPor(el, (p) => p.score, true),
      },
      proveedores,
      generadoEn: new Date().toISOString(),
    };
  }
}

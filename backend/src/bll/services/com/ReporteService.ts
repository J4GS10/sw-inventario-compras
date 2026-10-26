/**
 * Capa 3 - Logica de Negocio / compras (reporteria).
 *
 * Solo lectura (como `DashboardService`): compone `CompraReadRepository` y le
 * agrega lo que una consulta SQL no debe cargar (porcentaje de participacion,
 * totales del periodo). No hereda de `TransactionalService`.
 */

import {
  CompraReadRepository,
  type DesempenoProveedorRow,
  type EvaluacionProveedorRow,
  type GastoProveedorRow,
  type OcPendienteRow,
  type RiesgoProveedorInsumo,
} from "../../../dal/repositories/com/CompraReadRepository.js";

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

export interface ReporteOcPendientes {
  readonly totalOrdenes: number;
  readonly totalVencidas: number;
  readonly montoTotal: number;
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

import { validarRangoFechas } from "../../compras/reglasDocumentos.js";
import { ValidationError } from "../../../common/errors/AppError.js";

/** Valida el rango (dias reales, desde <= hasta) y lo deja normalizado. */
function normRango(desde: string | undefined, hasta: string | undefined): { d?: string; h?: string } {
  const r = validarRangoFechas(desde, hasta);
  return { ...(r.desde !== undefined ? { d: r.desde } : {}), ...(r.hasta !== undefined ? { h: r.hasta } : {}) };
}

export type NivelRiesgo = "bajo" | "medio" | "alto";

export interface RiesgoProveedorItem extends RiesgoProveedorInsumo {
  /** 0-100, mas alto = mas confiable. Formula documentada en `calcularScore`. */
  readonly score: number;
  readonly nivel: NivelRiesgo;
}
export interface ReporteRiesgoProveedores {
  readonly diasPromedioGeneral: number | null;
  readonly proveedores: readonly RiesgoProveedorItem[];
  readonly generadoEn: string;
}

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

/** Enfoque con el que se ordena la evaluacion de proveedores (pesos de cada criterio). */
export type PrioridadEvaluacion = "equilibrado" | "ahorro" | "rapidez" | "calidad";
export const PRIORIDADES_EVALUACION: readonly PrioridadEvaluacion[] = [
  "equilibrado",
  "ahorro",
  "rapidez",
  "calidad",
];

interface Pesos {
  readonly descuento: number;
  readonly entrega: number;
  readonly cumplimiento: number;
  readonly calidad: number;
  readonly envio: number;
}

/** Cada fila suma 1. `envio` premia el flete bajo o gratuito; `entrega`, los dias bajos. */
const PESOS: Record<PrioridadEvaluacion, Pesos> = {
  equilibrado: { descuento: 0.25, entrega: 0.25, cumplimiento: 0.2, calidad: 0.15, envio: 0.15 },
  ahorro: { descuento: 0.45, entrega: 0.1, cumplimiento: 0.1, calidad: 0.1, envio: 0.25 },
  rapidez: { descuento: 0.1, entrega: 0.4, cumplimiento: 0.3, calidad: 0.1, envio: 0.1 },
  calidad: { descuento: 0.1, entrega: 0.15, cumplimiento: 0.25, calidad: 0.4, envio: 0.1 },
};

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
  readonly minOrdenes: number;
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
  readonly minOrdenes?: number;
  /** Deja solo proveedores que registraron al menos un envio gratuito. */
  readonly soloEnvioGratis?: boolean;
}

const redondea = (n: number, d = 1): number => Number(n.toFixed(d));

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

export class ReporteService {
  private readonly read = new CompraReadRepository();

  public async gastoPorProveedor(
    desde?: string,
    hasta?: string,
  ): Promise<ReporteGastoProveedor> {
    const { d, h } = normRango(desde, hasta);
    const filas = await this.read.gastoPorProveedor(d, h);
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

  public async ocPendientesRecibir(): Promise<ReporteOcPendientes> {
    const filas = await this.read.ocPendientesRecibir();
    return {
      totalOrdenes: filas.length,
      totalVencidas: filas.filter((r) => r.diasVencida > 0).length,
      montoTotal: Number(filas.reduce((a, r) => a + r.monto, 0).toFixed(2)),
      ordenes: filas,
      generadoEn: new Date().toISOString(),
    };
  }

  public async desempenoProveedores(
    desde?: string,
    hasta?: string,
  ): Promise<ReporteDesempenoProveedores> {
    const { d, h } = normRango(desde, hasta);
    const filas = await this.read.desempenoProveedores(d, h);
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

  /** Riesgo por proveedor: todo el historico (ver `riesgoProveedoresInsumos`). */
  public async riesgoProveedores(): Promise<ReporteRiesgoProveedores> {
    const filas = await this.read.riesgoProveedoresInsumos();
    const conDias = filas.filter((f) => f.diasPromedioEntrega !== null);
    const promedioGeneral =
      conDias.length > 0
        ? Number(
            (conDias.reduce((a, f) => a + (f.diasPromedioEntrega ?? 0), 0) / conDias.length).toFixed(1),
          )
        : null;

    const proveedores = filas
      .map((f) => {
        const score = calcularScore(f, promedioGeneral);
        return { ...f, score, nivel: nivelDe(score) };
      })
      .sort((a, b) => a.score - b.score); // mas riesgoso primero

    return { diasPromedioGeneral: promedioGeneral, proveedores, generadoEn: new Date().toISOString() };
  }

  /**
   * Evaluacion comparativa de proveedores: descuento, entrega, cumplimiento,
   * calidad y envio, mas un score 0-100 segun la `prioridad`. Pensado para
   * decidir a quien comprarle: quien da mas descuento, entrega mas rapido,
   * cumple la fecha prometida, rechaza menos o cobra menos flete.
   */
  public async evaluacionProveedores(
    input: EvaluacionProveedoresInput = {},
  ): Promise<ReporteEvaluacionProveedores> {
    const { d, h } = normRango(input.desde, input.hasta);
    const prioridad = input.prioridad ?? "equilibrado";
    if (!PRIORIDADES_EVALUACION.includes(prioridad)) {
      throw new ValidationError(`Prioridad inválida: use ${PRIORIDADES_EVALUACION.join(", ")}`);
    }
    const minOrdenes = Math.max(1, Math.trunc(input.minOrdenes ?? 1));
    const filas = await this.read.evaluacionProveedores({
      ...(d !== undefined ? { desde: d } : {}),
      ...(h !== undefined ? { hasta: h } : {}),
      ...(input.idCategoria !== undefined ? { idCategoria: input.idCategoria } : {}),
    });

    const base = filas
      .filter((f) => input.soloEnvioGratis !== true || f.ordenesEnvioGratis > 0)
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

    // La escala se arma solo con los elegibles: un proveedor de 1 sola OC no la distorsiona.
    const comp = base.filter((b) => b.elegible);
    const nDesc = normalizador(comp.map((p) => p.descuentoPct), true);
    const nEnt = normalizador(comp.map((p) => p.diasEntrega), false);
    const nCum = normalizador(comp.map((p) => p.porcentajeATiempo), true);
    const nCal = normalizador(comp.map((p) => p.porcentajeRechazo), false);
    const nEnv = normalizador(comp.map((p) => p.costoEnvioPromedio), false);
    const w = PESOS[prioridad];

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
      minOrdenes,
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

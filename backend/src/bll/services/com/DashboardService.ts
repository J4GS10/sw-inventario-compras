/**
 * Capa 3 - Logica de Negocio / compras (analitica del dashboard).
 *
 * Caso de uso: el dashboard necesita tres series/indicadores agregados que no
 * salen de un simple `count`:
 *  - `comprasPorMes`       : monto (GTQ) de OC emitidas por mes, 12 meses.
 *  - `rotacion`            : razon entradas por compra / existencia valorizada,
 *                            como serie mensual y como indice de los 12 meses.
 *  - `ahorroAdjudicacion`  : indice 0-100 del ahorro obtenido al adjudicar la
 *                            cotizacion mas conveniente frente a la mas cara.
 *
 * Solo lectura: no hereda de TransactionalService. Compone `CompraReadRepository`
 * y rellena el rejilla de meses (los meses sin datos entran en cero) para que el
 * frontend dibuje una serie continua sin logica de huecos.
 */

import { CompraReadRepository } from "../../../dal/repositories/com/CompraReadRepository.js";

export interface PuntoCompraMes {
  readonly periodo: string; // "YYYY-MM"
  readonly label: string; // "sep 26"
  readonly monto: number;
  readonly ordenes: number;
}

export interface PuntoRotacionMes {
  readonly periodo: string;
  readonly label: string;
  readonly valorEntradas: number;
  /** valorEntradas / existenciaValorizada (0 si no hay existencia). */
  readonly rotacion: number;
}

export interface RotacionResumen {
  readonly porMes: readonly PuntoRotacionMes[];
  readonly existenciaValorizada: number;
  readonly valorEntradas12m: number;
  /** valorEntradas12m / existenciaValorizada (0 si no hay existencia). */
  readonly rotacion12m: number;
}

export interface AhorroAdjudicacionResumen {
  readonly lineasAdjudicadas: number;
  readonly lineasConAlternativa: number;
  /** Promedio simple del ahorro % por linea (0-100). */
  readonly ahorroPromedioPct: number;
  /** Ahorro % ponderado por monto (0-100). */
  readonly ahorroPonderadoPct: number;
  readonly montoAdjudicado: number;
  /** montoSiMasCaro - montoAdjudicado. */
  readonly montoEvitado: number;
}

/**
 * Proyeccion simple del gasto del proximo mes por regresion lineal sobre los
 * ultimos meses con datos (no un modelo de ML — una tendencia honesta y
 * explicable). `null` si hay menos de 3 meses con datos: no alcanza para
 * decir nada con sentido.
 */
export interface ProyeccionGastoMensual {
  readonly proximoMes: number;
  readonly rangoMin: number;
  readonly rangoMax: number;
  readonly tendencia: "alza" | "baja" | "estable";
  /** Cambio promedio en GTQ por mes (pendiente de la regresion). */
  readonly pendienteMensual: number;
}

export interface DashboardResumen {
  readonly meses: number;
  readonly comprasPorMes: readonly PuntoCompraMes[];
  readonly rotacion: RotacionResumen;
  readonly ahorroAdjudicacion: AhorroAdjudicacionResumen;
  readonly proyeccionGasto: ProyeccionGastoMensual | null;
  readonly generadoEn: string;
}

/** Pendiente, intercepto y desviacion de los residuales de y = pendiente*x + intercepto. */
function regresionLineal(
  valores: readonly number[],
): { pendiente: number; intercepto: number; desviacion: number } {
  const n = valores.length;
  const sumX = valores.reduce((a, _v, i) => a + i, 0);
  const sumY = valores.reduce((a, v) => a + v, 0);
  const sumXY = valores.reduce((a, v, i) => a + i * v, 0);
  const sumX2 = valores.reduce((a, _v, i) => a + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  const pendiente = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercepto = (sumY - pendiente * sumX) / n;
  const residuales = valores.map((v, i) => v - (pendiente * i + intercepto));
  const desviacion = Math.sqrt(residuales.reduce((a, r) => a + r * r, 0) / n);
  return { pendiente, intercepto, desviacion };
}

/**
 * Proyecta el gasto del proximo mes con regresion lineal sobre los ultimos 6
 * meses (o menos, si no hay 6). Con menos de 3 puntos no se proyecta: no hay
 * base para distinguir una tendencia real de ruido.
 */
function proyectarGasto(comprasPorMes: readonly PuntoCompraMes[]): ProyeccionGastoMensual | null {
  const ventana = comprasPorMes.slice(-6);
  const valores = ventana.map((p) => p.monto);
  if (valores.length < 3) return null;

  const { pendiente, intercepto, desviacion } = regresionLineal(valores);
  const proyectado = Math.max(0, pendiente * valores.length + intercepto);
  const promedio = valores.reduce((a, v) => a + v, 0) / valores.length;
  const umbral = promedio * 0.05; // +/-5% del promedio reciente se considera "estable"
  const tendencia: ProyeccionGastoMensual["tendencia"] =
    pendiente > umbral ? "alza" : pendiente < -umbral ? "baja" : "estable";

  return {
    proximoMes: Number(proyectado.toFixed(2)),
    rangoMin: Number(Math.max(0, proyectado - desviacion).toFixed(2)),
    rangoMax: Number((proyectado + desviacion).toFixed(2)),
    tendencia,
    pendienteMensual: Number(pendiente.toFixed(2)),
  };
}

const MES_LABEL = new Intl.DateTimeFormat("es-GT", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC", // la rejilla usa fechas a medianoche UTC; formatear en local las corre un mes
});

/** ["YYYY-MM", ...] de los ultimos `meses` meses, terminando en el mes actual. */
function rejillaMeses(meses: number): { periodo: string; label: string }[] {
  const hoy = new Date();
  const base = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const out: { periodo: string; label: string }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const periodo = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ periodo, label: MES_LABEL.format(d).replace(".", "") });
  }
  return out;
}

function clampMeses(meses: number | undefined): number {
  const n = Math.trunc(meses ?? 12);
  if (!Number.isFinite(n) || n < 1) return 12;
  return Math.min(24, n);
}

export class DashboardService {
  private readonly read = new CompraReadRepository();

  public async resumen(meses?: number): Promise<DashboardResumen> {
    const ventana = clampMeses(meses);
    const grid = rejillaMeses(ventana);

    const [compras, entradas, existencia, ahorro] = await Promise.all([
      this.read.comprasPorMesOc(ventana),
      this.read.valorEntradasPorMes(ventana),
      this.read.existenciaValorizada(),
      this.read.ahorroAdjudicacion(),
    ]);

    const comprasPorPeriodo = new Map(compras.map((r) => [r.periodo, r]));
    const entradasPorPeriodo = new Map(entradas.map((r) => [r.periodo, r.valor]));

    const comprasPorMes: PuntoCompraMes[] = grid.map((g) => {
      const row = comprasPorPeriodo.get(g.periodo);
      return {
        periodo: g.periodo,
        label: g.label,
        monto: row?.monto ?? 0,
        ordenes: row?.ordenes ?? 0,
      };
    });

    const razon = (valor: number): number =>
      existencia > 0 ? Number((valor / existencia).toFixed(4)) : 0;

    const porMes: PuntoRotacionMes[] = grid.map((g) => {
      const valor = entradasPorPeriodo.get(g.periodo) ?? 0;
      return { periodo: g.periodo, label: g.label, valorEntradas: valor, rotacion: razon(valor) };
    });

    const valorEntradas12m = Number(
      entradas.reduce((a, r) => a + r.valor, 0).toFixed(2),
    );

    const ponderado =
      ahorro.montoSiMasCaro > 0
        ? Number(
            (
              ((ahorro.montoSiMasCaro - ahorro.montoAdjudicado) /
                ahorro.montoSiMasCaro) *
              100
            ).toFixed(2),
          )
        : 0;

    return {
      meses: ventana,
      comprasPorMes,
      proyeccionGasto: proyectarGasto(comprasPorMes),
      rotacion: {
        porMes,
        existenciaValorizada: existencia,
        valorEntradas12m,
        rotacion12m: razon(valorEntradas12m),
      },
      ahorroAdjudicacion: {
        lineasAdjudicadas: ahorro.lineasAdjudicadas,
        lineasConAlternativa: ahorro.lineasConAlternativa,
        ahorroPromedioPct: ahorro.ahorroPromedioPct ?? 0,
        ahorroPonderadoPct: ponderado,
        montoAdjudicado: ahorro.montoAdjudicado,
        montoEvitado: Number(
          (ahorro.montoSiMasCaro - ahorro.montoAdjudicado).toFixed(2),
        ),
      },
      generadoEn: new Date().toISOString(),
    };
  }
}

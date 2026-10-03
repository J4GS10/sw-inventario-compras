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

function normFecha(v: string | undefined): string | undefined {
  return v === undefined || v === "" ? undefined : v;
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

export class ReporteService {
  private readonly read = new CompraReadRepository();

  public async gastoPorProveedor(
    desde?: string,
    hasta?: string,
  ): Promise<ReporteGastoProveedor> {
    const d = normFecha(desde);
    const h = normFecha(hasta);
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
    const d = normFecha(desde);
    const h = normFecha(hasta);
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
}

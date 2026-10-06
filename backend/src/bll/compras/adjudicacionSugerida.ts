/**
 * Capa 3 - Logica de Negocio / compras.
 * Adjudicacion SUGERIDA por renglon: ademas del precio pondera la confiabilidad historica del
 * proveedor (plazo real de entrega, rechazo y calificacion — el mismo score del reporte de riesgo)
 * y el credito que concede. Funcion pura y explicable: devuelve el desglose de cada oferta para que
 * quien adjudica vea POR QUE se sugiere, y siempre puede elegir otra.
 *
 *   puntaje = 100 * ( 0.60 * precio + 0.25 * confiabilidad + 0.15 * credito )
 *     precio         = menor precio neto del renglon / precio neto de la oferta        (1 = la mas barata)
 *     confiabilidad  = score del proveedor (0-100) / 100; sin historial = 0.70 (neutral)
 *     credito        = dias de credito / mayor credito ofrecido en el renglon           (0 si nadie da credito)
 *
 * Una oferta mucho mas cara no la rescata un buen historial: el precio pesa 60 % y se exige que la
 * sugerida no cueste mas de `MAX_SOBRE_PRECIO` (15 %) sobre la mas barata.
 */

export const PESOS = { precio: 0.6, confiabilidad: 0.25, credito: 0.15 } as const;
export const CONFIABILIDAD_NEUTRA = 70;
export const MAX_SOBRE_PRECIO = 0.15;

export interface OfertaParaPuntuar {
  readonly idCotizacionDetalle: number;
  readonly idProveedor: number;
  readonly proveedor: string;
  readonly precioNetoMoneda: number;
  readonly condicionPagoDias: number;
}

export interface OfertaPuntuada extends OfertaParaPuntuar {
  readonly puntaje: number;
  readonly precio: number;
  readonly confiabilidad: number | null;
  readonly sobreMasBarata: number;
  readonly elegible: boolean;
}

export interface SugerenciaRenglon {
  readonly sugerida: OfertaPuntuada | null;
  readonly ofertas: readonly OfertaPuntuada[];
  /** Frase corta para mostrar al decidir. */
  readonly motivo: string;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function puntuarRenglon(
  ofertas: readonly OfertaParaPuntuar[],
  confiabilidadDe: (idProveedor: number) => number | null,
): SugerenciaRenglon {
  if (ofertas.length === 0) return { sugerida: null, ofertas: [], motivo: "Sin ofertas" };
  const minPrecio = Math.min(...ofertas.map((o) => o.precioNetoMoneda));
  const maxCredito = Math.max(0, ...ofertas.map((o) => o.condicionPagoDias));

  const puntuadas: OfertaPuntuada[] = ofertas.map((o) => {
    const precio = o.precioNetoMoneda > 0 ? minPrecio / o.precioNetoMoneda : 1;
    const conf = confiabilidadDe(o.idProveedor);
    const confN = (conf ?? CONFIABILIDAD_NEUTRA) / 100;
    const credito = maxCredito > 0 ? o.condicionPagoDias / maxCredito : 0;
    const sobre = minPrecio > 0 ? o.precioNetoMoneda / minPrecio - 1 : 0;
    return {
      ...o,
      puntaje: r2(100 * (PESOS.precio * precio + PESOS.confiabilidad * confN + PESOS.credito * credito)),
      precio: r2(precio),
      confiabilidad: conf,
      sobreMasBarata: r2(sobre),
      elegible: sobre <= MAX_SOBRE_PRECIO + 1e-9,
    };
  });

  const elegibles = puntuadas.filter((o) => o.elegible);
  const sugerida =
    [...(elegibles.length > 0 ? elegibles : puntuadas)].sort(
      (a, b) => b.puntaje - a.puntaje || a.precioNetoMoneda - b.precioNetoMoneda,
    )[0] ?? null;

  let motivo = "Única oferta";
  if (sugerida !== null && ofertas.length > 1) {
    const masBarata = puntuadas.reduce((a, b) => (b.precioNetoMoneda < a.precioNetoMoneda ? b : a));
    if (masBarata.idCotizacionDetalle === sugerida.idCotizacionDetalle) {
      motivo = "Mejor precio y mejor equilibrio con confiabilidad y crédito";
    } else {
      motivo = `Cuesta ${r2(sugerida.sobreMasBarata * 100)} % más que la más barata, pero la compensa con su historial y/o crédito`;
    }
  }
  return { sugerida, ofertas: puntuadas, motivo };
}

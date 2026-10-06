/**
 * Capa 3 - Logica de Negocio / compras.
 * Reglas de coherencia de los documentos del ciclo de compra. Funciones PURAS
 * (sin base de datos): reciben los datos ya leidos y devuelven/lanzan el
 * resultado, de modo que cada regla se prueba con una linea.
 *
 * Cadena cronologica que se protege:
 *
 *   Solicitud --> RFQ --> Cotizacion --> Orden de compra --> Recepcion --> Devolucion
 *
 * Ningun documento puede quedar con una fecha anterior a la de aquel del que
 * nace, ni una fecha "limite/vencimiento/entrega" que ya paso al momento de
 * registrarlo. Las fechas de EMISION/RECEPCION/DEVOLUCION las pone la base de
 * datos con el reloj del servidor, asi que son monotonas por construccion; las
 * que escribe el usuario se validan aqui.
 */

import { hoy, sumarDias } from "../../common/util/fechas.js";
import { Validacion } from "../../common/validation/reglas.js";

/** Horizonte maximo razonable hacia adelante para una fecha tecleada (evita 2206 por 2026). */
export const HORIZONTE_DIAS = 366 * 3;

/** Prioridad de solicitud: 1 (urgente) a 5 (baja). */
export const PRIORIDAD_MIN = 1;
export const PRIORIDAD_MAX = 5;

/** Longitudes maximas (espejo del DDL, ya aplicadas por descriptor; aqui para mensajes de linea). */
export const MAX_DESCRIPCION_LINEA = 255;
export const MAX_JUSTIFICACION = 500;
export const MIN_JUSTIFICACION = 5;

/** Maximo de lineas por documento: freno a payloads abusivos que bloquean la transaccion. */
export const MAX_LINEAS = 200;

/** Limite superior de una fecha futura tecleada (hoy + HORIZONTE_DIAS). */
export function limiteFuturo(ahora?: Date): string {
  return sumarDias(hoy(ahora), HORIZONTE_DIAS);
}

// ---------------------------------------------------------------------------
// Solicitud
// ---------------------------------------------------------------------------

export interface LineaSolicitudDatos {
  readonly descripcion?: unknown;
  readonly cantidadSolicitada?: unknown;
  readonly fechaRequerida?: unknown;
}

export interface CabeceraSolicitudDatos {
  readonly justificacion?: unknown;
  readonly prioridad?: unknown;
  readonly montoEstimado?: unknown;
}

/** Valida los campos de negocio de la cabecera de una solicitud. `parcial`: edicion (solo lo enviado). */
export function validarCabeceraSolicitud(
  v: Validacion,
  c: CabeceraSolicitudDatos,
  parcial = false,
): void {
  if (!parcial || c.justificacion !== undefined) {
    v.texto("justificacion", "La justificación", c.justificacion, {
      min: MIN_JUSTIFICACION,
      max: MAX_JUSTIFICACION,
    });
  }
  if (!parcial || c.prioridad !== undefined) {
    const p = v.numero("prioridad", "La prioridad", c.prioridad);
    if (p !== null && (!Number.isInteger(p) || p < PRIORIDAD_MIN || p > PRIORIDAD_MAX)) {
      v.error("prioridad", `La prioridad debe ser un entero entre ${PRIORIDAD_MIN} y ${PRIORIDAD_MAX}`);
    }
  }
  if (c.montoEstimado !== undefined && c.montoEstimado !== null && c.montoEstimado !== "") {
    v.noNegativo("montoEstimado", "El monto estimado", c.montoEstimado);
  }
}

/** Valida las lineas de una solicitud: cantidad > 0, descripcion y fecha requerida no vencida. */
export function validarLineasSolicitud(
  v: Validacion,
  lineas: readonly LineaSolicitudDatos[],
  ahora?: Date,
): void {
  if (lineas.length === 0) {
    v.error("detalles", "La solicitud debe incluir al menos una línea");
    return;
  }
  if (lineas.length > MAX_LINEAS) {
    v.error("detalles", `La solicitud admite máximo ${MAX_LINEAS} líneas`);
    return;
  }
  const minimo = hoy(ahora);
  const maximo = limiteFuturo(ahora);
  lineas.forEach((l, i) => {
    const n = i + 1;
    v.texto(`detalles[${i}].descripcion`, `Línea ${n}: la descripción`, l.descripcion, {
      max: MAX_DESCRIPCION_LINEA,
    });
    v.positivo(`detalles[${i}].cantidadSolicitada`, `Línea ${n}: la cantidad`, l.cantidadSolicitada);
    const dia = v.dia(`detalles[${i}].fechaRequerida`, `Línea ${n}: la fecha requerida`, l.fechaRequerida);
    v.noAnteriorA(`detalles[${i}].fechaRequerida`, `Línea ${n}: la fecha requerida`, dia, minimo, "hoy");
    v.noPosteriorA(`detalles[${i}].fechaRequerida`, `Línea ${n}: la fecha requerida`, dia, maximo, "el horizonte máximo de 3 años");
  });
}

// ---------------------------------------------------------------------------
// RFQ
// ---------------------------------------------------------------------------

/**
 * Fecha limite de un RFQ: no vencida y no posterior a la ULTIMA fecha en que la
 * solicitud necesita la mercaderia (cotizar despues de cuando se necesita no
 * tiene sentido). `ultimaFechaRequerida` es null si la solicitud no tiene lineas.
 */
export function validarFechaLimiteRfq(
  v: Validacion,
  valor: unknown,
  ultimaFechaRequerida: string | null,
  ahora?: Date,
): string | null {
  const dia = v.dia("fechaLimite", "La fecha límite", valor);
  v.noAnteriorA("fechaLimite", "La fecha límite", dia, hoy(ahora), "hoy");
  v.noPosteriorA("fechaLimite", "La fecha límite", dia, limiteFuturo(ahora), "el horizonte máximo de 3 años");
  v.noPosteriorA(
    "fechaLimite",
    "La fecha límite del RFQ",
    dia,
    ultimaFechaRequerida,
    "la última fecha en que la solicitud necesita la mercadería",
  );
  return dia;
}

// ---------------------------------------------------------------------------
// Cotizacion
// ---------------------------------------------------------------------------

export interface LineaCotizacionDatos {
  readonly idSolicitudDetalle?: unknown;
  readonly precioUnitario?: unknown;
  readonly cantidad?: unknown;
  readonly porcentajeDescuento?: unknown;
  readonly porcentajeImpuesto?: unknown;
}

/** El RFQ admite cotizaciones hasta el final de su fecha limite (inclusive). */
export function rfqAceptaCotizaciones(fechaLimiteRfq: string | null, ahora?: Date): boolean {
  if (fechaLimiteRfq === null) return true;
  return hoy(ahora) <= fechaLimiteRfq;
}

/** Vencimiento de la oferta: no vencida al registrarla y dentro del horizonte. */
export function validarVencimientoCotizacion(v: Validacion, valor: unknown, ahora?: Date): string | null {
  const dia = v.dia("fechaVencimiento", "La fecha de vencimiento de la oferta", valor);
  v.noAnteriorA("fechaVencimiento", "La fecha de vencimiento de la oferta", dia, hoy(ahora), "hoy");
  v.noPosteriorA("fechaVencimiento", "La fecha de vencimiento de la oferta", dia, limiteFuturo(ahora), "el horizonte máximo de 3 años");
  return dia;
}

/** Tasa de cambio positiva (cotizacion/OC multi-moneda). */
export function validarTasaCambio(v: Validacion, valor: unknown): number | null {
  return v.positivo("tasaCambio", "La tasa de cambio", valor);
}

export function validarLineasCotizacion(
  v: Validacion,
  lineas: readonly LineaCotizacionDatos[],
  renglonesValidos: ReadonlySet<number> | null,
): void {
  if (lineas.length === 0) {
    v.error("lineas", "La cotización debe incluir al menos una línea");
    return;
  }
  if (lineas.length > MAX_LINEAS) {
    v.error("lineas", `La cotización admite máximo ${MAX_LINEAS} líneas`);
    return;
  }
  const vistos = new Set<number>();
  lineas.forEach((l, i) => {
    const n = i + 1;
    const renglon = v.id(`lineas[${i}].idSolicitudDetalle`, `Línea ${n}: el renglón de la solicitud`, l.idSolicitudDetalle);
    if (renglon !== null) {
      if (renglonesValidos !== null && !renglonesValidos.has(renglon)) {
        v.error(`lineas[${i}].idSolicitudDetalle`, `Línea ${n}: el renglón ${renglon} no pertenece a la solicitud de este RFQ`);
      } else if (vistos.has(renglon)) {
        v.error(`lineas[${i}].idSolicitudDetalle`, `Línea ${n}: el renglón ${renglon} está repetido; una cotización trae un precio por renglón`);
      }
      vistos.add(renglon);
    }
    v.positivo(`lineas[${i}].precioUnitario`, `Línea ${n}: el precio unitario`, l.precioUnitario);
    v.positivo(`lineas[${i}].cantidad`, `Línea ${n}: la cantidad`, l.cantidad);
    v.porcentaje(`lineas[${i}].porcentajeDescuento`, `Línea ${n}: el descuento`, l.porcentajeDescuento);
    v.porcentaje(`lineas[${i}].porcentajeImpuesto`, `Línea ${n}: el impuesto`, l.porcentajeImpuesto);
  });
}

// ---------------------------------------------------------------------------
// Orden de compra
// ---------------------------------------------------------------------------

export interface LineaOrdenDatos {
  readonly cantidad?: unknown;
  readonly precioUnitario?: unknown;
  readonly porcentajeDescuento?: unknown;
  readonly porcentajeImpuesto?: unknown;
  readonly toleranciaPorcentaje?: unknown;
  readonly idCotizacionDetalle?: unknown;
}

/**
 * Fecha de entrega esperada de una OC: hoy o posterior, no anterior al dia de
 * emision de la propia OC (en una edicion) ni al de la solicitud de origen, y
 * dentro del horizonte.
 */
export function validarEntregaOrden(
  v: Validacion,
  valor: unknown,
  opts: { emision?: string | null; solicitud?: string | null },
  ahora?: Date,
): string | null {
  const dia = v.dia("fechaEntregaEsperada", "La fecha de entrega esperada", valor);
  v.noAnteriorA("fechaEntregaEsperada", "La fecha de entrega esperada", dia, hoy(ahora), "hoy");
  v.noAnteriorA(
    "fechaEntregaEsperada",
    "La fecha de entrega esperada",
    dia,
    opts.emision ?? null,
    "la fecha de emisión de la orden",
  );
  v.noAnteriorA(
    "fechaEntregaEsperada",
    "La fecha de entrega esperada",
    dia,
    opts.solicitud ?? null,
    "la fecha de la solicitud de origen",
  );
  v.noPosteriorA("fechaEntregaEsperada", "La fecha de entrega esperada", dia, limiteFuturo(ahora), "el horizonte máximo de 3 años");
  return dia;
}

export function validarLineasOrden(v: Validacion, lineas: readonly LineaOrdenDatos[]): void {
  if (lineas.length === 0) {
    v.error("lineas", "La orden debe incluir al menos una línea");
    return;
  }
  if (lineas.length > MAX_LINEAS) {
    v.error("lineas", `La orden admite máximo ${MAX_LINEAS} líneas`);
    return;
  }
  const vistos = new Set<number>();
  lineas.forEach((l, i) => {
    const n = i + 1;
    v.positivo(`lineas[${i}].cantidad`, `Línea ${n}: la cantidad`, l.cantidad);
    if (l.precioUnitario !== undefined) v.noNegativo(`lineas[${i}].precioUnitario`, `Línea ${n}: el precio unitario`, l.precioUnitario);
    if (l.porcentajeDescuento !== undefined) v.porcentaje(`lineas[${i}].porcentajeDescuento`, `Línea ${n}: el descuento`, l.porcentajeDescuento);
    if (l.porcentajeImpuesto !== undefined) v.porcentaje(`lineas[${i}].porcentajeImpuesto`, `Línea ${n}: el impuesto`, l.porcentajeImpuesto);
    if (l.toleranciaPorcentaje !== undefined) v.porcentaje(`lineas[${i}].toleranciaPorcentaje`, `Línea ${n}: la tolerancia`, l.toleranciaPorcentaje);
    if (l.idCotizacionDetalle !== undefined && l.idCotizacionDetalle !== null) {
      const id = Number(l.idCotizacionDetalle);
      if (vistos.has(id)) {
        v.error(`lineas[${i}].idCotizacionDetalle`, `Línea ${n}: la oferta ${id} ya está en otra línea de esta orden`);
      }
      vistos.add(id);
    }
  });
}

/** Una oferta vencida ya no obliga al proveedor: no se emite una orden contra ella. */
export function ofertaVigente(vencimiento: string | null, ahora?: Date): boolean {
  if (vencimiento === null) return true;
  return vencimiento >= hoy(ahora);
}

// ---------------------------------------------------------------------------
// Recepcion y devolucion
// ---------------------------------------------------------------------------

/** Cantidad pendiente de una linea de OC tras lo ya procesado (nunca negativa). */
export function pendienteDeLinea(ordenado: number, procesadoPrevio: number): number {
  return Math.max(0, Math.round((ordenado - procesadoPrevio) * 1e6) / 1e6);
}

/** Cantidad aun devolvible de una linea de recepcion. */
export function devolvibleDeLinea(recibida: number, devueltaPrevia: number): number {
  return Math.max(0, Math.round((recibida - devueltaPrevia) * 1e6) / 1e6);
}

// ---------------------------------------------------------------------------
// Rangos de fechas de consulta (reportes, historiales)
// ---------------------------------------------------------------------------

/**
 * Normaliza un filtro `desde`/`hasta`: dias reales de calendario y `desde <= hasta`.
 * Devuelve `YYYY-MM-DD` (o undefined si vino vacio). Lanza ValidationError (422)
 * con el campo culpable; antes un texto cualquiera llegaba a Oracle y salia
 * como ORA-01861 / 500.
 */
export function validarRangoFechas(
  desde: string | undefined,
  hasta: string | undefined,
): { desde?: string; hasta?: string } {
  const v = new Validacion();
  const d = desde === undefined || desde === "" ? null : v.dia("desde", "La fecha 'desde'", desde);
  const h = hasta === undefined || hasta === "" ? null : v.dia("hasta", "La fecha 'hasta'", hasta);
  v.noAnteriorA("hasta", "La fecha 'hasta'", h, d, "la fecha 'desde'");
  v.lanzarSiHay("Rango de fechas inválido");
  return { ...(d !== null ? { desde: d } : {}), ...(h !== null ? { hasta: h } : {}) };
}

/**
 * Capa 6 - Componentes Comunes.
 * Reglas de validacion reutilizables, de un solo campo o de dos campos
 * relacionados. Cada regla ACUMULA su error en `details` (en vez de lanzar) para
 * que una peticion reporte TODOS sus problemas de una sola vez; el llamador
 * invoca `lanzarSiHay()` al final.
 *
 * Sin dependencia del negocio: solo conoce numeros, textos y fechas.
 */

import { ValidationError, type ErrorDetail } from "../errors/AppError.js";
import { aDia, formatoDia } from "../util/fechas.js";

/** Colector de errores de validacion. */
export class Validacion {
  private readonly details: ErrorDetail[] = [];

  /** Registra un error de campo. */
  public error(field: string, message: string): void {
    this.details.push({ field, message });
  }

  public get hayErrores(): boolean {
    return this.details.length > 0;
  }

  /** Lanza ValidationError (422) con todos los errores acumulados, si los hay. */
  public lanzarSiHay(mensaje: string): void {
    if (this.details.length === 0) return;
    const resumen = this.details
      .slice(0, 3)
      .map((d) => d.message)
      .join(" · ");
    const extra = this.details.length > 3 ? ` (+${this.details.length - 3} más)` : "";
    throw new ValidationError(`${mensaje}: ${resumen}${extra}`, this.details);
  }

  // ---- numeros -----------------------------------------------------------

  /** Numero finito (no NaN/Infinity). Devuelve el valor o `null` si es invalido. */
  public numero(field: string, etiqueta: string, v: unknown): number | null {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") {
      this.error(field, `${etiqueta} es obligatorio`);
      return null;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      this.error(field, `${etiqueta} debe ser un número válido`);
      return null;
    }
    return n;
  }

  /** Numero estrictamente mayor que 0. */
  public positivo(field: string, etiqueta: string, v: unknown): number | null {
    const n = this.numero(field, etiqueta, v);
    if (n !== null && !(n > 0)) {
      this.error(field, `${etiqueta} debe ser mayor que 0`);
      return null;
    }
    return n;
  }

  /** Numero mayor o igual a 0. */
  public noNegativo(field: string, etiqueta: string, v: unknown): number | null {
    const n = this.numero(field, etiqueta, v);
    if (n !== null && n < 0) {
      this.error(field, `${etiqueta} no puede ser negativo`);
      return null;
    }
    return n;
  }

  /** Porcentaje en [0, 100]. */
  public porcentaje(field: string, etiqueta: string, v: unknown): number | null {
    const n = this.numero(field, etiqueta, v);
    if (n !== null && (n < 0 || n > 100)) {
      this.error(field, `${etiqueta} debe estar entre 0 y 100`);
      return null;
    }
    return n;
  }

  /** Entero positivo (identificadores). */
  public id(field: string, etiqueta: string, v: unknown): number | null {
    const n = this.numero(field, etiqueta, v);
    if (n !== null && (!Number.isInteger(n) || n <= 0)) {
      this.error(field, `${etiqueta} es inválido`);
      return null;
    }
    return n;
  }

  // ---- texto -------------------------------------------------------------

  /** Texto obligatorio, sin espacios sobrantes, con longitud maxima. */
  public texto(
    field: string,
    etiqueta: string,
    v: unknown,
    opts: { max: number; min?: number },
  ): string | null {
    if (typeof v !== "string" || v.trim() === "") {
      this.error(field, `${etiqueta} es obligatorio`);
      return null;
    }
    const t = v.trim();
    if (opts.min !== undefined && t.length < opts.min) {
      this.error(field, `${etiqueta} debe tener al menos ${opts.min} caracteres`);
      return null;
    }
    if (t.length > opts.max) {
      this.error(field, `${etiqueta} no puede superar ${opts.max} caracteres (tiene ${t.length})`);
      return null;
    }
    return t;
  }

  // ---- fechas ------------------------------------------------------------

  /** Dia de calendario valido. Devuelve `YYYY-MM-DD` o `null`. */
  public dia(field: string, etiqueta: string, v: unknown): string | null {
    if (v === null || v === undefined || v === "") {
      this.error(field, `${etiqueta} es obligatoria`);
      return null;
    }
    const d = aDia(v);
    if (d === null) {
      this.error(field, `${etiqueta} no es una fecha válida`);
      return null;
    }
    return d;
  }

  /** `dia` no puede ser anterior a `minimo` (inclusive). `contexto` explica el limite. */
  public noAnteriorA(
    field: string,
    etiqueta: string,
    dia: string | null,
    minimo: string | null,
    contexto: string,
  ): void {
    if (dia === null || minimo === null) return;
    if (dia < minimo) {
      this.error(field, `${etiqueta} (${formatoDia(dia)}) no puede ser anterior a ${contexto} (${formatoDia(minimo)})`);
    }
  }

  /** `dia` no puede ser posterior a `maximo` (inclusive). */
  public noPosteriorA(
    field: string,
    etiqueta: string,
    dia: string | null,
    maximo: string | null,
    contexto: string,
  ): void {
    if (dia === null || maximo === null) return;
    if (dia > maximo) {
      this.error(field, `${etiqueta} (${formatoDia(dia)}) no puede ser posterior a ${contexto} (${formatoDia(maximo)})`);
    }
  }
}

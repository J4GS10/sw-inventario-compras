/**
 * Capa 6 - Componentes Comunes.
 * Validacion generica de un cuerpo plano contra un EntityDescriptor. Cubre el
 * 80% rote (tipos, obligatoriedad, enum, S/N) sin escribir una clase DTO por
 * tabla. Para reglas ricas se usa ademas una clase class-validator (ver
 * validators.ts + el generador scripts/gen-entities.ts).
 */

import { ValidationError, type ErrorDetail } from "../errors/AppError.js";
import { acentuar } from "../util/acentos.js";
import {
  isSystemColumn,
  type ColumnDescriptor,
  type EntityDescriptor,
} from "../../entities/support/EntityDescriptor.js";

export type Mode = "create" | "update";

/** "fechaRequerida" -> "fecha requerida" (para mensajes al usuario). */
export function etiquetaDe(prop: string): string {
  return acentuar(prop.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase());
}

/** Valida longitud, rango y precision de un numero contra los limites del DDL. */
function checkNumero(col: ColumnDescriptor, n: number, details: ErrorDetail[]): void {
  const et = etiquetaDe(col.prop);
  if (!Number.isFinite(n)) {
    details.push({ field: col.prop, message: `${et} debe ser un número finito` });
    return;
  }
  if (col.min !== undefined) {
    if (col.minExclusive === true ? n <= col.min : n < col.min) {
      details.push({
        field: col.prop,
        message:
          col.minExclusive === true
            ? `${et} debe ser mayor que ${col.min}`
            : `${et} no puede ser menor que ${col.min}`,
      });
      return;
    }
  }
  if (col.max !== undefined && n > col.max) {
    details.push({ field: col.prop, message: `${et} no puede ser mayor que ${col.max}` });
    return;
  }
  if (col.precision !== undefined) {
    const escala = col.scale ?? 0;
    const tope = 10 ** (col.precision - escala);
    if (Math.abs(n) >= tope) {
      details.push({
        field: col.prop,
        message: `${et} excede el máximo permitido (${tope.toLocaleString("en-US")})`,
      });
      return;
    }
    // Mas decimales de los que la columna guarda: Oracle redondea en silencio.
    const factor = 10 ** escala;
    if (Math.abs(Math.round(n * factor) / factor - n) > 1e-9) {
      details.push({
        field: col.prop,
        message:
          escala === 0
            ? `${et} debe ser un entero`
            : `${et} admite máximo ${escala} decimales`,
      });
    }
  }
}

function checkValue(
  col: ColumnDescriptor,
  value: unknown,
  details: ErrorDetail[],
): void {
  if (value === null) {
    if (!col.nullable) {
      details.push({ field: col.prop, message: "no puede ser nulo" });
    }
    return;
  }
  switch (col.type) {
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        details.push({ field: col.prop, message: "debe ser numérico" });
      } else {
        checkNumero(col, value, details);
      }
      break;
    case "string":
      if (typeof value !== "string") {
        details.push({ field: col.prop, message: "debe ser texto" });
      } else if (!col.nullable && value.trim() === "") {
        // Oracle guarda '' como NULL: en una columna NOT NULL fallaria con ORA-01400.
        details.push({ field: col.prop, message: `${etiquetaDe(col.prop)} no puede estar vacío` });
      } else if (col.maxLength !== undefined && value.length > col.maxLength) {
        details.push({
          field: col.prop,
          message: `${etiquetaDe(col.prop)} no puede superar ${col.maxLength} caracteres (tiene ${value.length})`,
        });
      }
      break;
    case "date":
    case "timestamp":
      if (
        typeof value !== "string" ||
        Number.isNaN(new Date(value).getTime())
      ) {
        details.push({
          field: col.prop,
          message: "debe ser una fecha ISO válida",
        });
      }
      break;
    case "boolLike":
      if (typeof value !== "boolean") {
        details.push({ field: col.prop, message: "debe ser booleano" });
      }
      break;
    case "enum":
      if (
        col.enumValues !== undefined &&
        !col.enumValues.includes(String(value))
      ) {
        details.push({
          field: col.prop,
          message: `debe ser uno de: ${col.enumValues.join(", ")}`,
        });
      }
      break;
    default:
      break;
  }
}

/**
 * Valida `body` y devuelve un objeto plano SOLO con las propiedades escribibles
 * (insertable en create / updatable en update) reconocidas por el descriptor.
 *
 * @param exempt Propiedades que no se exigen aunque sean NOT NULL (p. ej. la FK
 *   de una linea de detalle, que el repositorio cabecera/detalle inyecta luego).
 */
export function validateAgainstDescriptor(
  descriptor: EntityDescriptor,
  body: unknown,
  mode: Mode,
  exempt: readonly string[] = [],
): Record<string, unknown> {
  if (body === null || typeof body !== "object") {
    throw new ValidationError("El cuerpo de la petición debe ser un objeto");
  }
  const input = body as Record<string, unknown>;
  const exemptSet = new Set(exempt);
  const details: ErrorDetail[] = [];
  const clean: Record<string, unknown> = {};

  for (const col of descriptor.columns) {
    if (isSystemColumn(descriptor, col)) continue;
    const writable = mode === "create" ? col.insertable : col.updatable;
    if (!writable) continue;

    const present = col.prop in input;
    const value = input[col.prop];

    if (!present) {
      if (mode === "create" && !col.nullable && !exemptSet.has(col.prop)) {
        details.push({ field: col.prop, message: "es obligatorio" });
      }
      continue;
    }

    checkValue(col, value, details);
    // Sin espacios sobrantes en los extremos (" Acme " y "Acme" son el mismo proveedor).
    clean[col.prop] = col.type === "string" && typeof value === "string" ? value.trim() : value;
  }

  if (details.length > 0) {
    throw new ValidationError(
      "El cuerpo de la petición no es válido",
      details,
    );
  }
  return clean;
}

/**
 * Capa 6 - Componentes Comunes.
 * Validacion generica de un cuerpo plano contra un EntityDescriptor. Cubre el
 * 80% rote (tipos, obligatoriedad, enum, S/N) sin escribir una clase DTO por
 * tabla. Para reglas ricas se usa ademas una clase class-validator (ver
 * validators.ts + el generador scripts/gen-entities.ts).
 */

import { ValidationError, type ErrorDetail } from "../errors/AppError.js";
import type {
  ColumnDescriptor,
  EntityDescriptor,
} from "../../entities/support/EntityDescriptor.js";

export type Mode = "create" | "update";

function isSystemColumn(d: EntityDescriptor, col: ColumnDescriptor): boolean {
  if (col.db === d.pk) return true;
  if (d.version !== undefined && col.db === d.version) return true;
  if (
    col.db === d.softDelete.flag ||
    col.db === d.softDelete.date ||
    col.db === d.softDelete.user
  ) {
    return true;
  }
  const a = d.audit;
  if (
    a !== undefined &&
    (col.db === a.createdAt ||
      col.db === a.createdBy ||
      col.db === a.modifiedAt ||
      col.db === a.modifiedBy)
  ) {
    return true;
  }
  return false;
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
        details.push({ field: col.prop, message: "debe ser numerico" });
      }
      break;
    case "string":
      if (typeof value !== "string") {
        details.push({ field: col.prop, message: "debe ser texto" });
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
          message: "debe ser una fecha ISO valida",
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
    throw new ValidationError("El cuerpo de la peticion debe ser un objeto");
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
    clean[col.prop] = value;
  }

  if (details.length > 0) {
    throw new ValidationError(
      "El cuerpo de la peticion no es valido",
      details,
    );
  }
  return clean;
}

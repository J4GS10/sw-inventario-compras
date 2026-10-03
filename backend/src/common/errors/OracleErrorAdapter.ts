/**
 * Capa 6 - Componentes Comunes.
 * Patron Adapter: traduce errores tecnicos del driver `oracledb` (codigos ORA-*)
 * a las excepciones semanticas de AppError.
 *
 * Se invoca UNICAMENTE desde la DAL (Capa 2). Ninguna capa superior conoce ORA-*.
 */

import {
  AppError,
  ConflictError,
  ForeignKeyError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "./AppError.js";

interface OracleErrorShape {
  errorNum?: number;
  message?: string;
}

function asOracleError(value: unknown): OracleErrorShape | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  const errorNum =
    typeof candidate["errorNum"] === "number"
      ? (candidate["errorNum"] as number)
      : undefined;
  const message =
    typeof candidate["message"] === "string"
      ? (candidate["message"] as string)
      : undefined;
  if (errorNum === undefined && message === undefined) return undefined;
  return { errorNum, message };
}

/**
 * @param error   Error crudo capturado dentro de la DAL.
 * @param context Nombre de la entidad/tabla, para construir mensajes utiles.
 */
export function mapOracleError(error: unknown, context: string): AppError {
  if (error instanceof AppError) return error;

  const ora = asOracleError(error);
  const num = ora?.errorNum;
  const raw = ora?.message ?? (error instanceof Error ? error.message : String(error));

  switch (num) {
    case 1: // ORA-00001: unique constraint violated
      return new ConflictError(
        `Valor duplicado en ${context}: viola una restriccion de unicidad`,
        { cause: error },
      );
    case 2291: // integrity constraint (parent key not found)
      return new ForeignKeyError(
        `Referencia inexistente en ${context}: la entidad relacionada no existe`,
        { cause: error },
      );
    case 2292: // integrity constraint (child record found)
      return new ForeignKeyError(
        `No se puede completar la operacion sobre ${context}: existen registros dependientes`,
        { cause: error },
      );
    case 1400: // cannot insert NULL
    case 1407: // cannot update to NULL
      return new ValidationError(
        `Campo obligatorio ausente en ${context}`,
        [],
        { cause: error },
      );
    case 2290: // check constraint violated
      return new ValidationError(
        `Valor fuera de rango o no permitido en ${context}`,
        [],
        { cause: error },
      );
    case 1403: // no data found
    case 1405: // fetched column value is NULL (occasional in strict fetches)
      return new NotFoundError(context);
    case 12899: // value too large for column
      return new ValidationError(
        `Un valor excede la longitud permitida en ${context}`,
        [],
        { cause: error },
      );
    default:
      return new InternalError(`Error de base de datos en ${context}: ${raw}`, {
        cause: error,
      });
  }
}

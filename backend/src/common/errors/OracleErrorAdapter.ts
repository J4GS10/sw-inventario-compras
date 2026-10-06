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
  ServiceUnavailableError,
  ValidationError,
} from "./AppError.js";

/** ORA-* que significan "no hay conexion/instancia": la operacion es reintentable. */
const ORA_NO_DISPONIBLE = new Set([
  1033, // ORACLE initialization or shutdown in progress
  1034, // ORACLE not available
  1089, // immediate shutdown in progress
  3113, // end-of-file on communication channel
  3114, // not connected to ORACLE
  3135, // connection lost contact
  12170, // TNS connect timeout
  12514, // listener does not know of service
  12537, // TNS connection closed
  12541, // no listener
  12545, // target host or object does not exist
  28547, // connection to server failed
]);

/** Errores del driver (sin errorNum ORA) que tambien indican falta de disponibilidad. */
const DRIVER_NO_DISPONIBLE = /NJS-(040|500|503|510|511|521)|DPY-(1001|4011|6005)|DPI-1080|ECONNREFUSED|ETIMEDOUT|ECONNRESET/;

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

  if (
    (num !== undefined && ORA_NO_DISPONIBLE.has(num)) ||
    (num === undefined && DRIVER_NO_DISPONIBLE.test(raw))
  ) {
    return new ServiceUnavailableError(
      "La base de datos no está disponible en este momento. Reintente en unos segundos.",
      { cause: error },
    );
  }

  switch (num) {
    case 60: // ORA-00060: deadlock detected
    case 54: // ORA-00054: resource busy (NOWAIT)
    case 30006: // ORA-30006: resource busy; acquire with WAIT timeout expired
      return new ConflictError(
        "Otro usuario está modificando los mismos datos. Reintente en unos segundos.",
        { cause: error },
      );
    case 1438: // ORA-01438: value larger than specified precision
      return new ValidationError(
        `Un número excede la precisión permitida en ${context}`,
        [],
        { cause: error },
      );
    case 1722: // ORA-01722: invalid number
    case 1858: // ORA-01858: non-numeric character found where numeric expected
    case 1861: // ORA-01861: literal does not match format string
    case 1843: // ORA-01843: not a valid month
    case 1847: // ORA-01847: day of month must be between 1 and last day
      return new ValidationError(
        `Un valor tiene un formato inválido (número o fecha) en ${context}`,
        [],
        { cause: error },
      );
    case 1: // ORA-00001: unique constraint violated
      return new ConflictError(
        `Valor duplicado en ${context}: viola una restricción de unicidad`,
        { cause: error },
      );
    case 2291: // integrity constraint (parent key not found)
      return new ForeignKeyError(
        `Referencia inexistente en ${context}: la entidad relacionada no existe`,
        { cause: error },
      );
    case 2292: // integrity constraint (child record found)
      return new ForeignKeyError(
        `No se puede completar la operación sobre ${context}: existen registros dependientes`,
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

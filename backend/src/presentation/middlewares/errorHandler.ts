/**
 * Capa 4 - Presentacion / middlewares.
 * Manejador centralizado de errores. Traduce AppError -> respuesta HTTP con el
 * sobre uniforme { error: { code, message, details, requestId } }. Cualquier
 * otro error se registra (con su requestId, para rastrearlo en el log) y se
 * responde 500 sin filtrar detalles internos.
 */

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { isAppError, ServiceUnavailableError, TooManyRequestsError } from "../../common/errors/AppError.js";
import { mapOracleError } from "../../common/errors/OracleErrorAdapter.js";
import { SoloValidacionExitosa } from "../../common/errors/SoloValidacion.js";
import { logger } from "../../common/logging/Logger.js";

/** Mensajes en espanol para los errores de protocolo mas comunes de Fastify. */
const MENSAJES_FASTIFY: Readonly<Record<string, string>> = {
  FST_ERR_CTP_INVALID_JSON_BODY: "El cuerpo de la petición no es un JSON válido.",
  FST_ERR_CTP_BODY_TOO_LARGE: "El cuerpo de la petición es demasiado grande.",
  FST_ERR_CTP_EMPTY_JSON_BODY: "El cuerpo de la petición no puede estar vacío.",
  FST_ERR_CTP_INVALID_MEDIA_TYPE: "Tipo de contenido no soportado.",
  FST_REQ_FILE_TOO_LARGE: "El archivo supera el tamaño máximo permitido.",
};

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const requestId = String(request.id);

  // Modo "solo validar": todo se comprobo y nada se escribio.
  if (error instanceof SoloValidacionExitosa) {
    reply.status(200).send({ data: { valido: true } });
    return;
  }

  if (isAppError(error)) {
    if (error instanceof ServiceUnavailableError) reply.header("Retry-After", "5");
    if (error instanceof TooManyRequestsError) {
      reply.header("Retry-After", String(error.retryAfterSeconds));
    }
    if (error.httpStatus >= 500) {
      logger().error("Error de servicio", {
        requestId,
        path: request.url,
        method: request.method,
        message: error.message,
        cause: error.cause instanceof Error ? error.cause.message : undefined,
      });
    }
    reply.status(error.httpStatus).send({ error: { ...error.toJSON(), requestId } });
    return;
  }

  // Errores de parseo / validacion de esquema propios de Fastify.
  const maybeStatus = (error as FastifyError).statusCode;
  if (typeof maybeStatus === "number" && maybeStatus >= 400 && maybeStatus < 500) {
    const code = (error as FastifyError).code;
    reply.status(maybeStatus).send({
      error: {
        code: "VALIDATION",
        message: (code !== undefined && MENSAJES_FASTIFY[code]) || error.message,
        details: [],
        requestId,
      },
    });
    return;
  }

  // Un error crudo del driver que se escapo de la DAL (p. ej. el pool no pudo
  // entregar conexion): si es de disponibilidad, es un 503 reintentable, no un 500.
  const mapeado = mapOracleError(error, "la base de datos");
  if (mapeado instanceof ServiceUnavailableError) {
    errorHandler(mapeado, request, reply);
    return;
  }

  logger().error("Error no controlado", {
    requestId,
    path: request.url,
    method: request.method,
    message: error.message,
    stack: error.stack,
  });
  reply.status(500).send({
    error: { code: "INTERNAL", message: "Error interno del servidor", details: [], requestId },
  });
}

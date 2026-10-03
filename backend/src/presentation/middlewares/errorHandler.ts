/**
 * Capa 4 - Presentacion / middlewares.
 * Manejador centralizado de errores. Traduce AppError -> respuesta HTTP con el
 * sobre uniforme { error: { code, message, details } }. Cualquier otro error se
 * registra y se responde 500 sin filtrar detalles internos.
 */

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { isAppError } from "../../common/errors/AppError.js";
import { logger } from "../../common/logging/Logger.js";

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (isAppError(error)) {
    reply.status(error.httpStatus).send({ error: error.toJSON() });
    return;
  }

  // Errores de parseo / validacion de esquema propios de Fastify.
  const maybeStatus = (error as FastifyError).statusCode;
  if (typeof maybeStatus === "number" && maybeStatus >= 400 && maybeStatus < 500) {
    reply.status(maybeStatus).send({
      error: { code: "VALIDATION", message: error.message, details: [] },
    });
    return;
  }

  logger().error("Error no controlado", {
    path: request.url,
    method: request.method,
    message: error.message,
    stack: error.stack,
  });
  reply.status(500).send({
    error: { code: "INTERNAL", message: "Error interno del servidor", details: [] },
  });
}

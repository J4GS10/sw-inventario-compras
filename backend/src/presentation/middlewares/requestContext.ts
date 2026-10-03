/**
 * Capa 4 - Presentacion / middlewares.
 * Construye el AuditContext a partir del request autenticado. Debe ejecutarse
 * despues de authGuard.
 */

import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { AuditContext } from "../../common/types/AuditContext.js";
import { UnauthorizedError } from "../../common/errors/AppError.js";

export function auditContextOf(request: FastifyRequest): AuditContext {
  const userId = request.auth?.sub;
  if (typeof userId !== "number" || Number.isNaN(userId)) {
    throw new UnauthorizedError();
  }
  const ctx: {
    userId: number;
    permisos: readonly string[];
    empleadoId?: number;
    roles?: readonly string[];
    requestId: string;
  } = {
    userId,
    permisos: request.auth?.permisos ?? [],
    requestId:
      (typeof request.id === "string" && request.id) || randomUUID(),
  };
  const empleadoId = request.auth?.empleadoId;
  if (typeof empleadoId === "number" && empleadoId > 0) {
    ctx.empleadoId = empleadoId;
  }
  if (Array.isArray(request.auth?.roles)) {
    ctx.roles = request.auth.roles;
  }
  return ctx;
}

/**
 * Capa 4 - Presentacion / rutas / autenticacion.
 *   POST /api/auth/login          { username, password } -> { token, sesion }
 *   POST /api/auth/logout                                 -> 204   (requiere token)
 *   GET  /api/auth/me                                     -> { sesion }   (requiere token)
 *   GET  /api/auth/usuarios-demo                          -> lista para el selector de la UI
 *   GET  /api/auth/permisos                               -> catalogo de permisos y roles
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { ValidationError } from "../../common/errors/AppError.js";
import { authService } from "../../bll/services/seg/AuthService.js";
import { PERMISO_META, ROLES } from "../../common/auth/permissions.js";
import { authGuard } from "../middlewares/authGuard.js";

function clientIp(req: FastifyRequest): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim() !== "") {
    return fwd.split(",")[0]?.trim() ?? null;
  }
  return typeof req.ip === "string" && req.ip !== "" ? req.ip : null;
}

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { username?: string; password?: string };
    if (typeof body.username !== "string" || body.username.trim() === "") {
      throw new ValidationError("username es requerido", [
        { field: "username", message: "requerido" },
      ]);
    }
    if (typeof body.password !== "string" || body.password === "") {
      throw new ValidationError("password es requerido", [
        { field: "password", message: "requerido" },
      ]);
    }
    const { token, sesion } = await authService.login(
      body.username,
      body.password,
      { ip: clientIp(req) },
    );
    reply.send({ data: { token, sesion } });
  });

  app.post(
    "/api/auth/logout",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      const sub = req.auth?.sub;
      if (typeof sub === "number") {
        await authService.logout(sub, { ip: clientIp(req) });
      }
      reply.status(204).send();
    },
  );

  app.get("/api/auth/me", { preHandler: authGuard([]) }, async (req, reply) => {
    const sub = req.auth?.sub;
    if (typeof sub !== "number") {
      throw new ValidationError("Token invalido");
    }
    reply.send({ data: await authService.me(sub) });
  });

  app.get("/api/auth/usuarios-demo", async (_req, reply) => {
    reply.send({ data: await authService.usuariosDemo() });
  });

  app.get("/api/auth/permisos", async (_req, reply) => {
    reply.send({
      data: {
        permisos: Object.entries(PERMISO_META).map(([codigo, m]) => ({
          codigo,
          ...m,
        })),
        roles: Object.entries(ROLES).map(([codigo, r]) => ({
          codigo,
          nombre: r.nombre,
          permisos: r.permisos,
        })),
      },
    });
  });
}

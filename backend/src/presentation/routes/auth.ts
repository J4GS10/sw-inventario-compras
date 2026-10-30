/**
 * Capa 4 - Presentacion / rutas / autenticacion.
 *   POST /api/auth/login          { username, password } -> { token, sesion }
 *   POST /api/auth/logout                                 -> 204   (requiere token)
 *   GET  /api/auth/me                                     -> { sesion }   (requiere token)
 *   GET  /api/auth/usuarios-demo                          -> lista para el selector de la UI
 *   GET  /api/auth/permisos                               -> catalogo de permisos y roles
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "../../common/errors/AppError.js";
import { FailureRateLimiter } from "../../common/security/RateLimiter.js";
import { clientIpOf } from "../../common/security/clientIp.js";
import { revocarToken } from "../../common/auth/jwt.js";
import { authService } from "../../bll/services/seg/AuthService.js";
import { PERMISO_META, ROLES } from "../../common/auth/permissions.js";
import { authGuard } from "../middlewares/authGuard.js";

/** 20 logins fallidos por IP en 10 min -> 429. Configurable con LOGIN_MAX_FALLOS_IP. */
const loginLimiter = new FailureRateLimiter(
  Number.parseInt(process.env["LOGIN_MAX_FALLOS_IP"] ?? "", 10) || 20,
  10 * 60 * 1000,
);

function clientIp(req: FastifyRequest): string | null {
  return clientIpOf(req.socket.remoteAddress, req.headers["x-forwarded-for"]);
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
    // Freno por IP (rafaga contra muchos usuarios); el bloqueo por usuario vive en AuthService.
    const ip = clientIp(req) ?? "desconocida";
    const limite = loginLimiter.estado(ip);
    if (limite.bloqueado) {
      throw new TooManyRequestsError(
        `Demasiados intentos fallidos desde esta dirección. Espere ${Math.ceil(limite.reintentarEnSeg / 60)} min antes de reintentar.`,
        limite.reintentarEnSeg,
      );
    }
    try {
      const { token, sesion } = await authService.login(body.username, body.password, { ip: clientIp(req) });
      loginLimiter.limpiar(ip);
      reply.send({ data: { token, sesion } });
    } catch (e) {
      if (e instanceof UnauthorizedError) loginLimiter.registrarFallo(ip);
      throw e;
    }
  });

  app.post(
    "/api/auth/logout",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      const sub = req.auth?.sub;
      if (typeof sub === "number") {
        await authService.logout(sub, { ip: clientIp(req) });
      }
      // El token deja de valer YA (no hasta que expire).
      if (req.auth?.jti !== undefined) revocarToken(req.auth.jti, req.auth.exp);
      reply.status(204).send();
    },
  );

  app.get("/api/auth/me", { preHandler: authGuard([]) }, async (req, reply) => {
    const sub = req.auth?.sub;
    if (typeof sub !== "number") {
      throw new ValidationError("Token inválido");
    }
    reply.send({ data: await authService.me(sub) });
  });

  // Selector de perfiles de DEMO: nunca en produccion (lista usernames a cualquiera).
  app.get("/api/auth/usuarios-demo", async (_req, reply) => {
    // Acceso rapido por perfil: activo siempre, salvo APP_LOGIN_DEMO=0 (instalacion real expuesta).
    // Solo lista usuario/nombre/rol; entrar sigue exigiendo la contrasena.
    if (process.env["APP_LOGIN_DEMO"] === "0") {
      reply.status(404).send({ error: { code: "NOT_FOUND", message: "No encontrado", details: [] } });
      return;
    }
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

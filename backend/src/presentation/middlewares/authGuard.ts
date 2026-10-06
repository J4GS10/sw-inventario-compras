/**
 * Capa 4 - Presentacion / middlewares.
 * Guarda de autenticacion + autorizacion por permisos (contra los permisos
 * embebidos en el JWT; el mapeo rol->permiso vive en SEG_ROL_PERMISO y se
 * resuelve al emitir el token en el modulo de Seguridad).
 *
 * El atajo `X-Dev-User: <idUsuario>` (permisos `*`, sin login) SOLO se admite
 * cuando `env().devAuth` es true — es decir NODE_ENV != production Y
 * `APP_DEV_AUTH=1`. En cualquier otro caso se exige un JWT valido (login real),
 * de modo que los roles se apliquen tal cual en dev y en produccion.
 */

import type { FastifyRequest, preHandlerHookHandler } from "fastify";
import { env } from "../../common/config/EnvConfig.js";
import { ForbiddenError, UnauthorizedError } from "../../common/errors/AppError.js";
import { verifyJwt, type JwtPayload } from "../../common/auth/jwt.js";
import { esLoopback } from "../../common/security/clientIp.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: JwtPayload;
  }
}

function resolvePayload(request: FastifyRequest): JwtPayload {
  const header = request.headers["authorization"];
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return verifyJwt(header.slice("Bearer ".length).trim(), env().auth.jwtSecret);
  }
  // El atajo de desarrollo SOLO vale desde la propia maquina y sin proxy delante:
  // con el backend en 0.0.0.0 y Vite en la LAN, cualquiera en la red lo usaria
  // (y por el proxy del frontend, tambien) para entrar como administrador.
  if (
    env().devAuth &&
    esLoopback(request.socket.remoteAddress) &&
    request.headers["x-forwarded-for"] === undefined &&
    request.headers["forwarded"] === undefined
  ) {
    const devUser = request.headers["x-dev-user"];
    if (typeof devUser === "string" && devUser.trim() !== "") {
      return { sub: Number.parseInt(devUser, 10), permisos: ["*"], roles: [] };
    }
  }
  throw new UnauthorizedError();
}

/** @param permisos Permisos requeridos (TODOS). Vacio = solo autenticacion. */
export function authGuard(permisos: readonly string[] = []): preHandlerHookHandler {
  return async function guard(request: FastifyRequest): Promise<void> {
    const payload = resolvePayload(request);
    request.auth = payload;
    if (permisos.length === 0) return;
    const granted = new Set(payload.permisos ?? []);
    if (granted.has("*")) return;
    const missing = permisos.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenError(`Faltan permisos: ${missing.join(", ")}`);
    }
  };
}

/** Requiere AL MENOS UNO de los permisos (p. ej. aprobar jefe o gerente). */
export function authGuardAny(permisos: readonly string[]): preHandlerHookHandler {
  return async function guard(request: FastifyRequest): Promise<void> {
    const payload = resolvePayload(request);
    request.auth = payload;
    const granted = new Set(payload.permisos ?? []);
    if (granted.has("*")) return;
    if (!permisos.some((p) => granted.has(p))) {
      throw new ForbiddenError(`Requiere uno de: ${permisos.join(", ")}`);
    }
  };
}

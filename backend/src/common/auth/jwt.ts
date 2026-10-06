/**
 * Capa 6 - Componentes Comunes.
 * Firma/verificacion minima de JWT HS256 con node:crypto. Sin dependencias
 * externas y sin conocimiento del negocio.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { UnauthorizedError } from "../errors/AppError.js";

export interface JwtPayload {
  /** ID_USUARIO de SEG_USUARIO. */
  readonly sub: number;
  readonly username?: string;
  readonly empleadoId?: number;
  readonly roles?: readonly string[];
  readonly permisos?: readonly string[];
  readonly iat?: number;
  readonly exp?: number;
  /** Identificador unico del token (permite revocarlo al cerrar sesion). */
  readonly jti?: string;
}

/** Tokens revocados (jti -> exp). En memoria: se pierde al reiniciar (los tokens duran 8 h). */
const REVOCADOS = new Map<string, number>();

export function revocarToken(jti: string, exp: number | undefined): void {
  const ahora = Math.floor(Date.now() / 1000);
  REVOCADOS.set(jti, exp ?? ahora + 8 * 3600);
  // limpieza oportunista de los ya vencidos
  if (REVOCADOS.size > 5000) for (const [k, e] of REVOCADOS) if (e < ahora) REVOCADOS.delete(k);
}

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signJwt(
  payload: Omit<JwtPayload, "iat">,
  secret: string,
  expiresInSeconds = 8 * 3600,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = {
    ...payload,
    jti: payload.jti ?? randomUUID(),
    iat: now,
    exp: payload.exp ?? now + expiresInSeconds,
  };
  const h = base64url(Buffer.from(JSON.stringify(header)));
  const p = base64url(Buffer.from(JSON.stringify(body)));
  const sig = base64url(createHmac("sha256", secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new UnauthorizedError("Token malformado");
  const [h, p, sig] = parts as [string, string, string];
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const provided = fromBase64url(sig);
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    throw new UnauthorizedError("Firma de token inválida");
  }
  let payload: JwtPayload;
  try {
    payload = JSON.parse(fromBase64url(p).toString("utf8")) as JwtPayload;
  } catch {
    throw new UnauthorizedError("Payload de token inválido");
  }
  // exp es OBLIGATORIO: un token firmado sin vencimiento no caduca nunca.
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedError("Token expirado");
  }
  if (payload.jti !== undefined && REVOCADOS.has(payload.jti)) {
    throw new UnauthorizedError("Sesión cerrada");
  }
  if (typeof payload.sub !== "number") {
    throw new UnauthorizedError("Token sin sujeto válido");
  }
  return payload;
}

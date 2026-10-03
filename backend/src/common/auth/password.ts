/**
 * Capa 6 - Componentes Comunes.
 * Hash y verificacion de contrasenas. Sin dependencias externas: usa el KDF
 * memory-hard `scrypt` de `node:crypto` (mismo criterio que `jwt.ts`).
 *
 * Formato de almacenamiento (columna SEG_USUARIO.PASSWORD_HASH, VARCHAR2(200)):
 *   scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>
 *
 * Toda la logica de hashing vive detras de `hashPassword` / `verifyPassword`.
 * Para migrar a argon2/bcrypt basta reimplementar estas dos funciones; la capa
 * de negocio (AuthService) no cambia.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Parametros de coste. 128*N*r*p bytes de memoria ~= 16 MiB con estos valores. */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const SALT_BYTES = 16;
const PREFIX = "scrypt";
const MAX_MEM = 64 * 1024 * 1024;

function derive(
  password: string,
  salt: Buffer,
  keyLen: number,
  cost: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      keyLen,
      { N: cost.N, r: cost.r, p: cost.p, maxmem: MAX_MEM },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      },
    );
  });
}

/** Devuelve el hash serializado listo para guardar en PASSWORD_HASH. */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("La contrasena no puede estar vacia");
  }
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(plain, salt, KEY_LEN, { N, r: R, p: P });
  return [
    PREFIX,
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Compara `plain` contra un hash almacenado. Nunca lanza por un hash con formato
 * invalido o un marcador de dev: devuelve `false`.
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  if (typeof plain !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const cost = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
  if (
    !Number.isInteger(cost.N) ||
    !Number.isInteger(cost.r) ||
    !Number.isInteger(cost.p)
  ) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4] ?? "", "base64");
    expected = Buffer.from(parts[5] ?? "", "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await derive(plain, salt, expected.length, cost);
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True si `stored` no es un hash scrypt valido (marcador de dev, vacio, etc.). */
export function isPlaceholderHash(stored: string | null | undefined): boolean {
  return (
    typeof stored !== "string" ||
    stored.split("$").length !== 6 ||
    !stored.startsWith(`${PREFIX}$`)
  );
}

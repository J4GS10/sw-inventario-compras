/**
 * Capa 6 - Componentes Comunes.
 * Cargador de variables de entorno. Patron Singleton (skills/patron-arquitectura.md 4.1).
 *
 * Reconcilia los dos juegos de nombres presentes en el proyecto:
 *   - `.env` del repo usa DB_USER / DB_PASSWORD / DB_HOST / DB_PORT / DB_SERVICE_NAME / DB_CONNECT_STRING
 *   - skills/stack-tecnologico.md (seccion 4, Docker) menciona ORACLE_USER / ORACLE_PASSWORD / ORACLE_CONNECT_STRING
 * Se acepta cualquiera de los dos y se expone un contrato unico.
 *
 * Sin dependencia del negocio: 100% reutilizable.
 */

export interface OracleConfig {
  readonly user: string;
  readonly password: string;
  readonly connectString: string;
  readonly poolMin: number;
  readonly poolMax: number;
  readonly poolIncrement: number;
  readonly poolTimeout: number;
}

export interface HttpConfig {
  readonly host: string;
  readonly port: number;
}

export interface AuthConfig {
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
}

/** Identidad de la empresa emisora: sidebar + membrete del PDF de Orden de Compra. */
export interface EmpresaConfig {
  readonly nombre: string;
  readonly nit: string;
  readonly direccion: string;
  readonly telefono: string;
}

export interface AppEnvironment {
  readonly nodeEnv: "development" | "test" | "production";
  /**
   * Atajo de autenticacion para desarrollo/pruebas: acepta la cabecera
   * `X-Dev-User: <idUsuario>` (permisos `*`) SIN pasar por el login real.
   * Solo es `true` cuando NODE_ENV != production Y `APP_DEV_AUTH=1`.
   * En produccion es siempre `false` (doble candado).
   */
  readonly devAuth: boolean;
  readonly oracle: OracleConfig;
  readonly http: HttpConfig;
  readonly auth: AuthConfig;
  readonly empresa: EmpresaConfig;
}

function readFirst(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function required(keys: readonly string[], fallback?: string): string {
  const value = readFirst(keys) ?? fallback;
  if (value === undefined) {
    throw new Error(
      `Variable de entorno obligatoria ausente: una de [${keys.join(", ")}]`,
    );
  }
  return value;
}

function toInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildConnectString(): string {
  const direct = readFirst(["DB_CONNECT_STRING", "ORACLE_CONNECT_STRING"]);
  if (direct !== undefined) return direct;
  const host = required(["DB_HOST", "ORACLE_HOST"], "localhost");
  const port = toInt(readFirst(["DB_PORT", "ORACLE_PORT"]), 1521);
  const service = required(["DB_SERVICE_NAME", "ORACLE_SERVICE_NAME"], "proyecto");
  return `${host}:${port}/${service}`;
}

export class EnvConfig {
  private static instance: EnvConfig | undefined;

  public readonly values: AppEnvironment;

  private constructor() {
    const nodeEnvRaw = readFirst(["NODE_ENV"]) ?? "development";
    const nodeEnv: AppEnvironment["nodeEnv"] =
      nodeEnvRaw === "production" || nodeEnvRaw === "test"
        ? nodeEnvRaw
        : "development";

    const devAuth =
      nodeEnv !== "production" && readFirst(["APP_DEV_AUTH"]) === "1";

    this.values = {
      nodeEnv,
      devAuth,
      oracle: {
        user: required(["DB_USER", "ORACLE_USER"]),
        password: required(["DB_PASSWORD", "ORACLE_PASSWORD"]),
        connectString: buildConnectString(),
        poolMin: toInt(readFirst(["DB_POOL_MIN", "ORACLE_POOL_MIN"]), 2),
        poolMax: toInt(readFirst(["DB_POOL_MAX", "ORACLE_POOL_MAX"]), 10),
        poolIncrement: toInt(
          readFirst(["DB_POOL_INCREMENT", "ORACLE_POOL_INCREMENT"]),
          1,
        ),
        poolTimeout: toInt(
          readFirst(["DB_POOL_TIMEOUT", "ORACLE_POOL_TIMEOUT"]),
          60,
        ),
      },
      http: {
        host: readFirst(["HTTP_HOST"]) ?? "0.0.0.0",
        port: toInt(readFirst(["HTTP_PORT", "PORT"]), 3000),
      },
      auth: {
        jwtSecret:
          readFirst(["JWT_SECRET"]) ??
          (nodeEnv === "production"
            ? (() => {
                throw new Error("JWT_SECRET es obligatorio en produccion");
              })()
            : "dev-insecure-secret-change-me"),
        jwtExpiresIn: readFirst(["JWT_EXPIRES_IN"]) ?? "8h",
      },
      empresa: {
        nombre: readFirst(["EMPRESA_NOMBRE"]) ?? "Clavos S.A.",
        nit: readFirst(["EMPRESA_NIT"]) ?? "12345678-9",
        direccion: readFirst(["EMPRESA_DIRECCION"]) ?? "Zona 1, Ciudad de Guatemala",
        telefono: readFirst(["EMPRESA_TELEFONO"]) ?? "+502 2222-2222",
      },
    };
  }

  public static getInstance(): EnvConfig {
    if (EnvConfig.instance === undefined) {
      EnvConfig.instance = new EnvConfig();
    }
    return EnvConfig.instance;
  }

  /** Solo para pruebas: fuerza recarga en el proximo getInstance(). */
  public static reset(): void {
    EnvConfig.instance = undefined;
  }
}

export function env(): AppEnvironment {
  return EnvConfig.getInstance().values;
}

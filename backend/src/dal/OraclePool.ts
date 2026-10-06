/**
 * Capa 2 - Acceso a Datos.
 * UNICO archivo del sistema autorizado a importar `oracledb` junto con los
 * repositorios de `dal/repositories/`.
 *
 * Patrones:
 *  - Singleton + Object Pool: una sola instancia del pool para todo el backend.
 *  - Template Method: `withConnection` / `withTransaction` fijan el esqueleto
 *    invariable adquirir -> ejecutar -> commit/rollback -> close (finally).
 */

import oracledb, { type Connection, type Pool } from "oracledb";
import { env } from "../common/config/EnvConfig.js";
import { logger } from "../common/logging/Logger.js";
import { InternalError } from "../common/errors/AppError.js";

oracledb.autoCommit = false;
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

/** Tiempo maximo de una sentencia contra Oracle (ms). Configurable con DB_CALL_TIMEOUT_MS. */
const CALL_TIMEOUT_MS = (() => {
  const n = Number.parseInt(process.env["DB_CALL_TIMEOUT_MS"] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 30_000;
})();

export class OraclePool {
  private static instance: OraclePool | undefined;

  private pool: Pool | undefined;

  private constructor() {}

  public static getInstance(): OraclePool {
    if (OraclePool.instance === undefined) {
      OraclePool.instance = new OraclePool();
    }
    return OraclePool.instance;
  }

  /** Se llama una sola vez al arrancar el backend (server.ts). */
  public async init(): Promise<void> {
    if (this.pool !== undefined) return;
    const cfg = env().oracle;
    this.pool = await oracledb.createPool({
      user: cfg.user,
      password: cfg.password,
      connectString: cfg.connectString,
      poolMin: cfg.poolMin,
      poolMax: cfg.poolMax,
      poolIncrement: cfg.poolIncrement,
      poolTimeout: cfg.poolTimeout,
      // Valida la conexion cuando lleva >30 s ociosa: tras un corte de red o un
      // reinicio de Oracle no se entrega al request una conexion muerta.
      poolPingInterval: 30,
      // Si el pool esta saturado, el request espera 15 s y falla con NJS-040
      // (-> 503 reintentable) en vez de colgarse sin limite.
      queueTimeout: 15_000,
      queueMax: 200,
      stmtCacheSize: 50,
      poolAlias: "default",
    });
    logger().info("Pool de Oracle inicializado", {
      connectString: cfg.connectString,
      poolMin: cfg.poolMin,
      poolMax: cfg.poolMax,
    });
  }

  /** Round-trip real a Oracle (readiness). Lanza si la BD no responde en `timeoutMs`. */
  public async ping(timeoutMs = 3000): Promise<void> {
    const conn = await this.getPool().getConnection();
    try {
      conn.callTimeout = timeoutMs;
      await conn.execute("SELECT 1 FROM DUAL");
    } finally {
      try {
        await conn.close();
      } catch {
        /* la conexion ya estaba rota: el pool la descarta */
      }
    }
  }

  /** Foto del pool para /health/ready y diagnostico. */
  public stats(): { open: number; inUse: number; max: number } | null {
    if (this.pool === undefined) return null;
    return {
      open: this.pool.connectionsOpen,
      inUse: this.pool.connectionsInUse,
      max: this.pool.poolMax,
    };
  }

  public async close(): Promise<void> {
    if (this.pool === undefined) return;
    await this.pool.close(10);
    this.pool = undefined;
    logger().info("Pool de Oracle cerrado");
  }

  private getPool(): Pool {
    if (this.pool === undefined) {
      throw new InternalError(
        "El pool de Oracle no ha sido inicializado. Llame a OraclePool.getInstance().init() al arrancar.",
      );
    }
    return this.pool;
  }

  /**
   * Ejecuta `fn` con una conexion del pool. Sin transaccion explicita: apto
   * para lecturas. La conexion siempre se libera en `finally`.
   * Si se recibe `existing`, se reutiliza y NO se cierra (la controla el llamador).
   */
  public async withConnection<T>(
    fn: (conn: Connection) => Promise<T>,
    existing?: Connection,
  ): Promise<T> {
    if (existing !== undefined) {
      return fn(existing);
    }
    const conn = await this.getPool().getConnection();
    // Ninguna sentencia puede colgar un request mas de 30 s (consulta runaway, bloqueo).
    conn.callTimeout = CALL_TIMEOUT_MS;
    try {
      return await fn(conn);
    } finally {
      try {
        await conn.close();
      } catch (closeError) {
        logger().warn("Fallo al liberar conexión al pool", {
          reason:
            closeError instanceof Error
              ? closeError.message
              : String(closeError),
        });
      }
    }
  }

  /**
   * Template Method transaccional: adquiere conexion, ejecuta `fn`, hace commit
   * si todo va bien, rollback ante cualquier error, y siempre libera la conexion.
   * Si se recibe `existing`, participa en la transaccion en curso (no hace
   * commit/rollback/close: eso es responsabilidad del propietario original).
   */
  public async withTransaction<T>(
    fn: (conn: Connection) => Promise<T>,
    existing?: Connection,
  ): Promise<T> {
    if (existing !== undefined) {
      return fn(existing);
    }
    const conn = await this.getPool().getConnection();
    conn.callTimeout = CALL_TIMEOUT_MS;
    try {
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        logger().error("Fallo en rollback", {
          reason:
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError),
        });
      }
      throw error;
    } finally {
      try {
        await conn.close();
      } catch (closeError) {
        logger().warn("Fallo al liberar conexión transaccional al pool", {
          reason:
            closeError instanceof Error
              ? closeError.message
              : String(closeError),
        });
      }
    }
  }
}

export function oraclePool(): OraclePool {
  return OraclePool.getInstance();
}

export type { Connection } from "oracledb";

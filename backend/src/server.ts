/**
 * Capa 4 - Presentacion. Punto de entrada del backend.
 * Secuencia de arranque: init del pool Oracle (Singleton) -> build de la app ->
 * listen. Apagado ordenado que cierra el pool.
 */

import "reflect-metadata";
import { loadDotenv } from "./common/config/loadDotenv.js";
import { env } from "./common/config/EnvConfig.js";
import { logger } from "./common/logging/Logger.js";
import { oraclePool } from "./dal/OraclePool.js";
import { registerComprasSubscribers } from "./bll/compras/subscribers/index.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  loadDotenv();
  await oraclePool().init();
  registerComprasSubscribers();

  const app = await buildApp();
  const { host, port } = env().http;
  await app.listen({ host, port });
  logger().info("Backend escuchando", { host, port, env: env().nodeEnv });

  const shutdown = async (signal: string): Promise<void> => {
    logger().info("Apagando backend", { signal });
    try {
      await app.close();
      await oraclePool().close();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  logger().error("Fallo al arrancar el backend", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

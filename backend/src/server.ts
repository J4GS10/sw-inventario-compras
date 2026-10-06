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

  let apagando = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (apagando) return;
    apagando = true;
    logger().info("Apagando backend", { signal });
    // Si el cierre ordenado se cuelga (p. ej. una consulta abierta), se fuerza a los 15 s.
    const watchdog = setTimeout(() => {
      logger().error("Cierre ordenado excedió 15 s; se fuerza la salida");
      process.exit(1);
    }, 15_000);
    watchdog.unref();
    try {
      await app.close();
      await oraclePool().close();
    } catch (error: unknown) {
      logger().error("Error al apagar", { message: error instanceof Error ? error.message : String(error) });
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Una promesa rechazada sin manejar no debe tumbar el proceso en silencio: se registra y se sigue.
  process.on("unhandledRejection", (reason: unknown) => {
    logger().error("unhandledRejection", {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
  // Una excepcion no capturada deja el proceso en estado indefinido: se registra y se sale para que el supervisor lo reinicie limpio.
  process.on("uncaughtException", (error: Error) => {
    logger().error("uncaughtException", { message: error.message, stack: error.stack });
    void shutdown("uncaughtException");
  });
}

main().catch((error: unknown) => {
  logger().error("Fallo al arrancar el backend", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

/**
 * Capa 4 - Presentacion.
 * Construccion de la instancia Fastify: hooks transversales, manejador de
 * errores centralizado y montaje de rutas por modulo.
 */

import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { errorHandler } from "./presentation/middlewares/errorHandler.js";
import { oraclePool } from "./dal/OraclePool.js";
import { registerIdempotency } from "./presentation/middlewares/idempotency.js";
import { fileStorage } from "./common/storage/FileStorage.js";
import { logger } from "./common/logging/Logger.js";
import { randomUUID } from "node:crypto";
import { registerAuthRoutes } from "./presentation/routes/auth.js";
import { registerConfigRoutes } from "./presentation/routes/config.js";
import { registerBorradorRoutes } from "./presentation/routes/borradores.js";
import { registerComRoutes } from "./presentation/routes/com/index.js";
import { registerComFlujoRoutes } from "./presentation/routes/com/transaccional.js";
import { registerComAnaliticaRoutes } from "./presentation/routes/com/analitica.js";
import { registerComReferenciaRoutes } from "./presentation/routes/com/referencias.js";
import { registerComAdjuntoRoutes } from "./presentation/routes/com/adjuntos.js";
import { registerComReportesRoutes } from "./presentation/routes/com/reportes.js";
import { registerComCxpRoutes } from "./presentation/routes/com/cxp.js";

/** Tamano maximo por adjunto (bytes). Se lee al construir la app, ya con `.env` cargado. */
function adjuntoMaxBytes(): number {
  const raw = Number.parseInt(process.env["ADJUNTO_MAX_BYTES"] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 15 * 1024 * 1024;
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    routerOptions: { ignoreTrailingSlash: true },
    bodyLimit: 2 * 1024 * 1024,
    // Peticiones lentas/colgadas no retienen el socket indefinidamente.
    requestTimeout: 60_000,
    connectionTimeout: 0,
    keepAliveTimeout: 65_000,
    // Id de correlacion: el del cliente/proxy si viene, si no uno nuevo. Viaja en
    // la respuesta (x-request-id) y en el cuerpo de todo error para rastrearlo en el log.
    genReqId: (req) => {
      const h = req.headers["x-request-id"];
      return typeof h === "string" && /^[w.-]{8,64}$/.test(h) ? h : randomUUID();
    },
  });

  app.setErrorHandler(errorHandler);

  // Idempotencia de las escrituras (cabecera Idempotency-Key).
  registerIdempotency(app);

  // Respuestas 404 con el mismo sobre que el resto de errores (antes: formato propio de Fastify).
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Ruta no encontrada: ${req.method} ${req.url.split("?")[0] ?? ""}`,
        details: [],
        requestId: String(req.id),
      },
    });
  });

  // Cabeceras de seguridad y trazabilidad en TODA respuesta.
  // IMPORTANTE: hook SINCRONO (con `done`). Un hook `async` hace que `reply.sent` siga en false mientras corre; un
  // handler `async` que llama `reply.send(...)` sin `return` resuelve a `undefined` y Fastify envia la respuesta
  // una SEGUNDA vez ("Cannot write headers after they are sent", 500 falsos en el log).
  app.addHook("onSend", (req, reply, payload, done) => {
    reply.header("x-request-id", String(req.id));
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    // Datos de negocio: nunca en cache de navegador/proxy (un listado viejo parece "no se actualiza").
    if (req.url.startsWith("/api/") && reply.getHeader("cache-control") === undefined) {
      reply.header("Cache-Control", "no-store");
    }
    done(null, payload);
  });

  // Log de acceso: metodo, ruta, estado y duracion; los 5xx/lentos suben de nivel.
  app.addHook("onResponse", async (req, reply) => {
    const ms = Math.round(reply.elapsedTime);
    if (req.url === "/health" || req.url.startsWith("/health/")) return;
    const campos = { requestId: String(req.id), method: req.method, path: req.url.split("?")[0], status: reply.statusCode, ms };
    if (reply.statusCode >= 500) logger().error("HTTP", campos);
    else if (ms > 2000) logger().warn("HTTP lento", campos);
    else logger().debug("HTTP", campos);
  });

  // Tolerar POST de accion sin cuerpo (Content-Type: application/json + body vacio):
  // los endpoints /aprobar, /cerrar, /adjudicar, etc. no llevan payload.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      const text = typeof body === "string" ? body.trim() : "";
      if (text === "") {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(text) as unknown);
      } catch {
        const e = new Error("El cuerpo de la petición no es un JSON válido.") as Error & { statusCode: number };
        e.statusCode = 400;
        done(e, undefined);
      }
    },
  );

  // Adjuntos de documentos (multipart/form-data, un archivo por peticion).
  await app.register(multipart, {
    limits: { fileSize: adjuntoMaxBytes(), files: 1 },
  });

  // Liveness: el proceso responde. No toca la BD (un orquestador no debe reiniciar el backend porque Oracle se cayo).
  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  // Readiness: ademas verifica un round-trip real a Oracle. 503 = no enrutar trafico todavia.
  // Estado grueso para la interfaz (pasa por el proxy de /api): el usuario ve un aviso claro si algo esta caido.
  app.get("/api/salud", async (_req, reply) => {
    let db: "up" | "down" = "up";
    let storage: "up" | "down" | "memoria" = "memoria";
    try {
      await oraclePool().ping();
    } catch {
      db = "down";
    }
    const fs = fileStorage();
    if (fs.kind === "s3" && fs.ping !== undefined) {
      try {
        await fs.ping();
        storage = "up";
      } catch {
        storage = "down";
      }
    }
    reply.header("Cache-Control", "no-store");
    return { data: { db, storage } };
  });

  app.get("/health/ready", async (_req, reply) => {
    try {
      await oraclePool().ping();
      // El almacenamiento de archivos es opcional para operar: si cae, el sistema sigue
      // (degradado) y se avisa; no se tumba la readiness por un adjunto.
      let storage: "up" | "down" | "memoria" = "memoria";
      let storageError: string | undefined;
      const fs = fileStorage();
      if (fs.kind === "s3" && fs.ping !== undefined) {
        try {
          await fs.ping();
          storage = "up";
        } catch (e) {
          storage = "down";
          storageError = e instanceof Error ? e.message : String(e);
        }
      }
      return {
        status: storage === "down" ? "degraded" : "ok",
        db: "up",
        storage,
        ...(storageError !== undefined ? { storageError } : {}),
        pool: oraclePool().stats(),
        ts: new Date().toISOString(),
      };
    } catch (e) {
      logger().warn("Readiness: Oracle no responde", { message: e instanceof Error ? e.message : String(e) });
      reply.status(503);
      return { status: "degraded", db: "down", ts: new Date().toISOString() };
    }
  });

  registerAuthRoutes(app);
  registerConfigRoutes(app);
  registerBorradorRoutes(app);
  registerComRoutes(app);
  registerComFlujoRoutes(app);
  registerComAnaliticaRoutes(app);
  registerComReferenciaRoutes(app);
  registerComAdjuntoRoutes(app);
  registerComReportesRoutes(app);
  registerComCxpRoutes(app);

  return app;
}

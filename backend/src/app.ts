/**
 * Capa 4 - Presentacion.
 * Construccion de la instancia Fastify: hooks transversales, manejador de
 * errores centralizado y montaje de rutas por modulo.
 */

import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { errorHandler } from "./presentation/middlewares/errorHandler.js";
import { registerAuthRoutes } from "./presentation/routes/auth.js";
import { registerConfigRoutes } from "./presentation/routes/config.js";
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
    ignoreTrailingSlash: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  app.setErrorHandler(errorHandler);

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
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Adjuntos de documentos (multipart/form-data, un archivo por peticion).
  await app.register(multipart, {
    limits: { fileSize: adjuntoMaxBytes(), files: 1 },
  });

  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  registerAuthRoutes(app);
  registerConfigRoutes(app);
  registerComRoutes(app);
  registerComFlujoRoutes(app);
  registerComAnaliticaRoutes(app);
  registerComReferenciaRoutes(app);
  registerComAdjuntoRoutes(app);
  registerComReportesRoutes(app);
  registerComCxpRoutes(app);

  return app;
}

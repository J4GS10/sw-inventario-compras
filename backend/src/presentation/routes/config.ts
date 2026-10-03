/**
 * Capa 4 - Presentacion / rutas / configuracion publica.
 *   GET /api/config/empresa -> identidad de la empresa emisora (sidebar +
 *                              membrete del PDF de Orden de Compra).
 * Sin autenticacion (como /api/auth/permisos): no es informacion sensible,
 * la necesita la pantalla de login para mostrar el nombre antes de entrar.
 */

import type { FastifyInstance } from "fastify";
import { env } from "../../common/config/EnvConfig.js";

export function registerConfigRoutes(app: FastifyInstance): void {
  app.get("/api/config/empresa", async (_req, reply) => {
    reply.send({ data: env().empresa });
  });
}

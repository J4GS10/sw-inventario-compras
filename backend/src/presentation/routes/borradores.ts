/**
 * Capa 4 - Presentacion / rutas / borradores de trabajo.
 *   GET    /api/borradores          -> los del usuario en sesion (hasta 100)
 *   PUT    /api/borradores          -> { clave, contenido (JSON en texto), actualizadoEn }
 *   DELETE /api/borradores?clave=   -> descarta uno
 * Solo requiere sesion: cada usuario opera UNICAMENTE sobre los suyos.
 */

import type { FastifyInstance } from "fastify";
import { authGuard } from "../middlewares/authGuard.js";
import { auditContextOf } from "../middlewares/requestContext.js";
import { BorradorService } from "../../bll/services/seg/BorradorService.js";

const servicio = new BorradorService();

export function registerBorradorRoutes(app: FastifyInstance): void {
  app.get("/api/borradores", { preHandler: authGuard() }, async (req, reply) => {
    const { userId } = auditContextOf(req);
    return reply.send({ data: await servicio.listar(userId) });
  });

  app.put("/api/borradores", { preHandler: authGuard() }, async (req, reply) => {
    const { userId } = auditContextOf(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    await servicio.guardar(userId, { clave: b["clave"], contenido: b["contenido"], actualizadoEn: b["actualizadoEn"] });
    return reply.send({ data: { ok: true } });
  });

  app.delete("/api/borradores", { preHandler: authGuard() }, async (req, reply) => {
    const { userId } = auditContextOf(req);
    await servicio.eliminar(userId, (req.query as Record<string, unknown>)["clave"]);
    return reply.status(204).send();
  });
}

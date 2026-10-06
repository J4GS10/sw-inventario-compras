/**
 * Capa 4 - Presentacion / rutas / compras (Cuentas por Pagar).
 * Liquidacion de facturas de proveedor generadas por una Recepcion. Gateado
 * por `CATALOGO_ADMIN` — el mismo permiso financiero exclusivo de
 * GERENTE_FINANCIERO/ADMIN_COMPRAS que ya administra monedas; el comprador
 * que genero la OC no autoriza su propio pago (separacion de funciones).
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { ValidationError } from "../../../common/errors/AppError.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { withTelemetry } from "../../../bll/support/decorators/withTelemetry.js";
import { LiquidacionService, type FormaPago } from "../../../bll/services/com/LiquidacionService.js";
import { authGuard } from "../../middlewares/authGuard.js";
import { auditContextOf } from "../../middlewares/requestContext.js";

const liquidacion = withTelemetry(new LiquidacionService(), "LiquidacionService");
const CXP = authGuard([Permisos.CATALOGO_ADMIN]);

function idParam(req: FastifyRequest): number {
  const n = Number.parseInt((req.params as Record<string, string>)["id"] ?? "", 10);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError("Parámetro 'id' inválido");
  return n;
}

function liquidarBody(body: unknown): {
  numeroDte: string;
  serieDte: string;
  fechaEmision: string;
  fechaDocumento: string;
  montoTotal: number;
  formaPago: FormaPago;
  banco: string;
  numeroReferencia: string;
  fechaPago: string;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    numeroDte: String(b["numeroDte"] ?? ""),
    serieDte: String(b["serieDte"] ?? ""),
    fechaEmision: String(b["fechaEmision"] ?? ""),
    fechaDocumento: String(b["fechaDocumento"] ?? ""),
    montoTotal: Number(b["montoTotal"]),
    formaPago: String(b["formaPago"] ?? "") as FormaPago,
    banco: String(b["banco"] ?? ""),
    numeroReferencia: String(b["numeroReferencia"] ?? ""),
    fechaPago: String(b["fechaPago"] ?? ""),
  };
}

export function registerComCxpRoutes(app: FastifyInstance): void {
  app.get("/api/com/cxp/pendientes", { preHandler: CXP }, async (_req, reply) => {
    reply.send({ data: await liquidacion.pendientes() });
  });

  app.get("/api/com/cxp/proyeccion-pagos", { preHandler: CXP }, async (_req, reply) => {
    reply.send({ data: await liquidacion.proyeccionPagos() });
  });

  app.get("/api/com/cxp/:id", { preHandler: CXP }, async (req, reply) => {
    reply.send({ data: await liquidacion.detalle(idParam(req)) });
  });

  app.post("/api/com/cxp/:id/liquidar", { preHandler: CXP }, async (req, reply) => {
    reply.send({
      data: await liquidacion.liquidar(idParam(req), liquidarBody(req.body), auditContextOf(req)),
    });
  });
}

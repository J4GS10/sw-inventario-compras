/**
 * Capa 4 - Presentacion / rutas / compras (reporteria).
 *
 *   GET /api/com/reportes/gasto-proveedor[?desde&hasta]           JSON
 *   GET /api/com/reportes/gasto-proveedor/pdf[?desde&hasta]       PDF
 *   GET /api/com/reportes/oc-pendientes                           JSON
 *   GET /api/com/reportes/oc-pendientes/pdf                       PDF
 *   GET /api/com/reportes/desempeno-proveedores[?desde&hasta]     JSON
 *   GET /api/com/reportes/desempeno-proveedores/pdf[?desde&hasta] PDF
 *   GET /api/com/reportes/riesgo-proveedores                      JSON
 *   GET /api/com/reportes/riesgo-proveedores/pdf                  PDF
 *
 * Mismo permiso de lectura que Dashboard/Comparativo/Historial: ANALISIS_VER.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { withTelemetry } from "../../../bll/support/decorators/withTelemetry.js";
import { ReporteService } from "../../../bll/services/com/ReporteService.js";
import { ReportePdfService } from "../../../bll/services/com/ReportePdfService.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { authGuard } from "../../middlewares/authGuard.js";

const reportes = withTelemetry(new ReporteService(), "ReporteService");
const reportesPdf = withTelemetry(new ReportePdfService(), "ReportePdfService");

const READ = [Permisos.ANALISIS_VER];

function fechaQuery(request: FastifyRequest, key: string): string | undefined {
  const raw = (request.query as Record<string, string | undefined>)[key];
  return raw === undefined || raw === "" ? undefined : raw;
}

function enviarPdf(reply: import("fastify").FastifyReply, buffer: Buffer, filename: string): void {
  reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(buffer);
}

export function registerComReportesRoutes(app: FastifyInstance): void {
  app.get(
    "/api/com/reportes/gasto-proveedor",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      reply.send({
        data: await reportes.gastoPorProveedor(fechaQuery(req, "desde"), fechaQuery(req, "hasta")),
      });
    },
  );
  app.get(
    "/api/com/reportes/gasto-proveedor/pdf",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      const { buffer, filename } = await reportesPdf.gastoPorProveedor(
        fechaQuery(req, "desde"),
        fechaQuery(req, "hasta"),
      );
      enviarPdf(reply, buffer, filename);
    },
  );

  app.get(
    "/api/com/reportes/oc-pendientes",
    { preHandler: authGuard(READ) },
    async (_req, reply) => {
      reply.send({ data: await reportes.ocPendientesRecibir() });
    },
  );
  app.get(
    "/api/com/reportes/oc-pendientes/pdf",
    { preHandler: authGuard(READ) },
    async (_req, reply) => {
      const { buffer, filename } = await reportesPdf.ocPendientesRecibir();
      enviarPdf(reply, buffer, filename);
    },
  );

  app.get(
    "/api/com/reportes/desempeno-proveedores",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      reply.send({
        data: await reportes.desempenoProveedores(fechaQuery(req, "desde"), fechaQuery(req, "hasta")),
      });
    },
  );
  app.get(
    "/api/com/reportes/desempeno-proveedores/pdf",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      const { buffer, filename } = await reportesPdf.desempenoProveedores(
        fechaQuery(req, "desde"),
        fechaQuery(req, "hasta"),
      );
      enviarPdf(reply, buffer, filename);
    },
  );

  app.get(
    "/api/com/reportes/riesgo-proveedores",
    { preHandler: authGuard(READ) },
    async (_req, reply) => {
      reply.send({ data: await reportes.riesgoProveedores() });
    },
  );
  app.get(
    "/api/com/reportes/riesgo-proveedores/pdf",
    { preHandler: authGuard(READ) },
    async (_req, reply) => {
      const { buffer, filename } = await reportesPdf.riesgoProveedores();
      enviarPdf(reply, buffer, filename);
    },
  );
}

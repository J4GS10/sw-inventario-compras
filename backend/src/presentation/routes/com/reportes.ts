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
 *   GET /api/com/reportes/evaluacion-proveedores[?desde&hasta&idCategoria&minOrdenes&prioridad&soloEnvioGratis]  JSON
 *   GET /api/com/reportes/evaluacion-proveedores/pdf[?mismos filtros]                                            PDF
 *
 * Cada reporte exige SU permiso (COMPRAS_REPORTE_*), no el ANALISIS_VER general.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { withTelemetry } from "../../../bll/support/decorators/withTelemetry.js";
import {
  ReporteService,
  type EvaluacionProveedoresInput,
  type PrioridadEvaluacion,
} from "../../../bll/services/com/ReporteService.js";
import { ValidationError } from "../../../common/errors/AppError.js";
import { ReportePdfService } from "../../../bll/services/com/ReportePdfService.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { authGuard } from "../../middlewares/authGuard.js";

const reportes = withTelemetry(new ReporteService(), "ReporteService");
const reportesPdf = withTelemetry(new ReportePdfService(), "ReportePdfService");

/** Un permiso por reporte: cada area ve solo los que le sirven para decidir. */
const R_EVALUACION = [Permisos.REPORTE_EVALUACION];
const R_GASTO = [Permisos.REPORTE_GASTO];
const R_ENTREGAS = [Permisos.REPORTE_ENTREGAS];
const R_DESEMPENO = [Permisos.REPORTE_DESEMPENO];
const R_RIESGO = [Permisos.REPORTE_RIESGO];

function fechaQuery(request: FastifyRequest, key: string): string | undefined {
  const raw = (request.query as Record<string, string | undefined>)[key];
  return raw === undefined || raw === "" ? undefined : raw;
}

function enteroQuery(request: FastifyRequest, key: string): number | undefined {
  const raw = fechaQuery(request, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`Parámetro '${key}' inválido`);
  return n;
}

/** Filtros de la evaluacion de proveedores (mismos para el JSON y el PDF). */
function evaluacionQuery(request: FastifyRequest): EvaluacionProveedoresInput {
  const prioridad = fechaQuery(request, "prioridad");
  const desde = fechaQuery(request, "desde");
  const hasta = fechaQuery(request, "hasta");
  const idCategoria = enteroQuery(request, "idCategoria");
  const minOrdenes = enteroQuery(request, "minOrdenes");
  const soloEnvioGratis = fechaQuery(request, "soloEnvioGratis");
  return {
    ...(desde !== undefined ? { desde } : {}),
    ...(hasta !== undefined ? { hasta } : {}),
    ...(idCategoria !== undefined ? { idCategoria } : {}),
    ...(minOrdenes !== undefined ? { minOrdenes } : {}),
    ...(prioridad !== undefined ? { prioridad: prioridad as PrioridadEvaluacion } : {}),
    ...(soloEnvioGratis === "1" || soloEnvioGratis === "true" ? { soloEnvioGratis: true } : {}),
  };
}

function enviarPdf(reply: import("fastify").FastifyReply, buffer: Buffer, filename: string): void {
  reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(buffer);
}

export function registerComReportesRoutes(app: FastifyInstance): void {
  app.get(
    "/api/com/reportes/evaluacion-proveedores",
    { preHandler: authGuard(R_EVALUACION) },
    async (req, reply) => {
      reply.send({ data: await reportes.evaluacionProveedores(evaluacionQuery(req)) });
    },
  );
  app.get(
    "/api/com/reportes/evaluacion-proveedores/pdf",
    { preHandler: authGuard(R_EVALUACION) },
    async (req, reply) => {
      const { buffer, filename } = await reportesPdf.evaluacionProveedores(evaluacionQuery(req));
      enviarPdf(reply, buffer, filename);
    },
  );

  app.get(
    "/api/com/reportes/gasto-proveedor",
    { preHandler: authGuard(R_GASTO) },
    async (req, reply) => {
      reply.send({
        data: await reportes.gastoPorProveedor(fechaQuery(req, "desde"), fechaQuery(req, "hasta")),
      });
    },
  );
  app.get(
    "/api/com/reportes/gasto-proveedor/pdf",
    { preHandler: authGuard(R_GASTO) },
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
    { preHandler: authGuard(R_ENTREGAS) },
    async (_req, reply) => {
      reply.send({ data: await reportes.ocPendientesRecibir() });
    },
  );
  app.get(
    "/api/com/reportes/oc-pendientes/pdf",
    { preHandler: authGuard(R_ENTREGAS) },
    async (_req, reply) => {
      const { buffer, filename } = await reportesPdf.ocPendientesRecibir();
      enviarPdf(reply, buffer, filename);
    },
  );

  app.get(
    "/api/com/reportes/desempeno-proveedores",
    { preHandler: authGuard(R_DESEMPENO) },
    async (req, reply) => {
      reply.send({
        data: await reportes.desempenoProveedores(fechaQuery(req, "desde"), fechaQuery(req, "hasta")),
      });
    },
  );
  app.get(
    "/api/com/reportes/desempeno-proveedores/pdf",
    { preHandler: authGuard(R_DESEMPENO) },
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
    { preHandler: authGuard(R_RIESGO) },
    async (_req, reply) => {
      reply.send({ data: await reportes.riesgoProveedores() });
    },
  );
  app.get(
    "/api/com/reportes/riesgo-proveedores/pdf",
    { preHandler: authGuard(R_RIESGO) },
    async (_req, reply) => {
      const { buffer, filename } = await reportesPdf.riesgoProveedores();
      enviarPdf(reply, buffer, filename);
    },
  );
}

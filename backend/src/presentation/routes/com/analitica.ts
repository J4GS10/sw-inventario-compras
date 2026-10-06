/**
 * Capa 4 - Presentacion / rutas / compras (analitica y trazabilidad).
 *
 *   GET  /api/com/comparativo/solicitud/:id            comparativo completo
 *   GET  /api/com/comparativo/solicitud/:id/criterios  criterios del director
 *   POST /api/com/comparativo/criterios                registrar criterio
 *   GET  /api/com/historial-precios                    historial por proveedor
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { ValidationError } from "../../../common/errors/AppError.js";
import { withTelemetry } from "../../../bll/support/decorators/withTelemetry.js";
import { ComparativoService } from "../../../bll/services/com/ComparativoService.js";
import { ComparativoPdfService } from "../../../bll/services/com/ComparativoPdfService.js";
import { DashboardService } from "../../../bll/services/com/DashboardService.js";
import { fileStorage } from "../../../common/storage/FileStorage.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { authGuard } from "../../middlewares/authGuard.js";
import { auditContextOf } from "../../middlewares/requestContext.js";

const comparativo = withTelemetry(new ComparativoService(), "ComparativoService");
const comparativoPdf = withTelemetry(new ComparativoPdfService(), "ComparativoPdfService");
const dashboard = withTelemetry(new DashboardService(), "DashboardService");

const READ = [Permisos.ANALISIS_VER];
const WRITE = [Permisos.COTIZACION_ADJUDICAR];

function idParam(request: FastifyRequest): number {
  const id = Number.parseInt((request.params as { id?: string }).id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("Parámetro 'id' inválido");
  }
  return id;
}

function intQuery(request: FastifyRequest, key: string): number | undefined {
  const raw = (request.query as Record<string, string | undefined>)[key];
  if (raw === undefined || raw === "") return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) ? n : undefined;
}

function strQuery(request: FastifyRequest, key: string): string | undefined {
  const raw = (request.query as Record<string, string | undefined>)[key];
  return raw === undefined || raw === "" ? undefined : raw;
}

export function registerComAnaliticaRoutes(app: FastifyInstance): void {
  app.get(
    "/api/com/comparativo/solicitud/:id",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      reply.send({ data: await comparativo.comparativoSolicitud(idParam(req)) });
    },
  );

  app.get(
    "/api/com/comparativo/solicitud/:id/sugerencia",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      reply.send({ data: await comparativo.sugerenciaAdjudicacion(idParam(req)) });
    },
  );

  app.get(
    "/api/com/comparativo/solicitud/:id/criterios",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      reply.send({ data: await comparativo.listarCriterios(idParam(req)) });
    },
  );

  app.post(
    "/api/com/comparativo/criterios",
    { preHandler: authGuard(WRITE) },
    async (req, reply) => {
      reply
        .status(201)
        .send({ data: await comparativo.registrarCriterio(req.body, auditContextOf(req)) });
    },
  );

  // PDF del comparativo: descarga directa.
  app.get(
    "/api/com/comparativo/solicitud/:id/pdf",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      const { buffer, filename } = await comparativoPdf.generar(idParam(req));
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    },
  );

  // PDF del comparativo: genera, almacena (S3 si esta configurado) y devuelve URL.
  app.post(
    "/api/com/comparativo/solicitud/:id/pdf",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      const { stored, filename } = await comparativoPdf.generarYAlmacenar(idParam(req));
      reply.status(201).send({ data: { ...stored, filename } });
    },
  );

  // Descarga de archivos guardados en el almacenamiento en memoria (fallback dev).
  app.get(
    "/api/files/:key",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      const key = decodeURIComponent((req.params as { key?: string }).key ?? "");
      const buf = await fileStorage().get(key);
      if (buf === null) {
        reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Archivo no disponible", details: [] },
        });
        return;
      }
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${key.split("/").pop() ?? "archivo.pdf"}"`)
        .send(buf);
    },
  );

  // Dashboard: series temporales (compras/mes, rotacion) + indice de ahorro.
  app.get(
    "/api/com/dashboard/resumen",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      reply.send({ data: await dashboard.resumen(intQuery(req, "meses")) });
    },
  );

  app.get(
    "/api/com/historial-precios",
    { preHandler: authGuard(READ) },
    async (req, reply) => {
      const result = await comparativo.historialProveedor({
        idProveedor: intQuery(req, "idProveedor"),
        idArticulo: intQuery(req, "idArticulo"),
        desde: strQuery(req, "desde"),
        hasta: strQuery(req, "hasta"),
        page: intQuery(req, "page") ?? 1,
        pageSize: intQuery(req, "pageSize") ?? 25,
      });
      reply.send(result);
    },
  );
}

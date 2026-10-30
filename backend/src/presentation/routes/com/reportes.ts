/**
 * Capa 4 - Presentacion / rutas / compras (reporteria).
 *
 * Cada reporte expone el JSON y su PDF con EXACTAMENTE los mismos filtros
 * (un solo parser por reporte): el PDF trae las filas que el usuario ve.
 *
 *   Filtros comunes:  desde, hasta (YYYY-MM-DD), idProveedor, idCategoria, q (texto)
 *   PDF ademas:       filtrosTexto (descripcion legible de los filtros, solo informativa)
 *
 *   GET /api/com/reportes/gasto-proveedor[/pdf]
 *   GET /api/com/reportes/oc-pendientes[/pdf]           + soloVencidas (desde/hasta = entrega esperada)
 *   GET /api/com/reportes/desempeno-proveedores[/pdf]
 *   GET /api/com/reportes/riesgo-proveedores[/pdf]      + nivel, minOrdenes, soloActivos
 *   GET /api/com/reportes/inventario-categoria[/pdf]
 *   GET /api/com/reportes/disponibilidad-articulos[/pdf] + accion
 *   GET /api/com/reportes/gasto-area[/pdf]              + idDepartamento (acotado al alcance del usuario)
 *   GET /api/com/reportes/auditoria-compras[/pdf]       + tipo, severidad
 *   GET /api/com/reportes/evaluacion-proveedores[/pdf]  + minOrdenes, prioridad, soloEnvioGratis,
 *        pDescuento, pEntrega, pCumplimiento, pCalidad, pEnvio (prioridad=personalizado),
 *        maxRechazo, minATiempo, maxDias
 *
 * Cada reporte exige SU permiso (COMPRAS_REPORTE_*), no el ANALISIS_VER general.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { withTelemetry } from "../../../bll/support/decorators/withTelemetry.js";
import {
  PRIORIDADES_EVALUACION,
  ReporteService,
  type AccionDisponibilidad,
  type EvaluacionProveedoresInput,
  type FiltroAuditoria,
  type FiltroDisponibilidad,
  type FiltroGastoArea,
  type FiltroPendientes,
  type FiltroReporte,
  type FiltroRiesgo,
  type NivelRiesgo,
  type PrioridadEvaluacion,
  type SeveridadHallazgo,
} from "../../../bll/services/com/ReporteService.js";
import { ValidationError } from "../../../common/errors/AppError.js";
import { ReportePdfService } from "../../../bll/services/com/ReportePdfService.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { authGuard } from "../../middlewares/authGuard.js";
import { auditContextOf } from "../../middlewares/requestContext.js";

const reportes = withTelemetry(new ReporteService(), "ReporteService");
const reportesPdf = withTelemetry(new ReportePdfService(), "ReportePdfService");

/** Un permiso por reporte: cada area ve solo los que le sirven para decidir. */
const R_EVALUACION = [Permisos.REPORTE_EVALUACION];
const R_GASTO = [Permisos.REPORTE_GASTO];
const R_ENTREGAS = [Permisos.REPORTE_ENTREGAS];
const R_DESEMPENO = [Permisos.REPORTE_DESEMPENO];
const R_RIESGO = [Permisos.REPORTE_RIESGO];
const R_INVENTARIO = [Permisos.REPORTE_INVENTARIO];
const R_DISPONIBILIDAD = [Permisos.REPORTE_DISPONIBILIDAD];
const R_GASTO_AREA = [Permisos.REPORTE_GASTO_AREA];
const R_AUDITORIA = [Permisos.REPORTE_AUDITORIA];

function textoQuery(request: FastifyRequest, key: string): string | undefined {
  const raw = (request.query as Record<string, string | undefined>)[key];
  return raw === undefined || raw === "" ? undefined : raw;
}

function enteroQuery(request: FastifyRequest, key: string): number | undefined {
  const raw = textoQuery(request, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`Parámetro '${key}' inválido`);
  return n;
}

/** Numero >= 0 (admite decimales): porcentajes, pesos, dias. */
function numeroQuery(request: FastifyRequest, key: string): number | undefined {
  const raw = textoQuery(request, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`Parámetro '${key}' inválido`);
  return n;
}

function boolQuery(request: FastifyRequest, key: string): boolean {
  const raw = textoQuery(request, key);
  return raw === "1" || raw === "true";
}

/** Valor de una lista cerrada, o error de validacion. */
function enumQuery<T extends string>(request: FastifyRequest, key: string, validos: readonly T[]): T | undefined {
  const raw = textoQuery(request, key);
  if (raw === undefined) return undefined;
  if (!(validos as readonly string[]).includes(raw)) {
    throw new ValidationError(`Parámetro '${key}' inválido: use ${validos.join(", ")}`);
  }
  return raw as T;
}

/** Texto libre acotado (evita consultas gigantes). */
function busquedaQuery(request: FastifyRequest): string | undefined {
  const q = textoQuery(request, "q")?.trim();
  if (q === undefined || q === "") return undefined;
  return q.slice(0, 100);
}

function filtroComun(request: FastifyRequest): FiltroReporte {
  const desde = textoQuery(request, "desde");
  const hasta = textoQuery(request, "hasta");
  const idProveedor = enteroQuery(request, "idProveedor");
  const idCategoria = enteroQuery(request, "idCategoria");
  const q = busquedaQuery(request);
  return {
    ...(desde !== undefined ? { desde } : {}),
    ...(hasta !== undefined ? { hasta } : {}),
    ...(idProveedor !== undefined ? { idProveedor } : {}),
    ...(idCategoria !== undefined ? { idCategoria } : {}),
    ...(q !== undefined ? { q } : {}),
  };
}

function filtroPendientes(request: FastifyRequest): FiltroPendientes {
  return { ...filtroComun(request), ...(boolQuery(request, "soloVencidas") ? { soloVencidas: true } : {}) };
}

function filtroRiesgo(request: FastifyRequest): FiltroRiesgo {
  const nivel = enumQuery<NivelRiesgo>(request, "nivel", ["bajo", "medio", "alto"]);
  const minOrdenes = enteroQuery(request, "minOrdenes");
  return {
    ...filtroComun(request),
    ...(nivel !== undefined ? { nivel } : {}),
    ...(minOrdenes !== undefined ? { minOrdenes } : {}),
    ...(boolQuery(request, "soloActivos") ? { soloActivos: true } : {}),
  };
}

function filtroDisponibilidad(request: FastifyRequest): FiltroDisponibilidad {
  const accion = enumQuery<AccionDisponibilidad>(request, "accion", ["PEDIR", "EN_CURSO", "EN_TRANSITO", "SUFICIENTE", "EXCEDIDO"]);
  return { ...filtroComun(request), ...(accion !== undefined ? { accion } : {}) };
}

function filtroGastoArea(request: FastifyRequest): FiltroGastoArea {
  const idDepartamento = enteroQuery(request, "idDepartamento");
  return { ...filtroComun(request), ...(idDepartamento !== undefined ? { idDepartamento } : {}) };
}

function filtroAuditoria(request: FastifyRequest): FiltroAuditoria {
  const tipo = enumQuery<NonNullable<FiltroAuditoria["tipo"]>>(request, "tipo", [
    "AUTOAPROBACION",
    "SIN_COMPETENCIA",
    "NO_MAS_BARATA",
    "SOBREPRECIO_HISTORICO",
    "RECHAZO_ALTO",
    "PROVEEDOR_RIESGO",
  ]);
  const severidad = enumQuery<SeveridadHallazgo>(request, "severidad", ["alta", "media", "baja"]);
  return {
    ...filtroComun(request),
    ...(tipo !== undefined ? { tipo } : {}),
    ...(severidad !== undefined ? { severidad } : {}),
  };
}

/** Filtros de la evaluacion de proveedores (mismos para el JSON y el PDF). */
function evaluacionQuery(request: FastifyRequest): EvaluacionProveedoresInput {
  const comun = filtroComun(request);
  const prioridad = enumQuery<PrioridadEvaluacion>(request, "prioridad", PRIORIDADES_EVALUACION);
  const minOrdenes = enteroQuery(request, "minOrdenes");
  const maxRechazoPct = numeroQuery(request, "maxRechazo");
  const minATiempoPct = numeroQuery(request, "minATiempo");
  const maxDiasEntrega = numeroQuery(request, "maxDias");
  const pesos =
    prioridad === "personalizado"
      ? {
          descuento: numeroQuery(request, "pDescuento") ?? 0,
          entrega: numeroQuery(request, "pEntrega") ?? 0,
          cumplimiento: numeroQuery(request, "pCumplimiento") ?? 0,
          calidad: numeroQuery(request, "pCalidad") ?? 0,
          envio: numeroQuery(request, "pEnvio") ?? 0,
        }
      : undefined;
  return {
    ...comun,
    ...(minOrdenes !== undefined ? { minOrdenes } : {}),
    ...(prioridad !== undefined ? { prioridad } : {}),
    ...(pesos !== undefined ? { pesos } : {}),
    ...(boolQuery(request, "soloEnvioGratis") ? { soloEnvioGratis: true } : {}),
    ...(maxRechazoPct !== undefined ? { maxRechazoPct } : {}),
    ...(minATiempoPct !== undefined ? { minATiempoPct } : {}),
    ...(maxDiasEntrega !== undefined ? { maxDiasEntrega } : {}),
  };
}

/** Descripcion legible de los filtros para el encabezado del PDF (acotada). */
function filtrosTexto(request: FastifyRequest): string | undefined {
  return textoQuery(request, "filtrosTexto")?.slice(0, 400);
}

function enviarPdf(reply: FastifyReply, out: { buffer: Buffer; filename: string }): void {
  reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="${out.filename}"`)
    .send(out.buffer);
}

/** Registra el par JSON + PDF de un reporte con el mismo permiso y el mismo parser de filtros. */
function reporte<F>(
  app: FastifyInstance,
  ruta: string,
  permiso: readonly string[],
  parse: (req: FastifyRequest) => F,
  json: (f: F, req: FastifyRequest) => Promise<unknown>,
  pdf: (f: F, req: FastifyRequest, descripcion: string | undefined) => Promise<{ buffer: Buffer; filename: string }>,
): void {
  app.get(`/api/com/reportes/${ruta}`, { preHandler: authGuard([...permiso]) }, async (req, reply) => {
    reply.send({ data: await json(parse(req), req) });
  });
  app.get(`/api/com/reportes/${ruta}/pdf`, { preHandler: authGuard([...permiso]) }, async (req, reply) => {
    enviarPdf(reply, await pdf(parse(req), req, filtrosTexto(req)));
  });
}

export function registerComReportesRoutes(app: FastifyInstance): void {
  reporte(app, "inventario-categoria", R_INVENTARIO, filtroComun,
    (f) => reportes.inventarioPorCategoria(f),
    (f, _r, t) => reportesPdf.inventarioPorCategoria(f, t));

  reporte(app, "evaluacion-proveedores", R_EVALUACION, evaluacionQuery,
    (f) => reportes.evaluacionProveedores(f),
    (f, _r, t) => reportesPdf.evaluacionProveedores(f, t));

  reporte(app, "gasto-proveedor", R_GASTO, filtroComun,
    (f) => reportes.gastoPorProveedor(f),
    (f, _r, t) => reportesPdf.gastoPorProveedor(f, t));

  reporte(app, "oc-pendientes", R_ENTREGAS, filtroPendientes,
    (f) => reportes.ocPendientesRecibir(f),
    (f, _r, t) => reportesPdf.ocPendientesRecibir(f, t));

  reporte(app, "desempeno-proveedores", R_DESEMPENO, filtroComun,
    (f) => reportes.desempenoProveedores(f),
    (f, _r, t) => reportesPdf.desempenoProveedores(f, t));

  reporte(app, "riesgo-proveedores", R_RIESGO, filtroRiesgo,
    (f) => reportes.riesgoProveedores(f),
    (f, _r, t) => reportesPdf.riesgoProveedores(f, t));

  reporte(app, "disponibilidad-articulos", R_DISPONIBILIDAD, filtroDisponibilidad,
    (f) => reportes.disponibilidadArticulos(f),
    (f, _r, t) => reportesPdf.disponibilidadArticulos(f, t));

  reporte(app, "gasto-area", R_GASTO_AREA, filtroGastoArea,
    (f, req) => reportes.gastoPorArea(f, auditContextOf(req)),
    (f, req, t) => reportesPdf.gastoPorArea(f, auditContextOf(req), t));

  reporte(app, "auditoria-compras", R_AUDITORIA, filtroAuditoria,
    (f) => reportes.auditoriaCompras(f),
    (f, _r, t) => reportesPdf.auditoriaCompras(f, t));
}

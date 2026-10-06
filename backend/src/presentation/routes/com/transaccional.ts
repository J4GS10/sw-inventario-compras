/**
 * Capa 4 - Presentacion / rutas / compras (flujo transaccional).
 * Endpoints de los documentos con logica de negocio especializada. Cada
 * servicio se envuelve con withTelemetry (Decorator) al montarse.
 */

import { delegacionService } from "../../../bll/services/com/DelegacionService.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ForbiddenError, TooManyRequestsError, ValidationError } from "../../../common/errors/AppError.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import type { PageQuery, Paginated } from "../../../common/types/Query.js";
import { withTelemetry } from "../../../bll/support/decorators/withTelemetry.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { SolicitudCompraService } from "../../../bll/services/com/SolicitudCompraService.js";
import { notificacionService } from "../../../bll/services/com/NotificacionService.js";
import { LiveHub, liveHub } from "../../../common/realtime/LiveHub.js";
import { RfqService } from "../../../bll/services/com/RfqService.js";
import { CotizacionService } from "../../../bll/services/com/CotizacionService.js";
import { OrdenCompraService } from "../../../bll/services/com/OrdenCompraService.js";
import { OrdenCompraPdfService } from "../../../bll/services/com/OrdenCompraPdfService.js";
import { RecepcionService } from "../../../bll/services/com/RecepcionService.js";
import { RecepcionPdfService } from "../../../bll/services/com/RecepcionPdfService.js";
import { DevolucionProveedorService } from "../../../bll/services/com/DevolucionProveedorService.js";
import { ReconciliacionService } from "../../../bll/services/com/ReconciliacionService.js";
import { authGuard, authGuardAny } from "../../middlewares/authGuard.js";
import { auditContextOf } from "../../middlewares/requestContext.js";
import { parseListQuery } from "../../support/parseListQuery.js";

const solicitudes = withTelemetry(new SolicitudCompraService(), "SolicitudCompraService");
const rfq = withTelemetry(new RfqService(), "RfqService");
const cotizaciones = withTelemetry(new CotizacionService(), "CotizacionService");
const ordenes = withTelemetry(new OrdenCompraService(), "OrdenCompraService");
const ordenesPdf = withTelemetry(new OrdenCompraPdfService(), "OrdenCompraPdfService");
const recepciones = withTelemetry(new RecepcionService(), "RecepcionService");
const recepcionesPdf = withTelemetry(new RecepcionPdfService(), "RecepcionPdfService");
const devoluciones = withTelemetry(
  new DevolucionProveedorService(),
  "DevolucionProveedorService",
);
const reconciliacion = withTelemetry(new ReconciliacionService(), "ReconciliacionService");

/** Cualquier permiso del flujo habilita la bandeja de notificaciones (se auto-filtra por rol). */
const READ_FLUJO = [
  Permisos.SOLICITUD_VER,
  Permisos.RFQ_GESTIONAR,
  Permisos.COTIZACION_GESTIONAR,
  Permisos.COTIZACION_ADJUDICAR,
  Permisos.OC_GESTIONAR,
  Permisos.RECEPCION_GESTIONAR,
  Permisos.DEVOLUCION_GESTIONAR,
  Permisos.ANALISIS_VER,
];

/**
 * LECTURA por documento: cada rol solo lista/abre los documentos que su trabajo
 * toca (segregacion de funciones). Principio estricto: quien no gestiona un
 * recurso, no lo ve — sin permisos de "solo trazabilidad" para supervision
 * (se probaron y se revirtieron a pedido explicito: si no puedes accionarlo,
 * no lo ves). `SOLICITUD_VER` es la unica excepcion, ampliamente compartida
 * porque todo el mundo necesita saber el estado de una solicitud para saber
 * si le toca actuar.
 *   solicitudes  -> solicitante/jefe/gerente/comprador/financiero/auditor (ven o aprueban)
 *   rfq          -> solo comprador (quien gestiona)
 *   cotizaciones -> comprador (gestiona) + financiero (adjudica)
 *   OC           -> comprador/financiero (gestion) — Bodega NO la lista: solo
 *                   elige una OC receptible dentro de su propio formulario de
 *                   Recepcion, via `GET /api/com/ref/oc/receptibles`
 *                   (gateado por RECEPCION_GESTIONAR, no por ver el documento)
 *   recepcion    -> solo bodega (quien gestiona)
 *   devolucion   -> solo bodega (quien gestiona)
 */
const READ_SOLICITUDES = [
  Permisos.SOLICITUD_VER,
  Permisos.SOLICITUD_CREAR,
  Permisos.SOLICITUD_APROBAR_JEFE,
  Permisos.SOLICITUD_APROBAR_GERENTE,
  // Comparativo/Dashboard/Historial navegan la lista de solicitudes para dar
  // contexto a la decision de compra; espejo en frontend/src/core/auth/permisos.ts.
  Permisos.ANALISIS_VER,
];
const READ_RFQ = [Permisos.RFQ_GESTIONAR];
const READ_COTIZACIONES = [Permisos.COTIZACION_GESTIONAR, Permisos.COTIZACION_ADJUDICAR];
const READ_OC = [Permisos.OC_GESTIONAR];
const READ_RECEPCIONES = [Permisos.RECEPCION_GESTIONAR];
const READ_DEVOLUCIONES = [Permisos.DEVOLUCION_GESTIONAR];

function idParam(request: FastifyRequest): number {
  const id = Number.parseInt((request.params as { id?: string }).id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("Parámetro 'id' inválido");
  }
  return id;
}

function listQuery(request: FastifyRequest): PageQuery {
  return parseListQuery(
    (request.query ?? {}) as Record<string, string | string[] | undefined>,
  );
}

function envelope<T>(page: Paginated<T>): { data: readonly T[]; meta: object } {
  return {
    data: page.data,
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    },
  };
}

/** Servicio con la forma minima de un recurso de documento con detalle. */
interface DocumentoService<TRow> {
  listar(query: PageQuery, ctx: AuditContext): Promise<Paginated<TRow>>;
  obtener(id: number, ctx: AuditContext): Promise<unknown>;
}

/** Monta GET lista + GET por id, comunes a todos los documentos.
 *  Se pasa el AuditContext para que el servicio pueda acotar la visibilidad
 *  por departamento/equipo (hoy lo usa SolicitudCompraService; el resto lo
 *  ignora). */
function registrarLecturas(
  app: FastifyInstance,
  base: string,
  service: DocumentoService<unknown>,
  readPerms: readonly string[],
): void {
  app.get(base, { preHandler: authGuardAny(readPerms) }, async (req, reply) => {
    reply.send(
      envelope(await service.listar(listQuery(req), auditContextOf(req))),
    );
  });
  app.get(`${base}/:id`, { preHandler: authGuardAny(readPerms) }, async (req, reply) => {
    reply.send({ data: await service.obtener(idParam(req), auditContextOf(req)) });
  });
}

export function registerComFlujoRoutes(app: FastifyInstance): void {
  // Sesion + (permiso propio de aprobar O delegacion vigente en la base). La autorizacion fina por nivel
  // (jefe/gerente) y el alcance los resuelve despues el servicio.
  const APROBAR = [
    authGuard([]),
    async (req: FastifyRequest): Promise<void> => {
      const propios = req.auth?.permisos ?? [];
      if (propios.includes("*") || propios.includes(Permisos.SOLICITUD_APROBAR_JEFE) || propios.includes(Permisos.SOLICITUD_APROBAR_GERENTE)) return;
      const delegados = await delegacionService.permisosDeAprobacionDelegados(req.auth?.empleadoId);
      if (delegados.length === 0) {
        throw new ForbiddenError(
          `Requiere uno de: ${Permisos.SOLICITUD_APROBAR_JEFE}, ${Permisos.SOLICITUD_APROBAR_GERENTE}`,
        );
      }
    },
  ];

  // ---- Delegacion temporal de aprobaciones ----------------------------
  app.get("/api/com/delegaciones", { preHandler: authGuard([]) }, async (req, reply) => {
    reply.send({ data: await delegacionService.listar(auditContextOf(req)) });
  });
  app.post("/api/com/delegaciones", { preHandler: authGuard([]) }, async (req, reply) => {
    reply.status(201).send({ data: await delegacionService.crear(req.body, auditContextOf(req)) });
  });
  app.delete("/api/com/delegaciones/:id", { preHandler: authGuard([]) }, async (req, reply) => {
    await delegacionService.revocar(idParam(req), auditContextOf(req));
    reply.status(204).send();
  });

  // ---- Bandeja de pendientes (notificaciones derivadas del estado) -----
  app.get(
    "/api/com/notificaciones",
    { preHandler: authGuardAny(READ_FLUJO) },
    async (req, reply) => {
      reply.send({ data: await notificacionService.pendientes(auditContextOf(req)) });
    },
  );

  // Respuestas (aprobada/rechazada) a las solicitudes del propio usuario, ultimos 14 dias.
  app.get(
    "/api/com/notificaciones/decisiones",
    { preHandler: authGuardAny(READ_FLUJO) },
    async (req, reply) => {
      reply.send({ data: await notificacionService.decisionesRecibidas(auditContextOf(req)) });
    },
  );

  // Canal EN VIVO (Server-Sent Events): el servidor empuja "decision" y "bandeja".
  // Se usa fetch con cabecera Authorization (EventSource no puede enviarla).
  app.get(
    "/api/com/notificaciones/stream",
    { preHandler: authGuardAny(READ_FLUJO) },
    async (req, reply) => {
      const userId = auditContextOf(req).userId;
      // Tope por usuario: antes de hijack, para poder responder 429 normal.
      const conns = liveHub().connectionsOf(userId);
      if (conns >= LiveHub.MAX_POR_USUARIO) {
        throw new TooManyRequestsError("Demasiadas conexiones en vivo abiertas. Cierra otras pestañas.", 30);
      }
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // nginx: sin buffer, o el aviso llega minutos tarde
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      });
      raw.write("retry: 3000\n\n");
      raw.write(`event: ready\ndata: {"userId":${userId}}\n\n`);
      const off = liveHub().register(userId, (m) => {
        raw.write(`id: ${m.id}\nevent: ${m.event}\ndata: ${JSON.stringify(m.data)}\n\n`);
      });
      if (off === null) {
        raw.end();
        return;
      }
      // Latido: mantiene viva la conexion a traves de proxies y detecta clientes caidos.
      const latido = setInterval(() => raw.write(": latido\n\n"), 25_000);
      const cerrar = (): void => {
        clearInterval(latido);
        off();
      };
      raw.on("close", cerrar);
      raw.on("error", cerrar);
    },
  );

  // ---- Solicitudes de compra ------------------------------------------
  registrarLecturas(app, "/api/com/solicitudes", solicitudes, READ_SOLICITUDES);
  app.get(
    "/api/com/solicitudes/:id/trazabilidad",
    { preHandler: authGuardAny(READ_SOLICITUDES) },
    async (req, reply) => {
      reply.send({ data: await solicitudes.trazabilidad(idParam(req), auditContextOf(req)) });
    },
  );
  app.get(
    "/api/com/solicitudes/:id/pdf",
    { preHandler: authGuardAny(READ_SOLICITUDES) },
    async (req, reply) => {
      const { buffer, filename } = await solicitudes.pdf(idParam(req), auditContextOf(req));
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    },
  );
  app.post(
    "/api/com/solicitudes",
    { preHandler: authGuard([Permisos.SOLICITUD_CREAR]) },
    async (req, reply) => {
      reply.status(201).send({ data: await solicitudes.crear(req.body, auditContextOf(req)) });
    },
  );
  app.put(
    "/api/com/solicitudes/:id",
    { preHandler: authGuard([Permisos.SOLICITUD_CREAR]) },
    async (req, reply) => {
      reply.send({
        data: await solicitudes.actualizar(idParam(req), req.body, auditContextOf(req)),
      });
    },
  );
  app.delete(
    "/api/com/solicitudes/:id",
    { preHandler: authGuard([Permisos.SOLICITUD_CREAR]) },
    async (req, reply) => {
      await solicitudes.eliminar(idParam(req), auditContextOf(req));
      reply.status(204).send();
    },
  );
  app.post("/api/com/solicitudes/:id/aprobar", { preHandler: APROBAR }, async (req, reply) => {
    reply.send({ data: await solicitudes.aprobar(idParam(req), req.body, auditContextOf(req)) });
  });
  app.post("/api/com/solicitudes/:id/rechazar", { preHandler: APROBAR }, async (req, reply) => {
    reply.send({ data: await solicitudes.rechazar(idParam(req), req.body, auditContextOf(req)) });
  });

  // ---- RFQ ----------------------------------------------------------
  const RFQ = authGuard([Permisos.RFQ_GESTIONAR]);
  registrarLecturas(app, "/api/com/rfq", rfq, READ_RFQ);
  app.post("/api/com/rfq", { preHandler: RFQ }, async (req, reply) => {
    reply.status(201).send({ data: await rfq.crear(req.body, auditContextOf(req)) });
  });
  app.put("/api/com/rfq/:id", { preHandler: RFQ }, async (req, reply) => {
    reply.send({ data: await rfq.actualizar(idParam(req), req.body, auditContextOf(req)) });
  });
  app.delete("/api/com/rfq/:id", { preHandler: RFQ }, async (req, reply) => {
    await rfq.eliminar(idParam(req), auditContextOf(req));
    reply.status(204).send();
  });
  app.post("/api/com/rfq/:id/invitar", { preHandler: RFQ }, async (req, reply) => {
    reply.status(201).send({ data: await rfq.invitar(idParam(req), req.body, auditContextOf(req)) });
  });
  app.post("/api/com/rfq/:id/cerrar", { preHandler: RFQ }, async (req, reply) => {
    reply.send({ data: await rfq.cerrar(idParam(req), auditContextOf(req)) });
  });
  app.post("/api/com/rfq/:id/cancelar", { preHandler: RFQ }, async (req, reply) => {
    reply.send({ data: await rfq.cancelar(idParam(req), auditContextOf(req)) });
  });

  // ---- Cotizaciones ----------------------------------------------
  const COTIZAR = authGuard([Permisos.COTIZACION_GESTIONAR]);
  registrarLecturas(app, "/api/com/cotizaciones", cotizaciones, READ_COTIZACIONES);
  app.post("/api/com/cotizaciones", { preHandler: COTIZAR }, async (req, reply) => {
    reply.status(201).send({ data: await cotizaciones.registrar(req.body, auditContextOf(req)) });
  });
  app.put("/api/com/cotizaciones/:id", { preHandler: COTIZAR }, async (req, reply) => {
    reply.send({ data: await cotizaciones.actualizar(idParam(req), req.body, auditContextOf(req)) });
  });
  app.delete("/api/com/cotizaciones/:id", { preHandler: COTIZAR }, async (req, reply) => {
    await cotizaciones.eliminar(idParam(req), auditContextOf(req));
    reply.status(204).send();
  });
  app.post(
    "/api/com/cotizaciones/detalle/:id/adjudicar",
    { preHandler: authGuard([Permisos.COTIZACION_ADJUDICAR]) },
    async (req, reply) => {
      reply.send({ data: await cotizaciones.adjudicar(idParam(req), auditContextOf(req)) });
    },
  );

  // ---- Ordenes de compra ------------------------------------
  const OC = authGuard([Permisos.OC_GESTIONAR]);
  registrarLecturas(app, "/api/com/ordenes-compra", ordenes, READ_OC);
  app.post("/api/com/ordenes-compra", { preHandler: OC }, async (req, reply) => {
    reply.status(201).send({ data: await ordenes.crear(req.body, auditContextOf(req)) });
  });
  app.put("/api/com/ordenes-compra/:id", { preHandler: OC }, async (req, reply) => {
    reply.send({ data: await ordenes.actualizar(idParam(req), req.body, auditContextOf(req)) });
  });
  app.delete("/api/com/ordenes-compra/:id", { preHandler: OC }, async (req, reply) => {
    await ordenes.eliminar(idParam(req), auditContextOf(req));
    reply.status(204).send();
  });
  app.post("/api/com/ordenes-compra/:id/estado", { preHandler: OC }, async (req, reply) => {
    reply.send({
      data: await ordenes.cambiarEstado(idParam(req), req.body, auditContextOf(req)),
    });
  });
  // Vista previa en pantalla (mismos datos resueltos que el PDF, en JSON) —
  // documento oficial para revisar antes de emitir/enviar al proveedor.
  app.get(
    "/api/com/ordenes-compra/:id/vista-previa",
    { preHandler: authGuard(READ_OC) },
    async (req, reply) => {
      reply.send({ data: await ordenesPdf.datosParaVistaPrevia(idParam(req)) });
    },
  );

  // PDF de la orden de compra: descarga directa.
  app.get(
    "/api/com/ordenes-compra/:id/pdf",
    { preHandler: authGuard(READ_OC) },
    async (req, reply) => {
      const { buffer, filename } = await ordenesPdf.generar(idParam(req));
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    },
  );
  // PDF de la orden de compra: genera, almacena (S3 si esta configurado) y devuelve URL.
  app.post(
    "/api/com/ordenes-compra/:id/pdf",
    { preHandler: authGuard(READ_OC) },
    async (req, reply) => {
      const { stored, filename } = await ordenesPdf.generarYAlmacenar(idParam(req));
      reply.status(201).send({ data: { ...stored, filename } });
    },
  );

  // ---- Recepciones ---------------------------------------------
  const RECIBIR = authGuard([Permisos.RECEPCION_GESTIONAR]);
  registrarLecturas(app, "/api/com/recepciones", recepciones, READ_RECEPCIONES);
  app.post("/api/com/recepciones", { preHandler: RECIBIR }, async (req, reply) => {
    reply.status(201).send({ data: await recepciones.registrar(req.body, auditContextOf(req)) });
  });
  app.delete("/api/com/recepciones/:id", { preHandler: RECIBIR }, async (req, reply) => {
    await recepciones.eliminar(idParam(req), auditContextOf(req));
    reply.status(204).send();
  });
  app.post("/api/com/recepciones/:id/reversar", { preHandler: RECIBIR }, async (req, reply) => {
    reply.send({ data: await recepciones.reversar(idParam(req), auditContextOf(req)) });
  });
  // Nota de ingreso oficial: descarga directa, disponible desde el listado
  // una vez registrado el conteo fisico.
  app.get(
    "/api/com/recepciones/:id/pdf",
    { preHandler: authGuard(READ_RECEPCIONES) },
    async (req, reply) => {
      const { buffer, filename } = await recepcionesPdf.generar(idParam(req));
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    },
  );

  // ---- Reconciliacion (deteccion/reparacion de INV_/CXP_ desincronizados) --
  const RECONCILIAR = authGuard([Permisos.OC_GESTIONAR]);
  app.get(
    "/api/com/recepciones/:id/consistencia",
    { preHandler: RECONCILIAR },
    async (req, reply) => {
      reply.send({ data: await reconciliacion.consistencia(idParam(req)) });
    },
  );
  app.post(
    "/api/com/recepciones/:id/reprocesar",
    { preHandler: RECONCILIAR },
    async (req, reply) => {
      reply.send({ data: await reconciliacion.reprocesar(idParam(req), auditContextOf(req)) });
    },
  );

  // ---- Devoluciones ----------------------------------------
  const DEVOLVER = authGuard([Permisos.DEVOLUCION_GESTIONAR]);
  registrarLecturas(app, "/api/com/devoluciones", devoluciones, READ_DEVOLUCIONES);
  app.post("/api/com/devoluciones", { preHandler: DEVOLVER }, async (req, reply) => {
    reply.status(201).send({ data: await devoluciones.registrar(req.body, auditContextOf(req)) });
  });
  app.delete("/api/com/devoluciones/:id", { preHandler: DEVOLVER }, async (req, reply) => {
    await devoluciones.eliminar(idParam(req), auditContextOf(req));
    reply.status(204).send();
  });
}

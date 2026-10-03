/**
 * Capa 4 - Presentacion / rutas / compras (adjuntos de documentos).
 *
 * Para cada documento del ciclo con soporte de adjuntos:
 *   GET    {base}/:id/adjuntos          lista (metadatos del manifiesto)
 *   POST   {base}/:id/adjuntos          sube un archivo (multipart, campo "file")
 *   GET    {base}/:id/adjuntos/:ref     descarga el binario
 *   DELETE {base}/:id/adjuntos/:ref     elimina el adjunto
 *
 * Lectura: cualquier permiso del flujo. Escritura: el permiso de gestion del
 * documento correspondiente.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { ValidationError } from "../../../common/errors/AppError.js";
import { withTelemetry } from "../../../bll/support/decorators/withTelemetry.js";
import {
  AdjuntoService,
  type TipoDocumentoAdjunto,
} from "../../../bll/services/com/AdjuntoService.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { authGuard, authGuardAny } from "../../middlewares/authGuard.js";
import { auditContextOf } from "../../middlewares/requestContext.js";

const adjuntos = withTelemetry(new AdjuntoService(), "AdjuntoService");

interface DocDef {
  readonly base: string;
  readonly tipo: TipoDocumentoAdjunto;
  readonly write: string;
  /** Quien puede LISTAR/DESCARGAR adjuntos = quien puede leer ese documento. */
  readonly read: readonly string[];
}

// Espeja las listas de lectura por documento de routes/com/transaccional.ts.
const R_SOLICITUD = [
  Permisos.SOLICITUD_VER,
  Permisos.SOLICITUD_CREAR,
  Permisos.SOLICITUD_APROBAR_JEFE,
  Permisos.SOLICITUD_APROBAR_GERENTE,
];
const R_COTIZACION = [
  Permisos.COTIZACION_GESTIONAR,
  Permisos.COTIZACION_ADJUDICAR,
  Permisos.OC_GESTIONAR,
];
const R_OC = [Permisos.OC_GESTIONAR, Permisos.COTIZACION_ADJUDICAR, Permisos.RECEPCION_GESTIONAR];
const R_RECEPCION = [
  Permisos.RECEPCION_GESTIONAR,
  Permisos.DEVOLUCION_GESTIONAR,
  Permisos.OC_GESTIONAR,
];
const R_DEVOLUCION = [
  Permisos.DEVOLUCION_GESTIONAR,
  Permisos.RECEPCION_GESTIONAR,
  Permisos.OC_GESTIONAR,
];

const DOCS: readonly DocDef[] = [
  { base: "/api/com/solicitudes", tipo: "solicitud", write: Permisos.SOLICITUD_CREAR, read: R_SOLICITUD },
  { base: "/api/com/cotizaciones", tipo: "cotizacion", write: Permisos.COTIZACION_GESTIONAR, read: R_COTIZACION },
  { base: "/api/com/ordenes-compra", tipo: "orden", write: Permisos.OC_GESTIONAR, read: R_OC },
  { base: "/api/com/recepciones", tipo: "recepcion", write: Permisos.RECEPCION_GESTIONAR, read: R_RECEPCION },
  { base: "/api/com/devoluciones", tipo: "devolucion", write: Permisos.DEVOLUCION_GESTIONAR, read: R_DEVOLUCION },
];

function idParam(req: FastifyRequest): number {
  const id = Number.parseInt((req.params as { id?: string }).id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError("Parametro 'id' invalido");
  return id;
}

function refParam(req: FastifyRequest): string {
  return decodeURIComponent((req.params as { ref?: string }).ref ?? "");
}

export function registerComAdjuntoRoutes(app: FastifyInstance): void {
  for (const doc of DOCS) {
    app.get(
      `${doc.base}/:id/adjuntos`,
      { preHandler: authGuardAny(doc.read) },
      async (req, reply) => {
        reply.send({ data: await adjuntos.listar(doc.tipo, idParam(req)) });
      },
    );

    app.post(
      `${doc.base}/:id/adjuntos`,
      { preHandler: authGuard([doc.write]) },
      async (req, reply) => {
        if (typeof req.file !== "function") {
          throw new ValidationError("La peticion debe ser multipart/form-data");
        }
        const part = await req.file();
        if (part === undefined) {
          throw new ValidationError("Falta el archivo (campo 'file')");
        }
        let buffer: Buffer;
        try {
          buffer = await part.toBuffer();
        } catch {
          throw new ValidationError("El archivo supera el tamano maximo permitido");
        }
        const meta = await adjuntos.subir(
          doc.tipo,
          idParam(req),
          { nombre: part.filename, mime: part.mimetype, buffer },
          auditContextOf(req),
        );
        reply.status(201).send({ data: meta });
      },
    );

    app.get(
      `${doc.base}/:id/adjuntos/:ref`,
      { preHandler: authGuardAny(doc.read) },
      async (req, reply) => {
        const { nombre, mime, buffer } = await adjuntos.descargar(
          doc.tipo,
          idParam(req),
          refParam(req),
        );
        // ?disposition=inline permite la vista previa embebida (iframe/img);
        // por defecto se fuerza la descarga.
        const inline =
          (req.query as { disposition?: string }).disposition === "inline";
        reply
          .header("Content-Type", mime)
          .header(
            "Content-Disposition",
            `${inline ? "inline" : "attachment"}; filename="${nombre}"`,
          )
          .send(buffer);
      },
    );

    app.delete(
      `${doc.base}/:id/adjuntos/:ref`,
      { preHandler: authGuard([doc.write]) },
      async (req, reply) => {
        await adjuntos.eliminar(doc.tipo, idParam(req), refParam(req));
        reply.status(204).send();
      },
    );
  }
}

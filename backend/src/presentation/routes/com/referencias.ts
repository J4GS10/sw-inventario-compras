/**
 * Capa 4 - Presentacion / rutas / compras.
 * Endpoints de SOLO LECTURA de datos maestros de otros modulos, para poblar los
 * selects de los formularios de captura del modulo de Compras (empleados,
 * sucursales, articulos, unidades de medida, bodegas, departamentos).
 * Se retiran cuando esos modulos expongan sus propias APIs.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  INV_ARTICULO,
  INV_BODEGA,
  INV_CATEGORIA,
  INV_UNIDAD_MEDIDA,
  NOM_DEPARTAMENTO,
  NOM_EMPLEADO,
  NOM_SUCURSAL,
} from "../../../entities/shared/descriptors.js";
import type { EntityDescriptor } from "../../../entities/support/EntityDescriptor.js";
import { CrudRepository } from "../../../dal/repositories/CrudRepository.js";
import { CompraReadRepository } from "../../../dal/repositories/com/CompraReadRepository.js";
import { ValidationError } from "../../../common/errors/AppError.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { authGuard } from "../../middlewares/authGuard.js";
import { parseListQuery } from "../../support/parseListQuery.js";

const read = new CompraReadRepository();

function intParam(req: FastifyRequest, key = "id"): number {
  const n = Number.parseInt((req.params as Record<string, string>)[key] ?? "", 10);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`Parametro '${key}' invalido`);
  return n;
}

function readOnlyList(
  app: FastifyInstance,
  path: string,
  descriptor: EntityDescriptor,
): void {
  const repo = new CrudRepository(descriptor);
  app.get(path, { preHandler: authGuard([]) }, async (req, reply) => {
    const query = parseListQuery(
      (req.query ?? {}) as Record<string, string | string[] | undefined>,
    );
    const page = await repo.findAll(query);
    reply.send({
      data: page.data,
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    });
  });
}

export function registerComReferenciaRoutes(app: FastifyInstance): void {
  readOnlyList(app, "/api/com/ref/empleados", NOM_EMPLEADO);
  readOnlyList(app, "/api/com/ref/sucursales", NOM_SUCURSAL);
  readOnlyList(app, "/api/com/ref/departamentos", NOM_DEPARTAMENTO);
  readOnlyList(app, "/api/com/ref/articulos", INV_ARTICULO);
  readOnlyList(app, "/api/com/ref/unidades-medida", INV_UNIDAD_MEDIDA);
  readOnlyList(app, "/api/com/ref/bodegas", INV_BODEGA);
  // Familias de articulos (martillos, taladros, ...) — filtro del catalogo de
  // Articulos y select del formulario; no es COM_CATEGORIA_COMPRA (esa es la
  // categoria de GASTO para aprobacion, no la familia fisica del producto).
  readOnlyList(app, "/api/com/ref/categorias-articulo", INV_CATEGORIA);

  // Articulos bajo su stock minimo (INV_ALERTA_ESCASEZ, mantenida por
  // escasezSubscriber) con cantidad sugerida de reposicion ya calculada —
  // alimenta la sugerencia de Solicitud de compra en la pantalla de
  // Solicitudes. Gateado igual que la propia accion de crear la solicitud.
  app.get(
    "/api/com/ref/articulos/bajo-minimo",
    { preHandler: authGuard([Permisos.SOLICITUD_CREAR]) },
    async (_req, reply) => {
      reply.send({ data: await read.alertasEscasezPendientes() });
    },
  );

  // RFQ seleccionables al registrar una cotizacion suelta — con la
  // justificacion de la solicitud, no solo el numero de RFQ.
  app.get(
    "/api/com/ref/rfq/seleccionables",
    { preHandler: authGuard([]) },
    async (_req, reply) => {
      reply.send({ data: await read.rfqSeleccionables() });
    },
  );

  // Selects dependientes del ciclo de compra.
  app.get(
    "/api/com/ref/rfq/:id/lineas-solicitud",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      reply.send({ data: await read.lineasSolicitudDeRfq(intParam(req)) });
    },
  );
  app.get(
    "/api/com/ref/rfq/:id/proveedores",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      reply.send({ data: await read.proveedoresDeRfq(intParam(req)) });
    },
  );
  // Proveedores para invitar al RFQ, con los habituales (ya suministraron
  // algo de esta solicitud) primero — autorrelleno del paso de invitacion.
  app.get(
    "/api/com/ref/solicitud/:id/proveedores-sugeridos",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      reply.send({ data: await read.proveedoresSugeridos(intParam(req)) });
    },
  );
  // Renglones de una OC con cantidad pendiente > 0 (para el selector de la
  // Recepcion: evita elegir un renglon ya completo, y evita el intento de
  // sobre-recibir que el backend igual rechazaria).
  app.get(
    "/api/com/ref/oc/:id/lineas-pendientes",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      const lineas = await read.lineasPendientesOc(intParam(req));
      reply.send({ data: lineas.filter((l) => l.cantidadPendiente > 0) });
    },
  );

  // OC que todavia admiten una recepcion — referencia acotada para el
  // selector del formulario de Recepcion. Bodega no tiene OC_GESTIONAR (no
  // puede listar el documento completo), pero si puede elegir una OC para
  // recibir contra ella: se gatea por RECEPCION_GESTIONAR, no por ver OC.
  app.get(
    "/api/com/ref/oc/receptibles",
    { preHandler: authGuard([Permisos.RECEPCION_GESTIONAR]) },
    async (_req, reply) => {
      reply.send({ data: await read.ordenesReceptibles() });
    },
  );

  // Que RFQ admiten Eliminar ahora mismo (ABIERTO y sin cotizaciones
  // registradas) — un RFQ ABIERTO con cotizaciones ya registradas igual se
  // rechaza con 409.
  app.get(
    "/api/com/ref/rfq-eliminable",
    { preHandler: authGuard([]) },
    async (_req, reply) => {
      reply.send({ data: await read.rfqEliminable() });
    },
  );

  // Que cotizaciones admiten Editar/Eliminar ahora mismo (RFQ ABIERTO y sin
  // linea adjudicada) — evita ofrecer esas acciones cuando el backend las
  // va a rechazar con 409.
  app.get(
    "/api/com/ref/cotizaciones-editables",
    { preHandler: authGuard([]) },
    async (_req, reply) => {
      reply.send({ data: await read.cotizacionesEditables() });
    },
  );

  // Responsable del siguiente paso de cada solicitud (jefe/gerente/Compras) —
  // para que el solicitante sepa a quien pedirle que continue.
  app.get(
    "/api/com/ref/solicitudes/responsables",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      const raw = (req.query as Record<string, string>)["ids"] ?? "";
      const ids = raw
        .split(",")
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n > 0);
      reply.send({ data: await read.responsablesDeSolicitudes(ids) });
    },
  );

  // "Familias de productos" por proveedor (derivado, ver CompraReadRepository
  // para las 3 fuentes reales que se cruzan; no hay columna/tabla nueva).
  app.get(
    "/api/com/ref/proveedores/familias",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      const raw = (req.query as Record<string, string>)["ids"] ?? "";
      const ids = raw
        .split(",")
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n > 0);
      reply.send({ data: await read.familiasPorProveedor(ids) });
    },
  );

  app.get(
    "/api/com/ref/cotizaciones-adjudicadas",
    { preHandler: authGuard([]) },
    async (req, reply) => {
      const idSolicitud = Number.parseInt(
        (req.query as Record<string, string>)["idSolicitud"] ?? "",
        10,
      );
      if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        throw new ValidationError("Parametro 'idSolicitud' requerido");
      }
      reply.send({ data: await read.cotizacionesAdjudicadas(idSolicitud) });
    },
  );
}

/**
 * Capa 4 - Presentacion / rutas.
 * Factory que registra en Fastify las 5 rutas REST de un recurso CRUD en una
 * sola llamada. Reutilizado por cada entidad del modulo (14+ catalogos).
 *
 *   GET    {basePath}         -> list  (paginado + filtro + orden)
 *   GET    {basePath}/:id     -> get
 *   POST   {basePath}         -> create
 *   PUT    {basePath}/:id     -> update (If-Match o body.version para OCC)
 *   DELETE {basePath}/:id     -> remove (soft delete)
 */

import type { FastifyInstance } from "fastify";
import {
  BaseCrudController,
  type CrudService,
} from "../controllers/BaseCrudController.js";
import { authGuard } from "../middlewares/authGuard.js";

export interface CrudRouteConfig<TEntity> {
  readonly basePath: string;
  readonly service: CrudService<TEntity>;
  /** Permisos: [read, write]. write cubre POST/PUT/DELETE. */
  readonly permissions?: { readonly read?: readonly string[]; readonly write?: readonly string[] };
}

function registerReads<TEntity>(
  app: FastifyInstance,
  basePath: string,
  controller: BaseCrudController<TEntity>,
  read: readonly string[],
): void {
  app.get(basePath, { preHandler: authGuard(read) }, controller.list);
  app.get(`${basePath}/:id`, { preHandler: authGuard(read) }, controller.get);
}

export function registerCrudRoutes<TEntity>(
  app: FastifyInstance,
  config: CrudRouteConfig<TEntity>,
): void {
  const controller = new BaseCrudController<TEntity>(config.service);
  const write = config.permissions?.write ?? [];

  registerReads(app, config.basePath, controller, config.permissions?.read ?? []);
  app.post(config.basePath, { preHandler: authGuard(write) }, controller.create);
  app.put(
    `${config.basePath}/:id`,
    { preHandler: authGuard(write) },
    controller.update,
  );
  app.delete(
    `${config.basePath}/:id`,
    { preHandler: authGuard(write) },
    controller.remove,
  );
}

/**
 * Igual que `registerCrudRoutes` pero SIN escritura: no registra
 * `POST`/`PUT`/`DELETE` en absoluto (404, no 403 — la ruta no existe). Para
 * recursos que solo deben llenarse por transacciones de negocio, nunca por
 * CRUD generico (p. ej. tablas de auditoria del propio flujo).
 */
export function registerReadOnlyCrudRoutes<TEntity>(
  app: FastifyInstance,
  config: { readonly basePath: string; readonly service: CrudService<TEntity>; readonly read: readonly string[] },
): void {
  const controller = new BaseCrudController<TEntity>(config.service);
  registerReads(app, config.basePath, controller, config.read);
}

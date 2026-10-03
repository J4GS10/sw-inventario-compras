/**
 * Capa 4 - Presentacion / controladores.
 * Controlador CRUD generico. Traduce HTTP <-> servicio y produce el sobre
 * uniforme de respuesta. No contiene reglas de negocio ni SQL.
 *
 *   { data: <recurso> }                       para get/create/update
 *   { data: [...], meta: { page, ... } }      para list
 *   204 sin cuerpo                            para delete
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { ValidationError } from "../../common/errors/AppError.js";
import type { AuditContext } from "../../common/types/AuditContext.js";
import type { PageQuery, Paginated } from "../../common/types/Query.js";
import { auditContextOf } from "../middlewares/requestContext.js";
import { parseListQuery } from "../support/parseListQuery.js";

export interface CrudService<TEntity> {
  list(query: PageQuery): Promise<Paginated<TEntity>>;
  getById(id: number): Promise<TEntity>;
  create(body: unknown, ctx: AuditContext): Promise<TEntity>;
  update(
    id: number,
    body: unknown,
    expectedVersion: number | null,
    ctx: AuditContext,
  ): Promise<TEntity>;
  remove(id: number, ctx: AuditContext): Promise<void>;
}

function parseId(raw: string | undefined): number {
  const id = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("Parametro de ruta 'id' invalido");
  }
  return id;
}

function extractVersion(request: FastifyRequest): number | null {
  const ifMatch = request.headers["if-match"];
  if (typeof ifMatch === "string" && ifMatch.trim() !== "") {
    const parsed = Number.parseInt(ifMatch.replace(/"/g, "").trim(), 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  const body = request.body;
  if (body !== null && typeof body === "object" && "version" in body) {
    const v = (body as { version?: unknown }).version;
    if (typeof v === "number" && Number.isInteger(v)) return v;
  }
  return null;
}

export class BaseCrudController<TEntity> {
  constructor(protected readonly service: CrudService<TEntity>) {}

  public list = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const query = parseListQuery(
      (request.query ?? {}) as Record<string, string | string[] | undefined>,
    );
    const result = await this.service.list(query);
    reply.send({
      data: result.data,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  };

  public get = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId((request.params as { id?: string }).id);
    const entity = await this.service.getById(id);
    reply.send({ data: entity });
  };

  public create = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const ctx = auditContextOf(request);
    const entity = await this.service.create(request.body, ctx);
    reply.status(201).send({ data: entity });
  };

  public update = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId((request.params as { id?: string }).id);
    const ctx = auditContextOf(request);
    const version = extractVersion(request);
    const entity = await this.service.update(id, request.body, version, ctx);
    reply.send({ data: entity });
  };

  public remove = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId((request.params as { id?: string }).id);
    const ctx = auditContextOf(request);
    await this.service.remove(id, ctx);
    reply.status(204).send();
  };
}

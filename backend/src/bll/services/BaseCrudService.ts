/**
 * Capa 3 - Logica de Negocio.
 * Servicio CRUD generico. Patron Template Method: fija el flujo
 *   validar -> beforeX (hook) -> repositorio -> afterX (hook)
 * y deja que las subclases inserten reglas de negocio sin reescribir el CRUD.
 *
 * Validacion:
 *  - Por defecto valida el cuerpo contra el EntityDescriptor (config, cero DTO).
 *  - Si se pasan clases DTO (generadas con class-validator) se usan esas para
 *    reglas mas ricas.
 *
 * Agnostico de HTTP y de SQL (no importa `oracledb` ni toca req/res).
 */

import type { AuditContext } from "../../common/types/AuditContext.js";
import type {
  FilterCondition,
  PageQuery,
  Paginated,
} from "../../common/types/Query.js";
import { NotFoundError, ValidationError } from "../../common/errors/AppError.js";
import { validateDto } from "../../common/validation/validators.js";
import { validateAgainstDescriptor } from "../../common/validation/descriptorValidation.js";
import type { EntityDescriptor } from "../../entities/support/EntityDescriptor.js";
import type { IRepository } from "../../dal/contracts/IRepository.js";

export interface CrudServiceOptions {
  readonly descriptor: EntityDescriptor;
  /** Clases DTO opcionales (class-validator). Si faltan -> validacion por descriptor. */
  readonly createDto?: new () => object;
  readonly updateDto?: new () => object;
}

export class BaseCrudService<TEntity> {
  protected readonly repo: IRepository<TEntity, object, object>;

  protected readonly descriptor: EntityDescriptor;

  protected readonly createDtoClass?: new () => object;

  protected readonly updateDtoClass?: new () => object;

  constructor(
    repo: IRepository<TEntity, object, object>,
    options: CrudServiceOptions,
  ) {
    this.repo = repo;
    this.descriptor = options.descriptor;
    if (options.createDto !== undefined) this.createDtoClass = options.createDto;
    if (options.updateDto !== undefined) this.updateDtoClass = options.updateDto;
  }

  public get entityName(): string {
    return this.descriptor.table;
  }

  public async list(query: PageQuery): Promise<Paginated<TEntity>> {
    return this.repo.findAll(query);
  }

  public async getById(id: number): Promise<TEntity> {
    const found = await this.repo.findById(id);
    if (found === null) throw new NotFoundError(this.entityName, id);
    return found;
  }

  public async create(body: unknown, ctx: AuditContext): Promise<TEntity> {
    const dto = await this.validateBody(body, "create");
    await this.beforeCreate(dto, ctx);
    const created = await this.repo.create(dto, ctx);
    await this.afterCreate(created, ctx);
    return created;
  }

  public async update(
    id: number,
    body: unknown,
    expectedVersion: number | null,
    ctx: AuditContext,
  ): Promise<TEntity> {
    const dto = await this.validateBody(body, "update");
    if (this.descriptor.version !== undefined && expectedVersion === null) {
      throw new ValidationError(
        `${this.entityName} requiere el campo "versión" para actualizar (bloqueo optimista)`,
        [{ field: "version", message: "obligatorio" }],
      );
    }
    await this.beforeUpdate(id, dto, ctx);
    const updated = await this.repo.update(id, dto, expectedVersion, ctx);
    await this.afterUpdate(updated, ctx);
    return updated;
  }

  public async remove(id: number, ctx: AuditContext): Promise<void> {
    await this.beforeRemove(id, ctx);
    await this.repo.softDelete(id, ctx);
    await this.afterRemove(id, ctx);
  }

  public async count(filters: readonly FilterCondition[]): Promise<number> {
    return this.repo.count(filters);
  }

  protected async validateBody(
    body: unknown,
    mode: "create" | "update",
  ): Promise<Record<string, unknown>> {
    const dtoClass =
      mode === "create" ? this.createDtoClass : this.updateDtoClass;
    if (dtoClass !== undefined) {
      const instance = await validateDto(dtoClass, body);
      return { ...(instance as Record<string, unknown>) };
    }
    return validateAgainstDescriptor(this.descriptor, body, mode);
  }

  // -- Hooks (Template Method). Vacios por defecto; las subclases sobreescriben.
  protected async beforeCreate(
    _dto: Record<string, unknown>,
    _ctx: AuditContext,
  ): Promise<void> {}

  protected async afterCreate(_entity: TEntity, _ctx: AuditContext): Promise<void> {}

  protected async beforeUpdate(
    _id: number,
    _dto: Record<string, unknown>,
    _ctx: AuditContext,
  ): Promise<void> {}

  protected async afterUpdate(_entity: TEntity, _ctx: AuditContext): Promise<void> {}

  protected async beforeRemove(_id: number, _ctx: AuditContext): Promise<void> {}

  protected async afterRemove(_id: number, _ctx: AuditContext): Promise<void> {}

  protected repository(): IRepository<TEntity, object, object> {
    return this.repo;
  }
}

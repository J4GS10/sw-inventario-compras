/**
 * Capa 3 (frontend) - Logica de Aplicacion.
 * Servicio CRUD generico. Patron Template Method: `create`/`update`/`remove`
 * fijan el flujo (hook -> repositorio -> evento); las subclases solo aportan
 * reglas en los hooks. Composicion: recibe un `IRepository` por constructor.
 */

import { AppEvents, eventBus } from "./EventBus.js";
import type { IRepository, ListQuery } from "./Repository.js";
import { repositoryFactory } from "./Repository.js";
import type { Page } from "./HttpClient.js";

export interface CrudServiceOptions {
  readonly resource: string;
  readonly idField: string;
  readonly versioned?: boolean;
}

export class CrudService<TEntity extends Record<string, unknown>> {
  protected readonly repo: IRepository<TEntity>;

  constructor(
    protected readonly options: CrudServiceOptions,
    repo?: IRepository<TEntity>,
  ) {
    this.repo = repo ?? repositoryFactory.for<TEntity>(options.resource);
  }

  public list(query?: ListQuery): Promise<Page<TEntity>> {
    return this.repo.list(query);
  }

  public getById(id: number): Promise<TEntity> {
    return this.repo.getById(id);
  }

  public async create(dto: Record<string, unknown>): Promise<TEntity> {
    const clean = await this.beforeSave(dto, "create");
    const created = await this.repo.create(clean);
    this.emit(AppEvents.EntityCreated, this.idOf(created));
    await this.afterSave(created, "create");
    return created;
  }

  public async update(
    entity: TEntity,
    dto: Record<string, unknown>,
  ): Promise<TEntity> {
    const clean = await this.beforeSave(dto, "update");
    const id = this.idOf(entity);
    const version =
      this.options.versioned === true ? Number(entity["version"]) : undefined;
    const updated = await this.repo.update(id, clean, version);
    this.emit(AppEvents.EntityUpdated, id);
    await this.afterSave(updated, "update");
    return updated;
  }

  public async remove(entity: TEntity): Promise<void> {
    const id = this.idOf(entity);
    await this.beforeRemove(id);
    await this.repo.remove(id);
    this.emit(AppEvents.EntityRemoved, id);
  }

  public idOf(entity: TEntity): number {
    return Number(entity[this.options.idField]);
  }

  // -- Hooks (Template Method). Vacios por defecto.
  protected async beforeSave(
    dto: Record<string, unknown>,
    _mode: "create" | "update",
  ): Promise<Record<string, unknown>> {
    return dto;
  }
  protected async afterSave(_entity: TEntity, _mode: "create" | "update"): Promise<void> {}
  protected async beforeRemove(_id: number): Promise<void> {}

  private emit(event: string, id: number): void {
    eventBus.emit(event, { resource: this.options.resource, id });
  }
}

/**
 * Capa 2 (frontend) - Acceso a Datos.
 * Patron Repository sobre HTTP. La UI depende del contrato `IRepository`, nunca
 * de `fetch` ni de rutas.
 *
 *  - Abstraccion por contrato: `IRepository<T>`.
 *  - Generalizacion: `HttpRepository<T>` implementa el contrato entero.
 *  - Factory Method: `RepositoryFactory` entrega/cachea la instancia por recurso.
 */

import { HttpClient, type Page, type QueryParams } from "./HttpClient.js";

export interface ListQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: string;
  readonly order?: "asc" | "desc";
  readonly filters?: Readonly<Record<string, string | number | boolean>>;
  /** Busqueda global (`?q=`): cada palabra debe aparecer en algun campo del registro. */
  readonly search?: string;
}

export interface IRepository<TEntity> {
  list(query?: ListQuery): Promise<Page<TEntity>>;
  getById(id: number | string): Promise<TEntity>;
  create(dto: unknown): Promise<TEntity>;
  update(id: number | string, dto: unknown, version?: number): Promise<TEntity>;
  remove(id: number | string): Promise<void>;
}

export abstract class HttpRepository<TEntity> implements IRepository<TEntity> {
  protected constructor(
    protected readonly basePath: string,
    protected readonly http: HttpClient = HttpClient.getInstance(),
  ) {}

  public list(query?: ListQuery): Promise<Page<TEntity>> {
    return this.http.list<TEntity>(this.basePath, this.toParams(query));
  }
  public getById(id: number | string): Promise<TEntity> {
    return this.http.get<TEntity>(`${this.basePath}/${id}`);
  }
  public create(dto: unknown): Promise<TEntity> {
    return this.http.post<TEntity>(this.basePath, dto);
  }
  public update(id: number | string, dto: unknown, version?: number): Promise<TEntity> {
    return this.http.put<TEntity>(`${this.basePath}/${id}`, dto, version);
  }
  public remove(id: number | string): Promise<void> {
    return this.http.delete(`${this.basePath}/${id}`);
  }

  protected toParams(query?: ListQuery): QueryParams {
    const p: QueryParams = {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    };
    if (query?.sort !== undefined) p["sort"] = query.sort;
    if (query?.order !== undefined) p["order"] = query.order;
    if (query?.search !== undefined && query.search.trim() !== "") p["q"] = query.search.trim();
    for (const [k, v] of Object.entries(query?.filters ?? {})) p[k] = v;
    return p;
  }
}

/** Concrecion generica: cualquier recurso REST estandar. */
export class RestRepository<TEntity> extends HttpRepository<TEntity> {
  constructor(basePath: string) {
    super(basePath);
  }
}

/** Patron Factory Method: una instancia por ruta base, cacheada. */
export class RepositoryFactory {
  private static instance: RepositoryFactory | undefined;
  private readonly cache = new Map<string, IRepository<unknown>>();

  private constructor() {}

  public static getInstance(): RepositoryFactory {
    if (RepositoryFactory.instance === undefined) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  public for<TEntity>(basePath: string): IRepository<TEntity> {
    const cached = this.cache.get(basePath);
    if (cached !== undefined) return cached as IRepository<TEntity>;
    const repo = new RestRepository<TEntity>(basePath);
    this.cache.set(basePath, repo as IRepository<unknown>);
    return repo;
  }
}

export const repositoryFactory = RepositoryFactory.getInstance();

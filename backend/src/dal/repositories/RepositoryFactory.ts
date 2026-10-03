/**
 * Capa 2 - Acceso a Datos.
 * Patron Factory Method: entrega la instancia de repositorio adecuada segun la
 * clave logica de entidad, cacheando una unica instancia por clave (todas
 * comparten el mismo OraclePool Singleton).
 */

import {
  COM_DESCRIPTORS,
  type ComEntityKey,
} from "../../entities/com/descriptors.js";
import { InternalError } from "../../common/errors/AppError.js";
import type { BaseOracleRepository } from "./BaseOracleRepository.js";
import { CrudRepository } from "./CrudRepository.js";

type AnyRepo = BaseOracleRepository<unknown, unknown, unknown>;

export class RepositoryFactory {
  private static instance: RepositoryFactory | undefined;

  private readonly cache = new Map<string, AnyRepo>();

  /** Overrides registrados para claves que requieren un repo especializado. */
  private readonly overrides = new Map<string, () => AnyRepo>();

  private constructor() {}

  public static getInstance(): RepositoryFactory {
    if (RepositoryFactory.instance === undefined) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  /** Permite a la BLL registrar un repo especializado para una clave. */
  public register(key: ComEntityKey, builder: () => AnyRepo): void {
    this.overrides.set(key, builder);
    this.cache.delete(key);
  }

  public get<TEntity, TCreate, TUpdate>(
    key: ComEntityKey,
  ): BaseOracleRepository<TEntity, TCreate, TUpdate> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached as BaseOracleRepository<TEntity, TCreate, TUpdate>;
    }
    const override = this.overrides.get(key);
    const repo: AnyRepo =
      override !== undefined
        ? override()
        : (new CrudRepository(this.descriptorFor(key)) as AnyRepo);
    this.cache.set(key, repo);
    return repo as BaseOracleRepository<TEntity, TCreate, TUpdate>;
  }

  private descriptorFor(key: ComEntityKey) {
    const d = COM_DESCRIPTORS[key];
    if (d === undefined) {
      throw new InternalError(`Sin descriptor para la clave de entidad: ${key}`);
    }
    return d;
  }
}

export function repositoryFactory(): RepositoryFactory {
  return RepositoryFactory.getInstance();
}

/**
 * Capa 2 - Acceso a Datos.
 * Repositorio concreto generico para tablas sin SQL especial. Se instancia a
 * partir de un EntityDescriptor; cubre los ~14 catalogos del modulo tal cual.
 */

import type { EntityDescriptor } from "../../entities/support/EntityDescriptor.js";
import { BaseOracleRepository } from "./BaseOracleRepository.js";

export class CrudRepository<
  TEntity,
  TCreate,
  TUpdate,
> extends BaseOracleRepository<TEntity, TCreate, TUpdate> {
  public constructor(descriptor: EntityDescriptor) {
    super(descriptor);
  }
}

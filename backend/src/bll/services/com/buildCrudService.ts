/**
 * Capa 3 - Logica de Negocio / compras.
 * Fabrica un BaseCrudService a partir de una clave de entidad COM_. El
 * repositorio sale del RepositoryFactory (Factory Method); el descriptor, del
 * registro central. Cero codigo por catalogo.
 */

import { BaseCrudService } from "../BaseCrudService.js";
import {
  COM_DESCRIPTORS,
  type ComEntityKey,
} from "../../../entities/com/descriptors.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import { withTelemetry } from "../../support/decorators/withTelemetry.js";

export function buildCrudService<TEntity = Record<string, unknown>>(
  key: ComEntityKey,
): BaseCrudService<TEntity> {
  const repo = repositoryFactory().get<TEntity, object, object>(key);
  const service = new BaseCrudService<TEntity>(repo, {
    descriptor: COM_DESCRIPTORS[key],
  });
  // Decorator (Proxy): telemetria de duracion/exito en list/getById/create/
  // update/remove sin tocar la clase base. Antes solo los servicios de flujo lo
  // tenian; ahora tambien los ~14 CRUD genericos.
  return withTelemetry(service, `CrudService:${key}`);
}

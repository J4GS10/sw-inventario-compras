/**
 * Capa 2 - Acceso a Datos.
 * Concrecion generica de BaseHeaderDetailRepository para las 7 parejas
 * cabecera/detalle del modulo. Se instancia con los dos descriptores.
 */

import type { EntityDescriptor } from "../../entities/support/EntityDescriptor.js";
import { BaseHeaderDetailRepository } from "./BaseHeaderDetailRepository.js";

export class HeaderDetailRepository<
  THeader,
  TCreateHeader,
  TUpdateHeader,
  TDetail,
  TCreateDetail,
> extends BaseHeaderDetailRepository<
  THeader,
  TCreateHeader,
  TUpdateHeader,
  TDetail,
  TCreateDetail
> {
  public constructor(
    header: EntityDescriptor,
    detail: EntityDescriptor,
  ) {
    super(header, detail);
  }
}

/**
 * Capa 2 - Acceso a Datos / compartido.
 * Repositorios de tablas de otros modulos (INV_, CXP_) que los suscriptores de
 * eventos del modulo de Compras necesitan hasta que esos modulos existan.
 */

import {
  CXP_CHEQUE,
  CXP_CONTRASENA_PAGO,
  CXP_FACTURA_PROVEEDOR,
  INV_ALERTA_ESCASEZ,
  INV_ARTICULO,
  INV_EXISTENCIA_BODEGA,
  INV_KARDEX_MOVIMIENTO,
} from "../../../entities/shared/descriptors.js";
import { CrudRepository } from "../CrudRepository.js";

export const kardexRepository = () => new CrudRepository(INV_KARDEX_MOVIMIENTO);
export const existenciaRepository = () => new CrudRepository(INV_EXISTENCIA_BODEGA);
export const articuloRepository = () => new CrudRepository(INV_ARTICULO);
export const alertaEscasezRepository = () => new CrudRepository(INV_ALERTA_ESCASEZ);
export const facturaProveedorRepository = () =>
  new CrudRepository(CXP_FACTURA_PROVEEDOR);
export const contrasenaPagoRepository = () => new CrudRepository(CXP_CONTRASENA_PAGO);
export const chequeRepository = () => new CrudRepository(CXP_CHEQUE);

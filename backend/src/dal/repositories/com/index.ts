/**
 * Capa 2 - Acceso a Datos / compras.
 * Repositorios cabecera/detalle del modulo. Cada uno es una linea: se compone a
 * partir de los dos descriptores del registro central.
 */

import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import { HeaderDetailRepository } from "../HeaderDetailRepository.js";

export const solicitudRepository = () =>
  new HeaderDetailRepository(
    COM_DESCRIPTORS.solicitudCompra,
    COM_DESCRIPTORS.solicitudDetalle,
  );

export const rfqRepository = () =>
  new HeaderDetailRepository(
    COM_DESCRIPTORS.rfqCabecera,
    COM_DESCRIPTORS.rfqProveedor,
  );

export const cotizacionRepository = () =>
  new HeaderDetailRepository(
    COM_DESCRIPTORS.cotizacionProveedor,
    COM_DESCRIPTORS.cotizacionDetalle,
  );

export const ordenCompraRepository = () =>
  new HeaderDetailRepository(
    COM_DESCRIPTORS.ordenCompra,
    COM_DESCRIPTORS.ordenCompraDetalle,
  );

export const recepcionRepository = () =>
  new HeaderDetailRepository(
    COM_DESCRIPTORS.recepcion,
    COM_DESCRIPTORS.recepcionDetalle,
  );

export const devolucionRepository = () =>
  new HeaderDetailRepository(
    COM_DESCRIPTORS.devolucionProveedor,
    COM_DESCRIPTORS.devolucionDetalle,
  );

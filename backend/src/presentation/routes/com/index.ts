/**
 * Capa 4 - Presentacion / rutas / compras.
 * Registra el CRUD REST de todas las entidades COM_ que no requieren logica
 * transaccional especial. Cada entrada de la tabla = un recurso completo
 * (list/get/create/update/delete) sin escribir un handler.
 *
 * Las entidades transaccionales (solicitud, RFQ, cotizacion, orden de compra,
 * recepcion, devolucion) se montan aparte con sus servicios especializados
 * (ver Fase 4 del plan).
 */

import type { FastifyInstance } from "fastify";
import type { ComEntityKey } from "../../../entities/com/descriptors.js";
import { INV_ARTICULO } from "../../../entities/shared/descriptors.js";
import { buildCrudService } from "../../../bll/services/com/buildCrudService.js";
import { BaseCrudService } from "../../../bll/services/BaseCrudService.js";
import { withTelemetry } from "../../../bll/support/decorators/withTelemetry.js";
import { CrudRepository } from "../../../dal/repositories/CrudRepository.js";
import { Permisos } from "../../../common/auth/permissions.js";
import { registerCrudRoutes, registerReadOnlyCrudRoutes } from "../crudRouter.js";

interface CrudResource {
  readonly key: ComEntityKey;
  readonly path: string;
}

/**
 * Catalogos OPERATIVOS: los mantiene el Depto. de Compras (COMPRADOR) — escritura
 * con `CATALOGO_EDITAR`.
 */
const CRUD_OPERATIVOS: readonly CrudResource[] = [
  { key: "categoriaCompra", path: "/api/com/categorias-compra" },
  { key: "grupoCompra", path: "/api/com/grupos-compra" },
  { key: "condicionPago", path: "/api/com/condiciones-pago" },
  { key: "terminoEntrega", path: "/api/com/terminos-entrega" },
  { key: "centroCosto", path: "/api/com/centros-costo" },
  { key: "proveedor", path: "/api/com/proveedores" },
  { key: "articuloProveedor", path: "/api/com/articulo-proveedor" },
  { key: "acuerdoProveedor", path: "/api/com/acuerdos-proveedor" },
  { key: "acuerdoDetalle", path: "/api/com/acuerdo-detalle" },
  { key: "seguimientoOrden", path: "/api/com/seguimiento-orden" },
  { key: "excepcionOrden", path: "/api/com/excepciones-orden" },
];

/**
 * Catalogo SENSIBLE: configuracion financiera (monedas). Escritura solo con
 * `CATALOGO_ADMIN` (Gerente financiero / ADMIN_COMPRAS). El resto de roles
 * solo puede leerlo.
 */
const CRUD_SENSIBLES: readonly CrudResource[] = [{ key: "moneda", path: "/api/com/monedas" }];

/**
 * Tablas de AUDITORIA del propio flujo: registran quien aprobo que
 * (`COM_WORKFLOW_APROBACION`, escrita solo por
 * `SolicitudCompraService.registrarWorkflow`) y los criterios de
 * adjudicacion (`COM_COMPARATIVO_COTIZACIONES`, escrita solo por
 * `ComparativoService.registrarCriterio`, con su propia validacion). NINGUN
 * rol humano las edita via CRUD generico — ni siquiera ADMIN_COMPRAS: si se
 * expusiera escritura aqui, cualquiera con ese permiso podria reescribir o
 * borrar el historial de aprobaciones por fuera de la transaccion de negocio
 * que lo genera. Solo lectura, para trazabilidad/auditoria.
 */
const CRUD_SOLO_LECTURA: readonly CrudResource[] = [
  { key: "comparativoCotizaciones", path: "/api/com/comparativo-cotizaciones" },
  { key: "workflowAprobacion", path: "/api/com/workflow-aprobacion" },
];

export function registerComRoutes(app: FastifyInstance): void {
  for (const res of CRUD_OPERATIVOS) {
    registerCrudRoutes(app, {
      basePath: res.path,
      service: buildCrudService(res.key),
      permissions: {
        read: [Permisos.CATALOGO_VER],
        write: [Permisos.CATALOGO_EDITAR],
      },
    });
  }

  // Catalogo de Articulos (INV_ARTICULO): mismo trato que un catalogo
  // OPERATIVO (lectura CATALOGO_VER, escritura CATALOGO_EDITAR), pero su
  // descriptor vive en entities/shared/ (tabla INV_, no COM_) — no pasa por
  // COM_DESCRIPTORS/RepositoryFactory (ComEntityKey), que son exclusivos de
  // las 26 tablas del modulo. Se construye el servicio a mano con el mismo
  // CrudRepository/BaseCrudService genericos que usa buildCrudService.
  registerCrudRoutes(app, {
    basePath: "/api/com/articulos",
    service: withTelemetry(
      new BaseCrudService(new CrudRepository(INV_ARTICULO), { descriptor: INV_ARTICULO }),
      "CrudService:articulo",
    ),
    permissions: {
      read: [Permisos.CATALOGO_VER],
      write: [Permisos.CATALOGO_EDITAR],
    },
  });
  for (const res of CRUD_SENSIBLES) {
    registerCrudRoutes(app, {
      basePath: res.path,
      service: buildCrudService(res.key),
      permissions: {
        read: [Permisos.CATALOGO_VER],
        write: [Permisos.CATALOGO_ADMIN],
      },
    });
  }
  for (const res of CRUD_SOLO_LECTURA) {
    registerReadOnlyCrudRoutes(app, {
      basePath: res.path,
      service: buildCrudService(res.key),
      read: [Permisos.CATALOGO_VER],
    });
  }
}

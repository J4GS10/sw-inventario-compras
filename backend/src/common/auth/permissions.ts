/**
 * Capa 6 - Componentes Comunes.
 * Catalogo de permisos del modulo de Compras y guarda de autorizacion a nivel
 * de servicio (cuando el permiso depende del estado del dato, no solo de la ruta).
 *
 * Principio de acceso: quien no puede gestionar/accionar un recurso, no lo ve
 * — sin permisos de "solo trazabilidad" para supervision. La unica excepcion
 * es SOLICITUD_VER (ampliamente compartido: todo el mundo necesita ver el
 * estado de una solicitud para saber si le toca actuar) y ANALISIS_VER
 * (vistas agregadas — Dashboard/Comparativo/Historial/Reportes — no
 * documentos transaccionales en crudo).
 */

import { ForbiddenError } from "../errors/AppError.js";
import type { AuditContext } from "../types/AuditContext.js";

export const Permisos = {
  SOLICITUD_CREAR: "COMPRAS_SOLICITUD_CREAR",
  SOLICITUD_VER: "COMPRAS_SOLICITUD_VER",
  SOLICITUD_APROBAR_JEFE: "COMPRAS_SOLICITUD_APROBAR_JEFE",
  SOLICITUD_APROBAR_GERENTE: "COMPRAS_SOLICITUD_APROBAR_GERENTE",
  RFQ_GESTIONAR: "COMPRAS_RFQ_GESTIONAR",
  COTIZACION_GESTIONAR: "COMPRAS_COTIZACION_GESTIONAR",
  COTIZACION_ADJUDICAR: "COMPRAS_COTIZACION_ADJUDICAR",
  OC_GESTIONAR: "COMPRAS_OC_GESTIONAR",
  RECEPCION_GESTIONAR: "COMPRAS_RECEPCION_GESTIONAR",
  DEVOLUCION_GESTIONAR: "COMPRAS_DEVOLUCION_GESTIONAR",
  CATALOGO_VER: "COMPRAS_CATALOGO_VER",
  CATALOGO_EDITAR: "COMPRAS_CATALOGO_EDITAR",
  /** Catalogos sensibles: monedas. Las tablas de auditoria (comparativo,
   *  workflow) NO se editan por aqui — son de solo lectura para todos, ver
   *  CRUD_SENSIBLES en presentation/routes/com/index.ts. */
  CATALOGO_ADMIN: "COMPRAS_CATALOGO_ADMIN",
  ANALISIS_VER: "COMPRAS_ANALISIS_VER",
} as const;

export type PermisoCodigo = (typeof Permisos)[keyof typeof Permisos];

/** Descripcion legible de cada permiso (para el seed y la UI). */
export const PERMISO_META: Record<PermisoCodigo, { nombre: string; descripcion: string }> = {
  [Permisos.SOLICITUD_CREAR]: { nombre: "Crear solicitud de compra", descripcion: "Ingresar solicitudes de compra" },
  [Permisos.SOLICITUD_VER]: { nombre: "Ver solicitudes", descripcion: "Consultar solicitudes de compra" },
  [Permisos.SOLICITUD_APROBAR_JEFE]: { nombre: "Aprobar (jefe inmediato)", descripcion: "Aprobar, rechazar o ajustar cantidades en PENDIENTE_JEFE" },
  [Permisos.SOLICITUD_APROBAR_GERENTE]: { nombre: "Aprobar (gerente de área)", descripcion: "Aprobar o rechazar en PENDIENTE_GERENTE" },
  [Permisos.RFQ_GESTIONAR]: { nombre: "Gestionar RFQ", descripcion: "Crear, ver y cerrar RFQ, invitar proveedores" },
  [Permisos.COTIZACION_GESTIONAR]: { nombre: "Gestionar cotizaciones", descripcion: "Registrar y ver cotizaciones de proveedor" },
  [Permisos.COTIZACION_ADJUDICAR]: { nombre: "Adjudicar cotización", descripcion: "Ver, adjudicar y registrar criterios" },
  [Permisos.OC_GESTIONAR]: { nombre: "Gestionar órdenes de compra", descripcion: "Generar OC, verla y cambiar su estado" },
  [Permisos.RECEPCION_GESTIONAR]: { nombre: "Gestionar recepciones", descripcion: "Registrar y ver recepciones de mercadería" },
  [Permisos.DEVOLUCION_GESTIONAR]: { nombre: "Gestionar devoluciones", descripcion: "Registrar y ver devoluciones a proveedor" },
  [Permisos.CATALOGO_VER]: { nombre: "Ver catálogos", descripcion: "Consultar catálogos del módulo" },
  [Permisos.CATALOGO_EDITAR]: { nombre: "Editar catálogos operativos", descripcion: "Crear, editar y eliminar proveedores, acuerdos, condiciones, grupos, centros de costo" },
  [Permisos.CATALOGO_ADMIN]: { nombre: "Administrar monedas", descripcion: "Editar el catálogo de monedas" },
  [Permisos.ANALISIS_VER]: { nombre: "Ver análisis", descripcion: "Dashboard, comparativo, historial de precios y reportes" },
};

/** Roles del modulo y sus permisos. */
export const ROLES: Record<string, { nombre: string; permisos: readonly string[] }> = {
  SOLICITANTE: {
    nombre: "Solicitante",
    permisos: [Permisos.SOLICITUD_CREAR, Permisos.SOLICITUD_VER, Permisos.CATALOGO_VER, Permisos.ANALISIS_VER],
  },
  JEFE_INMEDIATO: {
    nombre: "Jefe inmediato",
    permisos: [
      Permisos.SOLICITUD_CREAR,
      Permisos.SOLICITUD_VER,
      Permisos.SOLICITUD_APROBAR_JEFE,
      Permisos.CATALOGO_VER,
      Permisos.ANALISIS_VER,
    ],
  },
  // Gerente de area: solo lo que aprueba. No ve RFQ/Cotizacion/OC/Recepcion/
  // Devolucion — no las gestiona, no las ve.
  GERENTE_AREA: {
    nombre: "Gerente de área",
    permisos: [
      Permisos.SOLICITUD_VER,
      Permisos.SOLICITUD_APROBAR_GERENTE,
      Permisos.CATALOGO_VER,
      Permisos.ANALISIS_VER,
    ],
  },
  COMPRADOR: {
    nombre: "Comprador (Depto. Compras)",
    permisos: [
      Permisos.SOLICITUD_VER,
      Permisos.RFQ_GESTIONAR,
      Permisos.COTIZACION_GESTIONAR,
      Permisos.OC_GESTIONAR,
      Permisos.CATALOGO_VER,
      // Compras mantiene los catalogos operativos del modulo (proveedores,
      // acuerdos, condiciones...). Monedas es de Finanzas — ver GERENTE_FINANCIERO.
      Permisos.CATALOGO_EDITAR,
      Permisos.ANALISIS_VER,
    ],
  },
  GERENTE_FINANCIERO: {
    nombre: "Gerente financiero",
    permisos: [
      Permisos.SOLICITUD_VER,
      Permisos.COTIZACION_ADJUDICAR,
      Permisos.OC_GESTIONAR,
      Permisos.CATALOGO_VER,
      // Finanzas mantiene catalogos operativos (condiciones de pago, terminos,
      // centros de costo) Y el catalogo sensible de monedas (moneda es funcion
      // de Finanzas, no de Compras).
      Permisos.CATALOGO_EDITAR,
      Permisos.CATALOGO_ADMIN,
      Permisos.ANALISIS_VER,
    ],
  },
  BODEGA: {
    nombre: "Bodega",
    permisos: [Permisos.RECEPCION_GESTIONAR, Permisos.DEVOLUCION_GESTIONAR, Permisos.CATALOGO_VER],
  },
  // Auditoria/control interno: mismo alcance que cualquier otro rol de solo
  // consulta — ve el estado de las solicitudes y el analisis agregado, no la
  // plomeria operativa completa (no gestiona nada de eso).
  AUDITOR: {
    nombre: "Auditor",
    permisos: [Permisos.SOLICITUD_VER, Permisos.CATALOGO_VER, Permisos.ANALISIS_VER],
  },
  ADMIN_COMPRAS: {
    nombre: "Administrador de Compras",
    permisos: ["*"],
  },
};

export function hasPermiso(permisos: readonly string[], code: string): boolean {
  return permisos.includes("*") || permisos.includes(code);
}

/** Lanza ForbiddenError si el contexto no tiene el permiso. */
export function requirePermiso(ctx: AuditContext, code: PermisoCodigo): void {
  if (!hasPermiso(ctx.permisos, code)) {
    throw new ForbiddenError(`Requiere el permiso ${code}`);
  }
}

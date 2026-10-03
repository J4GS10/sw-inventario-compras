/**
 * Modelo de navegacion del SISTEMA.
 *
 * Nivel 1: modulos que existen en la base de datos (SCRIPT_DDL.sql), en el
 *          orden canonico del esquema.
 * Nivel 2: solo el modulo disponible ("Gestion de Compras") despliega sus
 *          secciones (acordeon colapsable). Cada seccion y cada pantalla llevan
 *          su propio icono representativo. El orden va de lo mas usado a lo menos.
 * skills/patron-diseno.md seccion 5.
 */

import type { IconName } from "./ui/Icon.js";
import {
  Permisos,
  READ_COTIZACIONES,
  READ_DEVOLUCIONES,
  READ_OC,
  READ_RECEPCIONES,
  READ_RFQ,
  READ_SOLICITUDES,
} from "./core/auth/permisos.js";

export type ViewKind =
  | "dashboard"
  | "catalogo"
  | "documento"
  | "comparativo"
  | "historial"
  | "reportes"
  | "liquidacion";

export interface NavLeaf {
  readonly id: string;
  readonly label: string;
  readonly kind: ViewKind;
  readonly icon: IconName;
  readonly key?: string;
  /** El item es visible si la sesion tiene AL MENOS UNO de estos permisos. */
  readonly perm?: readonly string[];
}

export interface NavSection {
  readonly label: string;
  readonly icon: IconName;
  /** Abierta por defecto en el acordeon. */
  readonly openByDefault?: boolean;
  readonly items: readonly NavLeaf[];
}

export interface SystemModule {
  readonly id: string;
  readonly label: string;
  readonly prefix: string;
  readonly icon: IconName;
  readonly available: boolean;
  readonly sections?: readonly NavSection[];
}

/* --- Secciones de Gestion de Compras — orden por frecuencia de uso -------- */

const CAT_VER = [Permisos.CATALOGO_VER];
const ANALISIS = [Permisos.ANALISIS_VER];

const COMPRAS_SECTIONS: readonly NavSection[] = [
  {
    label: "Resumen",
    icon: "grid",
    openByDefault: true,
    items: [
      { id: "com-dashboard", label: "Dashboard", kind: "dashboard", icon: "chart", perm: ANALISIS },
    ],
  },
  {
    label: "Ciclo de compra",
    icon: "cart",
    openByDefault: true,
    items: [
      { id: "com-doc-solicitudes", label: "Solicitudes de compra", kind: "documento", key: "solicitudes", icon: "clipboard", perm: READ_SOLICITUDES },
      { id: "com-doc-ordenes", label: "Ordenes de compra", kind: "documento", key: "ordenesCompra", icon: "cart", perm: READ_OC },
      { id: "com-doc-cotizaciones", label: "Cotizaciones", kind: "documento", key: "cotizaciones", icon: "coins", perm: READ_COTIZACIONES },
      { id: "com-doc-rfq", label: "RFQ / Invitaciones", kind: "documento", key: "rfq", icon: "send", perm: READ_RFQ },
    ],
  },
  {
    label: "Operaciones",
    icon: "truck",
    openByDefault: true,
    items: [
      { id: "com-doc-recepciones", label: "Recepciones", kind: "documento", key: "recepciones", icon: "package", perm: READ_RECEPCIONES },
      { id: "com-doc-devoluciones", label: "Devoluciones", kind: "documento", key: "devoluciones", icon: "undo", perm: READ_DEVOLUCIONES },
    ],
  },
  {
    label: "Seguimiento de OC",
    icon: "truck",
    items: [
      { id: "com-cat-seguimiento", label: "Seguimiento de despachos", kind: "catalogo", key: "seguimientoOrden", icon: "clock", perm: READ_OC },
      { id: "com-cat-excepciones", label: "Excepciones de OC", kind: "catalogo", key: "excepcionOrden", icon: "shield", perm: READ_OC },
    ],
  },
  {
    label: "Analisis",
    icon: "chart",
    items: [
      { id: "com-an-comparativo", label: "Comparativo de cotizaciones", kind: "comparativo", icon: "award", perm: ANALISIS },
      { id: "com-an-historial", label: "Historial de precios", kind: "historial", icon: "chart", perm: ANALISIS },
    ],
  },
  {
    label: "Reportes",
    icon: "clipboard",
    items: [
      { id: "com-an-reportes", label: "Panel de reportes", kind: "reportes", icon: "chart", perm: ANALISIS },
    ],
  },
  {
    label: "Cuentas por pagar",
    icon: "wallet",
    items: [
      { id: "com-cxp-liquidacion", label: "Liquidacion de facturas", kind: "liquidacion", icon: "wallet", perm: [Permisos.CATALOGO_ADMIN] },
    ],
  },
  {
    label: "Catalogos",
    icon: "list",
    items: [
      { id: "com-cat-proveedores", label: "Proveedores", kind: "catalogo", key: "proveedores", icon: "truck", perm: CAT_VER },
      { id: "com-cat-acuerdos", label: "Acuerdos marco", kind: "catalogo", key: "acuerdos", icon: "shield", perm: CAT_VER },
      { id: "com-cat-articulos", label: "Articulos", kind: "catalogo", key: "articulos", icon: "package", perm: CAT_VER },
      { id: "com-cat-articulo-proveedor", label: "Articulo-Proveedor", kind: "catalogo", key: "articuloProveedor", icon: "tag", perm: CAT_VER },
      { id: "com-cat-condiciones", label: "Condiciones de pago", kind: "catalogo", key: "condicionesPago", icon: "wallet", perm: CAT_VER },
      { id: "com-cat-terminos", label: "Terminos de entrega", kind: "catalogo", key: "terminosEntrega", icon: "clock", perm: CAT_VER },
      { id: "com-cat-categorias", label: "Categorias de compra", kind: "catalogo", key: "categoriasCompra", icon: "tag", perm: CAT_VER },
      { id: "com-cat-grupos", label: "Grupos de compra", kind: "catalogo", key: "gruposCompra", icon: "layers", perm: CAT_VER },
      { id: "com-cat-centros", label: "Centros de costo", kind: "catalogo", key: "centrosCosto", icon: "building", perm: CAT_VER },
      { id: "com-cat-monedas", label: "Monedas", kind: "catalogo", key: "monedas", icon: "coins", perm: CAT_VER },
    ],
  },
];

/* --- Modulos del sistema (orden del DDL) -------------------------------- */

export const MODULES: readonly SystemModule[] = [
  { id: "nomina", label: "Nomina", prefix: "NOM_", icon: "users", available: false },
  { id: "seguridad", label: "Seguridad", prefix: "SEG_", icon: "shield", available: false },
  { id: "inventarios", label: "Inventarios", prefix: "INV_", icon: "package", available: false },
  {
    id: "compras",
    label: "Gestion de Compras",
    prefix: "COM_",
    icon: "cart",
    available: true,
    sections: COMPRAS_SECTIONS,
  },
  { id: "cxp", label: "Cuentas por Pagar", prefix: "CXP_", icon: "wallet", available: false },
  { id: "cxc", label: "Cuentas por Cobrar", prefix: "CXC_", icon: "coins", available: false },
];

export const COMPRAS_MODULE = MODULES.find((m) => m.id === "compras")!;

export const ALL_LEAVES: readonly NavLeaf[] = MODULES.flatMap((m) =>
  (m.sections ?? []).flatMap((s) => s.items),
);

/** ¿La sesion puede ver este item? (sin `perm` -> visible para cualquiera). */
export function leafVisible(
  leaf: NavLeaf,
  hasAnyPerm: (codes: readonly string[]) => boolean,
): boolean {
  return leaf.perm === undefined || hasAnyPerm(leaf.perm);
}

/** Secciones con al menos un item visible, ya filtradas. */
export function visibleSections(
  sections: readonly NavSection[],
  hasAnyPerm: (codes: readonly string[]) => boolean,
): NavSection[] {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((it) => leafVisible(it, hasAnyPerm)) }))
    .filter((s) => s.items.length > 0);
}

/** Todos los items que la sesion puede abrir (para elegir la vista inicial). */
export function visibleLeaves(
  hasAnyPerm: (codes: readonly string[]) => boolean,
): NavLeaf[] {
  return ALL_LEAVES.filter((l) => leafVisible(l, hasAnyPerm));
}

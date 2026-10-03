import { describe, expect, it } from "vitest";
import { ALL_LEAVES, leafVisible, visibleLeaves, visibleSections, type NavLeaf, type NavSection } from "./nav.js";
import { Permisos, READ_OC } from "./core/auth/permisos.js";

const leafSinPermiso: NavLeaf = { id: "l1", label: "Publico", kind: "dashboard", icon: "grid" };
const leafConPermiso: NavLeaf = {
  id: "l2",
  label: "Restringido",
  kind: "documento",
  icon: "cart",
  perm: [Permisos.OC_GESTIONAR],
};

describe("leafVisible", () => {
  it("un leaf sin perm es visible para cualquier sesion", () => {
    expect(leafVisible(leafSinPermiso, () => false)).toBe(true);
  });

  it("un leaf con perm depende de hasAnyPerm", () => {
    expect(leafVisible(leafConPermiso, () => true)).toBe(true);
    expect(leafVisible(leafConPermiso, () => false)).toBe(false);
  });
});

describe("visibleSections", () => {
  const secciones: readonly NavSection[] = [
    { label: "Seccion A", icon: "grid", items: [leafSinPermiso] },
    { label: "Seccion B", icon: "cart", items: [leafConPermiso] },
  ];

  it("conserva secciones con al menos un item visible", () => {
    const out = visibleSections(secciones, () => false);
    expect(out.map((s) => s.label)).toEqual(["Seccion A"]);
  });

  it("descarta secciones que quedan sin items", () => {
    const out = visibleSections(secciones, () => true);
    expect(out).toHaveLength(2);
  });
});

describe("visibleLeaves — Ordenes de compra solo para quien la gestiona", () => {
  it("un rol sin OC_GESTIONAR (p. ej. Bodega, que solo tiene RECEPCION_GESTIONAR) NO ve el leaf de Ordenes de compra", () => {
    // Revierte la regresion WS2 original (bodega veia el documento completo
    // via RECEPCION_GESTIONAR en READ_OC) a pedido explicito: si un rol no
    // puede gestionar un recurso, no lo ve — ni siquiera en solo lectura.
    // Bodega elige la OC dentro de su propio formulario de Recepcion via
    // `GET /api/com/ref/oc/receptibles` (gateado por RECEPCION_GESTIONAR),
    // no navegando el documento "Ordenes de compra".
    const hasAnyPerm = (codes: readonly string[]): boolean => codes.includes(Permisos.RECEPCION_GESTIONAR);
    const leaves = visibleLeaves(hasAnyPerm);
    const oc = ALL_LEAVES.find((l) => l.id === "com-doc-ordenes");
    expect(oc).toBeDefined();
    expect(oc?.perm).toEqual(READ_OC);
    expect(leaves.some((l) => l.id === "com-doc-ordenes")).toBe(false);
  });

  it("un rol con OC_GESTIONAR si ve el leaf de Ordenes de compra", () => {
    const hasAnyPerm = (codes: readonly string[]): boolean => codes.includes(Permisos.OC_GESTIONAR);
    const leaves = visibleLeaves(hasAnyPerm);
    expect(leaves.some((l) => l.id === "com-doc-ordenes")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { grants, grantsAny, Permisos, READ_OC } from "./permisos.js";

describe("grants", () => {
  it("otorga cuando el permiso está en la lista", () => {
    expect(grants([Permisos.OC_GESTIONAR], Permisos.OC_GESTIONAR)).toBe(true);
  });

  it("otorga cualquier permiso cuando la sesión tiene el comodín *", () => {
    expect(grants(["*"], Permisos.CATALOGO_ADMIN)).toBe(true);
  });

  it("no otorga cuando el permiso no está en la lista", () => {
    expect(grants([Permisos.CATALOGO_VER], Permisos.OC_GESTIONAR)).toBe(false);
  });

  it("no otorga con lista vacía", () => {
    expect(grants([], Permisos.OC_GESTIONAR)).toBe(false);
  });
});

describe("grantsAny", () => {
  it("otorga si al menos uno de los códigos coincide", () => {
    expect(grantsAny([Permisos.OC_GESTIONAR], READ_OC)).toBe(true);
  });

  it("otorga cualquier código cuando la sesión tiene el comodín *", () => {
    expect(grantsAny(["*"], READ_OC)).toBe(true);
  });

  it("no otorga si ningún código coincide", () => {
    expect(grantsAny([Permisos.CATALOGO_VER], READ_OC)).toBe(false);
  });
});

describe("READ_OC", () => {
  it("solo quien gestiona Órdenes de compra las ve (nadie ve sin poder accionar)", () => {
    expect(READ_OC).toEqual([Permisos.OC_GESTIONAR]);
  });
});

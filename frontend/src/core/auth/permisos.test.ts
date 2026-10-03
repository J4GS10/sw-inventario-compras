import { describe, expect, it } from "vitest";
import { grants, grantsAny, Permisos, READ_OC } from "./permisos.js";

describe("grants", () => {
  it("otorga cuando el permiso esta en la lista", () => {
    expect(grants([Permisos.OC_GESTIONAR], Permisos.OC_GESTIONAR)).toBe(true);
  });

  it("otorga cualquier permiso cuando la sesion tiene el comodin *", () => {
    expect(grants(["*"], Permisos.CATALOGO_ADMIN)).toBe(true);
  });

  it("no otorga cuando el permiso no esta en la lista", () => {
    expect(grants([Permisos.CATALOGO_VER], Permisos.OC_GESTIONAR)).toBe(false);
  });

  it("no otorga con lista vacia", () => {
    expect(grants([], Permisos.OC_GESTIONAR)).toBe(false);
  });
});

describe("grantsAny", () => {
  it("otorga si al menos uno de los codigos coincide", () => {
    expect(grantsAny([Permisos.OC_GESTIONAR], READ_OC)).toBe(true);
  });

  it("otorga cualquier codigo cuando la sesion tiene el comodin *", () => {
    expect(grantsAny(["*"], READ_OC)).toBe(true);
  });

  it("no otorga si ningun codigo coincide", () => {
    expect(grantsAny([Permisos.CATALOGO_VER], READ_OC)).toBe(false);
  });
});

describe("READ_OC", () => {
  it("solo quien gestiona Ordenes de compra las ve (nadie ve sin poder accionar)", () => {
    expect(READ_OC).toEqual([Permisos.OC_GESTIONAR]);
  });
});

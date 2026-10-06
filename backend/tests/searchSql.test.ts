import { describe, expect, it } from "vitest";
import { buildSearchClause, normalizar, tokenizar } from "../src/dal/repositories/searchSql.js";
import { COM_DESCRIPTORS } from "../src/entities/com/descriptors.js";
import { validateAgainstDescriptor, etiquetaDe } from "../src/common/validation/descriptorValidation.js";
import { ValidationError } from "../src/common/errors/AppError.js";
import { normalizePageQuery } from "../src/common/types/Query.js";

describe("tokenizar / normalizar", () => {
  it("mayúsculas, sin acentos, sin repetidos ni espacios sobrantes", () => {
    expect(normalizar("  Camión  Ñandú ")).toBe("CAMION NANDU");
    expect(tokenizar("  martillo   MARTILLO  Camión ")).toEqual(["MARTILLO", "CAMION"]);
  });

  it("limita la cantidad de palabras (anti-abuso)", () => {
    expect(tokenizar("a b c d e f g h i j")).toHaveLength(6);
  });
});

describe("buildSearchClause", () => {
  const oc = COM_DESCRIPTORS.ordenCompra;

  it("sin texto o solo espacios no agrega filtro", () => {
    expect(buildSearchClause(oc, undefined)).toBeNull();
    expect(buildSearchClause(oc, "   ")).toBeNull();
  });

  it("cada palabra va en un AND; los valores son binds, nunca texto en el SQL", () => {
    const r = buildSearchClause(oc, "acme emitida");
    expect(r).not.toBeNull();
    expect(r!.clause).toContain(" AND ");
    expect(r!.binds["q0"]).toBe("%ACME%");
    expect(r!.binds["q1"]).toBe("%EMITIDA%");
    expect(r!.clause).not.toContain("ACME");
    expect(r!.clause).toContain("COM_PROVEEDOR"); // busca tambien por el nombre del proveedor
    expect(r!.clause).toContain("COM_ORDEN_COMPRA_DETALLE"); // y por lo que se compro
  });

  it("escapa % _ y \\ del usuario (son texto, no comodines)", () => {
    const r = buildSearchClause(oc, "50%_\\");
    expect(r!.binds["q0"]).toBe("%50\\%\\_\\\\%");
    expect(r!.clause).toContain("ESCAPE '\\'");
  });

  it("intento de inyeccion queda como dato inerte en un bind", () => {
    const r = buildSearchClause(oc, "x') OR 1=1 --");
    expect(r!.clause).not.toContain("1=1");
    for (const v of Object.values(r!.binds)) expect(typeof v === "string" || typeof v === "number").toBe(true);
  });

  it("un número (o OC-12) compara por id exacto, no por LIKE", () => {
    const a = buildSearchClause(oc, "12");
    expect(a!.binds["q0id"]).toBe(12);
    expect(a!.clause).toContain("ID_ORDEN_COMPRA = :q0id");
    const b = buildSearchClause(oc, "OC-37");
    expect(b!.binds["q0id"]).toBe(37);
  });

  it("palabras con digito también buscan en fechas (ISO y dd/mm/aaaa)", () => {
    const r = buildSearchClause(oc, "2026-10");
    expect(r!.clause).toContain("TO_CHAR(FECHA_EMISION, 'YYYY-MM-DD')");
    expect(r!.clause).toContain("TO_CHAR(FECHA_EMISION, 'DD/MM/YYYY')");
    expect(buildSearchClause(oc, "emitida")!.clause).not.toContain("TO_CHAR");
  });

  it("'activo/inactivo' encuentra las banderas A/I y S/N", () => {
    const prov = buildSearchClause(COM_DESCRIPTORS.proveedor, "inactivo");
    expect(prov!.clause).toContain("ESTADO = 'I'");
    const mon = buildSearchClause(COM_DESCRIPTORS.moneda, "activa");
    expect(mon!.clause).toContain("ACTIVA = 'S'");
  });

  it("recepciones: sigue la cadena recepcion -> orden -> proveedor", () => {
    const r = buildSearchClause(COM_DESCRIPTORS.recepcion, "acme");
    expect(r!.clause).toMatch(/ID_ORDEN_COMPRA IN \(SELECT ID_ORDEN_COMPRA FROM COM_ORDEN_COMPRA WHERE .*ID_PROVEEDOR IN \(SELECT ID_PROVEEDOR FROM COM_PROVEEDOR/s);
  });
});

describe("orden por defecto: lo más reciente primero", () => {
  it("documentos y catalogos: pk desc; lineas de detalle: asc", () => {
    for (const k of ["solicitudCompra", "rfqCabecera", "cotizacionProveedor", "ordenCompra", "recepcion", "devolucionProveedor", "proveedor", "moneda"] as const) {
      const d = COM_DESCRIPTORS[k];
      expect(d.defaultOrder, k).toBe("desc");
      expect(d.defaultSort, k).toBe(d.pk.toLowerCase().replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase()));
    }
    for (const k of ["solicitudDetalle", "ordenCompraDetalle", "recepcionDetalle", "cotizacionDetalle", "devolucionDetalle"] as const) {
      expect(COM_DESCRIPTORS[k].defaultOrder, k).toBe("asc");
    }
  });
});

describe("normalizePageQuery robusta", () => {
  it("page/pageSize NaN no llegan a Oracle", () => {
    const q = normalizePageQuery({ page: Number.NaN, pageSize: Number.NaN });
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(20);
  });
  it("recorta el texto de búsqueda", () => {
    expect(normalizePageQuery({ search: "x".repeat(500) }).search).toHaveLength(100);
    expect(normalizePageQuery({ search: "   " }).search).toBeUndefined();
  });
});

describe("limites del DDL en la validación por descriptor", () => {
  const sol = COM_DESCRIPTORS.solicitudDetalle;
  const base = { idArticulo: null, descripcion: "Línea", cantidadSolicitada: 3, idUnidadMedida: 1, fechaRequerida: "2026-12-01" };
  const errs = (body: Record<string, unknown>): string[] => {
    try {
      validateAgainstDescriptor(sol, body, "create", ["idSolicitud"]);
      return [];
    } catch (e) {
      return (e as ValidationError).details.map((d) => `${d.field}: ${d.message}`);
    }
  };

  it("acepta un cuerpo válido", () => {
    expect(errs(base)).toEqual([]);
  });

  it("cantidad: CHECK > 0 del DDL", () => {
    expect(errs({ ...base, cantidadSolicitada: 0 })[0]).toContain("mayor que 0");
    expect(errs({ ...base, cantidadSolicitada: -4 })[0]).toContain("mayor que 0");
  });

  it("cantidad: NUMBER(12,2) -> maximo 10 enteros y 2 decimales", () => {
    expect(errs({ ...base, cantidadSolicitada: 1e10 })[0]).toContain("excede el máximo");
    expect(errs({ ...base, cantidadSolicitada: 1.234 })[0]).toContain("máximo 2 decimales");
    expect(errs({ ...base, cantidadSolicitada: 1.25 })).toEqual([]);
  });

  it("texto: VARCHAR2(255) y no vacío", () => {
    expect(errs({ ...base, descripcion: "x".repeat(256) })[0]).toContain("255 caracteres");
    expect(errs({ ...base, descripcion: "   " })[0]).toContain("no puede estar vacío");
  });

  it("recorta espacios sobrantes de los textos", () => {
    const out = validateAgainstDescriptor(sol, { ...base, descripcion: "  Tornillo  " }, "create", ["idSolicitud"]);
    expect(out["descripcion"]).toBe("Tornillo");
  });

  it("etiquetaDe humaniza camelCase", () => {
    expect(etiquetaDe("fechaRequerida")).toBe("fecha requerida");
  });
});

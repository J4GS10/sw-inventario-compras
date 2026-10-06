import { describe, expect, it } from "vitest";
import { parsearPegado } from "./formSupport.js";

const campos = [
  { name: "idArticulo", label: "Artículo", kind: "select" as const, fillOnSelect: { descripcion: "nombre" } },
  { name: "descripcion", label: "Descripción", kind: "shortText" as const },
  { name: "cantidadSolicitada", label: "Cantidad", kind: "quantity" as const },
];
const opts = {
  idArticulo: [
    { value: "5", label: "ART-001 · Martillo", data: { nombre: "Martillo" } },
    { value: "6", label: "ART-002 · Taladro", data: { nombre: "Taladro" } },
  ],
};

describe("parsearPegado", () => {
  it("sin encabezados: reconoce artículo por nombre y la cantidad por ser número", () => {
    const r = parsearPegado("Martillo\t10\nTaladro\t2,5", campos, opts);
    expect(r.avisos).toEqual([]);
    expect(r.lineas.map((l) => [l["idArticulo"], l["descripcion"], l["cantidadSolicitada"]])).toEqual([
      ["5", "Martillo", "10"],
      ["6", "Taladro", "2.5"],
    ]);
  });

  it("con encabezados: asocia por nombre de columna y por código", () => {
    const r = parsearPegado("Cantidad\tArtículo\n3\tART-002", campos, opts);
    expect(r.lineas[0]!["idArticulo"]).toBe("6");
    expect(r.lineas[0]!["cantidadSolicitada"]).toBe("3");
  });

  it("avisa lo que no reconoce en vez de descartarlo en silencio", () => {
    const r = parsearPegado("Serrucho\t4", [campos[0]!, campos[2]!], opts);
    expect(r.avisos[0]).toContain("Serrucho");
    expect(r.lineas).toHaveLength(1);
  });

  it("miles y decimales a la española", () => {
    const r = parsearPegado("Martillo\t1.250,50", campos, opts);
    expect(r.lineas[0]!["cantidadSolicitada"]).toBe("1250.50");
  });
});

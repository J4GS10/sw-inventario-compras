import { describe, expect, it } from "vitest";
import { puntuarRenglon } from "../src/bll/compras/adjudicacionSugerida.js";

const o = (id: number, prov: number, precio: number, dias = 0) => ({
  idCotizacionDetalle: id,
  idProveedor: prov,
  proveedor: `P${prov}`,
  precioNetoMoneda: precio,
  condicionPagoDias: dias,
});

describe("adjudicación sugerida", () => {
  it("sin otras diferencias gana la más barata", () => {
    const r = puntuarRenglon([o(1, 1, 100), o(2, 2, 120)], () => 70);
    expect(r.sugerida?.idCotizacionDetalle).toBe(1);
  });

  it("un poco más cara pero mucho más confiable y con crédito puede ganar", () => {
    const conf: Record<number, number> = { 1: 30, 2: 95 };
    const r = puntuarRenglon([o(1, 1, 100, 0), o(2, 2, 108, 30)], (p) => conf[p] ?? null);
    expect(r.sugerida?.idCotizacionDetalle).toBe(2);
    expect(r.motivo).toContain("más que la más barata");
  });

  it("una oferta más de 15 % sobre la más barata nunca se sugiere, aunque tenga buen historial", () => {
    const conf: Record<number, number> = { 1: 20, 2: 100 };
    const r = puntuarRenglon([o(1, 1, 100, 0), o(2, 2, 140, 60)], (p) => conf[p] ?? null);
    expect(r.sugerida?.idCotizacionDetalle).toBe(1);
    expect(r.ofertas.find((x) => x.idCotizacionDetalle === 2)?.elegible).toBe(false);
  });

  it("proveedor sin historial puntúa neutral y una sola oferta se sugiere sola", () => {
    expect(puntuarRenglon([o(1, 1, 50)], () => null).motivo).toBe("Única oferta");
    expect(puntuarRenglon([], () => null).sugerida).toBeNull();
  });
});

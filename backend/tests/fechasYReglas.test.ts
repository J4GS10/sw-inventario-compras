import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  aDia,
  diferenciaDias,
  esDiaValido,
  formatoDia,
  hoy,
  sumarDias,
} from "../src/common/util/fechas.js";
import { Validacion } from "../src/common/validation/reglas.js";
import { ValidationError } from "../src/common/errors/AppError.js";
import {
  limiteFuturo,
  ofertaVigente,
  pendienteDeLinea,
  devolvibleDeLinea,
  rfqAceptaCotizaciones,
  validarCabeceraSolicitud,
  validarEntregaOrden,
  validarFechaLimiteRfq,
  validarLineasCotizacion,
  validarLineasOrden,
  validarLineasSolicitud,
  validarVencimientoCotizacion,
} from "../src/bll/compras/reglasDocumentos.js";

// 2026-10-05 20:00 en Guatemala (UTC-6) == 2026-10-06 02:00 UTC.
// Es el caso que rompia `new Date().toISOString().slice(0, 10)`: en UTC ya es "manana".
const NOCHE_GT = new Date("2026-10-06T02:00:00.000Z");

function errores(fn: (v: Validacion) => void): Record<string, string> {
  const v = new Validacion();
  fn(v);
  try {
    v.lanzarSiHay("x");
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    const out: Record<string, string> = {};
    for (const d of (e as ValidationError).details) out[d.field ?? ""] = d.message;
    return out;
  }
  return {};
}

describe("fechas de calendario", () => {
  const tz = process.env["APP_TIMEZONE"];
  beforeEach(() => {
    delete process.env["APP_TIMEZONE"];
  });
  afterEach(() => {
    if (tz === undefined) delete process.env["APP_TIMEZONE"];
    else process.env["APP_TIMEZONE"] = tz;
  });

  it("hoy() usa la zona del negocio, no UTC", () => {
    expect(hoy(NOCHE_GT)).toBe("2026-10-05");
    expect(NOCHE_GT.toISOString().slice(0, 10)).toBe("2026-10-06"); // lo que daba el codigo viejo
  });

  it("esDiaValido rechaza dias que no existen", () => {
    expect(esDiaValido("2026-02-28")).toBe(true);
    expect(esDiaValido("2028-02-29")).toBe(true);
    expect(esDiaValido("2026-02-29")).toBe(false);
    expect(esDiaValido("2026-02-30")).toBe(false);
    expect(esDiaValido("2026-13-01")).toBe(false);
    expect(esDiaValido("2026-00-10")).toBe(false);
    expect(esDiaValido("hoy")).toBe(false);
  });

  it("aDia normaliza dia, ISO con hora, Date y descarta basura", () => {
    expect(aDia("2026-10-05")).toBe("2026-10-05");
    // Columna DATE de Oracle: medianoche UTC == dia de calendario (no se corre al dia anterior).
    expect(aDia("2026-10-19T00:00:00.000Z")).toBe("2026-10-19");
    expect(aDia(new Date("2026-10-19T00:00:00.000Z"))).toBe("2026-10-19");
    // Instante real (TIMESTAMP): se lleva al dia local del negocio.
    expect(aDia("2026-10-06T02:00:00.000Z")).toBe("2026-10-05");
    expect(aDia("2026-02-30")).toBeNull();
    expect(aDia("")).toBeNull();
    expect(aDia("5")).toBeNull();
    expect(aDia("manana")).toBeNull();
    expect(aDia(null)).toBeNull();
    expect(aDia(20261005)).toBeNull();
  });

  it("sumarDias / diferenciaDias / formatoDia", () => {
    expect(sumarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(diferenciaDias("2026-10-01", "2026-10-15")).toBe(14);
    expect(formatoDia("2026-10-05")).toBe("05/10/2026");
  });
});

describe("Validación (reglas reutilizables)", () => {
  it("acumula todos los errores en una sola respuesta 422", () => {
    const e = errores((v) => {
      v.positivo("cantidad", "La cantidad", 0);
      v.positivo("precio", "El precio", -3);
      v.porcentaje("desc", "El descuento", 101);
      v.texto("motivo", "El motivo", "   ", { max: 10 });
    });
    expect(Object.keys(e)).toEqual(["cantidad", "precio", "desc", "motivo"]);
  });

  it("número rechaza NaN, Infinity, texto y booleanos", () => {
    const e = errores((v) => {
      v.numero("a", "A", "abc");
      v.numero("b", "B", Infinity);
      v.numero("c", "C", true);
      v.numero("d", "D", null);
    });
    expect(Object.keys(e)).toEqual(["a", "b", "c", "d"]);
  });

  it("id exige entero positivo", () => {
    const e = errores((v) => {
      v.id("a", "A", 1.5);
      v.id("b", "B", 0);
      v.id("c", "C", -2);
      v.id("ok", "OK", 7);
    });
    expect(Object.keys(e)).toEqual(["a", "b", "c"]);
  });

  it("texto: recorta, valida mínimo y máximo", () => {
    const v = new Validacion();
    expect(v.texto("t", "T", "  hola  ", { max: 10 })).toBe("hola");
    expect(v.hayErrores).toBe(false);
    expect(errores((x) => x.texto("t", "T", "ab", { min: 5, max: 10 }))["t"]).toContain("al menos 5");
    expect(errores((x) => x.texto("t", "T", "x".repeat(11), { max: 10 }))["t"]).toContain("no puede superar 10");
  });

  it("noAnteriorA / noPosteriorA incluyen el limite (mismo dia es valido)", () => {
    expect(errores((v) => v.noAnteriorA("f", "F", "2026-10-05", "2026-10-05", "hoy"))).toEqual({});
    expect(errores((v) => v.noAnteriorA("f", "F", "2026-10-04", "2026-10-05", "hoy"))["f"]).toContain("anterior a hoy");
    expect(errores((v) => v.noPosteriorA("f", "F", "2026-10-06", "2026-10-05", "el tope"))["f"]).toContain("posterior a el tope");
  });
});

describe("reglas de solicitud", () => {
  it("rechaza fecha requerida pasada, cantidad <= 0 y descripcion vacia", () => {
    const e = errores((v) =>
      validarLineasSolicitud(
        v,
        [
          { descripcion: "Martillo", cantidadSolicitada: 5, fechaRequerida: "2026-10-04" },
          { descripcion: " ", cantidadSolicitada: 0, fechaRequerida: "2026-10-20" },
        ],
        NOCHE_GT,
      ),
    );
    expect(e["detalles[0].fechaRequerida"]).toContain("anterior a hoy");
    expect(e["detalles[1].descripcion"]).toBeDefined();
    expect(e["detalles[1].cantidadSolicitada"]).toContain("mayor que 0");
  });

  it("acepta fecha requerida = hoy (en hora local, aunque en UTC ya sea manana)", () => {
    const e = errores((v) =>
      validarLineasSolicitud(v, [{ descripcion: "Clavo", cantidadSolicitada: 1, fechaRequerida: "2026-10-05" }], NOCHE_GT),
    );
    expect(e).toEqual({});
  });

  it("rechaza fechas absurdas (typo de ano) y días inexistentes", () => {
    const e = errores((v) =>
      validarLineasSolicitud(
        v,
        [
          { descripcion: "A", cantidadSolicitada: 1, fechaRequerida: "2206-10-05" },
          { descripcion: "B", cantidadSolicitada: 1, fechaRequerida: "2026-02-30" },
        ],
        NOCHE_GT,
      ),
    );
    expect(e["detalles[0].fechaRequerida"]).toContain("posterior");
    expect(e["detalles[1].fechaRequerida"]).toContain("no es una fecha válida");
  });

  it("sin líneas no hay solicitud", () => {
    expect(errores((v) => validarLineasSolicitud(v, []))["detalles"]).toContain("al menos una línea");
  });

  it("cabecera: prioridad 1-5 entera, justificación mínima, monto no negativo", () => {
    const e = errores((v) =>
      validarCabeceraSolicitud(v, { justificacion: "abc", prioridad: 9, montoEstimado: -1 }),
    );
    expect(e["justificacion"]).toContain("al menos");
    expect(e["prioridad"]).toContain("entre 1 y 5");
    expect(e["montoEstimado"]).toContain("negativo");
    expect(errores((v) => validarCabeceraSolicitud(v, { justificacion: "Reposición de stock", prioridad: 3 }))).toEqual({});
  });

  it("edición parcial solo valida lo enviado", () => {
    expect(errores((v) => validarCabeceraSolicitud(v, { prioridad: 2 }, true))).toEqual({});
    expect(errores((v) => validarCabeceraSolicitud(v, { prioridad: 0 }, true))["prioridad"]).toBeDefined();
  });
});

describe("reglas de RFQ y cotización", () => {
  it("fecha límite: no pasada y no posterior a la última fecha requerida", () => {
    expect(errores((v) => validarFechaLimiteRfq(v, "2026-10-04", null, NOCHE_GT))["fechaLimite"]).toContain("anterior a hoy");
    expect(errores((v) => validarFechaLimiteRfq(v, "2026-10-25", "2026-10-20", NOCHE_GT))["fechaLimite"]).toContain(
      "posterior a la última fecha",
    );
    expect(errores((v) => validarFechaLimiteRfq(v, "2026-10-20", "2026-10-20", NOCHE_GT))).toEqual({});
    expect(errores((v) => validarFechaLimiteRfq(v, "2026-10-05", null, NOCHE_GT))).toEqual({});
  });

  it("el RFQ acepta ofertas hasta el final de su fecha límite (inclusive)", () => {
    expect(rfqAceptaCotizaciones("2026-10-05", NOCHE_GT)).toBe(true);
    expect(rfqAceptaCotizaciones("2026-10-04", NOCHE_GT)).toBe(false);
    expect(rfqAceptaCotizaciones(null, NOCHE_GT)).toBe(true);
  });

  it("vencimiento de la oferta no puede ser pasado", () => {
    expect(errores((v) => validarVencimientoCotizacion(v, "2026-10-01", NOCHE_GT))["fechaVencimiento"]).toContain("anterior a hoy");
    expect(errores((v) => validarVencimientoCotizacion(v, "2026-10-05", NOCHE_GT))).toEqual({});
  });

  it("líneas de cotización: renglón ajeno, repetido, precio/cantidad/porcentajes", () => {
    const e = errores((v) =>
      validarLineasCotizacion(
        v,
        [
          { idSolicitudDetalle: 10, precioUnitario: 5, cantidad: 2, porcentajeDescuento: 0, porcentajeImpuesto: 12 },
          { idSolicitudDetalle: 10, precioUnitario: 5, cantidad: 2, porcentajeDescuento: 0, porcentajeImpuesto: 12 },
          { idSolicitudDetalle: 99, precioUnitario: 0, cantidad: -1, porcentajeDescuento: 150, porcentajeImpuesto: -5 },
        ],
        new Set([10, 11]),
      ),
    );
    expect(e["lineas[1].idSolicitudDetalle"]).toContain("repetido");
    expect(e["lineas[2].idSolicitudDetalle"]).toContain("no pertenece");
    expect(e["lineas[2].precioUnitario"]).toContain("mayor que 0");
    expect(e["lineas[2].cantidad"]).toContain("mayor que 0");
    expect(e["lineas[2].porcentajeDescuento"]).toContain("entre 0 y 100");
    expect(e["lineas[2].porcentajeImpuesto"]).toContain("entre 0 y 100");
  });
});

describe("reglas de orden de compra", () => {
  it("entrega: no pasada, no antes de emisión ni de la solicitud", () => {
    expect(errores((v) => validarEntregaOrden(v, "2026-10-04", {}, NOCHE_GT))["fechaEntregaEsperada"]).toContain("anterior a hoy");
    // edicion: la entrega no puede quedar antes del dia de emision de la propia orden
    expect(
      errores((v) => validarEntregaOrden(v, "2026-10-05", { emision: "2026-10-05" }, NOCHE_GT)),
    ).toEqual({});
    expect(
      errores((v) => validarEntregaOrden(v, "2026-10-10", { solicitud: "2026-10-12" }, NOCHE_GT))["fechaEntregaEsperada"],
    ).toContain("solicitud de origen");
  });

  it("lineas: cantidad > 0, precio >= 0, porcentajes, oferta repetida", () => {
    const e = errores((v) =>
      validarLineasOrden(v, [
        { cantidad: 0 },
        { cantidad: 2, precioUnitario: -1, porcentajeDescuento: 101, toleranciaPorcentaje: 200, idCotizacionDetalle: 7 },
        { cantidad: 1, idCotizacionDetalle: 7 },
      ]),
    );
    expect(e["lineas[0].cantidad"]).toBeDefined();
    expect(e["lineas[1].precioUnitario"]).toContain("negativo");
    expect(e["lineas[1].porcentajeDescuento"]).toBeDefined();
    expect(e["lineas[1].toleranciaPorcentaje"]).toBeDefined();
    expect(e["lineas[2].idCotizacionDetalle"]).toContain("ya está en otra línea");
  });

  it("una oferta vencida ya no sirve para emitir orden", () => {
    expect(ofertaVigente("2026-10-05", NOCHE_GT)).toBe(true);
    expect(ofertaVigente("2026-10-04", NOCHE_GT)).toBe(false);
  });
});

describe("cantidades de recepción y devolución", () => {
  it("pendiente y devolvible nunca son negativos ni arrastran error de coma flotante", () => {
    expect(pendienteDeLinea(10, 4)).toBe(6);
    expect(pendienteDeLinea(10, 12)).toBe(0);
    expect(pendienteDeLinea(0.3, 0.1 + 0.2)).toBe(0);
    expect(devolvibleDeLinea(5, 5)).toBe(0);
    expect(devolvibleDeLinea(5, 2)).toBe(3);
  });

  it("limiteFuturo es hoy + 3 anos", () => {
    expect(limiteFuturo(NOCHE_GT)).toBe(sumarDias("2026-10-05", 366 * 3));
  });
});

import { validarFechasLiquidacion } from "../src/bll/services/com/LiquidacionService.js";

describe("liquidación de facturas: cronologia", () => {
  // hoy (GT) = 2026-10-05
  const f = (emision: string, documento: string, pago: string) => ({ fechaEmision: emision, fechaDocumento: documento, fechaPago: pago });

  it("orden <= documento <= pago, todo <= hoy: valido", () => {
    expect(errores((v) => validarFechasLiquidacion(v, f("2026-10-03", "2026-10-03", "2026-10-05"), "2026-10-01", NOCHE_GT))).toEqual({});
  });

  it("documento anterior a la orden de compra -> error", () => {
    const e = errores((v) => validarFechasLiquidacion(v, f("2026-09-20", "2026-09-20", "2026-10-05"), "2026-10-01", NOCHE_GT));
    expect(e["fechaDocumento"]).toContain("anterior a la fecha de la orden de compra");
    expect(e["fechaEmision"]).toContain("anterior a la fecha de la orden de compra");
  });

  it("documento fechado en el futuro -> error", () => {
    const e = errores((v) => validarFechasLiquidacion(v, f("2026-10-06", "2026-10-07", "2026-10-08"), null, NOCHE_GT));
    expect(e["fechaDocumento"]).toContain("posterior a hoy");
    expect(e["fechaEmision"]).toContain("posterior a hoy");
  });

  it("pago antes de la fecha del documento -> error; pago agendado hasta 90 dias esta permitido", () => {
    expect(errores((v) => validarFechasLiquidacion(v, f("2026-10-03", "2026-10-03", "2026-10-02"), null, NOCHE_GT))["fechaPago"]).toContain(
      "anterior a la fecha del documento",
    );
    expect(errores((v) => validarFechasLiquidacion(v, f("2026-10-03", "2026-10-03", "2026-12-20"), null, NOCHE_GT))).toEqual({});
    expect(errores((v) => validarFechasLiquidacion(v, f("2026-10-03", "2026-10-03", "2027-03-01"), null, NOCHE_GT))["fechaPago"]).toContain(
      "posterior",
    );
  });

  it("fechas inexistentes o vacías se reportan por campo", () => {
    const e = errores((v) => validarFechasLiquidacion(v, f("", "2026-02-30", "x"), null, NOCHE_GT));
    expect(Object.keys(e).sort()).toEqual(["fechaDocumento", "fechaEmision", "fechaPago"]);
  });
});

import { validarRangoFechas } from "../src/bll/compras/reglasDocumentos.js";

describe("rango de fechas de consulta", () => {
  it("vacío, válido, invertido y basura", () => {
    expect(validarRangoFechas(undefined, "")).toEqual({});
    expect(validarRangoFechas("2026-01-01", "2026-01-31")).toEqual({ desde: "2026-01-01", hasta: "2026-01-31" });
    expect(validarRangoFechas("2026-01-31", "2026-01-31")).toEqual({ desde: "2026-01-31", hasta: "2026-01-31" });
    expect(() => validarRangoFechas("2026-02-01", "2026-01-01")).toThrow(/Rango de fechas inválido/);
    expect(() => validarRangoFechas("abc", undefined)).toThrow(ValidationError);
    expect(() => validarRangoFechas("2026-02-30", undefined)).toThrow(ValidationError);
  });
});

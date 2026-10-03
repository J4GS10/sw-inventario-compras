import { describe, expect, it } from "vitest";
import { validateAgainstDescriptor } from "../src/common/validation/descriptorValidation.js";
import { isAppError } from "../src/common/errors/AppError.js";
import {
  COM_MONEDA,
  COM_SOLICITUD_COMPRA,
} from "../src/entities/com/descriptors.js";

describe("validateAgainstDescriptor", () => {
  it("acepta un cuerpo valido y solo devuelve columnas escribibles", () => {
    const clean = validateAgainstDescriptor(
      COM_MONEDA,
      { codigo: "GTQ", nombre: "Quetzal", simbolo: "Q", activa: true, idMoneda: 999 },
      "create",
    );
    expect(clean).toEqual({
      codigo: "GTQ",
      nombre: "Quetzal",
      simbolo: "Q",
      activa: true,
    });
    expect(clean).not.toHaveProperty("idMoneda");
  });

  it("exige campos obligatorios en create", () => {
    try {
      validateAgainstDescriptor(COM_MONEDA, { simbolo: "Q" }, "create");
      expect.unreachable("deberia lanzar ValidationError");
    } catch (e) {
      expect(isAppError(e)).toBe(true);
      if (isAppError(e)) {
        expect(e.code).toBe("VALIDATION");
        expect(e.details.map((d) => d.field)).toContain("codigo");
      }
    }
  });

  it("valida el enum de ESTADO de la solicitud", () => {
    expect(() =>
      validateAgainstDescriptor(
        COM_SOLICITUD_COMPRA,
        {
          idEmpleadoSolicitante: 1,
          idSucursal: 1,
          idGrupoCompra: 1,
          idTerminoEntrega: 1,
          estado: "NO_EXISTE",
          justificacion: "x",
          prioridad: 3,
        },
        "create",
      ),
    ).toThrow();
  });

  it("en update no exige campos ausentes", () => {
    const clean = validateAgainstDescriptor(
      COM_MONEDA,
      { nombre: "Nuevo nombre" },
      "update",
    );
    expect(clean).toEqual({ nombre: "Nuevo nombre" });
  });
});

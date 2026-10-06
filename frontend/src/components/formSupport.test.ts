import { describe, expect, it } from "vitest";
import { limiteError } from "./formSupport.js";

const campo = { name: "cantidadDevuelta", label: "Cantidad", kind: "quantity" as const, limitFrom: { select: "idRenglon", prop: "cantidadRecibida", noun: "recibido" } };
const opts = { idRenglon: [{ value: "7", label: "r7", data: { cantidadRecibida: 10 } }] };

describe("limiteError", () => {
  it("avisa al superar lo recibido", () => {
    expect(limiteError(campo, { idRenglon: "7", cantidadDevuelta: "11" }, opts)).toBe("No puede superar lo recibido (10)");
  });
  it("no avisa dentro del tope, vacío o sin renglón elegido", () => {
    expect(limiteError(campo, { idRenglon: "7", cantidadDevuelta: "10" }, opts)).toBeNull();
    expect(limiteError(campo, { idRenglon: "7", cantidadDevuelta: "" }, opts)).toBeNull();
    expect(limiteError(campo, { idRenglon: "", cantidadDevuelta: "99" }, opts)).toBeNull();
  });
});

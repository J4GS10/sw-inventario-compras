import { describe, expect, it } from "vitest";
import { StateMachine } from "../src/bll/support/StateMachine.js";
import { ORDEN_COMPRA_ESTADOS } from "../src/entities/com/descriptors.js";

type OcEstado = (typeof ORDEN_COMPRA_ESTADOS)[number];

const ocMachine = new StateMachine<OcEstado>(
  {
    EMITIDA: ["ENVIADA", "CANCELADA", "RECHAZADA"],
    ENVIADA: ["EN_TRANSITO", "CANCELADA"],
    EN_TRANSITO: ["RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA"],
    RECIBIDA_PARCIAL: ["RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA"],
    RECIBIDA_COMPLETA: [],
    CANCELADA: [],
    RECHAZADA: [],
  },
  "OrdenCompra",
);

describe("StateMachine", () => {
  it("permite transiciones declaradas", () => {
    expect(ocMachine.canTransition("EMITIDA", "ENVIADA")).toBe(true);
    expect(ocMachine.canTransition("EN_TRANSITO", "RECIBIDA_COMPLETA")).toBe(true);
  });

  it("rechaza transiciones no declaradas", () => {
    expect(ocMachine.canTransition("EMITIDA", "RECIBIDA_COMPLETA")).toBe(false);
    expect(() => ocMachine.assertTransition("RECIBIDA_COMPLETA", "ENVIADA")).toThrow();
  });

  it("acepta la transicion identidad", () => {
    expect(() => ocMachine.assertTransition("ENVIADA", "ENVIADA")).not.toThrow();
  });

  it("lista los estados siguientes", () => {
    expect(ocMachine.nextStates("EMITIDA")).toEqual([
      "ENVIADA",
      "CANCELADA",
      "RECHAZADA",
    ]);
  });
});

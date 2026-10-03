import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NavLeaf } from "../nav.js";
import { FlowStepper } from "./FlowStepper.js";

/**
 * `PERM_RFQ`/`hasAnyPerm` se referencian dentro de las factories de `vi.mock`
 * (hoisted por Vitest antes de los imports), por eso van en `vi.hoisted`.
 */
const { PERM_RFQ, hasAnyPerm } = vi.hoisted(() => {
  const perm = "TEST_PERM_RFQ";
  return { PERM_RFQ: perm, hasAnyPerm: vi.fn((codes: readonly string[]) => codes.includes(perm)) };
});

// Fixture controlada: solo el leaf de RFQ otorga TEST_PERM_RFQ, el resto usa
// permisos que `hasAnyPerm` (mockeado abajo) nunca concede.
vi.mock("../nav.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../nav.js")>();
  const leaves: readonly NavLeaf[] = [
    { id: "com-doc-solicitudes", label: "Solicitudes", kind: "documento", icon: "grid", perm: ["OTRO_1"] },
    { id: "com-doc-rfq", label: "RFQ", kind: "documento", icon: "grid", perm: [PERM_RFQ] },
    { id: "com-doc-cotizaciones", label: "Cotizaciones", kind: "documento", icon: "grid", perm: ["OTRO_2"] },
    { id: "com-an-comparativo", label: "Comparativo", kind: "documento", icon: "grid", perm: ["OTRO_3"] },
    { id: "com-doc-ordenes", label: "Ordenes", kind: "documento", icon: "grid", perm: ["OTRO_4"] },
    { id: "com-doc-recepciones", label: "Recepciones", kind: "documento", icon: "grid", perm: ["OTRO_5"] },
    { id: "com-doc-devoluciones", label: "Devoluciones", kind: "documento", icon: "grid", perm: ["OTRO_6"] },
  ];
  return { ...actual, ALL_LEAVES: leaves };
});

vi.mock("../core/auth/AuthContext.js", () => ({
  useAuth: () => ({ hasAnyPerm }),
}));

describe("FlowStepper — gating por permiso (WS2)", () => {
  it("solo el paso alcanzable por el rol queda habilitado; el resto se atenua y deshabilita", () => {
    render(<FlowStepper current="rfq" />);

    const rfqBtn = screen.getByRole("button", { name: /RFQ/ });
    expect(rfqBtn).toBeEnabled();
    expect(rfqBtn).toHaveAttribute("aria-current", "step");

    const solicitudBtn = screen.getByRole("button", { name: /^Solicitud$/ });
    expect(solicitudBtn).toBeDisabled();
  });

  it("un paso deshabilitado no dispara onStep al hacer click; uno habilitado si", async () => {
    const user = userEvent.setup();
    const onStep = vi.fn();
    render(<FlowStepper current="rfq" onStep={onStep} />);

    await user.click(screen.getByRole("button", { name: /^Solicitud$/ }));
    expect(onStep).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /RFQ/ }));
    expect(onStep).toHaveBeenCalledWith("com-doc-rfq");
  });
});

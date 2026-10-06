import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkError, ValidationError } from "./errors.js";

let comportamiento: (key: string) => Promise<unknown> = async () => ({ idX: 1 });
const claves: string[] = [];
vi.mock("./HttpClient.js", () => ({
  http: {
    postConClave: async (_p: string, _b: unknown, key: string) => {
      claves.push(key);
      return comportamiento(key);
    },
  },
}));

const { encolarEnvio, procesarCola, pendientesEnCola } = await import("./outbox.js");

beforeEach(() => {
  window.localStorage.clear();
  claves.length = 0;
  comportamiento = async () => ({ idX: 1 });
});

describe("cola de envíos sin conexión", () => {
  it("sin red el envío queda en cola y se conserva; con red sale en orden", async () => {
    encolarEnvio(1, "Solicitud", "/api/com/solicitudes", { a: 1 });
    encolarEnvio(1, "Solicitud", "/api/com/solicitudes", { a: 2 });
    comportamiento = async () => {
      throw new NetworkError();
    };
    expect((await procesarCola(1)).quedan).toBe(2);
    comportamiento = async () => ({ ok: true });
    const r = await procesarCola(1);
    expect(r.enviados).toHaveLength(2);
    expect(pendientesEnCola(1)).toBe(0);
  });

  it("reintenta con la MISMA clave de idempotencia (no duplica)", async () => {
    encolarEnvio(1, "Solicitud", "/x", {});
    comportamiento = async () => {
      throw new NetworkError();
    };
    await procesarCola(1);
    await procesarCola(1);
    expect(new Set(claves).size).toBe(1);
  });

  it("un rechazo del servidor saca el envío de la cola y avisa el motivo", async () => {
    encolarEnvio(1, "Solicitud", "/x", {});
    comportamiento = async () => {
      throw new ValidationError("Fecha requerida anterior a hoy");
    };
    const r = await procesarCola(1);
    expect(r.rechazados[0]!.motivo).toContain("Fecha requerida");
    expect(r.quedan).toBe(0);
  });
});

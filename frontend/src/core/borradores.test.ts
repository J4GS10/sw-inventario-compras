import { beforeEach, describe, expect, it, vi } from "vitest";

const remoto: { clave: string; contenido: string; actualizadoEn: number }[] = [];
const llamadas: string[] = [];

vi.mock("./HttpClient.js", () => ({
  http: {
    getToken: () => "t",
    get: async () => remoto,
    put: async (_p: string, body: { clave: string }) => {
      llamadas.push(`PUT ${body.clave}`);
    },
    delete: async (p: string) => {
      llamadas.push(`DELETE ${decodeURIComponent(p)}`);
    },
  },
}));

const { sincronizarBorradores, quitarBorrador } = await import("./borradores.js");

const K = "erp.borrador.7.solicitudes";

beforeEach(() => {
  window.localStorage.clear();
  remoto.length = 0;
  llamadas.length = 0;
});

describe("sincronizarBorradores", () => {
  it("trae al equipo el borrador que solo existe en el servidor", async () => {
    remoto.push({ clave: K, contenido: JSON.stringify({ header: { a: "1" }, en: 500 }), actualizadoEn: 500 });
    expect(await sincronizarBorradores(7)).toBe(1);
    expect(JSON.parse(window.localStorage.getItem(K)!)).toMatchObject({ header: { a: "1" } });
  });

  it("gana el más reciente: el servidor reemplaza un local más viejo", async () => {
    window.localStorage.setItem(K, JSON.stringify({ header: { a: "viejo" }, en: 100 }));
    remoto.push({ clave: K, contenido: JSON.stringify({ header: { a: "nuevo" }, en: 900 }), actualizadoEn: 900 });
    await sincronizarBorradores(7);
    expect(JSON.parse(window.localStorage.getItem(K)!).header.a).toBe("nuevo");
  });

  it("sube lo local que nunca llegó al servidor", async () => {
    window.localStorage.setItem(K, JSON.stringify({ header: {}, en: 100 }));
    await sincronizarBorradores(7);
    await Promise.resolve();
    expect(llamadas).toContain(`PUT ${K}`);
  });

  it("descarta lo local que el servidor ya no tiene y sí había confirmado (se registró en otro equipo)", async () => {
    window.localStorage.setItem(K, JSON.stringify({ header: {}, en: 100 }));
    remoto.push({ clave: K, contenido: JSON.stringify({ header: {}, en: 100 }), actualizadoEn: 100 });
    await sincronizarBorradores(7); // queda confirmado
    remoto.length = 0; // otro equipo lo registró y lo borró
    await sincronizarBorradores(7);
    expect(window.localStorage.getItem(K)).toBeNull();
  });

  it("no toca borradores de otro usuario", async () => {
    window.localStorage.setItem("erp.borrador.8.solicitudes", JSON.stringify({ en: 1 }));
    await sincronizarBorradores(7);
    expect(window.localStorage.getItem("erp.borrador.8.solicitudes")).not.toBeNull();
  });

  it("quitarBorrador lo borra aquí y en el servidor", () => {
    window.localStorage.setItem(K, JSON.stringify({ en: 1 }));
    quitarBorrador(K);
    expect(window.localStorage.getItem(K)).toBeNull();
    expect(llamadas).toContain(`DELETE /api/borradores?clave=${K}`);
  });
});

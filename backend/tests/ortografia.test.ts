/**
 * Guardia ortografica: ningun texto VISIBLE (cadenas, plantillas, JSX) del frontend ni del backend puede llevar
 * una palabra del diccionario sin su tilde. Si falla: `node scripts/tildes.mjs frontend/src backend/src`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { acentuar } from "../src/common/util/acentos.js";
import { etiquetaDe } from "../src/common/validation/descriptorValidation.js";

const RAIZ = resolve(__dirname, "../..");
const importar = async (rel: string): Promise<Record<string, unknown>> =>
  (await import(pathToFileURL(join(RAIZ, rel)).href)) as Record<string, unknown>;

function archivos(dir: string, salida: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && e.name !== "dist") archivos(p, salida);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/generated|vite-env|\.d\.ts$|\.test\./.test(e.name)) salida.push(p);
  }
  return salida;
}

describe("ortografia de textos visibles", () => {
  it("no queda ninguna palabra del diccionario sin tilde en frontend/src ni backend/src", async () => {
    const lib = (await importar("scripts/tildes-lib.mjs")) as { mapearTextos: (s: string, f: string, fn: (t: string) => string, rec: (t: string) => void) => string };
    const dic = ((await importar("scripts/tildes-diccionario.mjs")) as { DICCIONARIO: Record<string, string> }).DICCIONARIO;
    const { acentuar: acentuarBarrido } = (await importar("scripts/tildes-acentuar.mjs")) as { acentuar: (t: string) => string };
    const pendientes: string[] = [];
    for (const f of [...archivos(join(RAIZ, "frontend/src")), ...archivos(join(RAIZ, "backend/src"))]) {
      if (f.endsWith("acentos.generated.ts")) continue;
      lib.mapearTextos(readFileSync(f, "utf8"), f, (t) => t, (t) => {
        if (acentuarBarrido(t) !== t) pendientes.push(`${f.replace(RAIZ, "")}: ${t.trim().slice(0, 100)}`);
      });
    }
    expect(Object.keys(dic).length).toBeGreaterThan(200);
    expect(pendientes).toEqual([]);
  });

  it("los marcadores {campo} de las plantillas de etiqueta no llevan tilde (se mostrarian literales)", () => {
    const malos: string[] = [];
    for (const f of archivos(join(RAIZ, "frontend/src"))) {
      readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
        if (/labelTpl\s*:\s*["`'][^"`']*\{[^}]*[áéíóúñÁÉÍÓÚÑ][^}]*\}/.test(ln)) malos.push(`${f.replace(RAIZ, "")}:${i + 1}`);
      });
    }
    expect(malos).toEqual([]);
  });

  it("textos derivados de nombres de campo salen acentuados", () => {
    expect(etiquetaDe("descripci" + "on")).toBe("descripción");
    expect(etiquetaDe("fechaRecepci" + "on")).toBe("fecha recepción");
    expect(etiquetaDe("cantidadSolicitada")).toBe("cantidad solicitada");
  });

  it("acentuar respeta mayúsculas y no toca palabras ambiguas ni identificadores", () => {
    expect(acentuar("Descripci" + "on")).toBe("Descripci" + "ón");
    expect(acentuar("rechazo del jefe")).toBe("rechazo del jefe");
    expect(acentuar("idArticulo")).toBe("idArticulo");
  });
});

// Lista textos visibles con palabras AMBIGUAS (que/qué, como/cómo, esta/está...) para revision manual.
import fs from "node:fs";
import path from "node:path";
import { mapearTextos } from "./tildes-lib.mjs";

const re = /(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])(donde|cuando|cuanto|cuantos|cuantas|quien|quienes|cual|cuales|como|valida|fallo|envio|aun|estas|Que|Como|Donde|Cuando|Quien|Cual|Cuanto|(?:ver|saber|sabes|sabe|indica|indican|dice|elige|decide|explica|muestra|mostrar|cuenta|dicen|averigua) que|esta)(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/;
function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && e.name !== "dist") recorrer(p);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/generated|vite-env|\.d\.ts$|\.test\./.test(e.name)) {
      const src = fs.readFileSync(p, "utf8");
      mapearTextos(src, p, (t) => t, (t) => {
        if (re.test(t)) console.log(`${path.basename(p)}: ${t.trim().slice(0, 170).replace(/\n/g, " ")}`);
      });
    }
  }
}
for (const d of process.argv.slice(2)) recorrer(path.resolve(d));

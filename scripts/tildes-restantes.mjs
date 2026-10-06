// Lista los textos visibles que AUN contienen palabras del diccionario sin tilde (para revision manual).
import fs from "node:fs";
import path from "node:path";
import { mapearTextos } from "./tildes-lib.mjs";
import { DICCIONARIO } from "./tildes-diccionario.mjs";
const re = new RegExp(`(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])(${Object.keys(DICCIONARIO).join("|")})(?![A-Za-zÁÉÍÓÚáéíóúñÑ])`, "i");
function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "dist") recorrer(p); }
    else if (/\.(ts|tsx)$/.test(e.name) && !/generated|vite-env|\.d\.ts$/.test(e.name)) {
      const src = fs.readFileSync(p, "utf8");
      mapearTextos(src, p, (t) => t, (t) => { if (re.test(t)) console.log(`${path.relative(process.cwd(), p)}: ${t.trim().slice(0, 150)}`); });
    }
  }
}
for (const d of process.argv.slice(2)) recorrer(path.resolve(d));

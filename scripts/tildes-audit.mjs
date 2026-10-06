// Auditoria ortografica: lista las palabras SIN tilde que aparecen en textos visibles (cadenas, plantillas, JSX).
//   node scripts/tildes-audit.mjs <dir> [<dir>...]   -> imprime "palabra\tveces" ordenado alfabeticamente
import fs from "node:fs";
import path from "node:path";
import { extraerTextos } from "./tildes-lib.mjs";

const dirs = process.argv.slice(2);
const cuenta = new Map();
function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      recorrer(p);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/generated|vite-env|\.d\.ts$/.test(e.name)) {
      const src = fs.readFileSync(p, "utf8");
      for (const t of extraerTextos(src, p)) {
        for (const w of t.match(/[A-Za-zÁÉÍÓÚáéíóúñÑüÜ]+/g) ?? []) {
          if (/[ÁÉÍÓÚáéíóúñÑüÜ]/.test(w) || w.length < 3) continue;
          const k = w.toLowerCase();
          cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
        }
      }
    }
  }
}
for (const d of dirs) recorrer(path.resolve(d));
console.log([...cuenta.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([w, n]) => `${w}\t${n}`).join("\n"));

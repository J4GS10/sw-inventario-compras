// Barrido ortografico (v2) de texto visible. Idempotente.
//   node scripts/tildes.mjs [--dry] [--tests] <dir> [<dir>...]
// --dry   : no escribe; imprime cada linea que cambiaria.
// --tests : incluye archivos *.test.* (por defecto se omiten).
import fs from "node:fs";
import path from "node:path";
import { mapearTextos } from "./tildes-lib.mjs";
import { acentuar } from "./tildes-acentuar.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const TESTS = args.includes("--tests");
const dirs = args.filter((a) => !a.startsWith("--"));

let archivos = 0;
let cambiados = 0;
function procesar(file) {
  const src = fs.readFileSync(file, "utf8");
  const crlf = src.includes("\r\n");
  const base = crlf ? src.replace(/\r\n/g, "\n") : src;
  const out = mapearTextos(base, file, acentuar);
  archivos++;
  if (out === base) return;
  cambiados++;
  if (DRY) {
    const a = base.split("\n");
    const b = out.split("\n");
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) console.log(`${path.relative(process.cwd(), file)}:${i + 1}: ${b[i].trim()}`);
  } else {
    fs.writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out, "utf8");
  }
}

function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      recorrer(p);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/generated|vite-env|ortografia\.test|\.d\.ts$/.test(e.name) && (TESTS || !/\.test\./.test(e.name))) procesar(p);
  }
}
for (const d of dirs) recorrer(path.resolve(d));
console.error(`${DRY ? "(simulacion) " : ""}${cambiados} archivos modificados de ${archivos}`);

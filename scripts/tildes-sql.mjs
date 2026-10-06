// Acentua los TEXTOS de las semillas SQL (database/dml/*.sql): nombres, descripciones, etiquetas.
//   node scripts/tildes-sql.mjs [--dry] [--pares salida.json]
// Imprime/guarda los pares "antes" -> "despues" para poder actualizar tambien la base ya cargada.
import fs from "node:fs";
import path from "node:path";
import { acentuar } from "./tildes-acentuar.mjs";
import { esTextoUsuario } from "./tildes-lib.mjs";

const DRY = process.argv.includes("--dry");
const iPares = process.argv.indexOf("--pares");
const salidaPares = iPares >= 0 ? process.argv[iPares + 1] : null;
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "../database/dml");
const pares = new Map();

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
  const p = path.join(dir, f);
  const src = fs.readFileSync(p, "utf8");
  const lineas = src.split("\n").map((ln) => {
    if (/^\s*--/.test(ln)) return ln;
    // solo literales 'texto' (sin '' escapados) que parezcan texto de usuario
    return ln.replace(/'([^'\n]*)'/g, (m, c) => {
      if (!esTextoUsuario(c)) return m;
      const nuevo = acentuar(c);
      if (nuevo === c) return m;
      pares.set(c, nuevo);
      return `'${nuevo}'`;
    });
  });
  const out = lineas.join("\n");
  if (out !== src) {
    console.log(`${f}: ${[...pares].length} textos acumulados`);
    if (!DRY) fs.writeFileSync(p, out, "utf8");
  }
}
for (const [a, b] of pares) console.log(`  '${a}' -> '${b}'`);
if (salidaPares !== null && !DRY) fs.writeFileSync(salidaPares, JSON.stringify([...pares], null, 1), "utf8");

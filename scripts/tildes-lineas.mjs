// Red de seguridad: lineas (fuera de comentarios) donde una palabra del diccionario sin tilde aparece EN PROSA
// (rodeada de palabras) y que el barrido no detecto como texto visible. Para revision manual.
import fs from "node:fs";
import path from "node:path";
import { DICCIONARIO } from "./tildes-diccionario.mjs";

const lista = Object.keys(DICCIONARIO).join("|");
const prosa = new RegExp(`[A-Za-záéíóúñ,;:.¿¡(]\\s(?:${lista})\\s[A-Za-záéíóúñ]|^\\s*(?:${lista})\\s[a-záéíóúñ]+ [a-záéíóúñ]+|[a-záéíóúñ] [a-záéíóúñ]+ (?:${lista})[.,;:)!?]?\\s*$`, "i");

function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && e.name !== "dist") recorrer(p);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/generated|vite-env|\.d\.ts$|\.test\./.test(e.name)) {
      let enBloque = false;
      fs.readFileSync(p, "utf8").split("\n").forEach((ln, i) => {
        const t = ln.trim();
        if (enBloque) { if (t.includes("*/")) enBloque = false; return; }
        if (t.startsWith("/*")) { if (!t.includes("*/")) enBloque = true; return; }
        if (t.startsWith("//") || t.startsWith("*")) return;
        const sinComentario = ln.replace(/\s\/\/.*$/, "").replace(/\{\/\*.*?\*\/\}/g, "");
        if (prosa.test(sinComentario)) console.log(`${path.basename(p)}:${i + 1}: ${t.slice(0, 150)}`);
      });
    }
  }
}
for (const d of process.argv.slice(2)) recorrer(path.resolve(d));

// Genera backend/src/common/util/acentos.generated.ts desde el diccionario del barrido (una sola fuente de verdad).
import fs from "node:fs";
import { DICCIONARIO } from "./tildes-diccionario.mjs";
const filas = Object.entries(DICCIONARIO).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `  ${k}: "${v}",`).join("\n");
fs.writeFileSync(
  new URL("../backend/src/common/util/acentos.generated.ts", import.meta.url),
  `// GENERADO por scripts/gen-acentos.mjs a partir de scripts/tildes-diccionario.mjs. No editar a mano.\nexport const ACENTOS: Readonly<Record<string, string>> = {\n${filas}\n};\n`,
);

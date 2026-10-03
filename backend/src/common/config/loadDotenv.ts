/**
 * Capa 6 - Componentes Comunes.
 * Carga minima de un archivo `.env` (sin dependencias). No sobreescribe
 * variables ya presentes en el entorno. Se invoca una vez al arrancar, antes
 * de la primera lectura de EnvConfig.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadDotenv(candidatePaths?: readonly string[]): void {
  const paths = candidatePaths ?? [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    return;
  }
}

/**
 * Genera `src/entities/support/ddlLimits.generated.ts` a partir de
 * `database/ddl/SCRIPT_DDL.sql` (esquema canonico).
 *
 * Extrae por columna: longitud maxima (VARCHAR2/CHAR), precision/escala
 * (NUMBER) y CHECKs de rango (`> 0`, `>= 0`, `BETWEEN a AND b`). Asi las
 * validaciones de la API reflejan EXACTAMENTE lo que Oracle aceptara y el
 * usuario recibe un mensaje claro en vez de un ORA-12899 / ORA-02290.
 *
 *   pnpm --filter backend gen:limits
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Limite {
  l?: number;
  p?: number;
  s?: number;
  min?: number;
  minExcl?: true;
  max?: number;
}

const raiz = resolve(process.cwd(), "..");
const ddl = readFileSync(resolve(raiz, "database/ddl/SCRIPT_DDL.sql"), "utf8");

const tablas: Record<string, Record<string, Limite>> = {};
const reTabla = /CREATE\s+TABLE\s+(\w+)\s*\(([\s\S]*?)\n\)\s*;/gi;

for (const m of ddl.matchAll(reTabla)) {
  const nombre = (m[1] ?? "").toUpperCase();
  const cuerpo = m[2] ?? "";
  const cols: Record<string, Limite> = {};

  for (const rawLine of cuerpo.split("\n")) {
    const line = rawLine.trim().replace(/,$/, "");
    if (line === "" || line.startsWith("--") || /^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK)\b/i.test(line)) {
      continue;
    }
    const c = /^(\w+)\s+(VARCHAR2|NVARCHAR2|CHAR|NUMBER)\s*(?:\(\s*(\d+)\s*(?:,\s*(-?\d+)\s*)?(?:BYTE|CHAR)?\s*\))?/i.exec(line);
    if (c === null) continue;
    const col = (c[1] ?? "").toUpperCase();
    const tipo = (c[2] ?? "").toUpperCase();
    const lim: Limite = {};
    if (tipo !== "NUMBER" && c[3] !== undefined) lim.l = Number(c[3]);
    if (tipo === "NUMBER" && c[3] !== undefined) {
      lim.p = Number(c[3]);
      lim.s = c[4] !== undefined ? Number(c[4]) : 0;
    }

    const between = /CHECK\s*\(\s*\w+\s+BETWEEN\s+(-?[\d.]+)\s+AND\s+(-?[\d.]+)\s*\)/i.exec(line);
    if (between !== null) {
      lim.min = Number(between[1]);
      lim.max = Number(between[2]);
    }
    const cmp = /CHECK\s*\(\s*\w+\s*(>=|>)\s*(-?[\d.]+)\s*\)/i.exec(line);
    if (cmp !== null) {
      lim.min = Number(cmp[2]);
      if (cmp[1] === ">") lim.minExcl = true;
    }
    if (Object.keys(lim).length > 0) cols[col] = lim;
  }
  if (Object.keys(cols).length > 0) tablas[nombre] = cols;
}

const salida = `/**
 * ARCHIVO GENERADO por scripts/gen-ddl-limits.ts a partir de database/ddl/SCRIPT_DDL.sql.
 * No editar a mano: ejecutar \`pnpm --filter backend gen:limits\`.
 *
 * l = longitud maxima; p/s = precision y escala NUMBER; min/max = rango CHECK;
 * minExcl = el minimo es exclusivo (CHECK (X > n)).
 */

export interface LimiteDdl {
  readonly l?: number;
  readonly p?: number;
  readonly s?: number;
  readonly min?: number;
  readonly minExcl?: true;
  readonly max?: number;
}

export const DDL_LIMITES: Readonly<Record<string, Readonly<Record<string, LimiteDdl>>>> = ${JSON.stringify(tablas, null, 1)};
`;

const destino = resolve(process.cwd(), "src/entities/support/ddlLimits.generated.ts");
writeFileSync(destino, salida, "utf8");
const nCols = Object.values(tablas).reduce((a, t) => a + Object.keys(t).length, 0);
console.log(`ddlLimits.generated.ts: ${Object.keys(tablas).length} tablas, ${nCols} columnas con limite`);

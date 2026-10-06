// Aplica a la base YA CARGADA las mismas correcciones ortograficas de las semillas (database/dml/*.sql).
//   pnpm tsx scripts/tildes-db.ts <pares.json>
// Solo toca columnas de texto de las tablas que las semillas rellenan, y solo valores EXACTAMENTE iguales al texto viejo.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const envRaw = readFileSync(resolve(process.cwd(), "../.env"), "utf8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim();
}
const { oraclePool } = await import("../src/dal/OraclePool.js");

const pares = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as [string, string][];
const dml = resolve(process.cwd(), "../database/dml");
const tablas = new Set<string>();
for (const f of readdirSync(dml).filter((x) => x.endsWith(".sql"))) {
  for (const m of readFileSync(resolve(dml, f), "utf8").matchAll(/INSERT\s+INTO\s+([A-Z0-9_]+)/gi)) tablas.add(m[1]!.toUpperCase());
}

await oraclePool().init();
let total = 0;
await oraclePool().withTransaction(async (c) => {
  for (const t of tablas) {
    const cols = await c.execute<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :t AND DATA_TYPE IN ('VARCHAR2','NVARCHAR2','CHAR')`,
      { t },
    );
    for (const { COLUMN_NAME: col } of cols.rows ?? []) {
      for (const [viejo, nuevo] of pares) {
        const r = await c.execute(`UPDATE ${t} SET ${col} = :nuevo WHERE ${col} = :viejo`, { nuevo, viejo });
        if ((r.rowsAffected ?? 0) > 0) {
          total += r.rowsAffected ?? 0;
          console.log(`${t}.${col}: "${viejo}" -> "${nuevo}" (${r.rowsAffected})`);
        }
      }
    }
  }
});
console.log("filas actualizadas:", total);
await oraclePool().close();

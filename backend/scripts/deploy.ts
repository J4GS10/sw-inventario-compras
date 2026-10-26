/**
 * Herramienta de base de datos (Capa 1 / operacion).
 * - Conecta a Oracle 21c con los parametros de `.env` (raiz del repo).
 * - Verifica que el esquema canonico este aplicado (102 tablas; 26 COM_).
 * - Aplica database/dml/com_seed.sql (catalogos base) de forma idempotente.
 * - Con --full intenta ejecutar SCRIPT_DDL.sql sentencia por sentencia
 *   (statements DDL simples; para PL/SQL use `sqlplus @database/ddl/SCRIPT_DDL.sql`).
 *
 * Uso:
 *   pnpm --filter backend exec tsx scripts/deploy.ts            # verificar + seed
 *   pnpm --filter backend exec tsx scripts/deploy.ts --seed-only
 *   pnpm --filter backend exec tsx scripts/deploy.ts --full
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

interface EnvVars {
  user: string;
  password: string;
  connectString: string;
}

async function loadEnv(): Promise<EnvVars> {
  const raw = await readFile(resolve(REPO_ROOT, ".env"), "utf8");
  const map = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  const user = map.get("DB_USER") ?? map.get("ORACLE_USER");
  const password = map.get("DB_PASSWORD") ?? map.get("ORACLE_PASSWORD");
  const connectString =
    map.get("DB_CONNECT_STRING") ??
    map.get("ORACLE_CONNECT_STRING") ??
    `${map.get("DB_HOST") ?? "localhost"}:${map.get("DB_PORT") ?? "1521"}/${map.get("DB_SERVICE_NAME") ?? "proyecto"}`;
  if (user === undefined || password === undefined) {
    throw new Error("Faltan DB_USER / DB_PASSWORD en .env");
  }
  return { user, password, connectString };
}

function splitSqlStatements(sql: string): string[] {
  // Splitter simple: ignora bloques PL/SQL (los delega a sqlplus).
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines = withoutBlockComments.split(/\r?\n/);
  const statements: string[] = [];
  let buffer: string[] = [];
  let inPlSql = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") || trimmed === "") continue;
    if (/^(CREATE|REPLACE)?\s*(OR REPLACE\s+)?(TRIGGER|PROCEDURE|FUNCTION|PACKAGE)\b/i.test(trimmed)) {
      inPlSql = true;
    }
    buffer.push(line);
    if (trimmed === "/") {
      inPlSql = false;
      buffer = [];
      continue;
    }
    if (!inPlSql && trimmed.endsWith(";")) {
      const stmt = buffer.join("\n").trim().replace(/;\s*$/, "");
      if (stmt !== "") statements.push(stmt);
      buffer = [];
    }
  }
  return statements;
}

async function countComTables(conn: oracledb.Connection): Promise<number> {
  const res = await conn.execute<{ N: number }>(
    "SELECT COUNT(*) AS N FROM user_tables WHERE table_name LIKE 'COM\\_%' ESCAPE '\\'",
  );
  return Number(res.rows?.[0]?.N ?? 0);
}

async function countAllTables(conn: oracledb.Connection): Promise<number> {
  const res = await conn.execute<{ N: number }>(
    "SELECT COUNT(*) AS N FROM user_tables",
  );
  return Number(res.rows?.[0]?.N ?? 0);
}

async function runFullDdl(conn: oracledb.Connection): Promise<void> {
  const ddl = await readFile(
    resolve(REPO_ROOT, "database/ddl/SCRIPT_DDL.sql"),
    "utf8",
  );
  const statements = splitSqlStatements(ddl);
  let ok = 0;
  let skipped = 0;
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      ok++;
    } catch (error) {
      const num = (error as { errorNum?: number }).errorNum;
      // 955: name already used; 2260/2264/1442: constraint dup; 1408: index dup
      if (num === 955 || num === 2260 || num === 2264 || num === 1408 || num === 1442) {
        skipped++;
        continue;
      }
      console.error(`\n[FALLO] ${stmt.slice(0, 120)}...\n  ORA-${num}: ${(error as Error).message}`);
    }
  }
  await conn.commit();
  console.log(`DDL: ${ok} sentencias aplicadas, ${skipped} ya existentes.`);
  console.log("PL/SQL (triggers) omitido: ejecute `sqlplus @database/ddl/SCRIPT_DDL.sql` si lo necesita.");
}

async function runSeed(conn: oracledb.Connection): Promise<void> {
  const dmlDir = resolve(REPO_ROOT, "database/dml");
  let files: string[];
  try {
    files = (await readdir(dmlDir))
      .filter((f) => f.toLowerCase().endsWith(".sql"))
      .sort(); // 00_seed_base.sql antes que com_seed.sql
  } catch {
    console.log("Sin directorio database/dml/; se omite el seed.");
    return;
  }
  if (files.length === 0) {
    console.log("database/dml/ sin archivos .sql; se omite el seed.");
    return;
  }

  let ok = 0;
  for (const file of files) {
    const sql = await readFile(resolve(dmlDir, file), "utf8");
    for (const stmt of splitSqlStatements(sql)) {
      try {
        await conn.execute(stmt);
        ok++;
      } catch (error) {
        const num = (error as { errorNum?: number }).errorNum;
        if (num === 1) continue; // unique -> ya sembrado
        console.error(`[seed:${file}] ORA-${num}: ${(error as Error).message}`);
      }
    }
  }
  await conn.commit();
  console.log(`Seed: ${files.join(", ")} -> ${ok} sentencias ejecutadas.`);
}

/** Migracion idempotente: SEG_BORRADOR_USUARIO (borradores de trabajo por usuario; ver SCRIPT_DDL.sql). */
async function ensureBorradores(conn: oracledb.Connection): Promise<void> {
  const r = await conn.execute<{ N: number }>(
    `SELECT COUNT(*) AS N FROM USER_TABLES WHERE TABLE_NAME = 'SEG_BORRADOR_USUARIO'`,
  );
  if (Number(r.rows?.[0]?.N ?? 0) > 0) return;
  await conn.execute(`CREATE TABLE SEG_BORRADOR_USUARIO (
    ID_BORRADOR NUMBER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    ID_USUARIO NUMBER NOT NULL,
    CLAVE VARCHAR2(200) NOT NULL,
    CONTENIDO CLOB NOT NULL,
    ACTUALIZADO_EN NUMBER(16) NOT NULL,
    FECHA_ACTUALIZACION TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_SEG_BORRADOR_USUARIO PRIMARY KEY (ID_BORRADOR),
    CONSTRAINT UK_SEG_BORRADOR_USUARIO_1 UNIQUE (ID_USUARIO, CLAVE),
    CONSTRAINT FK_SEG_BORRADOR_USUARIO_1 FOREIGN KEY (ID_USUARIO) REFERENCES SEG_USUARIO(ID_USUARIO)
  )`);
  console.log("Migracion: tabla SEG_BORRADOR_USUARIO creada.");
}

/** Migracion idempotente: SEG_DELEGACION_APROBACION (delegacion temporal de aprobaciones; ver SCRIPT_DDL.sql). */
async function ensureDelegaciones(conn: oracledb.Connection): Promise<void> {
  const r = await conn.execute<{ N: number }>(
    `SELECT COUNT(*) AS N FROM USER_TABLES WHERE TABLE_NAME = 'SEG_DELEGACION_APROBACION'`,
  );
  if (Number(r.rows?.[0]?.N ?? 0) > 0) return;
  await conn.execute(`CREATE TABLE SEG_DELEGACION_APROBACION (
    ID_DELEGACION NUMBER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    ID_EMPLEADO_DELEGANTE NUMBER NOT NULL,
    ID_EMPLEADO_DELEGADO NUMBER NOT NULL,
    FECHA_DESDE DATE NOT NULL,
    FECHA_HASTA DATE NOT NULL,
    MOTIVO VARCHAR2(200),
    ESTADO VARCHAR2(10) DEFAULT 'ACTIVA' NOT NULL CHECK (ESTADO IN ('ACTIVA','REVOCADA')),
    FECHA_CREACION TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_SEG_DELEGACION_APROBACION PRIMARY KEY (ID_DELEGACION),
    CONSTRAINT CK_SEG_DELEGACION_APROBACION_1 CHECK (FECHA_HASTA >= FECHA_DESDE),
    CONSTRAINT CK_SEG_DELEGACION_APROBACION_2 CHECK (ID_EMPLEADO_DELEGANTE <> ID_EMPLEADO_DELEGADO),
    CONSTRAINT FK_SEG_DELEGACION_APROBACION_1 FOREIGN KEY (ID_EMPLEADO_DELEGANTE) REFERENCES NOM_EMPLEADO(ID_EMPLEADO),
    CONSTRAINT FK_SEG_DELEGACION_APROBACION_2 FOREIGN KEY (ID_EMPLEADO_DELEGADO) REFERENCES NOM_EMPLEADO(ID_EMPLEADO)
  )`);
  await conn.execute(`CREATE INDEX IX_SEG_DELEGACION_APROBACION_1 ON SEG_DELEGACION_APROBACION(ID_EMPLEADO_DELEGADO, ESTADO, FECHA_HASTA)`);
  await conn.execute(`CREATE INDEX IX_SEG_DELEGACION_APROBACION_2 ON SEG_DELEGACION_APROBACION(ID_EMPLEADO_DELEGANTE)`);
  console.log("Migracion: tabla SEG_DELEGACION_APROBACION creada.");
}

/** Migracion idempotente: COM_ORDEN_COMPRA.COSTO_ENVIO (flete; NULL = no registrado, 0 = envio gratuito). */
async function ensureCostoEnvio(conn: oracledb.Connection): Promise<void> {
  const r = await conn.execute<{ N: number }>(
    `SELECT COUNT(*) AS N FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'COM_ORDEN_COMPRA' AND COLUMN_NAME = 'COSTO_ENVIO'`,
  );
  if (Number(r.rows?.[0]?.N ?? 0) > 0) return;
  await conn.execute(
    `ALTER TABLE COM_ORDEN_COMPRA ADD (COSTO_ENVIO NUMBER(12,2) CHECK (COSTO_ENVIO IS NULL OR COSTO_ENVIO >= 0))`,
  );
  console.log("Migracion: columna COM_ORDEN_COMPRA.COSTO_ENVIO creada.");
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const cfg = await loadEnv();
  console.log(`Conectando a ${cfg.connectString} como ${cfg.user} ...`);
  const conn = await oracledb.getConnection(cfg);
  try {
    if (args.has("--full")) {
      await runFullDdl(conn);
    }
    await ensureBorradores(conn);
    await ensureDelegaciones(conn);
    await ensureCostoEnvio(conn);
    if (!args.has("--no-seed")) {
      await runSeed(conn);
    }

    const [com, all] = [await countComTables(conn), await countAllTables(conn)];
    console.log("---");
    console.log(`Tablas totales del esquema : ${all}  (esperado >= 104)`);
    console.log(`Tablas COM_ (Compras)      : ${com}  (esperado 26)`);
    if (com !== 26) {
      console.log(
        "AVISO: el modulo de Compras no esta completamente desplegado. " +
          "Ejecute con --full o aplique database/ddl/SCRIPT_DDL.sql con sqlplus.",
      );
      process.exitCode = 2;
    } else {
      console.log("OK: esquema de Compras verificado.");
    }
  } finally {
    await conn.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

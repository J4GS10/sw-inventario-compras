/**
 * Utilidades compartidas por los tests de integracion: carga de `.env`, arranque
 * de la app Fastify contra Oracle local y helper de valor escalar.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";

const envRaw = readFileSync(resolve(process.cwd(), "../.env"), "utf8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim();
}

const { oraclePool } = await import("../../src/dal/OraclePool.js");
const { registerComprasSubscribers } = await import(
  "../../src/bll/compras/subscribers/index.js"
);
const { buildApp } = await import("../../src/app.js");

export const SYS_HEADERS = { "x-dev-user": "0" } as const;

export async function startTestApp(): Promise<FastifyInstance> {
  await oraclePool().init();
  registerComprasSubscribers();
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function stopTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
  await oraclePool().close();
}

export async function scalar(sql: string): Promise<number> {
  return oraclePool().withConnection(async (c) => {
    const r = await c.execute<{ V: number | null }>(sql);
    const v = r.rows?.[0]?.V;
    return v === null || v === undefined ? Number.NaN : Number(v);
  });
}

export { oraclePool };

// QA sistematico por rol: recorre cada pantalla visible del menu (via
// Command Palette) para cada uno de los 8 usuarios demo, con SESIONES
// NUEVAS por rol (sin localStorage previo, evita el problema de JWT viejo
// que ya causo un falso positivo el 2026-09-11).
//
// Reporta por cada (rol, pantalla):
//   NOT_VISIBLE  - el rol no ve esa pantalla en su menu (puede ser correcto)
//   OK           - visible y cargo sin errores
//   ERROR        - visible pero la carga fallo (401/403/5xx o excepcion de
//                  consola/pagina) — un menu que promete algo que el backend
//                  rechaza, el bug de clase que motivo este script.
//
// Requiere: backend :3000 y frontend :8443 ya corriendo (`pnpm dev`).
// Uso: node scripts/qa-roles-smoke.mjs [--headed]
import { entrar } from "./qa-lib.mjs";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
const HEADED = process.argv.includes("--headed");

const ROLES = ["solicitante", "jefe", "gerente", "comprador", "financiero", "bodega", "auditor", "admin"];

// Espejo de frontend/src/nav.ts (ALL_LEAVES) — actualizar si se agregan pantallas.
const LEAVES = [
  "Dashboard",
  "Solicitudes de compra",
  "Órdenes de compra",
  "Cotizaciones",
  "RFQ / Invitaciones",
  "Recepciones",
  "Devoluciones",
  "Seguimiento de despachos",
  "Excepciones de OC",
  "Comparativo de cotizaciones",
  "Historial de precios",
  "Panel de reportes",
  "Proveedores",
  "Acuerdos marco",
  "Artículo-Proveedor",
  "Condiciones de pago",
  "Términos de entrega",
  "Categorías de compra",
  "Grupos de compra",
  "Centros de costo",
  "Monedas",
];

const browser = await chromium.launch({ headless: !HEADED });
const report = [];

for (const role of ROLES) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let consoleErrors = [];
  let badResponses = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/api/") && (res.status() === 401 || res.status() === 403 || res.status() >= 500)) {
      badResponses.push(`${res.status()} ${url.replace(BASE, "")}`);
    }
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await entrar(page, role);
  await page.waitForTimeout(400);

  for (const leaf of LEAVES) {
    consoleErrors = [];
    badResponses = [];
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyK");
    await page.keyboard.up("Control");
    const input = page.locator('input[placeholder^="Buscar pantalla"]');
    const paletteOpen = await input.isVisible({ timeout: 2000 }).catch(() => false);
    if (!paletteOpen) {
      report.push({ role, leaf, status: "NO_PALETTE" });
      continue;
    }
    await input.fill(leaf);
    await page.waitForTimeout(200);
    // Coincidencia EXACTA del label, ACOTADA a la lista <ul> del palette:
    //  - exact evita que "Cotizaciones" empareje "Comparativo de cotizaciones"
    //    (bug real encontrado: sin exact, con el documento oculto el
    //    Comparativo quedaba como unico resultado y se reportaba OK).
    //  - el scope a "ul" evita emparejar el boton homonimo del sidebar
    //    (AppShell), que queda tapado por el overlay del palette y cuelga el
    //    click con un timeout (regresion vista al quitar el scope a "ul").
    const resultBtn = page.locator("ul").getByRole("button", { name: leaf, exact: true }).first();
    const found = (await resultBtn.count()) > 0;
    if (!found) {
      await page.keyboard.press("Escape");
      report.push({ role, leaf, status: "NOT_VISIBLE" });
      continue;
    }
    await resultBtn.click();
    await page.waitForTimeout(900);

    // Si la pantalla tiene boton de ayuda, abrirlo y cerrarlo — no debe
    // disparar llamadas de red ni errores (es puramente local).
    const helpBtn = page.locator('button[aria-label^="Ayuda:"]').first();
    if (await helpBtn.isVisible().catch(() => false)) {
      await helpBtn.click();
      await page.waitForTimeout(200);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }

    const status = badResponses.length > 0 || consoleErrors.length > 0 ? "ERROR" : "OK";
    report.push({
      role,
      leaf,
      status,
      badResponses: [...badResponses],
      consoleErrors: consoleErrors.slice(0, 3),
    });
  }
  await context.close();
  console.log(`-- rol '${role}' listo --`);
}

await browser.close();
const outFile = path.join(__dirname, "..", "qa-report.json");
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

const errores = report.filter((r) => r.status === "ERROR");
console.log(`\n=== ${errores.length} ERRORES de ${report.length} checks (reporte completo: ${outFile}) ===`);
for (const e of errores) {
  console.log(`[${e.role}] ${e.leaf}: ${JSON.stringify(e.badResponses)} ${JSON.stringify(e.consoleErrors)}`);
}

console.log("\n=== Matriz completa (pantalla x rol -> OK / - (no visible) / ERROR) ===");
const byRole = {};
for (const r of report) {
  byRole[r.leaf] ??= {};
  byRole[r.leaf][r.role] = r.status === "OK" ? "OK" : r.status === "NOT_VISIBLE" ? "-" : "ERROR";
}
const header = ["PANTALLA".padEnd(26), ...ROLES.map((r) => r.slice(0, 6).padEnd(7))];
console.log(header.join(""));
for (const leaf of LEAVES) {
  const row = [leaf.padEnd(26), ...ROLES.map((r) => (byRole[leaf]?.[r] ?? "?").padEnd(7))];
  console.log(row.join(""));
}

process.exitCode = errores.length > 0 ? 1 : 0;

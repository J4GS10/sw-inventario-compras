// QA de apertura de formularios CRUD (Nuevo / Editar) por catalogo y documento.
// Complementa qa-roles-smoke.mjs, que solo abre la LISTA de cada pantalla y no
// el modal de alta/edicion — exactamente donde el usuario reporta errores al
// "presionar un catalogo o algo".
//
// Para cada rol y cada pantalla visible (catalogo o documento):
//   1. Abre la pantalla.
//   2. Click en "Nuevo" -> espera -> revisa consola/red -> cierra (Escape).
//   3. Si hay al menos una fila, abre su menu "Acciones de la fila" -> click
//      "Editar" (si existe) -> espera -> revisa -> cierra (Escape).
//
// Requiere: backend :3000 y frontend :8443 corriendo (`pnpm dev`).
// Uso: node scripts/qa-crud-open.mjs [--headed] [--roles=admin,comprador,...]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
const HEADED = process.argv.includes("--headed");
const rolesArg = process.argv.find((a) => a.startsWith("--roles="));
const ROLES = rolesArg
  ? rolesArg.slice("--roles=".length).split(",")
  : ["solicitante", "jefe", "gerente", "comprador", "financiero", "bodega", "auditor", "admin"];

// Pantallas con CRUD real (Nuevo/Editar) — se excluyen Dashboard, Comparativo,
// Historial, Reportes, Seguimiento/Excepciones (bitacora, sin alta directa
// desde su propia pantalla) porque no tienen boton "Nuevo" en la lista.
const SCREENS = [
  "Solicitudes de compra",
  "Ordenes de compra",
  "Cotizaciones",
  "RFQ / Invitaciones",
  "Recepciones",
  "Devoluciones",
  "Proveedores",
  "Acuerdos marco",
  "Articulo-Proveedor",
  "Condiciones de pago",
  "Terminos de entrega",
  "Categorias de compra",
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
  await page.waitForSelector("text=Elija un perfil", { timeout: 20000 });
  await page.locator(`button:has-text("· ${role}")`).first().click();
  await page.waitForSelector("text=MODULOS DEL SISTEMA", { timeout: 20000 });
  await page.waitForTimeout(400);

  for (const leaf of SCREENS) {
    // Navegar via Command Palette
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyK");
    await page.keyboard.up("Control");
    const input = page.locator('input[placeholder^="Buscar"]');
    const paletteOpen = await input.isVisible({ timeout: 2000 }).catch(() => false);
    if (!paletteOpen) {
      report.push({ role, leaf, action: "nav", status: "NO_PALETTE" });
      continue;
    }
    await input.fill(leaf);
    await page.waitForTimeout(200);
    // Coincidencia EXACTA del label, acotada a "ul" — ver qa-roles-smoke.mjs
    // (evita el falso match "Cotizaciones" -> "Comparativo de cotizaciones" Y
    // evita colisionar con el boton homonimo del sidebar, tapado por el
    // overlay del palette).
    const navBtn = page.locator("ul").getByRole("button", { name: leaf, exact: true }).first();
    const found = (await navBtn.count()) > 0;
    if (!found) {
      await page.keyboard.press("Escape");
      report.push({ role, leaf, action: "nav", status: "NOT_VISIBLE" });
      continue;
    }
    await navBtn.click();
    await page.waitForTimeout(900);

    // --- Nuevo ---
    const nuevoBtn = page.locator("button", { hasText: "Nuevo" }).first();
    const nuevoVisible = await nuevoBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!nuevoVisible) {
      report.push({ role, leaf, action: "nuevo", status: "NO_BOTON" });
    } else {
      consoleErrors = [];
      badResponses = [];
      await nuevoBtn.click();
      await page.waitForTimeout(900);
      const modalVisible = await page.locator('[role="dialog"], .modal, dialog').first().isVisible({ timeout: 1500 }).catch(() => false);
      const status = badResponses.length > 0 || consoleErrors.length > 0 ? "ERROR" : modalVisible ? "OK" : "NO_MODAL";
      report.push({
        role,
        leaf,
        action: "nuevo",
        status,
        badResponses: [...badResponses],
        consoleErrors: consoleErrors.slice(0, 5),
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // --- Editar (primera fila, si existe) ---
    const rowMenuBtn = page.locator('button[aria-label="Acciones de la fila"]').first();
    const rowMenuVisible = await rowMenuBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!rowMenuVisible) {
      report.push({ role, leaf, action: "editar", status: "SIN_FILAS" });
    } else {
      await rowMenuBtn.click();
      await page.waitForTimeout(200);
      const editarItem = page.locator('button, [role="menuitem"]', { hasText: "Editar" }).first();
      const editarVisible = await editarItem.isVisible({ timeout: 1000 }).catch(() => false);
      if (!editarVisible) {
        report.push({ role, leaf, action: "editar", status: "NO_EDITAR_EN_MENU" });
        await page.keyboard.press("Escape");
      } else {
        consoleErrors = [];
        badResponses = [];
        await editarItem.click();
        await page.waitForTimeout(900);
        const modalVisible = await page.locator('[role="dialog"], .modal, dialog').first().isVisible({ timeout: 1500 }).catch(() => false);
        const status = badResponses.length > 0 || consoleErrors.length > 0 ? "ERROR" : modalVisible ? "OK" : "NO_MODAL";
        report.push({
          role,
          leaf,
          action: "editar",
          status,
          badResponses: [...badResponses],
          consoleErrors: consoleErrors.slice(0, 5),
        });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }
  }
  await context.close();
  console.log(`-- rol '${role}' listo --`);
}

await browser.close();
const outFile = path.join(__dirname, "..", "qa-crud-report.json");
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

const errores = report.filter((r) => r.status === "ERROR");
console.log(`\n=== ${errores.length} ERRORES de ${report.length} checks (reporte completo: ${outFile}) ===`);
for (const e of errores) {
  console.log(`[${e.role}] ${e.leaf} (${e.action}): ${JSON.stringify(e.badResponses)} ${JSON.stringify(e.consoleErrors)}`);
}

process.exitCode = errores.length > 0 ? 1 : 0;

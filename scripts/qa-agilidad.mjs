// QA (UI real): funciones de agilidad — pegar renglones desde Excel, duplicar una solicitud, aviso del
// servidor en vivo y pantalla de delegación. Uso: node scripts/qa-agilidad.mjs
import { entrar } from "./qa-lib.mjs";
import { chromium } from "playwright";

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
const res = [];
const check = (w, ok, d = "") => { res.push(ok); console.log(`${ok ? "OK  " : "FAIL"} ${w}${d ? " — " + d : ""}`); };

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await entrar(page, "solicitante");

const ir = async (nombre) => {
  await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
  await page.fill('input[placeholder^="Buscar pantalla"]', nombre);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1800);
};

await ir("Solicitudes de compra");

// 1) Nuevo + pegar de Excel
await page.getByRole("button", { name: "Nuevo" }).first().click();
await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
await page.getByRole("button", { name: "Pegar de Excel" }).click();
await page.locator('textarea[placeholder^="Pega aquí"]').fill("Martillo de prueba\t3\nTaladro de prueba\t2,5");
await page.getByRole("button", { name: "Agregar renglones" }).click();
await page.waitForTimeout(500);
const renglones = await page.locator("[data-linea]").count();
check("pegar de Excel crea un renglón por fila", renglones >= 2, `${renglones} renglones`);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// 2) Duplicar la primera solicitud de la lista
const menu = page.locator('button[aria-label="Más opciones"]').first();
if (await menu.count()) {
  await menu.click();
  const dup = page.getByRole("menuitem", { name: /Duplicar/ });
  check("la acción «Duplicar» existe en el menú", (await dup.count()) > 0);
  if ((await dup.count()) > 0) {
    await dup.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(1200);
    const lineas = await page.locator("[data-linea]").count();
    check("duplicar abre el formulario con los renglones de la original", lineas >= 1, `${lineas} renglones`);
    await page.keyboard.press("Escape");
  }
}

// 3) Delegación (la ve quien aprueba): entramos como jefe
await page.close();
const p2 = await (await browser.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
await p2.goto(BASE, { waitUntil: "domcontentloaded" });
await entrar(p2, "jefe");
await p2.locator('button[aria-haspopup="menu"]').last().click();
const item = p2.getByRole("menuitem", { name: /Delegar mis aprobaciones/ });
check("el jefe ve «Delegar mis aprobaciones»", (await item.count()) > 0);
if ((await item.count()) > 0) {
  await item.click();
  await p2.waitForSelector("text=Delegar en", { timeout: 10000 });
  check("abre el formulario de delegación", true);
}
// 4) Repetir compra desde una orden de compra (admin)
const p3 = await (await browser.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
await p3.goto(BASE, { waitUntil: "domcontentloaded" });
await entrar(p3, "admin");
await p3.keyboard.down("Control"); await p3.keyboard.press("KeyK"); await p3.keyboard.up("Control");
await p3.fill('input[placeholder^="Buscar pantalla"]', "Órdenes de compra");
await p3.keyboard.press("Enter");
await p3.waitForTimeout(1800);
await p3.locator('button[aria-label="Más opciones"]').first().click();
const rep = p3.getByRole("menuitem", { name: /Repetir compra/ });
check("la orden de compra ofrece «Repetir compra»", (await rep.count()) > 0);
if ((await rep.count()) > 0) {
  await rep.click();
  await p3.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await p3.waitForTimeout(1500);
  check("repetir compra abre una SOLICITUD con los renglones de la orden", (await p3.locator("[data-linea]").count()) >= 1 && (await p3.locator('[role="dialog"]').innerText()).includes("Solicitud"));
}
await browser.close();
const fallos = res.filter((x) => !x).length;
console.log(`\n${res.length - fallos}/${res.length} comprobaciones OK`);
process.exit(fallos === 0 ? 0 : 1);

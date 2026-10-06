// QA de las listas desplegables con buscador dedicado (UI real, Playwright).
// Uso: node scripts/qa-listas-con-buscador.mjs [--headed] [--shots=<carpeta>]
import { entrar } from "./qa-lib.mjs";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
const shotsArg = process.argv.find((a) => a.startsWith("--shots="));
const SHOTS = shotsArg ? shotsArg.slice("--shots=".length) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const res = [];
const check = (w, ok, d = "") => { res.push(ok); console.log(`${ok ? "OK  " : "FAIL"} ${w}${d ? " — " + d : ""}`); };

const browser = await chromium.launch({ headless: !process.argv.includes("--headed") });
const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await entrar(page, "admin");

async function abrir(nombre) {
  await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
  await page.fill('input[placeholder^="Buscar pantalla"]', nombre);
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="searchbox"]', { timeout: 15000 });
  await page.waitForTimeout(900);
}

// 1) Formulario dentro de un modal (Nueva solicitud)
await abrir("Solicitudes de compra");
await page.getByRole("button", { name: /^Nuevo/ }).first().click();
await page.waitForTimeout(1200);
const combos = page.getByRole("combobox");
const total = await combos.count();
check("el formulario usa listas con buscador (combobox)", total >= 4, `${total} listas`);
check("ya no hay <select> nativos en el formulario", (await page.locator("select").count()) === 0);

const grupo = combos.nth(2); // Grupo de compra
check("el buscador NO se ve con la lista cerrada", (await page.getByRole("searchbox", { name: "Buscar en la lista" }).count()) === 0);
await grupo.click();
const caja = page.getByRole("searchbox", { name: "Buscar en la lista" });
await caja.waitFor({ timeout: 4000 });
check("al desplegar aparece el buscador enfocado", await caja.evaluate((el) => el === document.activeElement));
const antes = await page.getByRole("option").count();
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "lista_abierta.png") });
await caja.fill("zz-no-existe");
check("texto imposible -> 'Sin resultados'", (await page.locator("text=/Sin resultados para/").count()) > 0);
await caja.fill("");
const primera = (await page.getByRole("option").first().textContent()) ?? "";
const palabra = primera.replace(/^— .*/, "").split(/\s+/).find((w) => w.length >= 4) ?? "a";
await caja.fill(palabra.toLowerCase());
const despues = await page.getByRole("option").count();
check(`escribir «${palabra.toLowerCase()}» filtra la lista`, despues >= 1 && despues <= antes, `${despues} de ${antes}`);
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "lista_filtrada.png") });

// Escape cierra la lista pero NO el modal
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
check("Esc cierra la lista y el modal sigue abierto", (await page.getByRole("searchbox", { name: "Buscar en la lista" }).count()) === 0 && (await page.locator("text=Datos generales").count()) > 0);

// elegir con teclado
await grupo.click();
await page.getByRole("searchbox", { name: "Buscar en la lista" }).fill(palabra.toLowerCase());
await page.keyboard.press("Enter");
await page.waitForTimeout(250);
const elegido = (await grupo.textContent()) ?? "";
check("Enter elige y el valor queda visible en el campo", !/seleccionar/i.test(elegido) && elegido.trim() !== "", elegido.trim().slice(0, 50));

// elegir con clic
await combos.nth(1).click();
await page.getByRole("option").nth(0).click();
check("clic en una opcion la elige", !/seleccionar/i.test((await combos.nth(1).textContent()) ?? ""));

// 2) Filtros de una tabla (popover) usan la misma lista
await page.keyboard.press("Escape").catch(() => {});
await page.getByRole("button", { name: "Cerrar" }).first().click().catch(() => {});
await abrir("Órdenes de compra");
await page.getByRole("button", { name: /^Filtrar/ }).click();
const filtroCombo = page.getByRole("combobox").first();
check("el panel Filtrar usa lista con buscador", (await filtroCombo.count()) > 0);
await filtroCombo.click();
await page.getByRole("option").nth(1).click();
await page.waitForTimeout(900);
check("elegir en el filtro NO cierra el panel y filtra", (await page.getByRole("button", { name: /Filtrar \(1\)/ }).count()) > 0);
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "filtro.png") });

// 3) Catalogo con selects (Acuerdos marco)
await abrir("Acuerdos marco");
await page.getByRole("button", { name: /^Nuevo/ }).first().click();
await page.waitForTimeout(900);
await page.getByRole("combobox").first().click();
check("catalogos: la lista tambien trae buscador", (await page.getByRole("searchbox", { name: "Buscar en la lista" }).count()) === 1);
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "catalogo_lista.png") });

await browser.close();
const f = res.filter((r) => !r).length;
console.log(`\n${res.length - f}/${res.length} comprobaciones OK`);
process.exit(f === 0 ? 0 : 1);

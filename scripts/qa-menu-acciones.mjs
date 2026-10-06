// QA del menu "Mas opciones" de las tablas: nunca recortado, visible en la ultima fila, con teclado y con el panel abierto.
// Uso: node scripts/qa-menu-acciones.mjs [--shots=<carpeta>]
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

const browser = await chromium.launch();
for (const ancho of [1440, 1100]) {
  const page = await (await browser.newContext({ viewport: { width: ancho, height: 800 } })).newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await entrar(page, "admin");
  for (const pantalla of ["Solicitudes de compra", "Órdenes de compra", "Proveedores"]) {
    await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
    await page.fill('input[placeholder^="Buscar pantalla"]', pantalla);
    await page.keyboard.press("Enter");
    await page.waitForSelector("table.data-table tbody tr", { timeout: 20000 });
    await page.waitForTimeout(900);
    const filas = page.locator("table.data-table tbody > tr");
    const n = await filas.count();
    for (const [nombre, idx] of [["primera fila", 0], ["última fila visible", Math.min(n, 12) - 1]]) {
      const fila = filas.nth(idx);
      await fila.scrollIntoViewIfNeeded();
      const boton = fila.getByRole("button", { name: "Más opciones" });
      if ((await boton.count()) === 0) { check(`${pantalla} @${ancho} ${nombre}: sin menú (card)`, true); continue; }
      await boton.click();
      const menu = page.getByRole("menu", { name: "Acciones" });
      await menu.waitFor({ timeout: 4000 });
      await page.waitForTimeout(150);
      const r = await menu.evaluate((m) => {
        const b = m.getBoundingClientRect();
        const items = [...m.querySelectorAll('[role="menuitem"]')];
        // cada opcion debe ser la que recibe el clic en su centro (no queda tapada por otra capa)
        const libres = items.every((it) => {
          const q = it.getBoundingClientRect();
          const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
          return top !== null && (top === it || it.contains(top));
        });
        return { dentro: b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth, libres, n: items.length, foco: document.activeElement?.getAttribute("role") };
      });
      check(`${pantalla} @${ancho} ${nombre}: el menú se ve completo y no queda tapado`, r.dentro && r.libres && r.n > 0, JSON.stringify(r));
      if (SHOTS && idx !== 0) await page.screenshot({ path: path.join(SHOTS, `menu_${pantalla.replace(/\W+/g, "_")}_${ancho}.png`) });
      if (r.n > 1) {
        const antes = await page.evaluate(() => document.activeElement?.textContent);
        await page.keyboard.press("ArrowDown");
        const despues = await page.evaluate(() => document.activeElement?.textContent);
        check(`${pantalla} @${ancho} ${nombre}: ↓ mueve el foco entre opciones`, antes !== despues, `${antes} → ${despues}`);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      check(`${pantalla} @${ancho} ${nombre}: Esc cierra y devuelve el foco al botón`, (await page.getByRole("menu").count()) === 0 && (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Más opciones");
    }
  }
  // elegir una opcion funciona (abre el detalle)
  await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
  await page.fill('input[placeholder^="Buscar pantalla"]', "Solicitudes de compra");
  await page.keyboard.press("Enter");
  await page.waitForSelector("table.data-table tbody tr");
  await page.waitForTimeout(800);
  await page.locator("table.data-table tbody > tr").first().getByRole("button", { name: "Más opciones" }).click();
  await page.getByRole("menuitem", { name: "Detalle" }).click();
  await page.waitForSelector("aside.drawer h2", { timeout: 8000 });
  check(`@${ancho}: elegir «Detalle» en el menú abre el panel`, true);
  // con el panel abierto: en pantalla ancha la lista sigue usable; en angosta el panel la atenua (clic fuera cierra)
  if (ancho >= 1180) {
    await page.locator("table.data-table tbody > tr").nth(2).getByRole("button", { name: "Más opciones" }).click({ timeout: 8000 }).catch(() => {});
    check(`@${ancho}: con el panel abierto el menú de otra fila abre`, (await page.getByRole("menu", { name: "Acciones" }).count()) === 1);
  } else {
    await page.mouse.click(60, 400);
    await page.waitForTimeout(300);
    check(`@${ancho}: en pantalla angosta un clic fuera cierra el panel`, (await page.locator("aside.drawer").count()) === 0);
  }
  await page.context().close();
}
await browser.close();
const fallos = res.filter((x) => !x).length;
console.log(`\n${res.length - fallos}/${res.length} OK`);
process.exit(fallos === 0 ? 0 : 1);

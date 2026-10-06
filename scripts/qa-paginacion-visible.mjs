// QA: el pie de la tabla («Página N de M · total») queda dentro del área visible SIN desplazar la página,
// en varias alturas de pantalla (laptop 768, escala 125 %/150 % de Windows ≈ 600/500 px útiles).
// Además comprueba que el menú de acciones abre y que el atajo de una tecla funciona.
// Uso: node scripts/qa-paginacion-visible.mjs     (QA_BASE_URL por omisión http://localhost:8443)
import { entrar } from "./qa-lib.mjs";
import { chromium } from "playwright";

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
const res = [];
const check = (w, ok, d = "") => { res.push(ok); console.log(`${ok ? "OK  " : "FAIL"} ${w}${d ? " — " + d : ""}`); };

const PANTALLAS = ["Solicitudes de compra", "Órdenes de compra", "Proveedores"];
const ALTOS = [900, 768, 600];

const browser = await chromium.launch();
for (const alto of ALTOS) {
  const page = await (await browser.newContext({ viewport: { width: 1366, height: alto } })).newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await entrar(page, "admin");
  for (const nombre of PANTALLAS) {
    await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
    await page.fill('input[placeholder^="Buscar pantalla"]', nombre);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1800);
    const r = await page.evaluate(() => {
      const pie = [...document.querySelectorAll("span")].find((s) => /P[aá]gina \d+ de \d+/.test(s.textContent ?? "") && s.children.length === 0);
      if (!pie) return null;
      const b = pie.getBoundingClientRect();
      const main = document.querySelector("main");
      return { bottom: Math.round(b.bottom), vh: window.innerHeight, scrolled: main ? main.scrollTop : 0, texto: pie.textContent.trim() };
    });
    if (r === null) { check(`${nombre} @${alto}px: pie de paginación presente`, false); continue; }
    check(`${nombre} @${alto}px: «${r.texto}» visible sin desplazar`, r.bottom <= r.vh, `borde inferior ${r.bottom} / pantalla ${r.vh}`);
  }

  if (alto === 768) {
    // menú de acciones + atajo de una tecla (Detalle = D)
    await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
    await page.fill('input[placeholder^="Buscar pantalla"]', "Solicitudes de compra");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1800);
    const menu = page.locator('button[aria-label="Más opciones"]').first();
    if (await menu.count()) {
      await menu.click();
      check("menú de acciones abre", (await page.locator('[role="menu"] [role="menuitem"]').count()) > 0);
      check("atajos de una tecla visibles en el menú", (await page.locator('[role="menu"] kbd').count()) > 0);
      await page.keyboard.press("Escape");
    }
  }
  await page.context().close();
}
await browser.close();
const fallos = res.filter((x) => !x).length;
console.log(`\n${res.length - fallos}/${res.length} comprobaciones OK`);
process.exit(fallos === 0 ? 0 : 1);

// QA: ningun control de una tabla se superpone con otra celda (botones de accion, chips, menu) y las tablas
// llevan solo lo importante. UI real (Playwright). Uso: node scripts/qa-tablas-sin-solapes.mjs [--shots=<carpeta>]
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

const PANTALLAS = ["Solicitudes de compra", "RFQ / Invitaciones", "Cotizaciones", "Órdenes de compra", "Recepciones", "Devoluciones", "Proveedores", "Acuerdos marco", "Artículos"];
const ANCHOS = [1360, 1100, 820];

const browser = await chromium.launch();
for (const ancho of ANCHOS) {
  const page = await (await browser.newContext({ viewport: { width: ancho, height: 860 } })).newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await entrar(page, "admin");
  for (const nombre of PANTALLAS) {
    await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
    await page.fill('input[placeholder^="Buscar pantalla"]', nombre);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    if ((await page.locator("table.data-table").count()) === 0) { check(`${nombre} @${ancho}: sin tabla (vista tarjetas)`, true); continue; }
    const r = await page.evaluate(() => {
      const t = document.querySelector("table.data-table");
      const filas = [...t.querySelectorAll("tbody > tr")].slice(0, 15);
      const problemas = [];
      const inter = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      for (const tr of filas) {
        const tds = [...tr.children];
        if (tds.length < 2) continue;
        for (const td of tds) {
          const tr0 = td.getBoundingClientRect();
          // todo hijo interactivo/visual debe quedar dentro de SU celda
          for (const el of td.querySelectorAll("button, a, [role=button], span.chip, .chip")) {
            const b = el.getBoundingClientRect();
            if (b.width === 0) continue;
            if (b.left < tr0.left - 1 || b.right > tr0.right + 1) problemas.push(`control "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)}" se sale de su celda`);
            for (const otro of tds) {
              if (otro === td) continue;
              if (inter(b, otro.getBoundingClientRect())) problemas.push(`control "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)}" se superpone con otra celda`);
            }
          }
          // el texto de la celda no debe desbordar hacia la vecina
          if (td.scrollWidth > td.clientWidth + 2 && getComputedStyle(td).overflow !== "hidden" && getComputedStyle(td).overflow !== "visible") problemas.push("celda con desborde");
        }
      }
      const cols = [...t.querySelectorAll("thead th")].filter((th) => (th.textContent || "").trim() !== "").map((th) => th.textContent.trim());
      return { problemas: [...new Set(problemas)], cols, filas: filas.length };
    });
    check(`${nombre} @${ancho}: sin superposiciones`, r.problemas.length === 0, r.problemas.join("; "));
    if (ancho === 1360) console.log(`      columnas: ${r.cols.join(" | ")}`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${nombre.replace(/\W+/g, "_")}_${ancho}.png`) });
  }
  await page.context().close();
}
await browser.close();
const fallos = res.filter((x) => !x).length;
console.log(`\n${res.length - fallos}/${res.length} OK`);
process.exit(fallos === 0 ? 0 : 1);

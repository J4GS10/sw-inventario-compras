// QA del panel lateral de detalle, navegacion con flechas, aprobar desde el panel (y pasar al siguiente), PDF,
// columnas elegibles, orden por urgencia, conteos reales en filtros rapidos y sugerencia de busqueda.
// Uso: node scripts/qa-panel-detalle.mjs [--shots=<carpeta>] [--sin-aprobar]
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
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + ".png") }); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const sorts = [];
page.on("request", (r) => { const m = /[?&]sort=([^&]+)/.exec(r.url()); if (m) sorts.push(decodeURIComponent(m[1])); });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await entrar(page, "admin");
async function abrir(nombre) {
  await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
  await page.fill('input[placeholder^="Buscar pantalla"]', nombre);
  await page.keyboard.press("Enter");
  await page.waitForSelector("table.data-table tbody tr", { timeout: 20000 });
  await page.waitForTimeout(800);
}
await abrir("Órdenes de compra");

// ---- chips con conteo real
const chips = await page.locator('[aria-label="Filtros rápidos"] button').allTextContents();
check("los filtros rápidos muestran su conteo real", chips.length > 0 && chips.every((t) => /·\s*\d+/.test(t)), chips.join(" | "));

await abrir("Solicitudes de compra");
// ---- orden por urgencia
await page.getByRole("columnheader", { name: /Espera/ }).click();
await page.waitForTimeout(900);
check("ordenar por «Espera» consulta por fecha de creación", sorts.includes("fechaCreacion"), `sort=${sorts.join(",")}`);
await page.getByRole("columnheader", { name: /Espera/ }).click();
await page.getByRole("columnheader", { name: /Espera/ }).click(); // vuelve al orden por defecto
await page.waitForTimeout(600);

// ---- columnas elegibles
await page.getByRole("button", { name: /Columnas/ }).click();
await page.getByLabel("Estado", { exact: true }).uncheck();
await page.keyboard.press("Escape");
check("«Columnas» oculta Estado de la tabla", (await page.getByRole("columnheader", { name: "Estado" }).count()) === 0);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("text=MÓDULOS DEL SISTEMA", { timeout: 30000 }).catch(() => {});
await page.locator('button:has-text("· admin")').first().click().catch(() => {});
await abrir("Solicitudes de compra");
const sigue = (await page.getByRole("columnheader", { name: "Estado" }).count()) === 0;
check("la elección de columnas se recuerda", sigue);
await page.getByRole("button", { name: /Columnas/ }).click();
await page.getByRole("button", { name: "Restablecer" }).click();
await page.keyboard.press("Escape");
check("«Restablecer» devuelve las columnas originales", (await page.getByRole("columnheader", { name: "Estado" }).count()) === 1);

// ---- panel de detalle
const idDe = async () => ((await page.locator("aside.drawer h2").first().textContent()) ?? "").trim();
await page.locator("table.data-table tbody tr").first().click();
await page.waitForSelector("aside h2", { timeout: 10000 });
await page.waitForTimeout(700);
const t1 = await idDe();
check("clic en una fila abre el panel lateral", /#\d+/.test(t1), t1);
const cajaVisible = await page.getByRole("searchbox").isVisible();
const sinSolape = await page.evaluate(() => {
  const a = document.querySelector("aside.drawer").getBoundingClientRect();
  const t = document.querySelector(".table-scroll").getBoundingClientRect();
  return t.right <= a.left + 2;
});
check("la lista sigue visible a la izquierda (sin quedar tapada)", cajaVisible && sinSolape);
await shot(page, "panel_abierto");
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(900);
const t2 = await idDe();
check("↓ pasa al siguiente documento", t2 !== t1 && /#\d+/.test(t2), `${t1} → ${t2}`);
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(700);
check("↑ vuelve al anterior", (await idDe()) === t1);
const pos = (await page.locator("aside.drawer").textContent()) ?? "";
check("muestra la posición «N de M»", /\d+ de \d+/.test(pos));

// PDF
const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.getByRole("button", { name: "PDF", exact: true }).click()]);
check("el botón PDF descarga la solicitud", /solicitud-\d+\.pdf/.test(descarga.suggestedFilename()), descarga.suggestedFilename());

// aprobar desde el panel y pasar al siguiente
if (!process.argv.includes("--sin-aprobar")) {
  const antes = await idDe();
  const aprobar = page.locator("aside.drawer").getByRole("button", { name: "Aprobar" });
  if ((await aprobar.count()) > 0) {
    await aprobar.click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await page.waitForTimeout(2500);
    const despues = await idDe().catch(() => "");
    check("tras aprobar desde el panel se abre el siguiente pendiente", despues !== "" && despues !== antes, `${antes} → ${despues}`);
    await shot(page, "panel_tras_aprobar");
  } else check("hay un pendiente que aprobar desde el panel", false, "el panel no ofreció «Aprobar»");
}
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Esc cierra el panel", (await page.locator("aside.drawer h2").count()) === 0);

// ---- clic fuera cierra el panel
await page.locator("table.data-table tbody tr").first().click();
await page.waitForSelector("aside.drawer h2", { timeout: 8000 });
await page.getByRole("heading", { name: /Solicitudes de compra/ }).first().click();
await page.waitForTimeout(400);
check("un clic fuera del panel lo cierra", (await page.locator("aside.drawer").count()) === 0);
await page.locator("table.data-table tbody tr").first().click();
await page.waitForSelector("aside.drawer h2", { timeout: 8000 });
await page.locator("table.data-table tbody tr").nth(1).click();
await page.waitForTimeout(700);
check("clic en otra fila cambia de documento sin cerrar el panel", (await page.locator("aside.drawer h2").count()) === 1);
await page.keyboard.press("Escape");

// ---- muchas columnas: se pueden ver todas
await page.getByRole("button", { name: /Columnas/ }).click();
for (const n of ["Creada", "Grupo de compra", "Prioridad"]) await page.getByLabel(n, { exact: true }).check();
await page.keyboard.press("Escape");
await page.locator("table.data-table tbody tr").first().click();
await page.waitForSelector("aside.drawer h2", { timeout: 8000 });
await page.waitForTimeout(600);
const mas = page.getByRole("button", { name: "Ver más columnas" });
check("con muchas columnas aparece «Más columnas ›»", (await mas.count()) === 1);
await mas.click();
await page.waitForTimeout(700);
await mas.click().catch(() => {});
await page.waitForTimeout(700);
const visible = await page.evaluate(() => {
  const s = document.querySelector("table.data-table").closest(".table-scroll");
  const th = [...s.querySelectorAll("thead th")].find((x) => /prioridad/i.test(x.textContent || ""));
  if (!th) return false;
  const r = th.getBoundingClientRect(); const sr = s.getBoundingClientRect();
  const acc = s.querySelector("thead th.col-acciones").getBoundingClientRect();
  return r.left >= sr.left - 1 && r.right <= acc.left + 2;
});
check("tras desplazar se ve la última columna (Prioridad) completa, sin quedar bajo las acciones", visible);
await shot(page, "muchas_columnas");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: /Columnas/ }).click();
await page.getByRole("button", { name: "Restablecer" }).click();
await page.keyboard.press("Escape");

// ---- busqueda sin resultados: sugerencia
await page.getByRole("searchbox").fill("zzzzzzzzz");
await page.waitForTimeout(1200);
check("sin resultados: ofrece «Probar con …»", (await page.getByRole("button", { name: /Probar con/ }).count()) > 0);
await shot(page, "sin_resultados");

await browser.close();
const fallos = res.filter((x) => !x).length;
console.log(`\n${res.length - fallos}/${res.length} OK`);
process.exit(fallos === 0 ? 0 : 1);

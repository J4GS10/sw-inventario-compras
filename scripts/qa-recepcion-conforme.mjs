// QA de "Recibir todo conforme" (Recepcion guiada, conteo ciego) y de las tendencias del Dashboard (UI real, Playwright).
// Uso: node scripts/qa-recepcion-conforme.mjs [--headed] [--shots=<carpeta>] [--registrar]
import { entrar as entrarUI } from "./qa-lib.mjs";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
const shotsArg = process.argv.find((a) => a.startsWith("--shots="));
const SHOTS = shotsArg ? shotsArg.slice("--shots=".length) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const REGISTRAR = process.argv.includes("--registrar");
const res = [];
const check = (w, ok, d = "") => { res.push(ok); console.log(`${ok ? "OK  " : "FAIL"} ${w}${d ? " — " + d : ""}`); };
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + ".png") }); };

const browser = await chromium.launch({ headless: !process.argv.includes("--headed") });

async function entrar(perfil) {
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await entrarUI(page, perfil);
  return page;
}
async function abrir(page, nombre) {
  await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
  await page.fill('input[placeholder^="Buscar pantalla"]', nombre);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
}

// ---- 1) Dashboard con tendencias (rol de gestion) ----
{
  const page = await entrar("admin");
  await page.waitForTimeout(2500);
  const tend = await page.locator("text=/nuevos · 7 días/").count();
  check("el Dashboard muestra la tendencia de 7 días en las tarjetas", tend >= 3, `${tend} tarjetas`);
  await shot(page, "dashboard_tendencias");
  await page.context().close();
}

// ---- 2) Recepcion guiada: recibir todo conforme ----
{
  const page = await entrar("bodega");
  await abrir(page, "Recepciones");
  await page.getByRole("button", { name: /^Nuevo/ }).first().click();
  await page.getByRole("dialog").getByRole("combobox").first().waitFor({ timeout: 15000 });
  const combos = page.getByRole("combobox");
  // Orden de compra: primera opcion con renglones pendientes
  let avanzo = false;
  for (let i = 0; i < 12 && !avanzo; i++) {
    await combos.nth(0).click();
    await page.getByRole("option").first().waitFor({ timeout: 8000 });
    if (i >= (await page.getByRole("option").count())) break;
    await page.getByRole("option").nth(i).click();
    for (let k = 1; k < (await combos.count()); k++) {
      const v = (await combos.nth(k).textContent()) ?? "";
      if (/Seleccion|Elige|—\s*$/i.test(v) || v.trim() === "") {
        await combos.nth(k).click();
        if ((await page.getByRole("option").count()) > 0) await page.getByRole("option").first().click();
        else await page.keyboard.press("Escape");
      }
    }
    await page.getByRole("dialog").getByRole("button", { name: /Siguiente/ }).click();
    await page.waitForTimeout(1200);
    avanzo = (await page.locator("text=Recibir todo conforme").count()) > 0;
  }
  check("se llega al paso de cantidades", avanzo);
  if (avanzo) {
    await shot(page, "recepcion_cantidades");
    const boton = page.getByRole("dialog").getByRole("button", { name: "Recibir todo conforme" });
    check("'Recibir todo conforme' está deshabilitado hasta declarar el conteo", await boton.isDisabled());
    await page.getByRole("checkbox").check();
    check("al declarar el conteo se habilita", await boton.isEnabled());
    await boton.click();
    await page.waitForTimeout(300);
    const conformes = await page.locator("text=Conforme con la orden").count();
    check("todas las líneas quedan 'Conforme con la orden'", conformes >= 1, `${conformes} líneas`);
    const inputs = await page.locator("input[data-conteo]").count();
    check("no se muestran cantidades (conteo ciego intacto)", inputs === 0);
    await shot(page, "recepcion_conforme");
    // volver a contar manualmente una linea
    await page.getByRole("dialog").getByRole("button", { name: "Contar manualmente" }).first().click();
    check("'Contar manualmente' devuelve los campos en blanco", (await page.locator("input[data-conteo]").first().inputValue()) === "");
    await page.getByRole("dialog").getByRole("button", { name: "Recibir todo conforme" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Siguiente/ }).click();
    await page.waitForTimeout(400);
    check("el resumen dice 'conforme con la orden' sin números", (await page.locator("text=conforme con la orden").count()) >= 1 && (await page.locator("text=/recibida \\d/").count()) === 0);
    await shot(page, "recepcion_confirmar");
    if (REGISTRAR) {
      await page.getByRole("dialog").getByRole("button", { name: /Confirmar y registrar/ }).click();
      await page.waitForSelector("text=Recepción registrada", { timeout: 10000 });
      check("la recepción se registra con las cantidades del sistema", true);
    }
  }
  await page.context().close();
}

await browser.close();
const fallos = res.filter((x) => !x).length;
console.log(`\n${res.length - fallos}/${res.length} OK`);
process.exit(fallos === 0 ? 0 : 1);

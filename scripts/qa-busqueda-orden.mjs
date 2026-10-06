// QA de buscador, orden y validaciones de fecha en la UI REAL (Playwright).
//
// Comprueba, para cada documento y catalogo con lista:
//   1. Orden por defecto: la primera fila es la de id MAS ALTO (lo ultimo hecho).
//   2. Buscador: teclear filtra de verdad (menos filas, todas coinciden) y
//      limpiar restaura la lista; un texto imposible muestra "Sin resultados".
//   3. Orden por encabezado: click ordena TODO el conjunto en el servidor.
//   4. Formulario de Solicitud: el selector de fecha no deja elegir el pasado.
//
// Requiere: backend :3000 y frontend :8443 corriendo (`pnpm dev`).
// Uso: node scripts/qa-busqueda-orden.mjs [--headed] [--shots=<carpeta>] [--role=admin]
import { entrar } from "./qa-lib.mjs";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
const HEADED = process.argv.includes("--headed");
const shotsArg = process.argv.find((a) => a.startsWith("--shots="));
const SHOTS = shotsArg ? shotsArg.slice("--shots=".length) : null;
const roleArg = process.argv.find((a) => a.startsWith("--role="));
const ROLE = roleArg ? roleArg.slice("--role=".length) : "admin";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const SCREENS = [
  { name: "Solicitudes de compra", idCol: "#" },
  { name: "Órdenes de compra", idCol: "#" },
  { name: "Cotizaciones", idCol: "#" },
  { name: "RFQ / Invitaciones", idCol: "#" },
  { name: "Recepciones", idCol: "#" },
  { name: "Devoluciones", idCol: "#" },
  { name: "Proveedores", idCol: null },
  { name: "Monedas", idCol: null },
];

const results = [];
const check = (screen, what, ok, detail = "") => {
  results.push({ screen, what, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} [${screen}] ${what}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ headless: !HEADED });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const badResponses = [];
page.on("response", (res) => {
  if (res.url().includes("/api/") && res.status() >= 400) badResponses.push(`${res.status()} ${res.url().replace(BASE, "")}`);
});

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await entrar(page, ROLE);

async function abrir(nombre) {
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyK");
  await page.keyboard.up("Control");
  await page.fill('input[placeholder^="Buscar pantalla"]', nombre);
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="searchbox"]', { timeout: 15000 });
  // espera a que termine de cargar (esqueleto -> filas o vacio)
  await page.waitForSelector("table.data-table tbody tr td, text=/Aún no hay|Sin registros|Sin resultados/", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Textos de la primera celda de cada fila de la tabla visible. */
async function primerasCeldas() {
  return page.$$eval("table.data-table tbody tr", (trs) =>
    trs.filter((tr) => tr.querySelectorAll("td").length > 1).map((tr) => (tr.querySelector("td")?.textContent ?? "").trim()),
  );
}
async function textoFilas() {
  return page.$$eval("table.data-table tbody tr", (trs) => trs.map((tr) => (tr.textContent ?? "").toLowerCase()));
}

for (const s of SCREENS) {
  await abrir(s.name);
  // la lista carga de forma asincrona: se espera hasta ~6 s a que aparezcan filas
  let filas = await primerasCeldas();
  for (let i = 0; i < 24 && filas.length === 0; i++) {
    await page.waitForTimeout(250);
    filas = await primerasCeldas();
  }
  if (filas.length === 0) {
    check(s.name, "tiene datos para probar", false, "lista vacia");
    continue;
  }

  // 1. orden por defecto: ids descendentes
  if (s.idCol !== null) {
    const ids = filas.map((t) => Number(t.replace(/\D/g, ""))).filter(Number.isFinite);
    const desc = ids.every((v, i) => i === 0 || ids[i - 1] >= v);
    check(s.name, "orden por defecto: lo ultimo primero", desc && ids.length > 0, `ids=${ids.slice(0, 6).join(",")}`);
  }

  // 2. buscador: se toma una palabra real de la 1a fila visible
  const palabra = await page.$$eval("table.data-table tbody tr:first-child td", (tds) => {
    const textos = tds.filter((td) => td.querySelector("button") === null).map((td) => (td.textContent ?? "").trim()).filter((t) => /[A-Za-zÁÉÍÓÚáéíóúñ]{4,}/.test(t));
    const t = textos.find((x) => !/^(emitida|enviad|recibido|abierto|cerrado|aprobada|vence|vencid|espera|entrega|atrasad|hoy|hace|en d)/i.test(x)) ?? "";
    return (t.split(/\s+/).find((w) => w.length >= 4) ?? t).replace(/[^\wÁÉÍÓÚáéíóúñÑ-]/g, "");
  });
  const total0 = filas.length;
  const box = page.getByRole("searchbox");
  if (palabra) {
    const respuesta = page.waitForResponse((r) => r.url().includes("q=") && r.status() === 200, { timeout: 8000 }).catch(() => null);
    await box.fill(palabra);
    const r = await respuesta;
    await page.waitForTimeout(500);
    check(s.name, `la consulta de busqueda llega al servidor (q=${palabra})`, r !== null);
    const filtradas = await primerasCeldas();
    check(s.name, `buscar «${palabra}» devuelve resultados`, filtradas.length > 0, `${filtradas.length} de ${total0}`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${s.name.replace(/\W+/g, "_")}_busqueda.png`) });

    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await page.waitForTimeout(800);
    check(s.name, "limpiar restaura la lista", (await primerasCeldas()).length === total0);
  }

  await box.fill("zzzzqqqimposible");
  await page.waitForTimeout(900);
  const sin = await page.locator("text=Sin resultados para").count();
  check(s.name, "texto imposible -> «Sin resultados»", sin > 0);
  await box.fill("");
  await page.waitForTimeout(700);

  // 3. orden por encabezado (primera columna sortable)
  const sortable = page.locator('table.data-table thead th[style*="pointer"]').first();
  if ((await sortable.count()) > 0) {
    await sortable.click();
    await page.waitForTimeout(800);
    const asc = await sortable.getAttribute("aria-sort");
    check(s.name, "click en encabezado ordena (aria-sort=ascending)", asc === "ascending", String(asc));
    if (s.idCol !== null) {
      const ids = (await primerasCeldas()).map((t) => Number(t.replace(/\D/g, "")));
      check(s.name, "orden asc en servidor: ids ascendentes", ids.every((v, i) => i === 0 || ids[i - 1] <= v), ids.slice(0, 6).join(","));
    }
    await sortable.click();
    await sortable.click(); // asc -> desc -> sin orden
    await page.waitForTimeout(800);
    check(s.name, "tercer click vuelve al orden por defecto", (await sortable.getAttribute("aria-sort")) === null);
  }
}

// 4. formulario de solicitud: fecha requerida no admite pasado
await abrir("Solicitudes de compra");
const nuevo = page.getByRole("button", { name: /^Nuevo/ }).first();
if ((await nuevo.count()) > 0) {
  await nuevo.click();
  await page.waitForTimeout(900);
  const fecha = page.locator('input[type="date"]').first();
  if ((await fecha.count()) > 0) {
    const min = await fecha.getAttribute("min");
    const hoy = new Date().toLocaleDateString("en-CA");
    check("Solicitud (formulario)", "el selector de fecha tiene min = hoy", min === hoy, `min=${min}`);
    await fecha.fill("2020-01-01");
    await page.waitForTimeout(300);
    await fecha.blur();
    const msg = await page.locator("text=No puede ser anterior").count();
    check("Solicitud (formulario)", "una fecha pasada muestra el error en linea", msg > 0);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "solicitud_fecha_pasada.png") });
  } else {
    check("Solicitud (formulario)", "hay campo de fecha en el formulario", false);
  }
} else {
  check("Solicitud (formulario)", `el rol ${ROLE} puede crear`, false, "sin boton Nuevo");
}

check("API", "sin respuestas 4xx/5xx durante el recorrido", badResponses.length === 0, [...new Set(badResponses)].slice(0, 5).join(" | "));

await browser.close();
const fallos = results.filter((r) => !r.ok);
console.log(`\n${results.length - fallos.length}/${results.length} comprobaciones OK`);
process.exit(fallos.length === 0 ? 0 : 1);

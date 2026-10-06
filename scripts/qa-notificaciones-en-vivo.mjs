// QA de notificaciones EN VIVO con DOS usuarios reales en dos navegadores.
//
//   solicitante (A) crea una solicitud  ->  jefe (B) la aprueba desde su pantalla
//   -> A ve el aviso SIN recargar; luego gerente aprueba -> A ve "pasa a cotizacion";
//   una segunda solicitud la rechaza el jefe con motivo -> A ve el rechazo + motivo;
//   rechazar sin motivo no se deja confirmar.
//
// Requiere backend :3000 y frontend :8443 corriendo.
// Uso: node scripts/qa-notificaciones-en-vivo.mjs [--headed] [--shots=<carpeta>]
import { entrar as entrarUI } from "./qa-lib.mjs";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
const HEADED = process.argv.includes("--headed");
const shotsArg = process.argv.find((a) => a.startsWith("--shots="));
const SHOTS = shotsArg ? shotsArg.slice("--shots=".length) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (what, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "OK  " : "FAIL"} ${what}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ headless: !HEADED });

async function entrar(rol) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await entrarUI(page, rol);
  const token = await page.evaluate(() => window.localStorage.getItem("erp.auth.token"));
  return { ctx, page, token };
}

async function abrirSolicitudes(page) {
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyK");
  await page.keyboard.up("Control");
  await page.fill('input[placeholder^="Buscar pantalla"]', "Solicitudes de compra");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="searchbox"]', { timeout: 15000 });
  await page.waitForTimeout(800);
}

const A = await entrar("solicitante");
const B = await entrar("jefe");
const C = await entrar("gerente");

const api = (u) => async (method, url, body) => {
  const r = await u.page.request.fetch(`${BASE}${url}`, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" },
    data: body,
  });
  return { status: r.status(), json: await r.json().catch(() => ({})) };
};
const apiA = api(A);

// datos de referencia
const me = (await apiA("GET", "/api/auth/me")).json.data;
const ref = async (p) => (await apiA("GET", p)).json.data;
const sucursal = (await ref("/api/com/ref/sucursales"))?.[0]?.idSucursal ?? 1;
const grupo = (await ref("/api/com/grupos-compra?pageSize=1"))?.[0]?.idGrupoCompra ?? 1;
const termino = (await ref("/api/com/terminos-entrega?pageSize=1"))?.[0]?.idTerminoEntrega ?? 1;
const unidad = (await ref("/api/com/ref/unidades-medida"))?.[0]?.idUnidadMedida ?? 1;
const dia = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);

async function crear(just) {
  const r = await apiA("POST", "/api/com/solicitudes", {
    cabecera: {
      idEmpleadoSolicitante: me.sesion?.idEmpleado ?? me.idEmpleado,
      idSucursal: sucursal,
      idGrupoCompra: grupo,
      idTerminoEntrega: termino,
      justificacion: just,
      prioridad: 2,
    },
    detalles: [{ descripcion: "Item de prueba en vivo", cantidadSolicitada: 3, idUnidadMedida: unidad, fechaRequerida: dia }],
  });
  return r.json.data?.header?.idSolicitud;
}

async function decidirEnUI(u, id, accion, motivo) {
  await abrirSolicitudes(u.page);
  const box = u.page.getByRole("searchbox");
  await box.fill(`SOL-${id}`);
  await u.page.waitForTimeout(900);
  const fila = u.page.locator(`table.data-table tbody tr:has-text("${id}")`).first();
  try {
    await fila.waitFor({ timeout: 8000 });
  } catch {
    if (SHOTS) await u.page.screenshot({ path: path.join(SHOTS, `sin_fila_${id}.png`) });
    throw new Error(`no aparece SOL-${id} en la pantalla de este usuario`);
  }
  await fila.getByRole("button", { name: "Más opciones" }).click();
  await u.page.getByRole("menuitem", { name: accion }).click();
  if (motivo) await u.page.locator("textarea").first().fill(motivo);
  await u.page.getByRole("button", { name: "Confirmar" }).click();
}

const toastTexto = (page, re) => page.locator(".card", { hasText: re }).first();

// ---- 1) Aprobacion del jefe
const id1 = await crear("Prueba de aviso en vivo - aprobacion");
check("el solicitante creo la solicitud", Number.isInteger(id1), `SOL-${id1}`);
await abrirSolicitudes(A.page); // A queda mirando su pantalla; NO recargara
const t0 = Date.now();
await decidirEnUI(B, id1, "Aprobar", "Adelante");
try {
  await toastTexto(A.page, new RegExp(`aprobó tu solicitud SOL-${id1}`)).waitFor({ timeout: 8000 });
  check("A ve en vivo 'aprobó tu solicitud' sin recargar", true, `${Date.now() - t0} ms`);
} catch {
  check("A ve en vivo 'aprobó tu solicitud' sin recargar", false);
}
check("el aviso dice que sigue el gerente", (await A.page.locator("text=gerente de área").count()) > 0);
if (SHOTS) await A.page.screenshot({ path: path.join(SHOTS, "en_vivo_aprobada.png") });

// la lista de A se actualizo sola (estado nuevo)
await A.page.getByRole("searchbox").fill(`SOL-${id1}`);
await A.page.waitForTimeout(900);
const estadoA = await A.page.locator(`table.data-table tbody tr:has-text("${id1}")`).first().textContent();
check("la lista de A muestra el estado nuevo", /gerente/i.test(estadoA ?? ""), (estadoA ?? "").slice(0, 80));

// campana de A: respuesta listada
await A.page.getByRole("button", { name: /Pendientes:/ }).click();
check("la campana de A lista la respuesta", (await A.page.locator("text=Respuestas a tus solicitudes").count()) > 0);
if (SHOTS) await A.page.screenshot({ path: path.join(SHOTS, "campana_respuestas.png") });
await A.page.keyboard.press("Escape");
await A.page.mouse.click(5, 5);

// ---- 2) El gerente aprueba -> en cotizacion
const t1 = Date.now();
await decidirEnUI(C, id1, "Aprobar");
try {
  await toastTexto(A.page, /Aprobada por completo/).waitFor({ timeout: 8000 });
  check("A ve en vivo 'aprobada por completo: Compras ya puede cotizar'", true, `${Date.now() - t1} ms`);
} catch {
  check("A ve en vivo 'aprobada por completo: Compras ya puede cotizar'", false);
}

// ---- 3) Rechazo con motivo
const id2 = await crear("Prueba de aviso en vivo - rechazo");
await decidirEnUI(B, id2, "Rechazar", "Falta presupuesto del trimestre");
try {
  await toastTexto(A.page, new RegExp(`rechazó tu solicitud SOL-${id2}`)).waitFor({ timeout: 8000 });
  const txt = await toastTexto(A.page, new RegExp(`rechazó tu solicitud SOL-${id2}`)).textContent();
  check("A ve en vivo el rechazo CON el motivo", /Falta presupuesto del trimestre/.test(txt ?? ""), (txt ?? "").slice(0, 110));
} catch {
  check("A ve en vivo el rechazo CON el motivo", false);
}
if (SHOTS) await A.page.screenshot({ path: path.join(SHOTS, "en_vivo_rechazada.png") });

// el rechazo sin motivo no se deja confirmar en la UI
const id3 = await crear("Prueba de rechazo sin motivo");
await abrirSolicitudes(B.page);
await B.page.getByRole("searchbox").fill(`SOL-${id3}`);
await B.page.waitForTimeout(900);
await B.page.locator(`table.data-table tbody tr:has-text("${id3}")`).first().getByRole("button", { name: "Más opciones" }).click();
await B.page.getByRole("menuitem", { name: "Rechazar" }).click();
await B.page.getByRole("button", { name: "Confirmar" }).click();
check("rechazar sin motivo muestra el aviso y no confirma", (await B.page.locator("text=Escribe el motivo del rechazo").count()) > 0);

await browser.close();
const fallos = results.filter((r) => !r).length;
console.log(`\n${results.length - fallos}/${results.length} comprobaciones OK`);
process.exit(fallos === 0 ? 0 : 1);

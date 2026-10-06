// Ejecuta TODAS las pruebas contra el SERVIDOR OFICIAL (producción, :8443/:3000, Oracle local + MinIO).
//   pnpm oficial        (levanta el servidor)   y luego:   pnpm qa:oficial
// Se niega a correr si lo que responde no es el servidor de producción (por ejemplo `pnpm dev`).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const API = process.env["QA_API_URL"] ?? "http://localhost:8443";

let produccion = false;
try {
  const demo = await fetch(`${API}/api/auth/usuarios-demo`);
  produccion = demo.status === 404; // en desarrollo lista los perfiles; en producción no existe
  const salud = await (await fetch(`${API}/api/salud`)).json();
  if (salud.data.db !== "up") throw new Error("la base de datos no responde");
} catch (e) {
  console.error(`No se alcanza el servidor oficial en ${API}: ${e.message}\nEjecuta primero: pnpm oficial`);
  process.exit(2);
}
if (!produccion) {
  console.error("El servidor que responde NO está en modo producción (¿`pnpm dev`?). Detenlo y ejecuta: pnpm oficial");
  process.exit(2);
}

const solo = process.argv[2]; // p. ej. "api" | "ui"
const SUITES = [
  ["api", "API · negocio extremo a extremo (roles reales)", "e2e-negocio-real.mjs"],
  ["api", "API · matriz de roles x recursos x operaciones", "rbac-crud-matrix.mjs"],
  ["api", "API · funciones nuevas (borradores, solo-validar, delegación, sugerida, PDF, MinIO)", "qa-oficial-api.mjs"],
  ["api", "Seguridad · idempotencia", "pentest/idempotencia.mjs"],
  ["api", "Seguridad · concurrencia", "pentest/concurrencia.mjs"],
  ["api", "Seguridad · OWASP", "pentest/owasp.mjs"],
  ["ui", "UI · pie de tabla visible a distintas alturas", "qa-paginacion-visible.mjs"],
  ["ui", "UI · agilidad (pegar de Excel, duplicar, repetir compra, delegación)", "qa-agilidad.mjs"],
  ["ui", "UI · tablas sin superposiciones", "qa-tablas-sin-solapes.mjs"],
  ["ui", "UI · menú de acciones", "qa-menu-acciones.mjs"],
  ["ui", "UI · panel de detalle", "qa-panel-detalle.mjs"],
  ["ui", "UI · búsqueda y orden", "qa-busqueda-orden.mjs"],
  ["ui", "UI · listas con buscador", "qa-listas-con-buscador.mjs"],
  ["ui", "UI · recepción conforme", "qa-recepcion-conforme.mjs"],
  ["ui", "UI · notificaciones en vivo", "qa-notificaciones-en-vivo.mjs"],
  ["ui", "UI · roles (humo)", "qa-roles-smoke.mjs"],
  ["ui", "UI · apertura de catálogos", "qa-crud-open.mjs"],
];

const env = { ...process.env, QA_BASE_URL: API, QA_API_URL: API, PT_API: process.env["PT_API"] ?? "http://localhost:3000" };
const resumen = [];
for (const [tipo, titulo, archivo] of SUITES) {
  if (solo !== undefined && solo !== tipo) continue;
  console.log(`\n=== ${titulo} (${archivo}) ===`);
  const r = spawnSync(process.execPath, [path.join(aqui, archivo)], { stdio: "inherit", env, timeout: 600000 });
  resumen.push([titulo, r.status === 0]);
  // Las pruebas de fuerza bruta bloquean cuentas demo a proposito: se desbloquean antes de seguir.
  if (archivo.startsWith("pentest/")) spawnSync("pnpm", ["--filter", "backend", "exec", "tsx", "scripts/pentest-reset.ts"], { stdio: "ignore", shell: true });
}
console.log("\n================ RESUMEN (servidor oficial) ================");
for (const [t, ok] of resumen) console.log(`${ok ? "OK   " : "FALLA"} ${t}`);
const fallos = resumen.filter(([, ok]) => !ok).length;
console.log(`\n${resumen.length - fallos}/${resumen.length} suites OK`);
process.exit(fallos === 0 ? 0 : 1);

// SERVIDOR OFICIAL (producción) contra la base Oracle LOCAL del equipo.
//
//   pnpm oficial            construye, migra y levanta backend (:3000) + frontend (:8443)
//   pnpm oficial status     estado de cada pieza
//   pnpm oficial stop       detiene backend y frontend (Oracle y MinIO no se tocan)
//
// Qué es: el mismo código que corre la imagen Docker (backend compilado con NODE_ENV=production, frontend
// compilado y servido con proxy /api, igual que nginx), pero usando TU Oracle local (.env) y el MinIO
// local. Diferencias con `pnpm dev`: sin recarga en caliente, sin atajo X-Dev-User, sin lista de perfiles
// demo (se ingresa con usuario y contraseña) y JWT_SECRET obligatorio.
//
// Todas las pruebas "oficiales" (pnpm qa:oficial) apuntan a este servidor, nunca a `pnpm dev`.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirEstado = path.join(raiz, ".oficial");
const pidArchivo = path.join(dirEstado, "pids.json");
const accion = process.argv[2] ?? "start";
const esWin = process.platform === "win32";

const abierto = (port) =>
  new Promise((res) => {
    const s = net.connect({ port, host: "127.0.0.1" }, () => (s.destroy(), res(true)));
    s.on("error", () => res(false));
    s.setTimeout(800, () => (s.destroy(), res(false)));
  });
const esperar = async (port, veces = 60) => {
  for (let i = 0; i < veces && !(await abierto(port)); i++) await new Promise((r) => setTimeout(r, 500));
  return abierto(port);
};
const correr = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: "inherit", shell: esWin, cwd: raiz, ...opts });
const leerPids = () => {
  try {
    return JSON.parse(fs.readFileSync(pidArchivo, "utf8"));
  } catch {
    return {};
  }
};
const matar = (pid) => {
  if (!pid) return;
  if (esWin) spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else try { process.kill(pid); } catch { /* ya no existe */ }
};

async function detener() {
  const p = leerPids();
  matar(p.backend);
  matar(p.frontend);
  fs.rmSync(pidArchivo, { force: true });
  console.log("[oficial] backend y frontend detenidos.");
}

async function estado() {
  const piezas = [["Oracle local", 1521], ["MinIO (adjuntos)", 9000], ["Backend oficial", 3000], ["Frontend oficial", 8443]];
  for (const [n, p] of piezas) console.log(`${(await abierto(p)) ? "ARRIBA " : "CAÍDO  "} ${n} (:${p})`);
  try {
    const r = await fetch("http://localhost:3000/api/salud");
    console.log("Salud:", JSON.stringify((await r.json()).data));
  } catch {
    console.log("Salud: sin respuesta");
  }
}

if (accion === "stop") {
  await detener();
  process.exit(0);
}
if (accion === "status") {
  await estado();
  process.exit(0);
}

// --- start ---------------------------------------------------------------
if (!(await abierto(1521))) {
  console.error("[oficial] Oracle NO responde en :1521. Inicia el servicio de Oracle (OracleServiceORCL) y reintenta.");
  process.exit(2);
}
if (!fs.existsSync(path.join(raiz, ".env")) || !/^JWT_SECRET=.+/m.test(fs.readFileSync(path.join(raiz, ".env"), "utf8"))) {
  console.error("[oficial] Falta JWT_SECRET en .env (obligatorio en producción).");
  process.exit(2);
}
if (!(await abierto(9000))) {
  console.log("[oficial] Iniciando MinIO...");
  if (esWin) {
    spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(raiz, "scripts", "minio.ps1")], { detached: true, stdio: "ignore", windowsHide: true, cwd: raiz }).unref();
  }
  if (!(await esperar(9000))) console.log("[oficial] AVISO: MinIO no respondió; los adjuntos darán 503 hasta que lo inicies (pnpm minio).");
}

console.log("[oficial] 1/4 Migrando esquema (idempotente)...");
if (correr("pnpm", ["db:deploy"]).status !== 0) process.exit(3);
console.log("[oficial] 2/4 Compilando backend...");
if (correr("pnpm", ["--filter", "backend", "build"]).status !== 0) process.exit(3);
console.log("[oficial] 3/4 Compilando frontend...");
if (correr("pnpm", ["--filter", "frontend", "build"]).status !== 0) process.exit(3);

await detener(); // solo ahora (si la compilacion falla, el servidor anterior sigue en pie)
console.log("[oficial] 4/4 Levantando servidores...");
fs.mkdirSync(dirEstado, { recursive: true });
const logB = fs.openSync(path.join(dirEstado, "backend.log"), "w");
const logF = fs.openSync(path.join(dirEstado, "frontend.log"), "w");
const backend = spawn(process.execPath, ["dist/src/server.js"], {
  cwd: path.join(raiz, "backend"),
  env: { ...process.env, NODE_ENV: "production" },
  detached: true,
  stdio: ["ignore", logB, logB],
  windowsHide: true,
});
backend.unref();
const frontend = spawn("pnpm", ["--filter", "frontend", "exec", "vite", "preview", "--host", "--port", "8443", "--strictPort"], {
  cwd: raiz,
  shell: esWin,
  detached: true,
  stdio: ["ignore", logF, logF],
  windowsHide: true,
});
frontend.unref();
fs.writeFileSync(pidArchivo, JSON.stringify({ backend: backend.pid, frontend: frontend.pid }));

const okB = await esperar(3000);
const okF = await esperar(8443);
await estado();
if (!okB || !okF) {
  console.error(`[oficial] No levantó completo. Revisa ${dirEstado}\\backend.log y frontend.log`);
  process.exit(4);
}
console.log("\n[oficial] Listo: http://localhost:8443  (ingresa con usuario y contraseña)");
process.exit(0);

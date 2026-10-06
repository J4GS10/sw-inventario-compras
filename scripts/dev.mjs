// Arranque de desarrollo: asegura MinIO (adjuntos) y levanta backend + frontend.
//   pnpm dev
// MinIO se lanza una sola vez, desacoplado de esta terminal (sigue vivo si la cierras).
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const abierto = (port) =>
  new Promise((res) => {
    const s = net.connect({ port, host: "127.0.0.1" }, () => (s.destroy(), res(true)));
    s.on("error", () => res(false));
    s.setTimeout(800, () => (s.destroy(), res(false)));
  });

if (await abierto(9000)) {
  console.log("[dev] MinIO ya esta activo (:9000)");
} else if (process.platform === "win32") {
  console.log("[dev] Iniciando MinIO (adjuntos)...");
  spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(raiz, "scripts", "minio.ps1")], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    cwd: raiz,
  }).unref();
  for (let i = 0; i < 40 && !(await abierto(9000)); i++) await new Promise((r) => setTimeout(r, 500));
  console.log((await abierto(9000)) ? "[dev] MinIO listo" : "[dev] AVISO: MinIO no respondio; los adjuntos daran 503 hasta que lo inicies (pnpm minio)");
} else {
  console.log("[dev] AVISO: MinIO no esta activo; inicialo con `pnpm minio` o docker compose.");
}

const hijo = spawn("pnpm", ["--parallel", "-r", "dev"], { stdio: "inherit", shell: true, cwd: raiz });
hijo.on("exit", (c) => process.exit(c ?? 0));

// Utilidades comunes de los QA de interfaz. Entran por la pantalla de acceso REAL (usuario + contraseña):
// el servidor oficial (producción) no ofrece el selector de perfiles de demostración.
export const BASE = process.env["QA_BASE_URL"] ?? "http://localhost:8443";
export const PASS = process.env["QA_PASS"] ?? "compras.demo";

export async function entrar(page, usuario, pass = PASS) {
  const campoUsuario = page.locator('input[placeholder="usuario"]');
  await campoUsuario.waitFor({ timeout: 30000 });
  await campoUsuario.fill(usuario);
  await page.locator('input[placeholder="contraseña"]').fill(pass);
  await page.locator('input[placeholder="contraseña"]').press("Enter");
  await page.waitForSelector("text=MÓDULOS DEL SISTEMA", { timeout: 30000 });
}

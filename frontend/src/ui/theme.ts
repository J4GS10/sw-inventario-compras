/** Gestion de tema claro/oscuro persistente. */

export type ThemeMode = "light" | "dark" | "system";

const KEY = "erp.theme";

export function getTheme(): ThemeMode {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try {
    if (mode === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, mode);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function initTheme(): void {
  applyTheme(getTheme());
}

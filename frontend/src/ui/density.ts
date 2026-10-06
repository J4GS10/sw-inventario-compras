/**
 * Densidad de las tablas: "comoda" (por defecto) o "compacta" (mas filas por pantalla).
 * Se guarda por navegador y se aplica con un atributo en <html> (ver index.css).
 */

import { useCallback, useEffect, useState } from "react";

export type Densidad = "comoda" | "compacta";
const CLAVE = "erp.densidad";

function leer(): Densidad {
  try {
    return window.localStorage.getItem(CLAVE) === "compacta" ? "compacta" : "comoda";
  } catch {
    return "comoda";
  }
}

function aplicar(d: Densidad): void {
  document.documentElement.setAttribute("data-density", d === "compacta" ? "compact" : "comfortable");
}

/** Llamar una vez al arrancar (main.tsx) para que la preferencia rija desde el primer render. */
export function initDensidad(): void {
  aplicar(leer());
}

export function useDensidad(): [Densidad, () => void] {
  const [d, setD] = useState<Densidad>(leer);
  useEffect(() => aplicar(d), [d]);
  const alternar = useCallback(() => {
    setD((prev) => {
      const next: Densidad = prev === "comoda" ? "compacta" : "comoda";
      try {
        window.localStorage.setItem(CLAVE, next);
      } catch {
        /* sin almacenamiento: vale solo esta sesion */
      }
      return next;
    });
  }, []);
  return [d, alternar];
}

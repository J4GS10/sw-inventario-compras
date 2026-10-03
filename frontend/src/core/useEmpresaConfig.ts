/**
 * Capa 4 (frontend) - Presentacion / adaptador.
 * Identidad de la empresa emisora (sidebar + membrete de PDF) — se pide una
 * sola vez, sin autenticacion (la necesita la pantalla de login tambien).
 */

import { useEffect, useState } from "react";
import { http } from "./HttpClient.js";

export interface EmpresaConfig {
  readonly nombre: string;
  readonly nit: string;
  readonly direccion: string;
  readonly telefono: string;
}

const FALLBACK: EmpresaConfig = {
  nombre: "ERP Corporativo",
  nit: "",
  direccion: "",
  telefono: "",
};

let cache: EmpresaConfig | null = null;

export function useEmpresaConfig(): EmpresaConfig {
  const [empresa, setEmpresa] = useState<EmpresaConfig>(cache ?? FALLBACK);

  useEffect(() => {
    if (cache !== null) return;
    let alive = true;
    void (async () => {
      try {
        const body = await http.raw<{ data: EmpresaConfig }>("/api/config/empresa");
        if (alive) {
          cache = body.data;
          setEmpresa(body.data);
        }
      } catch {
        // Se queda con el fallback generico — no es informacion critica.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return empresa;
}

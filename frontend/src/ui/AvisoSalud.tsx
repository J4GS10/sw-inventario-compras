/**
 * Aviso de salud del sistema bajo la barra superior. Consulta `/api/salud` cada minuto (y al volver la
 * red): si la base de datos o el almacenamiento de archivos estan caidos, lo dice con claridad y dice
 * que el trabajo del usuario esta a salvo — en vez de dejarlo descubrirlo por un error al guardar.
 */

import { useEffect, useState } from "react";
import { http } from "../core/HttpClient.js";

interface Salud {
  readonly db: "up" | "down";
  readonly storage: "up" | "down" | "memoria";
}

export default function AvisoSalud(): React.ReactElement | null {
  const [salud, setSalud] = useState<Salud | null>(null);
  const [sinServidor, setSinServidor] = useState(false);

  useEffect(() => {
    let vivo = true;
    const consultar = (): void => {
      void http
        .get<Salud>("/api/salud")
        .then((s) => {
          if (!vivo) return;
          setSalud(s);
          setSinServidor(false);
        })
        .catch(() => {
          if (vivo && navigator.onLine) setSinServidor(true);
        });
    };
    consultar();
    const t = window.setInterval(consultar, 60_000);
    window.addEventListener("online", consultar);
    return () => {
      vivo = false;
      window.clearInterval(t);
      window.removeEventListener("online", consultar);
    };
  }, []);

  let texto: string | null = null;
  let grave = false;
  if (sinServidor) {
    texto = "No se alcanza el servidor. Lo que captures se guarda en este equipo y se enviará solo cuando responda.";
    grave = true;
  } else if (salud?.db === "down") {
    texto = "La base de datos no responde. Puedes seguir capturando: tus borradores y envíos quedan guardados y se enviarán al restablecerse.";
    grave = true;
  } else if (salud?.storage === "down") {
    texto = "El almacenamiento de archivos no está disponible: por ahora no se pueden subir adjuntos ni guardar PDF. El resto del sistema funciona.";
  }
  if (texto === null) return null;
  return (
    <div
      role="status"
      className="px-3 py-1.5 text-[0.78rem] font-semibold md:px-6"
      style={{
        background: grave ? "var(--color-danger)" : "var(--color-warning)",
        color: "#fff",
      }}
    >
      {texto}
    </div>
  );
}

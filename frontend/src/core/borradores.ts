/**
 * Borradores de trabajo con respaldo en el SERVIDOR.
 *
 * Lo que alguien va capturando se guarda al instante en el navegador (sobrevive a un cierre) y,
 * pasado un instante, tambien en el servidor (`/api/borradores`), de modo que al entrar desde OTRO
 * equipo (o tras un reinicio con el navegador limpio) el trabajo sigue ahi. Todo es "mejor
 * esfuerzo": si el servidor no responde, el borrador local sigue funcionando y se reenvia despues.
 *
 * Formato: el valor es un JSON que lleva su propia marca `en` (ms epoch de la ultima edicion);
 * gana siempre la edicion mas reciente. Una clave `erp.borrador.<idUsuario>.<formulario>`.
 */

import { http } from "./HttpClient.js";

const RETRASO_ENVIO_MS = 1500;
const temporizadores = new Map<string, number>();

interface FilaServidor {
  readonly clave: string;
  readonly contenido: string;
  readonly actualizadoEn: number;
}

const prefijoDe = (idUsuario: number): string => `erp.borrador.${idUsuario}.`;
const claveConfirmados = (idUsuario: number): string => `erp.borrador.ok.${idUsuario}`;

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function escribir(clave: string, valor: string): void {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento local: queda solo el respaldo del servidor */
  }
}
function borrar(clave: string): void {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    /* nada */
  }
}

function idUsuarioDe(clave: string): number | null {
  const m = /^erp\.borrador\.(\d+)\./.exec(clave);
  return m === null ? null : Number(m[1]);
}

/** Claves cuyo ultimo envio el servidor confirmo (para distinguir "borrado en otro equipo" de "nunca enviado"). */
function confirmados(idUsuario: number): Set<string> {
  try {
    const raw = leer(claveConfirmados(idUsuario));
    return new Set(raw === null ? [] : (JSON.parse(raw) as string[]));
  } catch {
    return new Set();
  }
}
function guardarConfirmados(idUsuario: number, s: ReadonlySet<string>): void {
  escribir(claveConfirmados(idUsuario), JSON.stringify([...s]));
}

function marcaEn(contenido: string): number {
  try {
    const en = Number((JSON.parse(contenido) as { en?: unknown }).en);
    return Number.isFinite(en) && en > 0 ? en : 0;
  } catch {
    return 0;
  }
}

async function enviar(clave: string): Promise<void> {
  const uid = idUsuarioDe(clave);
  const contenido = leer(clave);
  if (uid === null || contenido === null) return;
  try {
    await http.put("/api/borradores", { clave, contenido, actualizadoEn: marcaEn(contenido) || Date.now() });
    const ok = confirmados(uid);
    ok.add(clave);
    guardarConfirmados(uid, ok);
  } catch {
    /* sin conexion o servidor ocupado: se reintenta en la siguiente edicion o al volver la red */
  }
}

/** Guarda el borrador (local al instante; servidor en segundo plano). `valor` debe llevar `en`. */
export function guardarBorrador(clave: string, valor: { en: number } & Record<string, unknown>): void {
  escribir(clave, JSON.stringify(valor));
  const previo = temporizadores.get(clave);
  if (previo !== undefined) window.clearTimeout(previo);
  temporizadores.set(
    clave,
    window.setTimeout(() => {
      temporizadores.delete(clave);
      void enviar(clave);
    }, RETRASO_ENVIO_MS),
  );
}

/** Envia ya lo pendiente (al cerrar la pestana): la peticion sale aunque la pagina se descargue. */
export function vaciarPendientes(): void {
  for (const [clave, t] of temporizadores) {
    window.clearTimeout(t);
    temporizadores.delete(clave);
    const contenido = leer(clave);
    if (contenido === null) continue;
    try {
      const token = http.getToken();
      void fetch("/api/borradores", {
        method: "PUT",
        keepalive: true,
        headers: { "content-type": "application/json", ...(token !== null ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clave, contenido, actualizadoEn: marcaEn(contenido) || Date.now() }),
      });
    } catch {
      /* mejor esfuerzo */
    }
  }
}

/** Descarta el borrador en este equipo y en el servidor (al registrar el documento o al "empezar de nuevo"). */
export function quitarBorrador(clave: string): void {
  const t = temporizadores.get(clave);
  if (t !== undefined) {
    window.clearTimeout(t);
    temporizadores.delete(clave);
  }
  borrar(clave);
  const uid = idUsuarioDe(clave);
  if (uid !== null) {
    const ok = confirmados(uid);
    ok.delete(clave);
    guardarConfirmados(uid, ok);
  }
  void http.delete(`/api/borradores?clave=${encodeURIComponent(clave)}`).catch(() => undefined);
}

/**
 * Concilia este equipo con el servidor al iniciar sesion (o al volver la red):
 *  - lo del servidor mas reciente que lo local se trae (el trabajo "viaja" entre equipos);
 *  - lo local mas reciente (o nunca enviado) se sube;
 *  - lo local que el servidor ya no tiene y SI habia confirmado se descarta (se registro o descarto en otro equipo).
 * Devuelve cuantos borradores quedaron disponibles en este equipo.
 */
export async function sincronizarBorradores(idUsuario: number): Promise<number> {
  let remotos: readonly FilaServidor[];
  try {
    remotos = await http.get<readonly FilaServidor[]>("/api/borradores");
  } catch {
    return 0;
  }
  const prefijo = prefijoDe(idUsuario);
  const ok = confirmados(idUsuario);
  const claveRemota = new Set(remotos.map((r) => r.clave));

  for (const r of remotos) {
    if (!r.clave.startsWith(prefijo)) continue;
    const local = leer(r.clave);
    if (local === null || marcaEn(local) < r.actualizadoEn) {
      escribir(r.clave, r.contenido);
    } else if (marcaEn(local) > r.actualizadoEn) {
      void enviar(r.clave);
    }
    ok.add(r.clave);
  }

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k === null || !k.startsWith(prefijo) || claveRemota.has(k)) continue;
      if (ok.has(k)) {
        borrar(k); // el servidor ya no lo tiene: se registro o se descarto en otro equipo
        ok.delete(k);
        i--;
      } else {
        void enviar(k); // nunca llego al servidor (se capturo sin conexion)
      }
    }
  } catch {
    /* sin almacenamiento local */
  }
  guardarConfirmados(idUsuario, ok);
  return remotos.filter((r) => r.clave.startsWith(prefijo)).length;
}

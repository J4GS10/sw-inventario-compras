/**
 * Cola de envios SIN CONEXION.
 *
 * Si al registrar un documento se cae la red (o el servidor no responde), el envio no se pierde ni
 * obliga a volver a capturar: se guarda en el navegador con su propia Idempotency-Key y se reenvia
 * solo cuando vuelve la conexion, en el mismo orden. Como la clave viaja con cada reintento, aunque
 * el primer intento SI hubiera llegado al servidor, el documento no se duplica.
 *
 * Un envio que el servidor rechaza con una regla de negocio (4xx) sale de la cola y se avisa con el
 * motivo, para no reintentar eternamente algo que nunca va a pasar.
 */

import { http } from "./HttpClient.js";
import { eventBus } from "./EventBus.js";
import { AppError, NetworkError, TimeoutError, UnavailableError, messageOf } from "./errors.js";

export interface EnvioPendiente {
  readonly id: string;
  readonly titulo: string;
  readonly path: string;
  readonly body: unknown;
  readonly key: string;
  readonly creado: number;
}

export const OUTBOX_EVENTO = "outbox.cambio";

const clave = (uid: number): string => `erp.outbox.${uid}`;
let procesando = false;

function leer(uid: number): EnvioPendiente[] {
  try {
    const raw = window.localStorage.getItem(clave(uid));
    return raw === null ? [] : (JSON.parse(raw) as EnvioPendiente[]);
  } catch {
    return [];
  }
}
function escribir(uid: number, items: readonly EnvioPendiente[]): void {
  try {
    if (items.length === 0) window.localStorage.removeItem(clave(uid));
    else window.localStorage.setItem(clave(uid), JSON.stringify(items));
  } catch {
    /* sin almacenamiento: la cola vive solo mientras la pagina siga abierta */
  }
  eventBus.emit(OUTBOX_EVENTO, items.length);
}

export function pendientesEnCola(uid: number): number {
  return leer(uid).length;
}

/** true si el error indica que el envio pudo no haber llegado (red, tiempo agotado, servidor caido). */
export function esErrorDeConexion(e: unknown): boolean {
  return e instanceof NetworkError || e instanceof TimeoutError || e instanceof UnavailableError;
}

export function encolarEnvio(uid: number, titulo: string, path: string, body: unknown): EnvioPendiente {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const item: EnvioPendiente = { id, titulo, path, body, key: `ob-${id}-${Math.random().toString(36).slice(2, 10)}`, creado: Date.now() };
  escribir(uid, [...leer(uid), item]);
  return item;
}

export interface ResultadoCola {
  readonly enviados: readonly { item: EnvioPendiente; creado: unknown }[];
  readonly rechazados: readonly { item: EnvioPendiente; motivo: string }[];
  readonly quedan: number;
}

/** Reenvia en orden lo pendiente; se detiene al primer corte de conexion (el resto espera). */
export async function procesarCola(uid: number): Promise<ResultadoCola> {
  const enviados: { item: EnvioPendiente; creado: unknown }[] = [];
  const rechazados: { item: EnvioPendiente; motivo: string }[] = [];
  if (procesando) return { enviados, rechazados, quedan: leer(uid).length };
  procesando = true;
  try {
    for (const item of leer(uid)) {
      try {
        const creado = await http.postConClave<unknown>(item.path, item.body, item.key);
        escribir(uid, leer(uid).filter((x) => x.id !== item.id));
        enviados.push({ item, creado });
      } catch (e) {
        if (esErrorDeConexion(e)) break;
        if (e instanceof AppError && e.httpStatus === 401) break; // sesion vencida: se conserva para cuando vuelva a entrar
        escribir(uid, leer(uid).filter((x) => x.id !== item.id));
        rechazados.push({ item, motivo: messageOf(e) });
      }
    }
  } finally {
    procesando = false;
  }
  return { enviados, rechazados, quedan: leer(uid).length };
}

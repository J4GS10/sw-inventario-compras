/**
 * Capa 4 - Presentacion / middlewares.
 * IDEMPOTENCIA de las operaciones que escriben (POST/PUT/DELETE) mediante la
 * cabecera `Idempotency-Key` (patron de Stripe/IETF draft-ietf-httpapi-idempotency-key).
 *
 *  - Misma clave + mismo cuerpo, ya completada (2xx): se REPITE la respuesta original
 *    (cabecera `Idempotent-Replay: true`) SIN volver a ejecutar nada. Doble clic, reintento
 *    tras un corte de red o un cliente nervioso no duplican documentos ni pagos.
 *  - Misma clave en curso: la segunda peticion ESPERA a la primera y recibe su respuesta
 *    (no se ejecutan dos veces en paralelo).
 *  - Misma clave con OTRO cuerpo o ruta: 422 (la clave se reutilizo mal).
 *  - Solo se recuerdan los exitosos: un error (validacion, 409...) permite reintentar.
 *  - La clave es por usuario: la de A nunca devuelve datos de B.
 * Sin cabecera, el comportamiento es el de siempre. Almacen en memoria (un proceso), TTL 10 min.
 */

import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRADAS = 5000;
const MAX_BYTES_RESPUESTA = 1024 * 1024;
const CLAVE_VALIDA = /^[A-Za-z0-9._:-]{8,100}$/;
const METODOS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

interface Resultado {
  readonly status: number;
  readonly body: string;
  readonly contentType: string;
}
interface Entrada {
  readonly huella: string;
  readonly expira: number;
  resultado?: Resultado;
  /** Resuelve con el resultado, o null si la primera ejecucion fallo (el que espera procede por su cuenta). */
  readonly enCurso: Promise<Resultado | null>;
  resolver(r: Resultado | null): void;
}

const store = new Map<string, Entrada>();

function limpiar(ahora: number): void {
  for (const [k, e] of store) if (e.expira < ahora) store.delete(k);
  if (store.size > MAX_ENTRADAS) {
    for (const k of [...store.keys()].slice(0, store.size - MAX_ENTRADAS)) store.delete(k);
  }
}

function huellaDe(req: FastifyRequest): string {
  const cuerpo = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? null);
  return createHash("sha256").update(`${req.method}|${req.url.split("?")[0]}|${cuerpo}`).digest("hex");
}

function usuarioDe(req: FastifyRequest): string {
  return String(req.auth?.sub ?? "anon");
}

function enviar(reply: FastifyReply, r: Resultado, replay: boolean): FastifyReply {
  if (replay) reply.header("Idempotent-Replay", "true");
  return reply.status(r.status).header("content-type", r.contentType).send(r.body);
}

declare module "fastify" {
  interface FastifyRequest {
    idemKey?: string;
  }
}

export function registerIdempotency(app: FastifyInstance): void {
  app.addHook("preHandler", async (req, reply) => {
    if (!METODOS.has(req.method)) return;
    const k = req.headers["idempotency-key"];
    if (typeof k !== "string" || k === "") return;
    if (!CLAVE_VALIDA.test(k)) {
      return reply.status(422).send({
        error: { code: "VALIDATION", message: "Idempotency-Key inválida (8-100 caracteres: letras, números . _ : -)", details: [], requestId: String(req.id) },
      });
    }
    // Se identifica DESPUES de authGuard (preHandler de la ruta corre antes que los hooks globales? no):
    // los hooks globales de preHandler corren ANTES del preHandler de la ruta, asi que `req.auth` aun no
    // existe aqui. Se usa el token crudo como alcance (distinto por usuario/sesion).
    const alcance = createHash("sha256").update(String(req.headers["authorization"] ?? "anon")).digest("hex").slice(0, 16);
    const clave = `${alcance}:${req.method}:${k}`;
    const ahora = Date.now();
    limpiar(ahora);
    const huella = huellaDe(req);

    const previa = store.get(clave);
    if (previa !== undefined) {
      if (previa.huella !== huella) {
        return reply.status(422).send({
          error: { code: "VALIDATION", message: "Esta Idempotency-Key ya se usó con una petición distinta.", details: [], requestId: String(req.id) },
        });
      }
      if (previa.resultado !== undefined) return enviar(reply, previa.resultado, true);
      const r = await previa.enCurso; // la primera aun corre: esperar su desenlace
      if (r !== null) return enviar(reply, r, true);
      // la primera fallo: esta peticion procede (y registra la clave de nuevo abajo)
    }

    let resolver!: (r: Resultado | null) => void;
    const enCurso = new Promise<Resultado | null>((res) => (resolver = res));
    store.set(clave, { huella, expira: ahora + TTL_MS, enCurso, resolver });
    req.idemKey = clave;
  });

  // Hook SINCRONO (ver app.ts): evita el doble envio de handlers async que llaman reply.send sin return.
  app.addHook("onSend", (req, reply, payload, done) => {
    const clave = req.idemKey;
    if (clave === undefined) return done(null, payload);
    const e = store.get(clave);
    if (e === undefined || e.resultado !== undefined) return done(null, payload);
    const ok = reply.statusCode >= 200 && reply.statusCode < 300;
    const texto = typeof payload === "string" ? payload : Buffer.isBuffer(payload) ? payload.toString("utf8") : null;
    if (ok && texto !== null && texto.length <= MAX_BYTES_RESPUESTA) {
      const r: Resultado = {
        status: reply.statusCode,
        body: texto,
        contentType: String(reply.getHeader("content-type") ?? "application/json; charset=utf-8"),
      };
      e.resultado = r;
      e.resolver(r);
    } else {
      store.delete(clave); // error: no se recuerda, se puede reintentar
      e.resolver(null);
    }
    done(null, payload);
  });
}

/** Solo para pruebas. */
export function resetIdempotencia(): void {
  store.clear();
}

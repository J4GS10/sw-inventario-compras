/**
 * Capa 3 - Logica de Negocio / soporte.
 * Patron Decorator: envuelve un servicio con un Proxy que mide y registra la
 * duracion de cada metodo asincrono, sin tocar el codigo del servicio.
 *
 *   export const ordenCompraService = withTelemetry(
 *     new OrdenCompraService(...), "OrdenCompraService",
 *   );
 */

import { logger } from "../../../common/logging/Logger.js";

type AnyMethod = (...args: unknown[]) => unknown;

export function withTelemetry<T extends object>(target: T, label: string): T {
  const log = logger();
  return new Proxy(target, {
    get(obj, prop, receiver): unknown {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value !== "function" || typeof prop === "symbol") {
        return value;
      }
      const method = value as AnyMethod;
      return function decorated(this: unknown, ...args: unknown[]): unknown {
        const started = performance.now();
        let outcome: "ok" | "error" = "ok";
        try {
          const out = method.apply(obj, args);
          if (out instanceof Promise) {
            return out
              .catch((err: unknown) => {
                outcome = "error";
                throw err;
              })
              .finally(() => {
                log.debug("telemetria", {
                  service: label,
                  method: String(prop),
                  ms: Math.round(performance.now() - started),
                  outcome,
                });
              });
          }
          log.debug("telemetria", {
            service: label,
            method: String(prop),
            ms: Math.round(performance.now() - started),
            outcome,
          });
          return out;
        } catch (err) {
          log.debug("telemetria", {
            service: label,
            method: String(prop),
            ms: Math.round(performance.now() - started),
            outcome: "error",
          });
          throw err;
        }
      };
    },
  });
}

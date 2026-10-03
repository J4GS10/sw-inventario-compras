/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Fachada de compatibilidad sobre la capa POO (`core/HttpClient`). El codigo de
 * pantallas migra progresivamente a repositorios/servicios; `api` sigue
 * disponible con la misma superficie.
 */

import { HttpClient } from "../core/HttpClient.js";
import { AppError, isAppError, messageOf } from "../core/errors.js";

export type { Page as ListResult, PageMeta } from "../core/HttpClient.js";

/** Alias historico de la excepcion de dominio. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly api: { code: string; message: string; details: readonly { field?: string; message: string }[] },
  ) {
    super(api.message);
    this.name = "ApiRequestError";
  }
}

function toApiRequestError(e: unknown): ApiRequestError {
  if (isAppError(e)) {
    return new ApiRequestError(e.httpStatus, {
      code: e.code,
      message: e.message,
      details: e.details,
    });
  }
  return new ApiRequestError(0, { code: "UNKNOWN", message: messageOf(e), details: [] });
}

const client = HttpClient.getInstance();

async function guard<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e) {
    throw toApiRequestError(e);
  }
}

export const api = {
  list: <T>(path: string, query: Record<string, string> = {}) =>
    guard(() => client.list<T>(path, query)),
  raw: <T>(path: string, query: Record<string, string> = {}) =>
    guard(() => client.raw<T>(path, query)),
  get: <T>(path: string) => guard(() => client.get<T>(path)),
  create: <T>(path: string, payload: unknown) => guard(() => client.post<T>(path, payload)),
  update: <T>(path: string, payload: unknown, version?: number) =>
    guard(() => client.put<T>(path, payload, version)),
  remove: (path: string) => guard(() => client.delete(path)),
  action: <T>(path: string, payload?: unknown) => guard(() => client.action<T>(path, payload)),
  blob: (path: string) => guard(() => client.blob(path)),
};

export { AppError, isAppError, messageOf };

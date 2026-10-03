/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Cliente HTTP unico de la aplicacion.
 *
 * Patrones:
 *  - Singleton: una sola instancia (`HttpClient.getInstance()`).
 *  - Template Method: `request()` fija el flujo construir -> fetch -> mapear
 *    respuesta -> desempaquetar sobre; los metodos publicos solo aportan verbo,
 *    ruta y cuerpo.
 *  - Adapter: `toAppError()` traduce respuestas/errores de `fetch` a la
 *    jerarquia `AppError` del dominio.
 */

import {
  AppError,
  ConflictError,
  ForbiddenError,
  LockedError,
  NetworkError,
  NotFoundError,
  ServerError,
  UnauthorizedError,
  ValidationError,
  type ErrorDetail,
} from "./errors.js";

const TOKEN_STORAGE_KEY = "erp.auth.token";

export interface PageMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}
export interface Page<T> {
  readonly data: readonly T[];
  readonly meta: PageMeta;
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

interface WireError {
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export class HttpClient {
  private static instance: HttpClient | undefined;

  private token: string | null = null;
  /** Se invoca cuando un request autenticado recibe 401 (token vencido/invalido). */
  private authExpiredHandler: (() => void) | null = null;

  private constructor(private readonly baseUrl = "") {
    this.token = safeStorageGet(TOKEN_STORAGE_KEY);
  }

  public static getInstance(): HttpClient {
    if (HttpClient.instance === undefined) HttpClient.instance = new HttpClient();
    return HttpClient.instance;
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (token === null) safeStorageRemove(TOKEN_STORAGE_KEY);
    else safeStorageSet(TOKEN_STORAGE_KEY, token);
  }

  public getToken(): string | null {
    return this.token;
  }

  /** Registra el callback de sesion expirada (lo usa AuthContext). */
  public onAuthExpired(handler: (() => void) | null): void {
    this.authExpiredHandler = handler;
  }

  // -- API publica -----------------------------------------------------------

  public async get<T>(path: string, query?: QueryParams): Promise<T> {
    const body = await this.request("GET", this.withQuery(path, query));
    return this.unwrap<T>(body);
  }

  public async list<T>(path: string, query?: QueryParams): Promise<Page<T>> {
    const body = await this.request("GET", this.withQuery(path, query));
    const b = body as { data?: unknown; meta?: PageMeta };
    return {
      data: (Array.isArray(b.data) ? b.data : []) as T[],
      meta: b.meta ?? { page: 1, pageSize: 0, total: 0, totalPages: 0 },
    };
  }

  /** Devuelve el cuerpo tal cual (endpoints con forma propia, p. ej. historial). */
  public async raw<T>(path: string, query?: QueryParams): Promise<T> {
    return (await this.request("GET", this.withQuery(path, query))) as T;
  }

  public async post<T>(path: string, payload?: unknown): Promise<T> {
    return this.unwrap<T>(await this.request("POST", path, payload));
  }

  public async put<T>(path: string, payload: unknown, version?: number): Promise<T> {
    return this.unwrap<T>(await this.request("PUT", path, payload, version));
  }

  public async delete(path: string): Promise<void> {
    await this.request("DELETE", path);
  }

  /** Descarga binaria (PDF, etc.). */
  public async blob(path: string, query?: QueryParams): Promise<Blob> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl + this.withQuery(path, query), {
        headers: this.authHeaders(),
      });
    } catch (e) {
      throw new NetworkError(e instanceof Error ? e.message : undefined);
    }
    if (!res.ok) throw await this.toAppError(res);
    return res.blob();
  }

  /** Subida multipart de un archivo (campo "file"). Desempaqueta el sobre. */
  public async upload<T>(path: string, file: File): Promise<T> {
    const fd = new FormData();
    fd.append("file", file, file.name);
    let res: Response;
    try {
      // No fijar Content-Type: el navegador pone el boundary de multipart.
      res = await fetch(this.baseUrl + path, {
        method: "POST",
        headers: this.authHeaders(),
        body: fd,
      });
    } catch (e) {
      throw new NetworkError(e instanceof Error ? e.message : undefined);
    }
    const text = await res.text();
    const parsed: unknown = text ? this.safeJson(text) : {};
    if (!res.ok) throw this.mapError(res.status, parsed);
    return this.unwrap<T>(parsed);
  }

  // -- Compatibilidad con el codigo existente (fachada) --------------------

  public readonly create = <T>(path: string, payload: unknown): Promise<T> =>
    this.post<T>(path, payload);
  public readonly update = <T>(path: string, payload: unknown, version?: number): Promise<T> =>
    this.put<T>(path, payload, version);
  public readonly remove = (path: string): Promise<void> => this.delete(path);
  public readonly action = <T>(path: string, payload?: unknown): Promise<T> =>
    this.post<T>(path, payload);

  // -- Template Method ---------------------------------------------------

  private async request(
    method: string,
    path: string,
    payload?: unknown,
    version?: number,
  ): Promise<unknown> {
    const headers: Record<string, string> = { ...this.authHeaders() };
    const init: RequestInit = { method, headers };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(payload);
    }
    if (version !== undefined) headers["If-Match"] = String(version);

    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, init);
    } catch (e) {
      throw new NetworkError(e instanceof Error ? e.message : undefined);
    }

    if (res.status === 204) return {};
    const text = await res.text();
    const parsed: unknown = text ? this.safeJson(text) : {};
    if (!res.ok) {
      if (
        res.status === 401 &&
        this.token !== null &&
        !path.startsWith("/api/auth/login") &&
        !path.startsWith("/api/auth/logout")
      ) {
        // Token vencido o invalido en una llamada autenticada: limpiar y avisar.
        this.setToken(null);
        this.authExpiredHandler?.();
      }
      throw this.mapError(res.status, parsed);
    }
    return parsed;
  }

  private unwrap<T>(body: unknown): T {
    if (body !== null && typeof body === "object" && "data" in body) {
      return (body as { data: T }).data;
    }
    return body as T;
  }

  // -- Adapter -----------------------------------------------------------

  private mapError(status: number, body: unknown): AppError {
    const wire: WireError =
      body !== null && typeof body === "object" && "error" in body
        ? (body as { error: WireError }).error
        : { code: "INTERNAL", message: `HTTP ${status}` };
    const details = wire.details ?? [];
    switch (status) {
      case 401:
        return new UnauthorizedError(wire.message);
      case 403:
        return new ForbiddenError(wire.message);
      case 404:
        return new NotFoundError(wire.message);
      case 409:
        return new ConflictError(wire.message);
      case 423:
        return new LockedError(wire.message);
      case 422:
      case 400:
        return new ValidationError(wire.message, details);
      default:
        return new ServerError(wire.message);
    }
  }

  private async toAppError(res: Response): Promise<AppError> {
    let body: unknown = {};
    try {
      body = this.safeJson(await res.text());
    } catch {
      body = {};
    }
    return this.mapError(res.status, body);
  }

  // -- helpers ---------------------------------------------------------

  private authHeaders(): Record<string, string> {
    // Sin token -> sin cabecera de auth. El backend responde 401 y la app
    // muestra el LoginScreen. Ya no hay atajo X-Dev-User en el cliente: los
    // roles se aplican siempre.
    return this.token !== null ? { Authorization: `Bearer ${this.token}` } : {};
  }

  private withQuery(path: string, query?: QueryParams): string {
    if (query === undefined) return path;
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") usp.set(k, String(v));
    }
    const qs = usp.toString();
    return qs === "" ? path : `${path}?${qs}`;
  }

  private safeJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }
}

function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* modo privado / almacenamiento bloqueado */
  }
}
function safeStorageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export const http = HttpClient.getInstance();

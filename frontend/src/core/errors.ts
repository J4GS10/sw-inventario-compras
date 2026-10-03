/**
 * Capa 6 (frontend) - Componentes Comunes.
 * Jerarquia de excepciones semanticas, espejo de la del backend. Abstraccion +
 * generalizacion: un contrato comun (`AppError`) del que heredan los casos
 * concretos.
 */

export interface ErrorDetail {
  readonly field?: string;
  readonly message: string;
}

export abstract class AppError extends Error {
  public abstract readonly code: string;
  public abstract readonly httpStatus: number;
  public readonly details: readonly ErrorDetail[];

  protected constructor(message: string, details: readonly ErrorDetail[] = []) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  public readonly code = "NOT_FOUND";
  public readonly httpStatus = 404;
  constructor(message = "Recurso no encontrado") {
    super(message);
  }
}

export class ValidationError extends AppError {
  public readonly code = "VALIDATION";
  public readonly httpStatus = 422;
  constructor(message: string, details: readonly ErrorDetail[] = []) {
    super(message, details);
  }
}

export class ConflictError extends AppError {
  public readonly code = "CONFLICT";
  public readonly httpStatus = 409;
  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  public readonly code = "UNAUTHORIZED";
  public readonly httpStatus = 401;
  constructor(message = "No autenticado") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  public readonly code = "FORBIDDEN";
  public readonly httpStatus = 403;
  constructor(message = "No tiene permisos para esta accion") {
    super(message);
  }
}

export class LockedError extends AppError {
  public readonly code = "LOCKED";
  public readonly httpStatus = 423;
  constructor(message = "Cuenta bloqueada temporalmente") {
    super(message);
  }
}

export class NetworkError extends AppError {
  public readonly code = "NETWORK";
  public readonly httpStatus = 0;
  constructor(message = "No se pudo contactar el servidor") {
    super(message);
  }
}

export class ServerError extends AppError {
  public readonly code = "INTERNAL";
  public readonly httpStatus = 500;
  constructor(message = "Error interno del servidor") {
    super(message);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function messageOf(value: unknown): string {
  if (isAppError(value)) return value.message;
  if (value instanceof Error) return value.message;
  return String(value);
}

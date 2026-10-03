/**
 * Capa 6 - Componentes Comunes.
 * Jerarquia de excepciones semanticas. Sin dependencia del negocio.
 *
 * La DAL captura errores tecnicos de Oracle y los traduce a estas clases
 * (via OracleErrorAdapter); el middleware centralizado de Presentacion las
 * convierte en respuestas HTTP.
 */

export type ErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "FOREIGN_KEY"
  | "OPTIMISTIC_LOCK"
  | "BUSINESS_RULE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "LOCKED"
  | "INTERNAL";

export interface ErrorDetail {
  readonly field?: string;
  readonly message: string;
}

export abstract class AppError extends Error {
  public abstract readonly code: ErrorCode;
  public abstract readonly httpStatus: number;
  public readonly details: readonly ErrorDetail[];
  public override readonly cause?: unknown;

  protected constructor(
    message: string,
    options?: { details?: readonly ErrorDetail[]; cause?: unknown },
  ) {
    super(message);
    this.name = new.target.name;
    this.details = options?.details ?? [];
    this.cause = options?.cause;
    Error.captureStackTrace?.(this, new.target);
  }

  public toJSON(): {
    code: ErrorCode;
    message: string;
    details: readonly ErrorDetail[];
  } {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export class NotFoundError extends AppError {
  public readonly code = "NOT_FOUND" as const;
  public readonly httpStatus = 404;

  constructor(entity: string, id?: number | string) {
    super(
      id === undefined
        ? `${entity} no encontrado`
        : `${entity} con id ${id} no encontrado`,
    );
  }
}

export class ConflictError extends AppError {
  public readonly code = "CONFLICT" as const;
  public readonly httpStatus = 409;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export class ValidationError extends AppError {
  public readonly code = "VALIDATION" as const;
  public readonly httpStatus = 422;

  constructor(
    message: string,
    details: readonly ErrorDetail[] = [],
    options?: { cause?: unknown },
  ) {
    super(message, { details, cause: options?.cause });
  }
}

export class ForeignKeyError extends AppError {
  public readonly code = "FOREIGN_KEY" as const;
  public readonly httpStatus = 409;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export class OptimisticLockError extends AppError {
  public readonly code = "OPTIMISTIC_LOCK" as const;
  public readonly httpStatus = 409;

  constructor(entity: string, id: number | string) {
    super(
      `${entity} con id ${id} fue modificado por otro usuario. Recargue y reintente.`,
    );
  }
}

export class BusinessRuleError extends AppError {
  public readonly code = "BUSINESS_RULE" as const;
  public readonly httpStatus = 409;

  constructor(message: string, details: readonly ErrorDetail[] = []) {
    super(message, { details });
  }
}

export class UnauthorizedError extends AppError {
  public readonly code = "UNAUTHORIZED" as const;
  public readonly httpStatus = 401;

  constructor(message = "No autenticado") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  public readonly code = "FORBIDDEN" as const;
  public readonly httpStatus = 403;

  constructor(message = "No autorizado para esta operacion") {
    super(message);
  }
}

/** Cuenta bloqueada temporalmente (p. ej. por intentos de login fallidos). */
export class LockedError extends AppError {
  public readonly code = "LOCKED" as const;
  public readonly httpStatus = 423;

  constructor(message = "Cuenta bloqueada temporalmente") {
    super(message);
  }
}

export class InternalError extends AppError {
  public readonly code = "INTERNAL" as const;
  public readonly httpStatus = 500;

  constructor(message = "Error interno", options?: { cause?: unknown }) {
    super(message, options);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

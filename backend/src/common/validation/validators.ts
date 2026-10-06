/**
 * Capa 6 - Componentes Comunes.
 * Validadores genericos reutilizables (independientes del negocio) y helper
 * para ejecutar la validacion de un DTO decorado con class-validator, mapeando
 * el resultado a la excepcion semantica ValidationError.
 */

import "reflect-metadata";
import {
  registerDecorator,
  validate,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";
import { plainToInstance } from "class-transformer";
import { ValidationError, type ErrorDetail } from "../errors/AppError.js";

/** Decorador: el valor (si esta presente) debe ser 'S' o 'N'. */
export function IsCharBool(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: "isCharBool",
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown): boolean {
          return value === undefined || value === "S" || value === "N";
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} debe ser 'S' o 'N'`;
        },
      },
    });
  };
}

/** Decorador: el valor (si esta presente) debe pertenecer al conjunto dado. */
export function IsOneOf(allowed: readonly string[], options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: "isOneOf",
      target: object.constructor,
      propertyName,
      constraints: [allowed],
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const set = args.constraints[0] as readonly string[];
          return value === undefined || set.includes(String(value));
        },
        defaultMessage(args: ValidationArguments): string {
          const set = args.constraints[0] as readonly string[];
          return `${args.property} debe ser uno de: ${set.join(", ")}`;
        },
      },
    });
  };
}

/**
 * Convierte `plain` en una instancia de `dtoClass`, la valida y la devuelve
 * tipada. Lanza ValidationError con el detalle por campo si algo falla.
 */
export async function validateDto<T extends object>(
  dtoClass: new () => T,
  plain: unknown,
): Promise<T> {
  const instance = plainToInstance(dtoClass, plain, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: false,
    forbidUnknownValues: true,
  });
  if (errors.length > 0) {
    const details: ErrorDetail[] = [];
    for (const err of errors) {
      const messages = Object.values(err.constraints ?? {});
      for (const message of messages) {
        details.push({ field: err.property, message });
      }
    }
    throw new ValidationError("El cuerpo de la petición no es válido", details);
  }
  return instance;
}

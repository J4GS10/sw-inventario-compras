/**
 * Capa 6 - Componentes Comunes.
 * Sistema de logging. Patron Singleton.
 * Sin dependencia del negocio.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogFields {
  readonly [key: string]: unknown;
}

export class Logger {
  private static instance: Logger | undefined;

  private minWeight: number;

  private constructor() {
    const configured = (process.env["LOG_LEVEL"] ?? "info") as LogLevel;
    this.minWeight = LEVEL_WEIGHT[configured] ?? LEVEL_WEIGHT.info;
  }

  public static getInstance(): Logger {
    if (Logger.instance === undefined) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.minWeight = LEVEL_WEIGHT[level];
  }

  public debug(message: string, fields?: LogFields): void {
    this.write("debug", message, fields);
  }

  public info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  public warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  public error(message: string, fields?: LogFields): void {
    this.write("error", message, fields);
  }

  /** Crea un logger hijo con campos fijos (ej. correlationId por request). */
  public child(base: LogFields): ScopedLogger {
    return new ScopedLogger(this, base);
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_WEIGHT[level] < this.minWeight) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(fields ?? {}),
    };
    const line = JSON.stringify(entry);
    if (level === "error") {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }
}

export class ScopedLogger {
  constructor(
    private readonly parent: Logger,
    private readonly base: LogFields,
  ) {}

  public debug(message: string, fields?: LogFields): void {
    this.parent.debug(message, { ...this.base, ...(fields ?? {}) });
  }

  public info(message: string, fields?: LogFields): void {
    this.parent.info(message, { ...this.base, ...(fields ?? {}) });
  }

  public warn(message: string, fields?: LogFields): void {
    this.parent.warn(message, { ...this.base, ...(fields ?? {}) });
  }

  public error(message: string, fields?: LogFields): void {
    this.parent.error(message, { ...this.base, ...(fields ?? {}) });
  }
}

export function logger(): Logger {
  return Logger.getInstance();
}

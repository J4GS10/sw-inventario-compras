/**
 * Capa 6 - Componentes Comunes.
 * Limitador de intentos fallidos por clave (p. ej. IP), en memoria, ventana fija.
 *
 * Complementa el bloqueo por USUARIO del login: este corta la rafaga contra
 * MUCHOS usuarios desde una misma IP (password spraying). En memoria porque el
 * backend es un solo proceso; con varias replicas se movera a un almacen
 * compartido sin cambiar la interfaz.
 */

export interface EstadoLimite {
  readonly bloqueado: boolean;
  /** Segundos hasta que se libera (0 si no esta bloqueado). */
  readonly reintentarEnSeg: number;
}

export class FailureRateLimiter {
  private readonly fallos = new Map<string, { n: number; desde: number }>();

  constructor(
    private readonly maxFallos: number,
    private readonly ventanaMs: number,
    private readonly ahora: () => number = Date.now,
  ) {}

  public estado(clave: string): EstadoLimite {
    const e = this.fallos.get(clave);
    if (e === undefined) return { bloqueado: false, reintentarEnSeg: 0 };
    const restante = e.desde + this.ventanaMs - this.ahora();
    if (restante <= 0) {
      this.fallos.delete(clave);
      return { bloqueado: false, reintentarEnSeg: 0 };
    }
    return e.n >= this.maxFallos
      ? { bloqueado: true, reintentarEnSeg: Math.ceil(restante / 1000) }
      : { bloqueado: false, reintentarEnSeg: 0 };
  }

  public registrarFallo(clave: string): void {
    const t = this.ahora();
    const e = this.fallos.get(clave);
    if (e === undefined || e.desde + this.ventanaMs <= t) {
      this.fallos.set(clave, { n: 1, desde: t });
    } else {
      e.n += 1;
    }
    // Barrido oportunista: el mapa no crece sin limite bajo un ataque con IPs variadas.
    if (this.fallos.size > 10_000) {
      for (const [k, v] of this.fallos) if (v.desde + this.ventanaMs <= t) this.fallos.delete(k);
    }
  }

  public limpiar(clave: string): void {
    this.fallos.delete(clave);
  }
}

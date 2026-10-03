/**
 * Capa 3 - Logica de Negocio / Seguridad.
 * Orquesta la autenticacion: valida credenciales (hash scrypt), aplica la
 * politica de bloqueo por intentos fallidos, resuelve roles -> permisos y emite
 * el JWT. Deja rastro en SEG_BITACORA_ACCESO.
 *
 * No contiene SQL: toda la persistencia pasa por `SegAuthRepository` (Capa 2).
 * Patron Singleton.
 */

import { env } from "../../../common/config/EnvConfig.js";
import {
  LockedError,
  UnauthorizedError,
  ValidationError,
} from "../../../common/errors/AppError.js";
import { signJwt } from "../../../common/auth/jwt.js";
import { verifyPassword } from "../../../common/auth/password.js";
import { hasPermiso } from "../../../common/auth/permissions.js";
import {
  segAuthRepository,
  type SegAuthRepository,
} from "../../../dal/repositories/seg/SegAuthRepository.js";

export interface SesionUsuario {
  readonly idUsuario: number;
  readonly username: string;
  readonly idEmpleado: number;
  readonly nombre: string;
  readonly roles: readonly string[];
  readonly permisos: readonly string[];
}

/** Contexto de la peticion util para la bitacora. */
export interface AuthRequestInfo {
  readonly ip?: string | null;
}

/** Numero de intentos fallidos consecutivos que bloquea la cuenta. */
export const MAX_INTENTOS_FALLIDOS = 5;
/** Minutos que dura el bloqueo temporal. */
export const VENTANA_BLOQUEO_MIN = 15;

const CREDENCIALES_INVALIDAS = "Usuario o contrasena invalidos";
const TOKEN_TTL_SECONDS = 8 * 3600;

export class AuthService {
  private static instance: AuthService | undefined;

  private readonly repo: SegAuthRepository;

  private constructor(repo: SegAuthRepository = segAuthRepository) {
    this.repo = repo;
  }

  public static getInstance(): AuthService {
    if (AuthService.instance === undefined) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /** Inicia sesion validando contrasena; devuelve token + datos de la sesion. */
  public async login(
    username: string,
    password: string | undefined,
    info: AuthRequestInfo = {},
  ): Promise<{ token: string; sesion: SesionUsuario }> {
    const user = String(username ?? "").trim();
    const pass = typeof password === "string" ? password : "";
    if (user === "") throw new ValidationError("Usuario requerido");
    if (pass === "") {
      throw new ValidationError("Contrasena requerida", [
        { field: "password", message: "requerido" },
      ]);
    }
    const ip = info.ip ?? null;

    const found = await this.repo.findByUsername(user);

    if (found === null) {
      // Aun sin cuenta valida dejamos huella; respuesta generica (no se revela
      // si el usuario existe).
      await this.repo.registrarFallo({
        idUsuario: null,
        username: user,
        ip,
        maxIntentos: MAX_INTENTOS_FALLIDOS,
      });
      throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
    }

    if (found.estado !== "A") {
      await this.repo.registrarEvento({
        idUsuario: found.idUsuario,
        username: user,
        evento: "LOGIN_FALLIDO",
        ip,
        detalle: "cuenta inactiva",
      });
      throw new UnauthorizedError("La cuenta esta inactiva");
    }

    this.assertNoBloqueada(found.fechaBloqueo);

    const ok = await verifyPassword(pass, found.passwordHash);
    if (!ok) {
      const { intentos, bloqueada } = await this.repo.registrarFallo({
        idUsuario: found.idUsuario,
        username: user,
        ip,
        maxIntentos: MAX_INTENTOS_FALLIDOS,
      });
      if (bloqueada) {
        throw new LockedError(
          `Cuenta bloqueada por ${intentos} intentos fallidos. ` +
            `Reintente en ${VENTANA_BLOQUEO_MIN} minutos.`,
        );
      }
      throw new UnauthorizedError(CREDENCIALES_INVALIDAS);
    }

    const accesos = await this.repo.loadAccesos(found.idUsuario);
    const sesion: SesionUsuario = {
      idUsuario: found.idUsuario,
      username: found.username,
      idEmpleado: found.idEmpleado,
      nombre: found.nombre,
      roles: accesos.roles,
      permisos: this.efectivos(accesos.roles, accesos.permisos),
    };

    await this.repo.registrarExito(found.idUsuario, ip);

    const token = signJwt(
      {
        sub: sesion.idUsuario,
        username: sesion.username,
        empleadoId: sesion.idEmpleado,
        roles: sesion.roles,
        permisos: sesion.permisos,
      },
      env().auth.jwtSecret,
      TOKEN_TTL_SECONDS,
    );
    return { token, sesion };
  }

  /** Datos de la sesion a partir del id de usuario (para GET /me). */
  public async me(idUsuario: number): Promise<SesionUsuario> {
    const base = await this.repo.findSesionById(idUsuario);
    if (base === null) throw new UnauthorizedError();
    const accesos = await this.repo.loadAccesos(idUsuario);
    return {
      ...base,
      roles: accesos.roles,
      permisos: this.efectivos(accesos.roles, accesos.permisos),
    };
  }

  /** Cierra sesion (JWT es stateless): solo deja la marca en la bitacora. */
  public async logout(
    idUsuario: number,
    info: AuthRequestInfo = {},
  ): Promise<void> {
    await this.repo.registrarEvento({
      idUsuario,
      username: null,
      evento: "LOGOUT",
      ip: info.ip ?? null,
    });
  }

  /** Usuarios de demostracion + sus roles (para el selector de la UI). */
  public async usuariosDemo(): Promise<
    readonly { username: string; nombre: string; roles: readonly string[] }[]
  > {
    return this.repo.usuariosDemo();
  }

  // ------------------------------------------------------------------ internos

  private assertNoBloqueada(fechaBloqueo: Date | null): void {
    if (fechaBloqueo === null) return;
    const desbloqueaEn =
      fechaBloqueo.getTime() + VENTANA_BLOQUEO_MIN * 60 * 1000;
    const restanteMs = desbloqueaEn - Date.now();
    if (restanteMs > 0) {
      const min = Math.ceil(restanteMs / 60000);
      throw new LockedError(
        `Cuenta bloqueada temporalmente. Reintente en ${min} minuto(s).`,
      );
    }
  }

  private efectivos(
    roles: readonly string[],
    permisos: readonly string[],
  ): readonly string[] {
    if (hasPermiso(permisos, "*") || roles.includes("ADMIN_COMPRAS")) {
      return ["*"];
    }
    return permisos;
  }
}

export const authService = AuthService.getInstance();

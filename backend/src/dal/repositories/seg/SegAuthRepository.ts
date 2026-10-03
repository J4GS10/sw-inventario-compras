/**
 * Capa 2 - Acceso a Datos / Seguridad.
 * UNICO lugar con SQL de autenticacion. Concentra las lecturas y escrituras
 * sobre SEG_USUARIO / SEG_USUARIO_ROL / SEG_ROL / SEG_ROL_PERMISO / SEG_PERMISO
 * y la bitacora SEG_BITACORA_ACCESO.
 *
 * - Bind variables siempre; identificadores fijos (no provienen de input).
 * - Errores del driver -> `mapOracleError` -> AppError.
 * - Las escrituras corren dentro de `withTransaction` (el pool tiene
 *   autoCommit = false).
 *
 * Patron Singleton (una instancia; comparte el OraclePool).
 */

import oracledb, { type BindParameters, type Connection } from "oracledb";
import { oraclePool } from "../../OraclePool.js";
import { mapOracleError } from "../../../common/errors/OracleErrorAdapter.js";

function asBinds(map: Record<string, unknown>): BindParameters {
  return map as unknown as BindParameters;
}

export type EventoAcceso =
  | "LOGIN_EXITOSO"
  | "LOGIN_FALLIDO"
  | "LOGOUT"
  | "CAMBIO_PASSWORD"
  | "BLOQUEO_CUENTA";

/** Fila de SEG_USUARIO con lo necesario para autenticar y aplicar bloqueo. */
export interface AuthUserRow {
  readonly idUsuario: number;
  readonly username: string;
  readonly idEmpleado: number;
  readonly nombre: string;
  readonly passwordHash: string;
  readonly estado: string;
  readonly intentosFallidos: number;
  readonly fechaBloqueo: Date | null;
}

export interface SesionRow {
  readonly idUsuario: number;
  readonly username: string;
  readonly idEmpleado: number;
  readonly nombre: string;
}

export interface Accesos {
  readonly roles: readonly string[];
  readonly permisos: readonly string[];
}

export interface UsuarioDemoRow {
  readonly username: string;
  readonly nombre: string;
  readonly roles: readonly string[];
}

interface Row {
  [k: string]: unknown;
}

export class SegAuthRepository {
  private static instance: SegAuthRepository | undefined;

  public static getInstance(): SegAuthRepository {
    if (SegAuthRepository.instance === undefined) {
      SegAuthRepository.instance = new SegAuthRepository();
    }
    return SegAuthRepository.instance;
  }

  // ------------------------------------------------------------------ lecturas

  /** Usuario por username (case-insensitive). No filtra por ESTADO. */
  public async findByUsername(username: string): Promise<AuthUserRow | null> {
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(
          `SELECT u.ID_USUARIO, u.USERNAME, u.ID_EMPLEADO,
                  e.NOMBRES || ' ' || e.APELLIDOS AS NOMBRE,
                  u.PASSWORD_HASH, NVL(u.ESTADO, 'A') AS ESTADO,
                  NVL(u.INTENTOS_FALLIDOS, 0) AS INTENTOS_FALLIDOS,
                  u.FECHA_BLOQUEO
           FROM SEG_USUARIO u
           JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = u.ID_EMPLEADO
           WHERE LOWER(u.USERNAME) = :username AND u.ELIMINADO = 'N'`,
          { username: username.toLowerCase() },
        );
        const row = res.rows?.[0];
        if (row === undefined) return null;
        return this.mapAuthUser(row);
      } catch (error) {
        throw mapOracleError(error, "SEG_USUARIO");
      }
    });
  }

  /** Datos de sesion por id (para GET /me). Exige ESTADO = 'A'. */
  public async findSesionById(idUsuario: number): Promise<SesionRow | null> {
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(
          `SELECT u.ID_USUARIO, u.USERNAME, u.ID_EMPLEADO,
                  e.NOMBRES || ' ' || e.APELLIDOS AS NOMBRE
           FROM SEG_USUARIO u
           JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = u.ID_EMPLEADO
           WHERE u.ID_USUARIO = :id AND u.ELIMINADO = 'N'
             AND NVL(u.ESTADO, 'A') = 'A'`,
          { id: idUsuario },
        );
        const row = res.rows?.[0];
        if (row === undefined) return null;
        return {
          idUsuario: Number(row["ID_USUARIO"]),
          username: String(row["USERNAME"]),
          idEmpleado: Number(row["ID_EMPLEADO"]),
          nombre: String(row["NOMBRE"]),
        };
      } catch (error) {
        throw mapOracleError(error, "SEG_USUARIO");
      }
    });
  }

  /** Roles (codigos) y permisos efectivos (codigos) de un usuario. */
  public async loadAccesos(idUsuario: number): Promise<Accesos> {
    return oraclePool().withConnection(async (c) => {
      try {
        const roles = await c.execute<Row>(
          `SELECT r.CODIGO
           FROM SEG_USUARIO_ROL ur
           JOIN SEG_ROL r ON r.ID_ROL = ur.ID_ROL
             AND r.ELIMINADO = 'N' AND NVL(r.ESTADO, 'A') = 'A'
           WHERE ur.ID_USUARIO = :id AND ur.ELIMINADO = 'N'`,
          { id: idUsuario },
        );
        const permisos = await c.execute<Row>(
          `SELECT DISTINCT p.CODIGO
           FROM SEG_USUARIO_ROL ur
           JOIN SEG_ROL_PERMISO rp ON rp.ID_ROL = ur.ID_ROL AND rp.ELIMINADO = 'N'
           JOIN SEG_PERMISO p ON p.ID_PERMISO = rp.ID_PERMISO AND p.ELIMINADO = 'N'
           WHERE ur.ID_USUARIO = :id AND ur.ELIMINADO = 'N'`,
          { id: idUsuario },
        );
        return {
          roles: (roles.rows ?? []).map((r) => String(r["CODIGO"])),
          permisos: (permisos.rows ?? []).map((r) => String(r["CODIGO"])),
        };
      } catch (error) {
        throw mapOracleError(error, "SEG_ROL_PERMISO");
      }
    });
  }

  /** Usuarios de demostracion + roles (selector de la UI). */
  public async usuariosDemo(): Promise<readonly UsuarioDemoRow[]> {
    return oraclePool().withConnection(async (c) => {
      try {
        const res = await c.execute<Row>(
          `SELECT u.USERNAME, e.NOMBRES || ' ' || e.APELLIDOS AS NOMBRE,
                  LISTAGG(r.CODIGO, ',') WITHIN GROUP (ORDER BY r.CODIGO) AS ROLES
           FROM SEG_USUARIO u
           JOIN NOM_EMPLEADO e ON e.ID_EMPLEADO = u.ID_EMPLEADO
           LEFT JOIN SEG_USUARIO_ROL ur
             ON ur.ID_USUARIO = u.ID_USUARIO AND ur.ELIMINADO = 'N'
           LEFT JOIN SEG_ROL r
             ON r.ID_ROL = ur.ID_ROL AND r.ELIMINADO = 'N'
           WHERE u.ELIMINADO = 'N' AND NVL(u.ESTADO, 'A') = 'A'
           GROUP BY u.USERNAME, e.NOMBRES || ' ' || e.APELLIDOS
           ORDER BY u.USERNAME`,
        );
        return (res.rows ?? []).map((r) => ({
          username: String(r["USERNAME"]),
          nombre: String(r["NOMBRE"]),
          roles: String(r["ROLES"] ?? "")
            .split(",")
            .filter((x) => x !== ""),
        }));
      } catch (error) {
        throw mapOracleError(error, "SEG_USUARIO");
      }
    });
  }

  // ---------------------------------------------------------------- escrituras

  /**
   * Login correcto: resetea el contador de intentos y el bloqueo, marca
   * FECHA_ULTIMO_LOGIN y deja una fila LOGIN_EXITOSO en la bitacora. Atomico.
   */
  public async registrarExito(
    idUsuario: number,
    ip: string | null,
  ): Promise<void> {
    return oraclePool().withTransaction(async (c) => {
      try {
        await c.execute(
          `UPDATE SEG_USUARIO
           SET INTENTOS_FALLIDOS = 0, FECHA_BLOQUEO = NULL,
               FECHA_ULTIMO_LOGIN = SYSTIMESTAMP
           WHERE ID_USUARIO = :id`,
          { id: idUsuario },
        );
        await this.insertBitacora(c, {
          idUsuario,
          usernameIntento: null,
          evento: "LOGIN_EXITOSO",
          ip,
          detalle: null,
        });
      } catch (error) {
        throw mapOracleError(error, "SEG_USUARIO");
      }
    });
  }

  /**
   * Login fallido. Si `idUsuario` es null (usuario inexistente) solo deja la
   * huella en bitacora. Si existe: incrementa INTENTOS_FALLIDOS, aplica
   * FECHA_BLOQUEO al alcanzar `maxIntentos`, y registra LOGIN_FALLIDO (+
   * BLOQUEO_CUENTA si se acaba de bloquear). Atomico.
   */
  public async registrarFallo(input: {
    readonly idUsuario: number | null;
    readonly username: string;
    readonly ip: string | null;
    readonly maxIntentos: number;
    readonly detalle?: string;
  }): Promise<{ intentos: number; bloqueada: boolean }> {
    return oraclePool().withTransaction(async (c) => {
      try {
        if (input.idUsuario === null) {
          await this.insertBitacora(c, {
            idUsuario: null,
            usernameIntento: input.username,
            evento: "LOGIN_FALLIDO",
            ip: input.ip,
            detalle: input.detalle ?? "usuario inexistente",
          });
          return { intentos: 0, bloqueada: false };
        }

        const upd = await c.execute(
          `UPDATE SEG_USUARIO
           SET INTENTOS_FALLIDOS = NVL(INTENTOS_FALLIDOS, 0) + 1,
               FECHA_BLOQUEO = CASE
                 WHEN NVL(INTENTOS_FALLIDOS, 0) + 1 >= :maxIntentos THEN SYSTIMESTAMP
                 ELSE FECHA_BLOQUEO
               END
           WHERE ID_USUARIO = :id
           RETURNING INTENTOS_FALLIDOS INTO :nuevo`,
          asBinds({
            id: input.idUsuario,
            maxIntentos: input.maxIntentos,
            nuevo: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          }),
        );
        const out = upd.outBinds as { nuevo?: number[] } | undefined;
        const intentos = Number(out?.nuevo?.[0] ?? 0);
        const bloqueada = intentos >= input.maxIntentos;

        await this.insertBitacora(c, {
          idUsuario: input.idUsuario,
          usernameIntento: input.username,
          evento: "LOGIN_FALLIDO",
          ip: input.ip,
          detalle: input.detalle ?? `intento ${intentos}/${input.maxIntentos}`,
        });
        if (bloqueada) {
          await this.insertBitacora(c, {
            idUsuario: input.idUsuario,
            usernameIntento: input.username,
            evento: "BLOQUEO_CUENTA",
            ip: input.ip,
            detalle: `bloqueada tras ${intentos} intentos fallidos`,
          });
        }
        return { intentos, bloqueada };
      } catch (error) {
        throw mapOracleError(error, "SEG_USUARIO");
      }
    });
  }

  /** Deja un evento suelto en la bitacora (LOGOUT, BLOQUEO_CUENTA, etc.). */
  public async registrarEvento(input: {
    readonly idUsuario: number | null;
    readonly username: string | null;
    readonly evento: EventoAcceso;
    readonly ip: string | null;
    readonly detalle?: string | null;
  }): Promise<void> {
    return oraclePool().withTransaction(async (c) => {
      try {
        await this.insertBitacora(c, {
          idUsuario: input.idUsuario,
          usernameIntento: input.username,
          evento: input.evento,
          ip: input.ip,
          detalle: input.detalle ?? null,
        });
      } catch (error) {
        throw mapOracleError(error, "SEG_BITACORA_ACCESO");
      }
    });
  }

  // ------------------------------------------------------------------ internos

  private async insertBitacora(
    conn: Connection,
    b: {
      idUsuario: number | null;
      usernameIntento: string | null;
      evento: EventoAcceso;
      ip: string | null;
      detalle: string | null;
    },
  ): Promise<void> {
    await conn.execute(
      `INSERT INTO SEG_BITACORA_ACCESO
         (ID_USUARIO, USERNAME_INTENTO, TIPO_EVENTO, IP_ORIGEN, DETALLE)
       VALUES (:idUsuario, :usernameIntento, :evento, :ip, :detalle)`,
      {
        idUsuario: b.idUsuario,
        usernameIntento: b.usernameIntento?.slice(0, 50) ?? null,
        evento: b.evento,
        ip: b.ip?.slice(0, 45) ?? null,
        detalle: b.detalle?.slice(0, 300) ?? null,
      },
    );
  }

  private mapAuthUser(row: Row): AuthUserRow {
    const fb = row["FECHA_BLOQUEO"];
    return {
      idUsuario: Number(row["ID_USUARIO"]),
      username: String(row["USERNAME"]),
      idEmpleado: Number(row["ID_EMPLEADO"]),
      nombre: String(row["NOMBRE"]),
      passwordHash: String(row["PASSWORD_HASH"] ?? ""),
      estado: String(row["ESTADO"] ?? "A"),
      intentosFallidos: Number(row["INTENTOS_FALLIDOS"] ?? 0),
      fechaBloqueo: fb instanceof Date ? fb : fb == null ? null : new Date(String(fb)),
    };
  }
}

export const segAuthRepository = SegAuthRepository.getInstance();

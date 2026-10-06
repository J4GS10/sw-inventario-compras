/**
 * Capa 2 - Acceso a Datos / Seguridad.
 * Borradores de trabajo por usuario (SEG_BORRADOR_USUARIO): lo que alguien va capturando en un
 * formulario y aun no registra, para que lo recupere desde cualquier equipo o tras un corte.
 * Datos efimeros del puesto de trabajo: baja FISICA (sin borrado logico).
 * Bind variables siempre; las escrituras van en `withTransaction` (autoCommit = false).
 */

import type { BindParameters } from "oracledb";
import { oraclePool } from "../../OraclePool.js";
import { mapOracleError } from "../../../common/errors/OracleErrorAdapter.js";

export interface BorradorRow {
  readonly clave: string;
  readonly contenido: string;
  /** Marca de tiempo (ms epoch) de la ultima edicion segun el cliente que la envio. */
  readonly actualizadoEn: number;
}

const binds = (m: Record<string, unknown>): BindParameters => m as unknown as BindParameters;

export class BorradorRepository {
  public async listar(idUsuario: number): Promise<readonly BorradorRow[]> {
    try {
      return await oraclePool().withConnection(async (c) => {
        const r = await c.execute<{ CLAVE: string; CONTENIDO: string; ACTUALIZADO_EN: number }>(
          `SELECT CLAVE, CONTENIDO, ACTUALIZADO_EN
             FROM SEG_BORRADOR_USUARIO
            WHERE ID_USUARIO = :u
            ORDER BY ACTUALIZADO_EN DESC
            FETCH FIRST 100 ROWS ONLY`,
          binds({ u: idUsuario }),
        );
        return (r.rows ?? []).map((x) => ({
          clave: x.CLAVE,
          contenido: x.CONTENIDO,
          actualizadoEn: Number(x.ACTUALIZADO_EN),
        }));
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_BORRADOR_USUARIO");
    }
  }

  /** Crea o reemplaza el borrador; solo avanza si el recibido NO es mas viejo que el guardado. */
  public async guardar(idUsuario: number, clave: string, contenido: string, actualizadoEn: number): Promise<void> {
    try {
      await oraclePool().withTransaction(async (c) => {
        const upd = await c.execute(
          `UPDATE SEG_BORRADOR_USUARIO
              SET CONTENIDO = :contenido, ACTUALIZADO_EN = :en, FECHA_ACTUALIZACION = SYSTIMESTAMP
            WHERE ID_USUARIO = :u AND CLAVE = :clave AND ACTUALIZADO_EN <= :en`,
          binds({ contenido, en: actualizadoEn, u: idUsuario, clave }),
        );
        if ((upd.rowsAffected ?? 0) > 0) return;
        const existe = await c.execute(
          `SELECT 1 FROM SEG_BORRADOR_USUARIO WHERE ID_USUARIO = :u AND CLAVE = :clave`,
          binds({ u: idUsuario, clave }),
        );
        if ((existe.rows ?? []).length > 0) return; // lo guardado es mas nuevo: se conserva
        await c.execute(
          `INSERT INTO SEG_BORRADOR_USUARIO (ID_USUARIO, CLAVE, CONTENIDO, ACTUALIZADO_EN)
           VALUES (:u, :clave, :contenido, :en)`,
          binds({ u: idUsuario, clave, contenido, en: actualizadoEn }),
        );
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_BORRADOR_USUARIO");
    }
  }

  public async eliminar(idUsuario: number, clave: string): Promise<void> {
    try {
      await oraclePool().withTransaction(async (c) => {
        await c.execute(
          `DELETE FROM SEG_BORRADOR_USUARIO WHERE ID_USUARIO = :u AND CLAVE = :clave`,
          binds({ u: idUsuario, clave }),
        );
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_BORRADOR_USUARIO");
    }
  }

  public async contar(idUsuario: number): Promise<number> {
    try {
      return await oraclePool().withConnection(async (c) => {
        const r = await c.execute<{ N: number }>(
          `SELECT COUNT(*) AS N FROM SEG_BORRADOR_USUARIO WHERE ID_USUARIO = :u`,
          binds({ u: idUsuario }),
        );
        return Number(r.rows?.[0]?.N ?? 0);
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_BORRADOR_USUARIO");
    }
  }

  /** Borra los borradores sin tocar desde hace mas de `dias` dias (higiene). */
  public async purgarAntiguos(dias: number): Promise<number> {
    try {
      return await oraclePool().withTransaction(async (c) => {
        const r = await c.execute(
          `DELETE FROM SEG_BORRADOR_USUARIO WHERE FECHA_ACTUALIZACION < SYSTIMESTAMP - NUMTODSINTERVAL(:d, 'DAY')`,
          binds({ d: dias }),
        );
        return r.rowsAffected ?? 0;
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_BORRADOR_USUARIO");
    }
  }
}

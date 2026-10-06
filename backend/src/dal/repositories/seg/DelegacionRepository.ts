/**
 * Capa 2 - Acceso a Datos / Seguridad.
 * Delegacion temporal de aprobaciones (SEG_DELEGACION_APROBACION). Bind variables siempre; las
 * escrituras van en `withTransaction` (autoCommit = false). "Vigente" = ACTIVA y hoy entre
 * FECHA_DESDE y FECHA_HASTA (inclusive), con hoy segun la base de datos.
 */

import type { BindParameters } from "oracledb";
import { oraclePool } from "../../OraclePool.js";
import { mapOracleError } from "../../../common/errors/OracleErrorAdapter.js";

type Row = Record<string, unknown>;
const binds = (m: Record<string, unknown>): BindParameters => m as unknown as BindParameters;

export interface DelegacionRow {
  readonly idDelegacion: number;
  readonly idEmpleadoDelegante: number;
  readonly nombreDelegante: string;
  readonly idEmpleadoDelegado: number;
  readonly nombreDelegado: string;
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: string | null;
  readonly estado: "ACTIVA" | "REVOCADA";
  /** ACTIVA y dentro del rango hoy. */
  readonly vigente: boolean;
}

/** Delegacion vigente con la cuenta del delegante (para resolver sus roles y permisos). */
export interface DelegacionVigente {
  readonly idDelegacion: number;
  readonly idEmpleadoDelegante: number;
  readonly idUsuarioDelegante: number;
  readonly nombreDelegante: string;
}

const SELECT_BASE = `
  SELECT d.ID_DELEGACION, d.ID_EMPLEADO_DELEGANTE, d.ID_EMPLEADO_DELEGADO, d.MOTIVO, d.ESTADO,
         TO_CHAR(d.FECHA_DESDE, 'YYYY-MM-DD') AS DESDE, TO_CHAR(d.FECHA_HASTA, 'YYYY-MM-DD') AS HASTA,
         a.NOMBRES || ' ' || a.APELLIDOS AS NOMBRE_DELEGANTE,
         b.NOMBRES || ' ' || b.APELLIDOS AS NOMBRE_DELEGADO,
         CASE WHEN d.ESTADO = 'ACTIVA' AND TRUNC(SYSDATE) BETWEEN d.FECHA_DESDE AND d.FECHA_HASTA THEN 1 ELSE 0 END AS VIGENTE
    FROM SEG_DELEGACION_APROBACION d
    JOIN NOM_EMPLEADO a ON a.ID_EMPLEADO = d.ID_EMPLEADO_DELEGANTE
    JOIN NOM_EMPLEADO b ON b.ID_EMPLEADO = d.ID_EMPLEADO_DELEGADO`;

function mapFila(r: Row): DelegacionRow {
  return {
    idDelegacion: Number(r["ID_DELEGACION"]),
    idEmpleadoDelegante: Number(r["ID_EMPLEADO_DELEGANTE"]),
    nombreDelegante: String(r["NOMBRE_DELEGANTE"]),
    idEmpleadoDelegado: Number(r["ID_EMPLEADO_DELEGADO"]),
    nombreDelegado: String(r["NOMBRE_DELEGADO"]),
    desde: String(r["DESDE"]),
    hasta: String(r["HASTA"]),
    motivo: r["MOTIVO"] === null || r["MOTIVO"] === undefined ? null : String(r["MOTIVO"]),
    estado: String(r["ESTADO"]) === "REVOCADA" ? "REVOCADA" : "ACTIVA",
    vigente: Number(r["VIGENTE"]) === 1,
  };
}

export class DelegacionRepository {
  /** Las que el empleado otorgo o recibio y que aun cuentan (activas con fin hoy o futuro). */
  public async listarDe(idEmpleado: number): Promise<readonly DelegacionRow[]> {
    try {
      return await oraclePool().withConnection(async (c) => {
        const r = await c.execute<Row>(
          `${SELECT_BASE}
            WHERE (d.ID_EMPLEADO_DELEGANTE = :e OR d.ID_EMPLEADO_DELEGADO = :e)
              AND d.ESTADO = 'ACTIVA' AND d.FECHA_HASTA >= TRUNC(SYSDATE)
            ORDER BY d.FECHA_DESDE DESC, d.ID_DELEGACION DESC`,
          binds({ e: idEmpleado }),
        );
        return (r.rows ?? []).map(mapFila);
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_DELEGACION_APROBACION");
    }
  }

  public async obtener(idDelegacion: number): Promise<DelegacionRow | null> {
    try {
      return await oraclePool().withConnection(async (c) => {
        const r = await c.execute<Row>(`${SELECT_BASE} WHERE d.ID_DELEGACION = :id`, binds({ id: idDelegacion }));
        const fila = r.rows?.[0];
        return fila === undefined ? null : mapFila(fila);
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_DELEGACION_APROBACION");
    }
  }

  /** Delegaciones vigentes HOY a favor de un empleado, con la cuenta de cada delegante. */
  public async vigentesPara(idEmpleadoDelegado: number): Promise<readonly DelegacionVigente[]> {
    try {
      return await oraclePool().withConnection(async (c) => {
        const r = await c.execute<Row>(
          `SELECT d.ID_DELEGACION, d.ID_EMPLEADO_DELEGANTE, u.ID_USUARIO,
                  a.NOMBRES || ' ' || a.APELLIDOS AS NOMBRE_DELEGANTE
             FROM SEG_DELEGACION_APROBACION d
             JOIN SEG_USUARIO u ON u.ID_EMPLEADO = d.ID_EMPLEADO_DELEGANTE AND u.ELIMINADO = 'N' AND NVL(u.ESTADO, 'A') = 'A'
             JOIN NOM_EMPLEADO a ON a.ID_EMPLEADO = d.ID_EMPLEADO_DELEGANTE
            WHERE d.ID_EMPLEADO_DELEGADO = :e AND d.ESTADO = 'ACTIVA'
              AND TRUNC(SYSDATE) BETWEEN d.FECHA_DESDE AND d.FECHA_HASTA`,
          binds({ e: idEmpleadoDelegado }),
        );
        return (r.rows ?? []).map((x) => ({
          idDelegacion: Number(x["ID_DELEGACION"]),
          idEmpleadoDelegante: Number(x["ID_EMPLEADO_DELEGANTE"]),
          idUsuarioDelegante: Number(x["ID_USUARIO"]),
          nombreDelegante: String(x["NOMBRE_DELEGANTE"]),
        }));
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_DELEGACION_APROBACION");
    }
  }

  /** true si ya hay una delegacion ACTIVA del mismo par que se traslapa con el rango. */
  public async haySolape(delegante: number, delegado: number, desde: string, hasta: string): Promise<boolean> {
    try {
      return await oraclePool().withConnection(async (c) => {
        const r = await c.execute<Row>(
          `SELECT COUNT(*) AS N FROM SEG_DELEGACION_APROBACION
            WHERE ID_EMPLEADO_DELEGANTE = :a AND ID_EMPLEADO_DELEGADO = :b AND ESTADO = 'ACTIVA'
              AND FECHA_DESDE <= TO_DATE(:hasta, 'YYYY-MM-DD') AND FECHA_HASTA >= TO_DATE(:desde, 'YYYY-MM-DD')`,
          binds({ a: delegante, b: delegado, desde, hasta }),
        );
        return Number(r.rows?.[0]?.["N"] ?? 0) > 0;
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_DELEGACION_APROBACION");
    }
  }

  public async crear(input: {
    delegante: number;
    delegado: number;
    desde: string;
    hasta: string;
    motivo: string | null;
  }): Promise<number> {
    try {
      return await oraclePool().withTransaction(async (c) => {
        const oracledb = (await import("oracledb")).default;
        const r = await c.execute(
          `INSERT INTO SEG_DELEGACION_APROBACION (ID_EMPLEADO_DELEGANTE, ID_EMPLEADO_DELEGADO, FECHA_DESDE, FECHA_HASTA, MOTIVO)
           VALUES (:a, :b, TO_DATE(:desde, 'YYYY-MM-DD'), TO_DATE(:hasta, 'YYYY-MM-DD'), :motivo)
           RETURNING ID_DELEGACION INTO :id`,
          binds({
            a: input.delegante,
            b: input.delegado,
            desde: input.desde,
            hasta: input.hasta,
            motivo: input.motivo,
            id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          }),
        );
        return Number((r.outBinds as { id: number[] }).id[0]);
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_DELEGACION_APROBACION");
    }
  }

  public async revocar(idDelegacion: number): Promise<void> {
    try {
      await oraclePool().withTransaction(async (c) => {
        await c.execute(
          `UPDATE SEG_DELEGACION_APROBACION SET ESTADO = 'REVOCADA' WHERE ID_DELEGACION = :id`,
          binds({ id: idDelegacion }),
        );
      });
    } catch (e) {
      throw mapOracleError(e, "SEG_DELEGACION_APROBACION");
    }
  }
}

export const delegacionRepository = new DelegacionRepository();

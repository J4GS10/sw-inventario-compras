/**
 * Capa 3 - Logica de Negocio / Seguridad.
 * Borradores de trabajo por usuario: cada quien solo ve y toca los SUYOS (el id sale de la sesion,
 * nunca del cliente). Valida forma y tamano; el contenido es JSON opaco.
 */

import { ValidationError } from "../../../common/errors/AppError.js";
import { BorradorRepository, type BorradorRow } from "../../../dal/repositories/seg/BorradorRepository.js";

const CLAVE_VALIDA = /^[A-Za-z0-9._:/-]{1,200}$/;
const MAX_BYTES = 200_000;
const MAX_BORRADORES = 100;
export const DIAS_VIGENCIA = 14;

export class BorradorService {
  constructor(private readonly repo = new BorradorRepository()) {}

  public listar(idUsuario: number): Promise<readonly BorradorRow[]> {
    return this.repo.listar(idUsuario);
  }

  public async guardar(
    idUsuario: number,
    input: { clave: unknown; contenido: unknown; actualizadoEn: unknown },
  ): Promise<void> {
    const clave = typeof input.clave === "string" ? input.clave : "";
    if (!CLAVE_VALIDA.test(clave)) throw new ValidationError("Clave de borrador inválida");
    const contenido = typeof input.contenido === "string" ? input.contenido : "";
    if (contenido === "" || Buffer.byteLength(contenido, "utf8") > MAX_BYTES) {
      throw new ValidationError("El borrador está vacío o es demasiado grande");
    }
    try {
      JSON.parse(contenido);
    } catch {
      throw new ValidationError("El borrador debe ser JSON válido");
    }
    const ms = Number(input.actualizadoEn);
    const en = Number.isFinite(ms) && ms > 0 && ms <= Date.now() + 5 * 60_000 ? Math.floor(ms) : Date.now();
    if ((await this.repo.contar(idUsuario)) >= MAX_BORRADORES) {
      const actuales = await this.repo.listar(idUsuario);
      if (!actuales.some((b) => b.clave === clave)) {
        throw new ValidationError("Demasiados borradores guardados; descarta alguno");
      }
    }
    await this.repo.guardar(idUsuario, clave, contenido, en);
  }

  public async eliminar(idUsuario: number, clave: unknown): Promise<void> {
    if (typeof clave !== "string" || !CLAVE_VALIDA.test(clave)) throw new ValidationError("Clave de borrador inválida");
    await this.repo.eliminar(idUsuario, clave);
  }

  /** Higiene: borra lo no tocado en `DIAS_VIGENCIA` dias. */
  public purgar(): Promise<number> {
    return this.repo.purgarAntiguos(DIAS_VIGENCIA);
  }
}

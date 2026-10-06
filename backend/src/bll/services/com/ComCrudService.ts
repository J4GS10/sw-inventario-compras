/**
 * Capa 3 - Logica de Negocio / compras.
 * Servicio CRUD de los catalogos/operativos del modulo COM_ con REGLAS DE
 * NEGOCIO por entidad (Template Method: se enchufan en `beforeCreate` /
 * `beforeUpdate` de `BaseCrudService`).
 *
 * El descriptor ya valida tipo, obligatoriedad, longitud y rango del DDL; aqui
 * viven las reglas que cruzan campos o consultan la base: un acuerdo no puede
 * terminar antes de empezar, ni solaparse con otro del mismo proveedor y
 * articulo; una excepcion no se resuelve antes de reportarse; etc.
 */

import type { AuditContext } from "../../../common/types/AuditContext.js";
import { BusinessRuleError } from "../../../common/errors/AppError.js";
import { normalizePageQuery } from "../../../common/types/Query.js";
import { Validacion } from "../../../common/validation/reglas.js";
import { aDia, formatoDia, hoy } from "../../../common/util/fechas.js";
import type { ComEntityKey } from "../../../entities/com/descriptors.js";
import { BaseCrudService } from "../BaseCrudService.js";
import type { CrudServiceOptions } from "../BaseCrudService.js";
import type { IRepository } from "../../../dal/contracts/IRepository.js";

type Datos = Record<string, unknown>;

/** Regla pura sobre el registro RESULTANTE (existente + cambios). */
type ReglaCampos = (v: Validacion, d: Datos) => void;

const vacio = (x: unknown): boolean => x === undefined || x === null || x === "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO_RE = /^[0-9+()\-.\s]{6,20}$/;
const CODIGO_MONEDA_RE = /^[A-Z]{3}$/;

/** Reglas de campos por entidad. Solo se evalua lo que el registro resultante trae. */
const REGLAS: Partial<Record<ComEntityKey, ReglaCampos>> = {
  proveedor: (v, d) => {
    if (!vacio(d["email"]) && !EMAIL_RE.test(String(d["email"]).trim())) {
      v.error("email", "El correo electrónico no tiene un formato válido (ej. ventas@empresa.com)");
    }
    if (!vacio(d["telefono"]) && !TELEFONO_RE.test(String(d["telefono"]).trim())) {
      v.error("telefono", "El teléfono solo admite números, espacios y + ( ) - . (6 a 20 caracteres)");
    }
    if (!vacio(d["diasCredito"])) {
      const n = v.numero("diasCredito", "Los días de crédito", d["diasCredito"]);
      if (n !== null && (!Number.isInteger(n) || n < 0 || n > 365)) {
        v.error("diasCredito", "Los días de crédito deben ser un entero entre 0 y 365");
      }
    }
  },

  moneda: (v, d) => {
    if (!vacio(d["codigo"]) && !CODIGO_MONEDA_RE.test(String(d["codigo"]).trim())) {
      v.error("codigo", "El código de moneda son 3 letras mayúsculas (ISO 4217, ej. GTQ)");
    }
  },

  condicionPago: (v, d) => {
    if (vacio(d["dias"])) return;
    const n = v.numero("dias", "Los días de plazo", d["dias"]);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 365)) {
      v.error("dias", "Los días de plazo deben ser un entero entre 0 y 365");
    }
  },

  terminoEntrega: (v, d) => {
    if (vacio(d["diasEstimados"])) return;
    const n = v.numero("diasEstimados", "Los días estimados", d["diasEstimados"]);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 365)) {
      v.error("diasEstimados", "Los días estimados deben ser un entero entre 0 y 365");
    }
  },

  acuerdoProveedor: (v, d) => {
    const inicio = v.dia("fechaInicio", "La fecha de inicio", d["fechaInicio"]);
    const fin = v.dia("fechaFin", "La fecha de fin", d["fechaFin"]);
    v.noAnteriorA("fechaFin", "La fecha de fin", fin, inicio, "la fecha de inicio");
    if (!vacio(d["precioFijo"])) v.positivo("precioFijo", "El precio fijo", d["precioFijo"]);
  },

  acuerdoDetalle: (v, d) => {
    v.positivo("cantidadMinima", "La cantidad mínima", d["cantidadMinima"]);
    v.porcentaje("porcentajeDescuento", "El descuento", d["porcentajeDescuento"]);
  },

  articuloProveedor: (v, d) => {
    if (!vacio(d["precioUltimaCompra"])) {
      v.positivo("precioUltimaCompra", "El precio de la última compra", d["precioUltimaCompra"]);
    }
    if (!vacio(d["fechaUltimaCompra"])) {
      const dia = v.dia("fechaUltimaCompra", "La fecha de la última compra", d["fechaUltimaCompra"]);
      v.noPosteriorA("fechaUltimaCompra", "La fecha de la última compra", dia, hoy(), "hoy (no puede estar en el futuro)");
    }
  },

  excepcionOrden: (v, d) => {
    if (!vacio(d["fechaResolucion"])) {
      const resol = v.dia("fechaResolucion", "La fecha de resolución", d["fechaResolucion"]);
      v.noAnteriorA("fechaResolucion", "La fecha de resolución", resol, aDia(d["fechaReporte"]), "la fecha en que se reportó la excepción");
      v.noPosteriorA("fechaResolucion", "La fecha de resolución", resol, hoy(), "hoy (no puede estar en el futuro)");
    }
  },
};

export class ComCrudService<TEntity> extends BaseCrudService<TEntity> {
  constructor(
    repo: IRepository<TEntity, object, object>,
    options: CrudServiceOptions,
    private readonly clave: ComEntityKey,
  ) {
    super(repo, options);
  }

  protected override async beforeCreate(dto: Datos, _ctx: AuditContext): Promise<void> {
    await this.aplicarReglas(null, dto);
  }

  protected override async beforeUpdate(id: number, dto: Datos, _ctx: AuditContext): Promise<void> {
    const actual = (await this.repo.findById(id)) as Datos | null;
    await this.aplicarReglas(actual, dto, id);
  }

  private async aplicarReglas(actual: Datos | null, dto: Datos, id?: number): Promise<void> {
    const regla = REGLAS[this.clave];
    if (regla !== undefined) {
      const v = new Validacion();
      // Se evalua el registro RESULTANTE: una edicion parcial (solo la fecha de
      // fin) se compara contra la fecha de inicio que ya estaba guardada.
      regla(v, { ...(actual ?? {}), ...dto });
      v.lanzarSiHay("Datos inválidos");
    }
    if (this.clave === "excepcionOrden") this.sellarResolucion({ ...(actual ?? {}), ...dto }, dto);
    if (this.clave === "acuerdoProveedor") {
      await this.assertSinSolape({ ...(actual ?? {}), ...dto }, id);
    }
  }

  /**
   * La fecha de resolucion la pone el sistema: marcar una excepcion como
   * resuelta la estampa con el momento actual; reabrirla la limpia. Asi nunca
   * queda "resuelta" sin fecha ni "pendiente" con fecha.
   */
  private sellarResolucion(resultado: Datos, dto: Datos): void {
    if (!("resuelta" in dto)) return;
    if (resultado["resuelta"] === true) {
      if (vacio(resultado["fechaResolucion"])) dto["fechaResolucion"] = new Date().toISOString();
    } else {
      dto["fechaResolucion"] = null;
    }
  }

  /** Dos acuerdos activos del mismo proveedor y articulo no pueden vigir a la vez. */
  private async assertSinSolape(d: Datos, idActual?: number): Promise<void> {
    if (d["activo"] === false) return;
    const inicio = aDia(d["fechaInicio"]);
    const fin = aDia(d["fechaFin"]);
    if (inicio === null || fin === null) return;
    const otros = await this.repo.findAll(
      normalizePageQuery({
        page: 1,
        pageSize: 200,
        filters: [
          { prop: "idProveedor", operator: "eq", value: Number(d["idProveedor"]) },
          { prop: "idArticulo", operator: "eq", value: Number(d["idArticulo"]) },
        ],
      }),
    );
    for (const o of otros.data as readonly Datos[]) {
      if (idActual !== undefined && Number(o["idAcuerdo"]) === idActual) continue;
      if (o["activo"] === false) continue;
      const oi = aDia(o["fechaInicio"]);
      const of = aDia(o["fechaFin"]);
      if (oi === null || of === null) continue;
      if (inicio <= of && fin >= oi) {
        throw new BusinessRuleError(
          `Se solapa con el acuerdo ${String(o["idAcuerdo"])} de este proveedor y artículo ` +
            `(${formatoDia(oi)} al ${formatoDia(of)}). Ajuste las fechas o desactive el otro acuerdo.`,
        );
      }
    }
  }
}

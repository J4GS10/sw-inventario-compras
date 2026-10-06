/**
 * Capa 3 - Logica de Negocio / compras (Cuentas por Pagar).
 *
 * Caso de uso: liquidar (pagar) la factura de proveedor que una Recepcion ya
 * dejo en borrador (`cxpSubscriber`). El flujo es: 1) confirmar los datos
 * reales de la factura FEL (numero/serie/montos — el borrador los estimo del
 * precio de la OC), 2) verificar el 3-way match (Solicitud -> OC ->
 * Recepcion) con `ReconciliacionService`, 3) registrar el medio de pago
 * (cheque o transferencia) como `CXP_CONTRASENA_PAGO` + `CXP_CHEQUE`.
 *
 * `CXP_CHEQUE` es el unico lugar del esquema con "banco + numero de
 * referencia"; se usa igual para CHEQUE y TRANSFERENCIA (no hay una tabla de
 * referencia ACH aparte en el DDL canonico).
 */

import { NotFoundError, BusinessRuleError, ValidationError } from "../../../common/errors/AppError.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import { TransactionalService, type TransactionScope } from "../../support/TransactionalService.js";
import {
  chequeRepository,
  contrasenaPagoRepository,
  facturaProveedorRepository,
} from "../../../dal/repositories/shared/index.js";
import {
  CompraReadRepository,
  type BucketPagoRow,
  type FacturaPendienteLiquidacionRow,
} from "../../../dal/repositories/com/CompraReadRepository.js";
import { ReconciliacionService, type TresWayMatchReport } from "./ReconciliacionService.js";
import { Validacion } from "../../../common/validation/reglas.js";
import { aDia, hoy, sumarDias } from "../../../common/util/fechas.js";
import { recepcionRepository, ordenCompraRepository } from "../../../dal/repositories/com/index.js";

/** Un pago puede programarse (cheque posfechado / transferencia agendada) hasta 90 dias adelante. */
export const DIAS_MAX_PAGO_FUTURO = 90;

export type FormaPago = "CHEQUE" | "TRANSFERENCIA";

export interface BucketPagoProyectado {
  readonly id: BucketPagoRow["bucket"];
  readonly etiqueta: string;
  readonly monto: number;
  readonly facturas: number;
}
export interface ProyeccionPagosResumen {
  readonly buckets: readonly BucketPagoProyectado[];
  readonly totalPendiente: number;
  readonly montoVencido: number;
  readonly generadoEn: string;
}

/** Orden fijo de la "escalera" de vencimientos + etiqueta legible. */
const ORDEN_BUCKETS: readonly { id: BucketPagoRow["bucket"]; etiqueta: string }[] = [
  { id: "VENCIDA", etiqueta: "Vencidas" },
  { id: "SEM1", etiqueta: "Esta semana" },
  { id: "SEM2", etiqueta: "Semana 2" },
  { id: "SEM3", etiqueta: "Semana 3" },
  { id: "SEM4", etiqueta: "Semana 4" },
  { id: "DESPUES", etiqueta: "Después de 4 semanas" },
  { id: "SIN_FECHA", etiqueta: "Sin fecha de vencimiento" },
];

export interface LiquidarInput {
  readonly numeroDte: string;
  readonly serieDte: string;
  readonly fechaEmision: string;
  readonly fechaDocumento: string;
  readonly montoTotal: number;
  readonly formaPago: FormaPago;
  readonly banco: string;
  readonly numeroReferencia: string;
  readonly fechaPago: string;
}

interface FacturaRow {
  readonly idFacturaProveedor: number;
  readonly idRecepcion: number | null;
  readonly estado: string | null;
}

/**
 * Coherencia cronologica de la liquidacion (funcion pura, probada sin BD):
 *   emision de la OC <= fecha del documento <= hoy
 *   emision de la OC <= fecha de emision del DTE <= hoy
 *   fecha del documento <= fecha de pago <= hoy + 90 dias
 * Una factura no puede ser anterior a la orden que la origina, ni estar fechada
 * en el futuro; y no se paga antes de que exista la factura.
 */
export function validarFechasLiquidacion(
  v: Validacion,
  f: { fechaEmision: unknown; fechaDocumento: unknown; fechaPago: unknown },
  diaOrden: string | null,
  ahora?: Date,
): void {
  const tope = hoy(ahora);
  const emision = v.dia("fechaEmision", "La fecha de emisión", f.fechaEmision);
  const documento = v.dia("fechaDocumento", "La fecha del documento", f.fechaDocumento);
  const pago = v.dia("fechaPago", "La fecha de pago", f.fechaPago);
  v.noAnteriorA("fechaDocumento", "La fecha del documento", documento, diaOrden, "la fecha de la orden de compra");
  v.noAnteriorA("fechaEmision", "La fecha de emisión", emision, diaOrden, "la fecha de la orden de compra");
  v.noPosteriorA("fechaDocumento", "La fecha del documento", documento, tope, "hoy");
  v.noPosteriorA("fechaEmision", "La fecha de emisión", emision, tope, "hoy");
  v.noAnteriorA("fechaPago", "La fecha de pago", pago, documento, "la fecha del documento");
  v.noPosteriorA("fechaPago", "La fecha de pago", pago, sumarDias(tope, DIAS_MAX_PAGO_FUTURO), `hoy + ${DIAS_MAX_PAGO_FUTURO} días`);
}

export class LiquidacionService extends TransactionalService {
  private readonly read = new CompraReadRepository();

  private readonly reconciliacion = new ReconciliacionService();

  public async pendientes(): Promise<readonly FacturaPendienteLiquidacionRow[]> {
    return this.read.facturasPendientesLiquidacion();
  }

  /**
   * Proyeccion de flujo de pagos: cuanto hay que pagar y cuando, agrupado en
   * la "escalera" de vencimiento (vencidas, semana 1-4, despues). Predictivo
   * en el sentido util para Finanzas — no es una suposicion, es la suma
   * exacta de lo que YA se debe, organizada por cuando se vuelve exigible.
   */
  public async proyeccionPagos(): Promise<ProyeccionPagosResumen> {
    const filas = await this.read.proyeccionPagos();
    const porBucket = new Map(filas.map((f) => [f.bucket, f]));
    const buckets: BucketPagoProyectado[] = ORDEN_BUCKETS.map(({ id, etiqueta }) => {
      const f = porBucket.get(id);
      return { id, etiqueta, monto: f?.monto ?? 0, facturas: f?.facturas ?? 0 };
    });
    return {
      buckets,
      totalPendiente: Number(filas.reduce((a, f) => a + f.monto, 0).toFixed(2)),
      montoVencido: porBucket.get("VENCIDA")?.monto ?? 0,
      generadoEn: new Date().toISOString(),
    };
  }

  public async detalle(idFacturaProveedor: number): Promise<{
    readonly factura: Record<string, unknown>;
    readonly tresWayMatch: TresWayMatchReport;
  }> {
    const factura = await facturaProveedorRepository().findById(idFacturaProveedor);
    if (factura === null) throw new NotFoundError("CXP_FACTURA_PROVEEDOR", idFacturaProveedor);
    const tresWayMatch = await this.reconciliacion.tresWayMatch(idFacturaProveedor);
    return { factura: factura as Record<string, unknown>, tresWayMatch };
  }

  /**
   * Liquidacion completa (no parcial): confirma los datos reales del FEL,
   * registra el pago y deja la factura en PAGADA / saldo 0.
   */
  public async liquidar(
    idFacturaProveedor: number,
    input: LiquidarInput,
    ctx: AuditContext,
  ): Promise<{ readonly idFacturaProveedor: number; readonly idContrasena: number }> {
    const v = new Validacion();
    v.texto("numeroDte", "El número de DTE", input.numeroDte, { max: 50 });
    v.texto("serieDte", "La serie de DTE", input.serieDte, { max: 50 });
    v.texto("banco", "El banco", input.banco, { max: 50 });
    v.texto("numeroReferencia", "El número de referencia de pago", input.numeroReferencia, { max: 20 });
    const monto = v.positivo("montoTotal", "El monto total", input.montoTotal);
    if (monto !== null && (monto >= 1e12 || Math.abs(Math.round(monto * 100) / 100 - monto) > 1e-9)) {
      v.error("montoTotal", "El monto total admite máximo 2 decimales y menos de 1,000,000,000,000");
    }
    if (input.formaPago !== "CHEQUE" && input.formaPago !== "TRANSFERENCIA") {
      v.error("formaPago", "La forma de pago debe ser CHEQUE o TRANSFERENCIA");
    }
    v.lanzarSiHay("Liquidación inválida");

    return this.runInTransaction(async (scope: TransactionScope) => {
      const { conn } = scope;
      const facturas = facturaProveedorRepository();
      // Serializa: dos liquidaciones simultaneas de la misma factura no pagan dos veces.
      await facturas.lockById(idFacturaProveedor, conn);
      const factura = (await facturas.findById(idFacturaProveedor, conn)) as FacturaRow | null;
      if (factura === null) throw new NotFoundError("CXP_FACTURA_PROVEEDOR", idFacturaProveedor);
      if (factura.estado === "PAGADA") {
        throw new BusinessRuleError("Esta factura ya está liquidada.");
      }
      if (factura.estado === "ANULADA") {
        throw new BusinessRuleError("Esta factura está anulada; no se puede liquidar.");
      }

      // Fecha de la OC de origen (factura -> recepcion -> orden): piso de las fechas del documento.
      let diaOrden: string | null = null;
      if (factura.idRecepcion !== null) {
        const rec = (await recepcionRepository().findById(factura.idRecepcion, conn)) as
          | { idOrdenCompra: number }
          | null;
        if (rec !== null) {
          const oc = (await ordenCompraRepository().findById(rec.idOrdenCompra, conn)) as
            | { fechaEmision?: unknown }
            | null;
          diaOrden = aDia(oc?.fechaEmision);
        }
      }
      const fechas = new Validacion();
      validarFechasLiquidacion(fechas, input, diaOrden);
      fechas.lanzarSiHay("Fechas inválidas");

      await facturas.update(
        idFacturaProveedor,
        {
          numeroDte: input.numeroDte,
          serieDte: input.serieDte,
          fechaEmision: input.fechaEmision,
          fechaDocumento: input.fechaDocumento,
          montoTotal: input.montoTotal,
          saldoPendiente: 0,
          estado: "PAGADA",
        },
        null,
        ctx,
        conn,
      );

      const contrasena = (await contrasenaPagoRepository().create(
        {
          idFacturaProveedor,
          fecha: input.fechaPago,
          monto: input.montoTotal,
          formaPago: input.formaPago,
          estado: "PAGADA",
          idEmpleadoAutoriza: ctx.empleadoId ?? null,
        },
        ctx,
        conn,
      )) as { idContrasena: number };

      await chequeRepository().create(
        {
          idContrasenaPago: contrasena.idContrasena,
          banco: input.banco,
          numeroCheque: input.numeroReferencia,
          fechaEmision: input.fechaPago,
          estado: "EMITIDO",
        },
        ctx,
        conn,
      );

      this.log.info("Factura de proveedor liquidada", {
        idFacturaProveedor,
        idContrasena: contrasena.idContrasena,
        formaPago: input.formaPago,
      });

      return { idFacturaProveedor, idContrasena: contrasena.idContrasena };
    });
  }
}

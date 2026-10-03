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
  { id: "DESPUES", etiqueta: "Despues de 4 semanas" },
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
  readonly estado: string | null;
}

function req(value: string | undefined, campo: string): string {
  if (value === undefined || value.trim() === "") {
    throw new ValidationError(`${campo} es obligatorio`);
  }
  return value;
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
    req(input.numeroDte, "Numero de DTE");
    req(input.serieDte, "Serie de DTE");
    req(input.fechaEmision, "Fecha de emision");
    req(input.fechaDocumento, "Fecha del documento");
    req(input.fechaPago, "Fecha de pago");
    req(input.banco, "Banco");
    req(input.numeroReferencia, "Numero de referencia de pago");
    if (!Number.isFinite(input.montoTotal) || input.montoTotal <= 0) {
      throw new ValidationError("Monto total debe ser mayor a 0");
    }
    if (input.formaPago !== "CHEQUE" && input.formaPago !== "TRANSFERENCIA") {
      throw new ValidationError("Forma de pago debe ser CHEQUE o TRANSFERENCIA");
    }

    return this.runInTransaction(async (scope: TransactionScope) => {
      const { conn } = scope;
      const facturas = facturaProveedorRepository();
      const factura = (await facturas.findById(idFacturaProveedor, conn)) as FacturaRow | null;
      if (factura === null) throw new NotFoundError("CXP_FACTURA_PROVEEDOR", idFacturaProveedor);
      if (factura.estado === "PAGADA") {
        throw new BusinessRuleError("Esta factura ya esta liquidada.");
      }
      if (factura.estado === "ANULADA") {
        throw new BusinessRuleError("Esta factura esta anulada; no se puede liquidar.");
      }

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

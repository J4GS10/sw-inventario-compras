/**
 * Capa 3 - Logica de Negocio / compras.
 * Bandeja de pendientes por rol: "que necesita TU accion ahora mismo".
 * Se deriva del estado del flujo (no hay tabla de notificaciones), acotada por
 * departamento/equipo cuando el rol lo exige.
 *
 *   JEFE_INMEDIATO   -> solicitudes PENDIENTE_JEFE de su equipo
 *   GERENTE_AREA     -> solicitudes PENDIENTE_GERENTE de su area
 *   COMPRADOR        -> solicitudes EN_COTIZACION sin RFQ (listas para cotizar)
 *   GERENTE_FINANCIERO -> comparativos listos para adjudicar
 *   BODEGA           -> ordenes ENVIADA / EN_TRANSITO por recibir
 */

import type { AuditContext } from "../../../common/types/AuditContext.js";
import { hasPermiso, Permisos } from "../../../common/auth/permissions.js";
import { CompraReadRepository } from "../../../dal/repositories/com/CompraReadRepository.js";
import { empleadosEnAlcance } from "./alcance.js";

export type NotiTipo =
  | "APROBAR_JEFE"
  | "APROBAR_GERENTE"
  | "COTIZAR"
  | "ORDEN_PENDIENTE"
  | "ADJUDICAR"
  | "RECIBIR"
  | "ESCASEZ";

export interface Notificacion {
  readonly tipo: NotiTipo;
  readonly titulo: string;
  readonly detalle: string;
  readonly cantidad: number;
  /** Pantalla del frontend a la que lleva. */
  readonly leafId: string;
  /** Ids de referencia (para navegacion directa; preview corto). */
  readonly refs: readonly number[];
}

export interface BandejaPendientes {
  readonly total: number;
  readonly items: readonly Notificacion[];
}

/** Centinela: el usuario no tiene cola personal de aprobacion (no notificar). */
const NADA = Symbol("sin-cola-de-aprobacion");

export class NotificacionService {
  private static instance: NotificacionService | undefined;

  private readonly read = new CompraReadRepository();

  /**
   * Empleados cuyas solicitudes puede aprobar el usuario:
   *  - `null`  -> todas (ADMIN_COMPRAS, vista supervisora)
   *  - number[] -> su equipo / departamento
   *  - `NADA`  -> no tiene cola propia (sin empleado ligado y no es admin)
   */
  private async alcanceAprobacion(
    ctx: AuditContext,
  ): Promise<readonly number[] | null | typeof NADA> {
    if (hasPermiso(ctx.permisos, "*")) return null;
    const a = await empleadosEnAlcance(ctx, this.read);
    if (a === null && (ctx.empleadoId === undefined || ctx.empleadoId <= 0)) {
      return NADA;
    }
    return a;
  }

  public static getInstance(): NotificacionService {
    if (NotificacionService.instance === undefined) {
      NotificacionService.instance = new NotificacionService();
    }
    return NotificacionService.instance;
  }

  public async pendientes(ctx: AuditContext): Promise<BandejaPendientes> {
    const todo = hasPermiso(ctx.permisos, "*");
    const items: Notificacion[] = [];

    // --- Aprobaciones: SOLO si el usuario puede aprobar ese nivel Y la
    //     solicitud cae en su equipo/area (nunca notificar lo que no le toca). ---
    if (todo || hasPermiso(ctx.permisos, Permisos.SOLICITUD_APROBAR_JEFE)) {
      const alcance = await this.alcanceAprobacion(ctx);
      if (alcance !== NADA) {
        const pend = await this.read.solicitudesEnEstado("PENDIENTE_JEFE", alcance);
        if (pend.length > 0) {
          items.push({
            tipo: "APROBAR_JEFE",
            titulo: "Solicitudes por aprobar (jefe)",
            detalle: "Esperan tu autorizacion de primer nivel.",
            cantidad: pend.length,
            leafId: "com-doc-solicitudes",
            refs: pend.map((p) => p.idSolicitud),
          });
        }
      }
    }
    if (todo || hasPermiso(ctx.permisos, Permisos.SOLICITUD_APROBAR_GERENTE)) {
      const alcance = await this.alcanceAprobacion(ctx);
      if (alcance !== NADA) {
        const pend = await this.read.solicitudesEnEstado("PENDIENTE_GERENTE", alcance);
        if (pend.length > 0) {
          items.push({
            tipo: "APROBAR_GERENTE",
            titulo: "Solicitudes por aprobar (gerente)",
            detalle: "Aprobadas por el jefe; esperan tu autorizacion de area.",
            cantidad: pend.length,
            leafId: "com-doc-solicitudes",
            refs: pend.map((p) => p.idSolicitud),
          });
        }
      }
    }

    // --- Compras: solicitudes listas para cotizar ---
    if (todo || hasPermiso(ctx.permisos, Permisos.RFQ_GESTIONAR)) {
      const sinRfq = await this.read.solicitudesSinRfq();
      if (sinRfq.length > 0) {
        items.push({
          tipo: "COTIZAR",
          titulo: "Solicitudes listas para cotizar",
          detalle: "Aprobadas por gerencia; falta crear el RFQ e invitar proveedores.",
          cantidad: sinRfq.length,
          leafId: "com-doc-rfq",
          refs: sinRfq.map((p) => p.idSolicitud),
        });
      }
    }

    // --- Compras: ya adjudicadas, falta generar la Orden de Compra ---
    if (todo || hasPermiso(ctx.permisos, Permisos.RFQ_GESTIONAR)) {
      const porOrdenar = await this.read.solicitudesAdjudicadasSinOrden();
      if (porOrdenar.length > 0) {
        items.push({
          tipo: "ORDEN_PENDIENTE",
          titulo: "Listas para generar la Orden de Compra",
          detalle: "El financiero ya adjudico la mejor oferta.",
          cantidad: porOrdenar.length,
          leafId: "com-an-comparativo",
          refs: porOrdenar.map((p) => p.idSolicitud),
        });
      }
    }

    // --- Finanzas: comparativos listos para adjudicar ---
    if (todo || hasPermiso(ctx.permisos, Permisos.COTIZACION_ADJUDICAR)) {
      const listos = await this.read.solicitudesParaAdjudicar();
      if (listos.length > 0) {
        items.push({
          tipo: "ADJUDICAR",
          titulo: "Comparativos por adjudicar",
          detalle: "Tienen cotizaciones y aun no se elige la mejor oferta.",
          cantidad: listos.length,
          leafId: "com-an-comparativo",
          refs: listos.map((p) => p.idSolicitud),
        });
      }
    }

    // --- Bodega: ordenes por recibir ---
    if (todo || hasPermiso(ctx.permisos, Permisos.RECEPCION_GESTIONAR)) {
      const oc = await this.read.ordenesPorRecibir();
      if (oc.length > 0) {
        items.push({
          tipo: "RECIBIR",
          titulo: "Ordenes por recibir",
          detalle: "Enviadas o en transito; registra la recepcion cuando lleguen.",
          cantidad: oc.length,
          leafId: "com-doc-recepciones",
          refs: oc.map((o) => o.idOrdenCompra),
        });
      }
    }

    // --- Reposicion: articulos bajo el minimo, para quien puede originar
    //     la solicitud que los reponga (no es un documento de otro — la
    //     escasez es un hecho de inventario, no de un equipo/departamento). ---
    if (todo || hasPermiso(ctx.permisos, Permisos.SOLICITUD_CREAR)) {
      const bajoMinimo = await this.read.alertasEscasezPendientes();
      if (bajoMinimo.length > 0) {
        items.push({
          tipo: "ESCASEZ",
          titulo: "Articulos por reabastecer",
          detalle: "La existencia cayo bajo el stock minimo; hay cantidad sugerida de reposicion.",
          cantidad: bajoMinimo.length,
          leafId: "com-doc-solicitudes",
          refs: bajoMinimo.map((a) => a.idArticulo),
        });
      }
    }

    return { total: items.reduce((a, n) => a + n.cantidad, 0), items };
  }
}

export const notificacionService = NotificacionService.getInstance();

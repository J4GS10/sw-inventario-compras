/**
 * Capa 3 - Logica de Negocio / compras.
 *
 * Caso de uso: Recepcion fisica de mercaderia contra una orden de compra.
 *
 * Patron Facade: `registrar` coordina cabecera/detalle + recalculo de estado de
 * la OC (parcial / completa) + publicacion del evento RecepcionRegistrada.
 *
 * Patron Observer: NO alimenta el kardex ni CxP directamente. Publica el evento
 * y los suscriptores (modulos INV / CXP) reaccionan. Asi el modulo de Compras
 * no depende de la implementacion de esos modulos (bajo acoplamiento).
 *
 * La FK circular COM_RECEPCION.ID_FACTURA_PROVEEDOR <-> CXP_FACTURA_PROVEEDOR
 * .ID_RECEPCION se resuelve en dos pasos: aqui se crea la recepcion con
 * ID_FACTURA_PROVEEDOR NULL; el suscriptor de CxP crea la factura y actualiza
 * la recepcion (estado ALIMENTADO_CXP).
 */

import type { Connection } from "oracledb";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../../common/errors/AppError.js";
import {
  normalizePageQuery,
  type PageQuery,
  type Paginated,
} from "../../../common/types/Query.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import type {
  OrdenCompra,
  OrdenCompraDetalle,
  Recepcion,
  RecepcionDetalle,
} from "../../../entities/com/models.js";
import type { WithDetails } from "../../../dal/contracts/IHeaderDetailRepository.js";
import {
  devolucionRepository,
  ordenCompraRepository,
  recepcionRepository,
} from "../../../dal/repositories/com/index.js";
import { facturaProveedorRepository } from "../../../dal/repositories/shared/index.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
import {
  ComEvents,
  type RecepcionRegistradaPayload,
  type RecepcionReversadaPayload,
} from "../../events/domainEvents.js";
import {
  ordenCompraStateMachine,
  recepcionStateMachine,
} from "../../compras/stateMachines.js";
import { TransactionalService } from "../../support/TransactionalService.js";

interface LineaRecepcionInput {
  readonly idOcDetalle: number;
  readonly cantidadRecibida: number;
  readonly cantidadRechazada?: number;
}

export interface RegistrarRecepcionInput {
  readonly idOrdenCompra: number;
  readonly idBodega: number;
  readonly idEmpleadoRecibe: number;
  readonly lineas: readonly LineaRecepcionInput[];
}

export class RecepcionService extends TransactionalService {
  private readonly repo = recepcionRepository();

  private readonly ocRepo = ordenCompraRepository();

  private readonly devolucionRepo = devolucionRepository();

  private readonly recDetalleRepo = repositoryFactory().get<
    RecepcionDetalle,
    object,
    object
  >("recepcionDetalle");

  public async listar(query: PageQuery): Promise<Paginated<Recepcion>> {
    return this.repo.findAll(query) as Promise<Paginated<Recepcion>>;
  }

  public async obtener(
    id: number,
  ): Promise<WithDetails<Recepcion, RecepcionDetalle>> {
    const found = (await this.repo.findByIdWithDetails(id)) as WithDetails<
      Recepcion,
      RecepcionDetalle
    > | null;
    if (found === null) throw new NotFoundError("COM_RECEPCION", id);
    return found;
  }

  /**
   * Borrado logico de la recepcion (cabecera + lineas). Cerrojo: solo si aun
   * NO alimento CxP (estado RECIBIDO). No revierte kardex ni la factura: si ya
   * esta ALIMENTADO_CXP hay que anular por CxP. Si esta era la unica recepcion
   * (o la ultima activa) de su OC, la OC vuelve a ENVIADA / RECIBIDA_PARCIAL
   * segun lo que quede (ver `recalcularYActualizarOc`).
   */
  public async eliminar(id: number, ctx: AuditContext): Promise<{ idRecepcion: number }> {
    return this.runInTransaction(async ({ conn }) => {
      const actual = (await this.repo.findById(id, conn)) as Recepcion | null;
      if (actual === null) throw new NotFoundError("COM_RECEPCION", id);
      if (actual.estado !== "RECIBIDO") {
        throw new BusinessRuleError(
          "No se puede eliminar: la recepcion ya alimento el kardex y CxP " +
            "(estado ALIMENTADO_CXP). Anula por Cuentas por Pagar.",
        );
      }
      await this.repo.softDeleteWithDetails(id, ctx, conn);
      await this.recalcularYActualizarOc(actual.idOrdenCompra, ctx, conn);
      return { idRecepcion: id };
    });
  }

  /**
   * Reversa de una recepcion que YA alimento CxP (estado ALIMENTADO_CXP): anula
   * la factura de proveedor generada, compensa el kardex con un AJUSTE_NEGATIVO
   * por linea y deja la recepcion con borrado logico. Cerrojos:
   *  - no debe haber devoluciones a proveedor registradas contra esta recepcion,
   *  - la factura de CxP debe seguir PENDIENTE y sin pagos aplicados.
   * Las mutaciones de INV_/CXP_ ocurren en sus suscriptores (RecepcionReversada);
   * aqui solo se leen para el cerrojo (bajo acoplamiento, igual que la creacion).
   */
  public async reversar(
    id: number,
    ctx: AuditContext,
  ): Promise<{ idRecepcion: number; idFacturaAnulada: number | null }> {
    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      const actual = (await this.repo.findById(id, conn)) as Recepcion | null;
      if (actual === null) throw new NotFoundError("COM_RECEPCION", id);
      if (actual.estado !== "ALIMENTADO_CXP") {
        throw new BusinessRuleError(
          "Solo se puede reversar una recepcion que ya alimento CxP " +
            "(estado ALIMENTADO_CXP). Si aun esta en RECIBIDO, usa Eliminar.",
        );
      }

      const devoluciones = await this.devolucionRepo.findAll(
        normalizePageQuery({
          page: 1,
          pageSize: 1,
          filters: [{ prop: "idRecepcion", operator: "eq", value: id }],
        }),
        conn,
      );
      if (devoluciones.data.length > 0) {
        throw new BusinessRuleError(
          "No se puede reversar: hay devoluciones a proveedor registradas contra " +
            "esta recepcion. Eliminalas primero.",
        );
      }

      const idFactura = actual.idFacturaProveedor ?? null;
      let facturaAnulable: number | null = null;
      if (idFactura !== null) {
        const factura = (await facturaProveedorRepository().findById(
          idFactura,
          conn,
        )) as
          | {
              idFacturaProveedor: number;
              estado: string | null;
              montoTotal: number;
              saldoPendiente: number;
            }
          | null;
        if (factura !== null && factura.estado !== "ANULADA") {
          if (factura.estado !== "PENDIENTE") {
            throw new BusinessRuleError(
              `No se puede reversar: la factura de CxP ${factura.idFacturaProveedor} ` +
                `esta en estado ${String(factura.estado)}.`,
            );
          }
          if (
            Number(factura.saldoPendiente) + 1e-6 <
            Number(factura.montoTotal)
          ) {
            throw new BusinessRuleError(
              `No se puede reversar: la factura de CxP ${factura.idFacturaProveedor} ` +
                "ya tiene pagos aplicados.",
            );
          }
          facturaAnulable = factura.idFacturaProveedor;
        }
      }

      // Reunir las lineas para el evento inverso ANTES del borrado logico.
      const recLineas = (await this.repo.listDetails(
        id,
        conn,
      )) as readonly RecepcionDetalle[];
      const oc = (await this.ocRepo.findById(
        actual.idOrdenCompra,
        conn,
      )) as OrdenCompra | null;
      const ocLineas =
        oc === null
          ? []
          : ((await this.ocRepo.listDetails(
              actual.idOrdenCompra,
              conn,
            )) as readonly OrdenCompraDetalle[]);
      const porOcId = new Map(ocLineas.map((l) => [l.idOcDetalle, l]));

      // Soltar la FK a la factura, volver a RECIBIDO y borrar logico.
      recepcionStateMachine.assertTransition(actual.estado, "RECIBIDO");
      await this.repo.update(
        id,
        { idFacturaProveedor: null, estado: "RECIBIDO" },
        null,
        ctx,
        conn,
      );
      await this.repo.softDeleteWithDetails(id, ctx, conn);
      // La OC vuelve a ENVIADA / RECIBIDA_PARCIAL segun lo que quede recibido;
      // sin esto quedaba RECIBIDA_COMPLETA sin poder recibir de nuevo.
      await this.recalcularYActualizarOc(actual.idOrdenCompra, ctx, conn);

      const payload: RecepcionReversadaPayload = {
        idRecepcion: id,
        idBodega: actual.idBodega,
        idFacturaProveedor: facturaAnulable,
        fechaRecepcion: actual.fechaRecepcion,
        userId: ctx.userId,
        lineas: recLineas.map((d) => {
          const ocLinea = porOcId.get(d.idOcDetalle);
          const neto =
            ocLinea === undefined
              ? 0
              : ocLinea.precioUnitario *
                (1 - ocLinea.porcentajeDescuento / 100);
          return {
            idArticulo: ocLinea?.idArticulo ?? null,
            cantidadRecibida: d.cantidadRecibida,
            costoUnitario: Number(neto.toFixed(4)),
          };
        }),
      };
      enqueueEvent(ComEvents.RecepcionReversada, payload);
      return { idRecepcion: id, idFacturaAnulada: facturaAnulable };
    });
  }

  public async registrar(
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<Recepcion, RecepcionDetalle>> {
    const input = this.parse(body);

    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      const oc = (await this.ocRepo.findById(
        input.idOrdenCompra,
        conn,
      )) as OrdenCompra | null;
      if (oc === null) {
        throw new NotFoundError("COM_ORDEN_COMPRA", input.idOrdenCompra);
      }
      if (["CANCELADA", "RECHAZADA", "RECIBIDA_COMPLETA"].includes(oc.estado)) {
        throw new BusinessRuleError(
          `La orden de compra ${oc.idOrdenCompra} esta en estado ${oc.estado} y no admite recepciones`,
        );
      }

      const ocLineas = (await this.ocRepo.listDetails(
        input.idOrdenCompra,
        conn,
      )) as readonly OrdenCompraDetalle[];
      const porId = new Map(ocLineas.map((l) => [l.idOcDetalle, l]));

      // No se puede procesar (recibir + rechazar) mas de lo ordenado en la
      // linea, sumando esta recepcion sobre lo ya procesado en recepciones
      // previas activas de la misma OC.
      for (const linea of input.lineas) {
        const ocLinea = porId.get(linea.idOcDetalle);
        if (ocLinea === undefined) continue; // error mas especifico abajo
        const previas = await this.recDetalleRepo.findAll(
          normalizePageQuery({
            page: 1,
            pageSize: 500,
            filters: [
              { prop: "idOcDetalle", operator: "eq", value: linea.idOcDetalle },
            ],
          }),
          conn,
        );
        const procesadoPrevio = previas.data.reduce(
          (acc, r) => acc + r.cantidadRecibida + r.cantidadRechazada,
          0,
        );
        const nuevo = linea.cantidadRecibida + (linea.cantidadRechazada ?? 0);
        const pendiente = ocLinea.cantidad - procesadoPrevio;
        if (nuevo > pendiente + 1e-6) {
          throw new BusinessRuleError(
            `La linea de OC ${linea.idOcDetalle} admite maximo ${pendiente.toFixed(2)} ` +
              `unidades pendientes (ordenado ${ocLinea.cantidad}, ya procesado ` +
              `${procesadoPrevio.toFixed(2)}); se intento registrar ${nuevo}.`,
          );
        }
      }

      const cabecera = validateAgainstDescriptor(
        COM_DESCRIPTORS.recepcion,
        {
          idOrdenCompra: input.idOrdenCompra,
          idBodega: input.idBodega,
          idEmpleadoRecibe: input.idEmpleadoRecibe,
          idFacturaProveedor: null,
          estado: "RECIBIDO",
        },
        "create",
      );

      const fkProp = this.repo.detailForeignKeyProp();
      const detalles = input.lineas.map((linea) => {
        const ocLinea = porId.get(linea.idOcDetalle);
        if (ocLinea === undefined) {
          throw new ValidationError(
            `La linea de OC ${linea.idOcDetalle} no pertenece a la orden ${input.idOrdenCompra}`,
          );
        }
        return validateAgainstDescriptor(
          COM_DESCRIPTORS.recepcionDetalle,
          {
            idOcDetalle: linea.idOcDetalle,
            cantidadRecibida: linea.cantidadRecibida,
            cantidadRechazada: linea.cantidadRechazada ?? 0,
          },
          "create",
          [fkProp],
        );
      });

      const created = (await this.repo.createWithDetails(
        cabecera,
        detalles,
        ctx,
        conn,
      )) as WithDetails<Recepcion, RecepcionDetalle>;

      const nuevoEstadoOc = await this.calcularEstadoOc(
        input.idOrdenCompra,
        ocLineas,
        conn,
      );
      if (nuevoEstadoOc !== oc.estado) {
        ordenCompraStateMachine.assertTransition(oc.estado, nuevoEstadoOc);
        await this.ocRepo.update(
          input.idOrdenCompra,
          { estado: nuevoEstadoOc },
          oc.version,
          ctx,
          conn,
        );
      }

      const payload: RecepcionRegistradaPayload = {
        idRecepcion: created.header.idRecepcion,
        idOrdenCompra: oc.idOrdenCompra,
        idBodega: created.header.idBodega,
        idProveedor: oc.idProveedor,
        idEmpleadoRecibe: created.header.idEmpleadoRecibe,
        fechaRecepcion: created.header.fechaRecepcion,
        userId: ctx.userId,
        lineas: created.details.map((d) => {
          const ocLinea = porId.get(d.idOcDetalle);
          const neto =
            ocLinea === undefined
              ? 0
              : ocLinea.precioUnitario *
                (1 - ocLinea.porcentajeDescuento / 100);
          return {
            idOcDetalle: d.idOcDetalle,
            idArticulo: ocLinea?.idArticulo ?? null,
            cantidadRecibida: d.cantidadRecibida,
            cantidadRechazada: d.cantidadRechazada,
            costoUnitario: Number(neto.toFixed(4)),
          };
        }),
      };
      enqueueEvent(ComEvents.RecepcionRegistrada, payload);
      return created;
    });
  }

  // ------------------------------------------------------------------------

  /**
   * ENVIADA si no queda ninguna recepcion activa (todas eliminadas/reversadas);
   * RECIBIDA_COMPLETA si toda linea de OC esta cubierta; si no, RECIBIDA_PARCIAL.
   * Reusado tanto al registrar como al eliminar/reversar una recepcion.
   */
  private async calcularEstadoOc(
    idOrdenCompra: number,
    ocLineas: readonly OrdenCompraDetalle[],
    conn: Connection,
  ): Promise<OrdenCompra["estado"]> {
    let completa = true;
    let algunaRecibida = false;
    for (const ocLinea of ocLineas) {
      const recibidas = await this.recDetalleRepo.findAll(
        normalizePageQuery({
          page: 1,
          pageSize: 500,
          filters: [
            { prop: "idOcDetalle", operator: "eq", value: ocLinea.idOcDetalle },
          ],
        }),
        conn,
      );
      // findAll ya filtra ELIMINADO='N': una recepcion borrada/reversada no cuenta.
      const total = recibidas.data.reduce(
        (acc, r) => acc + r.cantidadRecibida,
        0,
      );
      if (total > 1e-6) algunaRecibida = true;
      if (total + 1e-6 < ocLinea.cantidad) completa = false;
    }
    if (!algunaRecibida) return "ENVIADA";
    return completa ? "RECIBIDA_COMPLETA" : "RECIBIDA_PARCIAL";
  }

  /**
   * Recalcula el estado de la OC desde las recepciones ACTIVAS restantes y
   * aplica la transicion si cambio. No hace nada si la OC no esta en un estado
   * de recepcion (p. ej. ya CANCELADA): eso no es asunto de este calculo.
   */
  private async recalcularYActualizarOc(
    idOrdenCompra: number,
    ctx: AuditContext,
    conn: Connection,
  ): Promise<void> {
    const oc = (await this.ocRepo.findById(idOrdenCompra, conn)) as OrdenCompra | null;
    if (oc === null) return;
    if (!["RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA"].includes(oc.estado)) return;
    const ocLineas = (await this.ocRepo.listDetails(
      idOrdenCompra,
      conn,
    )) as readonly OrdenCompraDetalle[];
    const nuevoEstado = await this.calcularEstadoOc(idOrdenCompra, ocLineas, conn);
    if (nuevoEstado !== oc.estado) {
      ordenCompraStateMachine.assertTransition(oc.estado, nuevoEstado);
      await this.ocRepo.update(idOrdenCompra, { estado: nuevoEstado }, oc.version, ctx, conn);
    }
  }

  private parse(body: unknown): RegistrarRecepcionInput {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    const b = body as Record<string, unknown>;
    const idOrdenCompra = Number(b["idOrdenCompra"]);
    const idBodega = Number(b["idBodega"]);
    const idEmpleadoRecibe = Number(b["idEmpleadoRecibe"]);
    const lineasRaw = Array.isArray(b["lineas"]) ? b["lineas"] : [];
    if (
      !Number.isInteger(idOrdenCompra) ||
      !Number.isInteger(idBodega) ||
      !Number.isInteger(idEmpleadoRecibe) ||
      lineasRaw.length === 0
    ) {
      throw new ValidationError("Datos de recepcion invalidos", [
        {
          message:
            "idOrdenCompra, idBodega, idEmpleadoRecibe y al menos una linea son obligatorios",
        },
      ]);
    }
    const lineas: LineaRecepcionInput[] = lineasRaw.map((raw, i) => {
      const l = raw as Record<string, unknown>;
      const idOcDetalle = Number(l["idOcDetalle"]);
      const cantidadRecibida = Number(l["cantidadRecibida"]);
      if (!Number.isInteger(idOcDetalle) || !(cantidadRecibida > 0)) {
        throw new ValidationError(`Linea ${i + 1} invalida`, [
          {
            field: `lineas[${i}]`,
            message: "idOcDetalle y cantidadRecibida (> 0) son obligatorios",
          },
        ]);
      }
      const out: LineaRecepcionInput = { idOcDetalle, cantidadRecibida };
      if (l["cantidadRechazada"] !== undefined) {
        return { ...out, cantidadRechazada: Number(l["cantidadRechazada"]) };
      }
      return out;
    });
    return { idOrdenCompra, idBodega, idEmpleadoRecibe, lineas };
  }
}

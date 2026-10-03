/**
 * Capa 3 - Logica de Negocio / compras.
 * Caso de uso: devolucion de mercaderia a un proveedor tras la recepcion.
 * Valida que lo devuelto por linea no exceda lo recibido. Publica
 * DevolucionRegistrada (un futuro suscriptor de INV puede generar la salida de
 * kardex correspondiente).
 */

import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../../common/errors/AppError.js";
import type { PageQuery, Paginated } from "../../../common/types/Query.js";
import { validateAgainstDescriptor } from "../../../common/validation/descriptorValidation.js";
import { COM_DESCRIPTORS } from "../../../entities/com/descriptors.js";
import type {
  DevolucionProveedor,
  Recepcion,
  RecepcionDetalle,
} from "../../../entities/com/models.js";
import type { WithDetails } from "../../../dal/contracts/IHeaderDetailRepository.js";
import {
  devolucionRepository,
  recepcionRepository,
} from "../../../dal/repositories/com/index.js";
import { ComEvents } from "../../events/domainEvents.js";
import { TransactionalService } from "../../support/TransactionalService.js";

interface DevolucionDetalle {
  readonly idDevolucionDetalle: number;
  readonly idRecepcionDetalle: number;
  readonly cantidadDevuelta: number;
}

interface LineaInput {
  readonly idRecepcionDetalle: number;
  readonly cantidadDevuelta: number;
}

export class DevolucionProveedorService extends TransactionalService {
  private readonly repo = devolucionRepository();

  private readonly recepcionRepo = recepcionRepository();

  public async listar(query: PageQuery): Promise<Paginated<DevolucionProveedor>> {
    return this.repo.findAll(query) as Promise<Paginated<DevolucionProveedor>>;
  }

  public async obtener(
    id: number,
  ): Promise<WithDetails<DevolucionProveedor, DevolucionDetalle>> {
    const found = (await this.repo.findByIdWithDetails(id)) as WithDetails<
      DevolucionProveedor,
      DevolucionDetalle
    > | null;
    if (found === null) throw new NotFoundError("COM_DEVOLUCION_PROVEEDOR", id);
    return found;
  }

  /**
   * Borrado logico de la devolucion (cabecera + lineas). Cerrojo: solo el mismo
   * dia en que se registro (correccion de captura).
   */
  public async eliminar(id: number, ctx: AuditContext): Promise<{ idDevolucion: number }> {
    return this.runInTransaction(async ({ conn }) => {
      const actual = (await this.repo.findById(id, conn)) as
        | (DevolucionProveedor & { fechaDevolucion?: string })
        | null;
      if (actual === null) throw new NotFoundError("COM_DEVOLUCION_PROVEEDOR", id);
      const dia = String(actual.fechaDevolucion ?? "").slice(0, 10);
      const hoy = new Date().toISOString().slice(0, 10);
      if (dia !== "" && dia !== hoy) {
        throw new BusinessRuleError(
          "Solo se puede eliminar una devolucion el mismo dia en que se registro.",
        );
      }
      await this.repo.softDeleteWithDetails(id, ctx, conn);
      return { idDevolucion: id };
    });
  }

  public async registrar(
    body: unknown,
    ctx: AuditContext,
  ): Promise<WithDetails<DevolucionProveedor, DevolucionDetalle>> {
    const b = this.asObject(body);
    const idRecepcion = Number(b["idRecepcion"]);
    const motivo = String(b["motivo"] ?? "");
    const idEmpleadoSolicita = Number(b["idEmpleadoSolicita"]);
    const lineasRaw = Array.isArray(b["lineas"]) ? b["lineas"] : [];
    if (
      !Number.isInteger(idRecepcion) ||
      motivo === "" ||
      !Number.isInteger(idEmpleadoSolicita) ||
      lineasRaw.length === 0
    ) {
      throw new ValidationError("Datos de devolucion invalidos", [
        { message: "idRecepcion, motivo, idEmpleadoSolicita y lineas son obligatorios" },
      ]);
    }
    const lineas: LineaInput[] = lineasRaw.map((raw, i) => {
      const l = raw as Record<string, unknown>;
      const idRecepcionDetalle = Number(l["idRecepcionDetalle"]);
      const cantidadDevuelta = Number(l["cantidadDevuelta"]);
      if (!Number.isInteger(idRecepcionDetalle) || !(cantidadDevuelta > 0)) {
        throw new ValidationError(`Linea ${i + 1} invalida`);
      }
      return { idRecepcionDetalle, cantidadDevuelta };
    });

    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      const recepcion = (await this.recepcionRepo.findById(
        idRecepcion,
        conn,
      )) as Recepcion | null;
      if (recepcion === null) throw new NotFoundError("COM_RECEPCION", idRecepcion);

      const recLineas = (await this.recepcionRepo.listDetails(
        idRecepcion,
        conn,
      )) as readonly RecepcionDetalle[];
      const porId = new Map(recLineas.map((l) => [l.idRecepcionDetalle, l]));

      for (const linea of lineas) {
        const rec = porId.get(linea.idRecepcionDetalle);
        if (rec === undefined) {
          throw new ValidationError(
            `La linea de recepcion ${linea.idRecepcionDetalle} no pertenece a la recepcion ${idRecepcion}`,
          );
        }
        if (linea.cantidadDevuelta > rec.cantidadRecibida) {
          throw new BusinessRuleError(
            `No se pueden devolver ${linea.cantidadDevuelta} de la linea ${linea.idRecepcionDetalle}: ` +
              `solo se recibieron ${rec.cantidadRecibida}`,
          );
        }
      }

      const cabecera = validateAgainstDescriptor(
        COM_DESCRIPTORS.devolucionProveedor,
        { idRecepcion, motivo, idEmpleadoSolicita },
        "create",
      );
      const fkProp = this.repo.detailForeignKeyProp();
      const detalles = lineas.map((linea) =>
        validateAgainstDescriptor(
          COM_DESCRIPTORS.devolucionDetalle,
          {
            idRecepcionDetalle: linea.idRecepcionDetalle,
            cantidadDevuelta: linea.cantidadDevuelta,
          },
          "create",
          [fkProp],
        ),
      );

      const created = (await this.repo.createWithDetails(
        cabecera,
        detalles,
        ctx,
        conn,
      )) as WithDetails<DevolucionProveedor, DevolucionDetalle>;

      enqueueEvent(ComEvents.DevolucionRegistrada, {
        idDevolucion: created.header.idDevolucion,
        idRecepcion,
        idProveedor: recepcion.idOrdenCompra,
        userId: ctx.userId,
        lineas: created.details.length,
      });
      return created;
    });
  }

  private asObject(body: unknown): Record<string, unknown> {
    if (body === null || typeof body !== "object") {
      throw new ValidationError("El cuerpo debe ser un objeto");
    }
    return body as Record<string, unknown>;
  }
}

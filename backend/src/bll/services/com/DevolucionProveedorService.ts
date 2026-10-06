/**
 * Capa 3 - Logica de Negocio / compras.
 * Caso de uso: devolucion de mercaderia a un proveedor tras la recepcion.
 * Valida que lo devuelto por linea no exceda lo recibido. Publica
 * DevolucionRegistrada (un futuro suscriptor de INV puede generar la salida de
 * kardex correspondiente).
 */

import { SoloValidacionExitosa } from "../../../common/errors/SoloValidacion.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../../common/errors/AppError.js";
import type { PageQuery, Paginated } from "../../../common/types/Query.js";
import { Validacion } from "../../../common/validation/reglas.js";
import { MAX_LINEAS, devolvibleDeLinea } from "../../compras/reglasDocumentos.js";
import { normalizePageQuery } from "../../../common/types/Query.js";
import { repositoryFactory } from "../../../dal/repositories/RepositoryFactory.js";
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

  private readonly devDetalleRepo = repositoryFactory().get<
    { idRecepcionDetalle: number; cantidadDevuelta: number },
    object,
    object
  >("devolucionDetalle");

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
          "Solo se puede eliminar una devolución el mismo día en que se registró.",
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
    const lineasRaw = Array.isArray(b["lineas"]) ? b["lineas"] : [];

    const v = new Validacion();
    const idRecepcionV = v.id("idRecepcion", "La recepción", b["idRecepcion"]);
    const motivoV = v.texto("motivo", "El motivo", b["motivo"], { min: 3, max: 255 });
    const idEmpleadoV = v.id("idEmpleadoSolicita", "El empleado que solicita", b["idEmpleadoSolicita"]);
    if (lineasRaw.length === 0) v.error("lineas", "La devolución debe incluir al menos una línea");
    if (lineasRaw.length > MAX_LINEAS) v.error("lineas", `La devolución admite máximo ${MAX_LINEAS} líneas`);
    const vistas = new Set<number>();
    const lineas: LineaInput[] = [];
    lineasRaw.forEach((raw, i) => {
      const l = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const n = i + 1;
      const idRecepcionDetalle = v.id(`lineas[${i}].idRecepcionDetalle`, `Línea ${n}: la línea de la recepción`, l["idRecepcionDetalle"]);
      const cantidadDevuelta = v.positivo(`lineas[${i}].cantidadDevuelta`, `Línea ${n}: la cantidad devuelta`, l["cantidadDevuelta"]);
      if (idRecepcionDetalle !== null) {
        if (vistas.has(idRecepcionDetalle)) {
          v.error(`lineas[${i}].idRecepcionDetalle`, `Línea ${n}: la línea de recepción ${idRecepcionDetalle} está repetida`);
        }
        vistas.add(idRecepcionDetalle);
      }
      if (idRecepcionDetalle !== null && cantidadDevuelta !== null) {
        lineas.push({ idRecepcionDetalle, cantidadDevuelta });
      }
    });
    v.lanzarSiHay("Devolución inválida");
    const idRecepcion = idRecepcionV as number;
    const motivo = motivoV as string;
    const idEmpleadoSolicita = idEmpleadoV as number;

    return this.runInTransaction(async ({ conn, enqueueEvent }) => {
      // Serializa las devoluciones de ESTA recepcion: el acumulado devuelto se lee
      // y se escribe dentro del mismo bloqueo (sin el, N peticiones simultaneas
      // devolvian cada una "dentro del tope" y se superaba lo recibido).
      await this.recepcionRepo.lockById(idRecepcion, conn);
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
            `La línea de recepción ${linea.idRecepcionDetalle} no pertenece a la recepción ${idRecepcion}`,
          );
        }
        // Acumulado: lo ya devuelto en devoluciones anteriores de esta misma linea
        // cuenta contra lo recibido (antes se podia devolver la misma mercaderia
        // varias veces, cada una "dentro del tope").
        const previas = await this.devDetalleRepo.findAll(
          normalizePageQuery({
            page: 1,
            pageSize: 500,
            filters: [{ prop: "idRecepcionDetalle", operator: "eq", value: linea.idRecepcionDetalle }],
          }),
          conn,
        );
        const yaDevuelto = previas.data.reduce((acc, d) => acc + Number(d.cantidadDevuelta), 0);
        const disponible = devolvibleDeLinea(rec.cantidadRecibida, yaDevuelto);
        if (linea.cantidadDevuelta > disponible) {
          throw new BusinessRuleError(
            disponible === 0
              ? `La línea ${linea.idRecepcionDetalle} ya fue devuelta por completo (${rec.cantidadRecibida} recibidas).`
              : `No se pueden devolver ${linea.cantidadDevuelta} de la línea ${linea.idRecepcionDetalle}: ` +
                `se recibieron ${rec.cantidadRecibida}, ya se devolvieron ${yaDevuelto} y quedan ${disponible} por devolver.`,
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

      if (ctx.soloValidar === true) throw new SoloValidacionExitosa();
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

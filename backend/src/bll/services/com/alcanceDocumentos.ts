/**
 * Capa 3 - Logica de Negocio / compras.
 * Alcance por departamento/equipo aplicado a los DOCUMENTOS del ciclo (RFQ,
 * cotizacion). Extiende `empleadosEnAlcance` (que resuelve el conjunto de
 * empleados visibles) hasta el nivel de solicitud y de RFQ.
 *
 *   null      -> el usuario ve/actua sobre TODO (comprador, financiero, auditor,
 *                admin, contexto de sistema).
 *   number[]  -> solo los ids de solicitud dentro de su ambito (puede ser []).
 *
 * Nota: OC / Recepcion / Devolucion NO se acotan aqui. COM_ORDEN_COMPRA no
 * guarda ID_SOLICITUD (el vinculo es multi-salto via la cotizacion adjudicada) y,
 * tras el endurecimiento de lecturas por rol, ningun rol acotado por
 * departamento (solicitante/jefe/gerente) tiene ya acceso de lectura a esos
 * documentos: solo comprador/financiero/auditor/admin, que operan a nivel de
 * toda la empresa por diseno.
 */

import type { AuditContext } from "../../../common/types/AuditContext.js";
import type { CompraReadRepository } from "../../../dal/repositories/com/CompraReadRepository.js";
import { empleadosEnAlcance } from "./alcance.js";

/** Ids de solicitud dentro del alcance del usuario, o `null` si ve todo. */
export async function solicitudIdsEnAlcance(
  ctx: AuditContext | undefined,
  read: CompraReadRepository,
): Promise<readonly number[] | null> {
  const empleados = await empleadosEnAlcance(ctx, read);
  if (empleados === null) return null;
  return read.solicitudIdsDeEmpleados(empleados);
}

/** Ids de RFQ dentro del alcance del usuario, o `null` si ve todo. */
export async function rfqIdsEnAlcance(
  ctx: AuditContext | undefined,
  read: CompraReadRepository,
): Promise<readonly number[] | null> {
  const solicitudes = await solicitudIdsEnAlcance(ctx, read);
  if (solicitudes === null) return null;
  return read.rfqIdsDeSolicitudes(solicitudes);
}

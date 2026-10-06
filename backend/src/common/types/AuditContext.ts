/**
 * Capa 6 - Componentes Comunes.
 * Contexto de auditoria que viaja desde Presentacion hasta la DAL para poblar
 * columnas CREADO_POR / MODIFICADO_POR / ELIMINADO_POR (todas FK -> SEG_USUARIO).
 */

export interface AuditContext {
  /** ID_USUARIO de SEG_USUARIO extraido del token JWT. */
  readonly userId: number;
  /** Permisos efectivos del usuario (o ["*"] en contexto de sistema/dev). */
  readonly permisos: readonly string[];
  /** ID_EMPLEADO ligado a la cuenta (para alcance por departamento/equipo). */
  readonly empleadoId?: number;
  /** Codigos de rol del usuario (para reglas de alcance/visibilidad). */
  readonly roles?: readonly string[];
  /** Identificador de correlacion del request (para logs). */
  readonly requestId?: string;
  /** Modo "solo validar" (cabecera X-Solo-Validar): el servicio valida todo y NO escribe. */
  readonly soloValidar?: boolean;
}

export const SYSTEM_AUDIT_CONTEXT: AuditContext = { userId: 0, permisos: ["*"] };

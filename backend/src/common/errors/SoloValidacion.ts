/**
 * Capa 6 - Componentes Comunes.
 * Senal (no es un fallo) para el modo "solo validar": el servicio ejecuta TODAS sus validaciones
 * (incluidas las que consultan la base: proveedor invitado, plazos, topes...) y, justo antes de
 * escribir, lanza esta senal. La transaccion se revierte sin haber insertado nada — por eso no se
 * consume ningun folio (IDENTITY) — y el manejador de errores responde 200 { valido: true }.
 */
export class SoloValidacionExitosa extends Error {
  constructor() {
    super("Validación exitosa (no se registró nada)");
    this.name = "SoloValidacionExitosa";
  }
}

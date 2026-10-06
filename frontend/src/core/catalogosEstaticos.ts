/**
 * Catalogos de REFERENCIA del modulo de Compras que no ameritan una tabla
 * propia (listas cortas y estables). Centralizados aqui para constrenir la
 * entrada de datos en lugar de texto libre. Cada uno = lista tipada de opciones.
 */

import type { SelectOption } from "../ui/Field.js";

export const CALIFICACION_PROVEEDOR: readonly SelectOption[] = [
  { value: "A+", label: "A+ · Estratégico" },
  { value: "A", label: "A · Confiable" },
  { value: "B", label: "B · Aceptable" },
  { value: "C", label: "C · En observación" },
  { value: "Nuevo", label: "Nuevo · Sin historial" },
];

export const CRITERIO_COMPARATIVO: readonly SelectOption[] = [
  { value: "Precio", label: "Precio" },
  { value: "Plazo de entrega", label: "Plazo de entrega" },
  { value: "Calidad", label: "Calidad" },
  { value: "Condiciones de pago", label: "Condiciones de pago" },
  { value: "Garantia", label: "Garantía" },
  { value: "Servicio posventa", label: "Servicio posventa" },
  { value: "Experiencia previa", label: "Experiencia previa" },
  { value: "Capacidad de suministro", label: "Capacidad de suministro" },
];

export const TIPO_EXCEPCION_ORDEN: readonly SelectOption[] = [
  { value: "FALTANTE", label: "Faltante en la entrega" },
  { value: "SOBRANTE", label: "Sobrante en la entrega" },
  { value: "DANADO", label: "Producto dañado" },
  { value: "RETRASO", label: "Retraso en la entrega" },
  { value: "PRECIO_INCORRECTO", label: "Precio incorrecto" },
  { value: "DOCUMENTO_FALTANTE", label: "Documento faltante" },
  { value: "OTRO", label: "Otro" },
];

export const ESTADO_SEGUIMIENTO_ORDEN: readonly SelectOption[] = [
  { value: "CONTACTADO", label: "Contactado" },
  { value: "SIN_RESPUESTA", label: "Sin respuesta" },
  { value: "CONFIRMADO", label: "Confirmado por el proveedor" },
  { value: "EN_PREPARACION", label: "En preparación" },
  { value: "DESPACHADO", label: "Despachado" },
  { value: "RETRASADO", label: "Retrasado" },
  { value: "ENTREGADO", label: "Entregado" },
];

export const MOTIVO_DEVOLUCION: readonly SelectOption[] = [
  { value: "Producto danado", label: "Producto dañado" },
  { value: "No corresponde a lo solicitado", label: "No corresponde a lo solicitado" },
  { value: "Vencimiento proximo", label: "Vencimiento próximo" },
  { value: "Exceso de entrega", label: "Exceso de entrega" },
  { value: "Calidad deficiente", label: "Calidad deficiente" },
  { value: "Error de facturacion", label: "Error de facturación" },
  { value: "Otro", label: "Otro" },
];

export const ESTADO_AI: readonly SelectOption[] = [
  { value: "A", label: "Activo" },
  { value: "I", label: "Inactivo" },
];

export const PRIORIDAD_SOLICITUD: readonly SelectOption[] = [
  { value: "1", label: "1 · Crítica" },
  { value: "2", label: "2 · Alta" },
  { value: "3", label: "3 · Normal" },
  { value: "4", label: "4 · Baja" },
  { value: "5", label: "5 · Planificada" },
];

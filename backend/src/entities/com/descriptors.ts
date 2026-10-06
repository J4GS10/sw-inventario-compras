/**
 * Capa 5 - Entidades (transversal).
 * Descriptores de las 26 tablas del modulo de Compras (COM_).
 * Fuente: database/ddl/SCRIPT_DDL.sql lineas 684-1069.
 *
 * Estos objetos son la UNICA fuente de verdad que alimenta:
 *  - dal/repositories/BaseOracleRepository  (CRUD + SQL + mapeo)
 *  - bll/services/BaseCrudService           (casos de uso + validacion)
 *  - presentation/routes/crudRouter         (rutas REST)
 *  - frontend (espejo en frontend/src/entities/com/)
 *
 * Regenerables con: pnpm --filter backend gen:entities
 */

import type { EntityDescriptor } from "../support/EntityDescriptor.js";
import {
  buildDescriptor,
  col,
  virtualCol,
} from "../support/descriptorHelpers.js";

const ESTADO_AI = ["A", "I"] as const;

export const SOLICITUD_ESTADOS = [
  "PENDIENTE_JEFE",
  "PENDIENTE_GERENTE",
  "EN_COTIZACION",
  "ORDEN_GENERADA",
  "RECHAZADA",
] as const;

export const RFQ_ESTADOS = ["ABIERTO", "CERRADO", "CANCELADO"] as const;

export const ORDEN_COMPRA_ESTADOS = [
  "EMITIDA",
  "ENVIADA",
  "EN_TRANSITO",
  "RECIBIDA_PARCIAL",
  "RECIBIDA_COMPLETA",
  "CANCELADA",
  "RECHAZADA",
] as const;

export const RECEPCION_ESTADOS = ["RECIBIDO", "ALIMENTADO_CXP"] as const;

// ===========================================================================
// Catalogos / maestros
// ===========================================================================

export const COM_MONEDA: EntityDescriptor = buildDescriptor({
  key: "moneda",
  table: "COM_MONEDA",
  pk: "ID_MONEDA",
  business: [
    col("CODIGO", "codigo", "string"),
    col("NOMBRE", "nombre", "string"),
    col("SIMBOLO", "simbolo", "string", { nullable: true }),
    col("ACTIVA", "activa", "boolLike", { nullable: true }),
  ],
  defaultSort: "codigo",
  filterable: ["codigo", "nombre", "activa"],
  sortable: ["codigo", "nombre"],
});

export const COM_CATEGORIA_COMPRA: EntityDescriptor = buildDescriptor({
  key: "categoriaCompra",
  table: "COM_CATEGORIA_COMPRA",
  pk: "ID_CATEGORIA_COMPRA",
  business: [
    col("NOMBRE", "nombre", "string"),
    col("DESCRIPCION", "descripcion", "string", { nullable: true }),
    col("ESTADO", "estado", "enum", { nullable: true, enumValues: ESTADO_AI }),
  ],
  defaultSort: "nombre",
  filterable: ["nombre", "estado"],
  sortable: ["nombre", "estado"],
});

export const COM_GRUPO_COMPRA: EntityDescriptor = buildDescriptor({
  key: "grupoCompra",
  table: "COM_GRUPO_COMPRA",
  pk: "ID_GRUPO_COMPRA",
  business: [
    col("ID_CATEGORIA_COMPRA", "idCategoriaCompra", "number"),
    col("NOMBRE", "nombre", "string"),
    col("DESCRIPCION", "descripcion", "string", { nullable: true }),
  ],
  defaultSort: "nombre",
  filterable: ["nombre", "idCategoriaCompra"],
  sortable: ["nombre"],
});

export const COM_CONDICION_PAGO: EntityDescriptor = buildDescriptor({
  key: "condicionPago",
  table: "COM_CONDICION_PAGO",
  pk: "ID_CONDICION_PAGO",
  business: [
    col("NOMBRE", "nombre", "string"),
    col("DIAS", "dias", "number"),
  ],
  defaultSort: "nombre",
  filterable: ["nombre", "dias"],
  sortable: ["nombre", "dias"],
});

export const COM_TERMINO_ENTREGA: EntityDescriptor = buildDescriptor({
  key: "terminoEntrega",
  table: "COM_TERMINO_ENTREGA",
  pk: "ID_TERMINO_ENTREGA",
  business: [
    col("NOMBRE", "nombre", "string"),
    col("DIAS_ESTIMADOS", "diasEstimados", "number"),
  ],
  defaultSort: "nombre",
  filterable: ["nombre", "diasEstimados"],
  sortable: ["nombre", "diasEstimados"],
});

export const COM_CENTRO_COSTO: EntityDescriptor = buildDescriptor({
  key: "centroCosto",
  table: "COM_CENTRO_COSTO",
  pk: "ID_CENTRO_COSTO",
  business: [
    col("CODIGO", "codigo", "string"),
    col("NOMBRE", "nombre", "string"),
    col("ID_DEPARTAMENTO", "idDepartamento", "number", { nullable: true }),
    col("ESTADO", "estado", "enum", { nullable: true, enumValues: ESTADO_AI }),
  ],
  defaultSort: "codigo",
  filterable: ["codigo", "nombre", "estado", "idDepartamento"],
  sortable: ["codigo", "nombre"],
});

export const COM_PROVEEDOR: EntityDescriptor = buildDescriptor({
  key: "proveedor",
  table: "COM_PROVEEDOR",
  pk: "ID_PROVEEDOR",
  business: [
    col("NIT", "nit", "string"),
    col("RAZON_SOCIAL", "razonSocial", "string"),
    col("NOMBRE_COMERCIAL", "nombreComercial", "string", { nullable: true }),
    col("DIRECCION", "direccion", "string", { nullable: true }),
    col("TELEFONO", "telefono", "string", { nullable: true }),
    col("EMAIL", "email", "string", { nullable: true }),
    col("DIAS_CREDITO", "diasCredito", "number", { nullable: true }),
    col("CALIFICACION", "calificacion", "string", { nullable: true }),
    col("CUENTA_BANCARIA", "cuentaBancaria", "string", { nullable: true }),
    col("BANCO", "banco", "string", { nullable: true }),
    col("ESTADO", "estado", "enum", { nullable: true, enumValues: ESTADO_AI }),
  ],
  defaultSort: "razonSocial",
  filterable: ["nit", "razonSocial", "nombreComercial", "estado", "email"],
  sortable: ["nit", "razonSocial", "diasCredito"],
});

export const COM_ARTICULO_PROVEEDOR: EntityDescriptor = buildDescriptor({
  key: "articuloProveedor",
  table: "COM_ARTICULO_PROVEEDOR",
  pk: "ID_ARTICULO_PROVEEDOR",
  business: [
    col("ID_ARTICULO", "idArticulo", "number"),
    col("ID_PROVEEDOR", "idProveedor", "number"),
    col("PRECIO_ULTIMA_COMPRA", "precioUltimaCompra", "number", { nullable: true }),
    col("FECHA_ULTIMA_COMPRA", "fechaUltimaCompra", "date", { nullable: true }),
  ],
  defaultSort: "idArticuloProveedor",
  filterable: ["idArticulo", "idProveedor"],
  sortable: ["idArticuloProveedor", "fechaUltimaCompra"],
  search: {
    refs: [
      { own: "ID_PROVEEDOR", table: "COM_PROVEEDOR", key: "ID_PROVEEDOR", columns: ["RAZON_SOCIAL", "NOMBRE_COMERCIAL", "NIT"] },
      { own: "ID_ARTICULO", table: "INV_ARTICULO", key: "ID_ARTICULO", columns: ["NOMBRE", "CODIGO"] },
    ],
  },
});

// ===========================================================================
// Solicitud de compra + workflow de aprobacion
// ===========================================================================

export const COM_SOLICITUD_COMPRA: EntityDescriptor = buildDescriptor({
  key: "solicitudCompra",
  table: "COM_SOLICITUD_COMPRA",
  pk: "ID_SOLICITUD",
  withVersion: true,
  audit: "full",
  business: [
    col("ID_EMPLEADO_SOLICITANTE", "idEmpleadoSolicitante", "number"),
    col("ID_SUCURSAL", "idSucursal", "number"),
    col("ID_GRUPO_COMPRA", "idGrupoCompra", "number"),
    col("ID_TERMINO_ENTREGA", "idTerminoEntrega", "number"),
    col("ID_CENTRO_COSTO", "idCentroCosto", "number", { nullable: true }),
    col("ESTADO", "estado", "enum", { enumValues: SOLICITUD_ESTADOS }),
    col("JUSTIFICACION", "justificacion", "string"),
    col("PRIORIDAD", "prioridad", "number"),
    col("MONTO_ESTIMADO", "montoEstimado", "number", { nullable: true }),
  ],
  defaultSort: "idSolicitud",
  filterable: [
    "estado",
    "idEmpleadoSolicitante",
    "idSucursal",
    "idGrupoCompra",
    "prioridad",
  ],
  sortable: ["idSolicitud", "estado", "prioridad", "montoEstimado", "fechaCreacion"],
  detail: { entityKey: "solicitudDetalle", fk: "ID_SOLICITUD" },
  search: {
    refs: [
      { own: "ID_EMPLEADO_SOLICITANTE", table: "NOM_EMPLEADO", key: "ID_EMPLEADO", columns: ["NOMBRES || ' ' || APELLIDOS", "CODIGO_EMPLEADO"] },
      { own: "ID_SUCURSAL", table: "NOM_SUCURSAL", key: "ID_SUCURSAL", columns: ["NOMBRE", "CODIGO"] },
      { own: "ID_GRUPO_COMPRA", table: "COM_GRUPO_COMPRA", key: "ID_GRUPO_COMPRA", columns: ["NOMBRE"] },
      { own: "ID_CENTRO_COSTO", table: "COM_CENTRO_COSTO", key: "ID_CENTRO_COSTO", columns: ["NOMBRE", "CODIGO"] },
      // Por lo que se pide: "martillo" encuentra las solicitudes que lo incluyen.
      { own: "ID_SOLICITUD", table: "COM_SOLICITUD_DETALLE", key: "ID_SOLICITUD", columns: ["DESCRIPCION"] },
    ],
  },
});

export const COM_SOLICITUD_DETALLE: EntityDescriptor = buildDescriptor({
  key: "solicitudDetalle",
  table: "COM_SOLICITUD_DETALLE",
  pk: "ID_SOLICITUD_DETALLE",
  withVersion: true,
  business: [
    col("ID_SOLICITUD", "idSolicitud", "number"),
    col("ID_ARTICULO", "idArticulo", "number", { nullable: true }),
    col("DESCRIPCION", "descripcion", "string"),
    col("CANTIDAD_SOLICITADA", "cantidadSolicitada", "number"),
    col("CANTIDAD_AUTORIZADA", "cantidadAutorizada", "number", { nullable: true }),
    col("ID_UNIDAD_MEDIDA", "idUnidadMedida", "number"),
    col("FECHA_REQUERIDA", "fechaRequerida", "date"),
  ],
  defaultSort: "idSolicitudDetalle",
  recientesPrimero: false,
  filterable: ["idSolicitud", "idArticulo"],
  sortable: ["idSolicitudDetalle", "fechaRequerida"],
});

export const COM_WORKFLOW_APROBACION: EntityDescriptor = buildDescriptor({
  key: "workflowAprobacion",
  table: "COM_WORKFLOW_APROBACION",
  pk: "ID_WORKFLOW_APROBACION",
  business: [
    col("ID_SOLICITUD", "idSolicitud", "number"),
    col("NIVEL_JERARQUICO", "nivelJerarquico", "number"),
    col("ID_EMPLEADO_REALIZA", "idEmpleadoRealiza", "number"),
    col("ESTADO_ANTERIOR", "estadoAnterior", "string", { nullable: true }),
    col("ESTADO_NUEVO", "estadoNuevo", "string"),
    col("COMENTARIO", "comentario", "string", { nullable: true }),
    col("FECHA", "fecha", "timestamp", { insertable: false, updatable: false }),
  ],
  defaultSort: "idWorkflowAprobacion",
  filterable: ["idSolicitud", "idEmpleadoRealiza", "estadoNuevo"],
  sortable: ["idWorkflowAprobacion", "fecha"],
});

// ===========================================================================
// Acuerdos marco
// ===========================================================================

export const COM_ACUERDO_PROVEEDOR: EntityDescriptor = buildDescriptor({
  key: "acuerdoProveedor",
  table: "COM_ACUERDO_PROVEEDOR",
  pk: "ID_ACUERDO",
  business: [
    col("ID_PROVEEDOR", "idProveedor", "number"),
    col("ID_ARTICULO", "idArticulo", "number"),
    col("PRECIO_FIJO", "precioFijo", "number", { nullable: true }),
    col("FECHA_INICIO", "fechaInicio", "timestamp"),
    col("FECHA_FIN", "fechaFin", "timestamp"),
    col("ACTIVO", "activo", "boolLike", { nullable: true }),
  ],
  defaultSort: "idAcuerdo",
  filterable: ["idProveedor", "idArticulo", "activo"],
  sortable: ["idAcuerdo", "fechaInicio", "fechaFin"],
  search: {
    refs: [
      { own: "ID_PROVEEDOR", table: "COM_PROVEEDOR", key: "ID_PROVEEDOR", columns: ["RAZON_SOCIAL", "NOMBRE_COMERCIAL", "NIT"] },
      { own: "ID_ARTICULO", table: "INV_ARTICULO", key: "ID_ARTICULO", columns: ["NOMBRE", "CODIGO"] },
    ],
  },
  detail: { entityKey: "acuerdoDetalle", fk: "ID_ACUERDO" },
});

export const COM_ACUERDO_DETALLE: EntityDescriptor = buildDescriptor({
  key: "acuerdoDetalle",
  table: "COM_ACUERDO_DETALLE",
  pk: "ID_ACUERDO_DETALLE",
  business: [
    col("ID_ACUERDO", "idAcuerdo", "number"),
    col("CANTIDAD_MINIMA", "cantidadMinima", "number"),
    col("PORCENTAJE_DESCUENTO", "porcentajeDescuento", "number"),
  ],
  defaultSort: "cantidadMinima",
  recientesPrimero: false,
  filterable: ["idAcuerdo"],
  sortable: ["cantidadMinima", "porcentajeDescuento"],
});

// ===========================================================================
// RFQ + cotizaciones
// ===========================================================================

export const COM_RFQ_CABECERA: EntityDescriptor = buildDescriptor({
  key: "rfqCabecera",
  table: "COM_RFQ_CABECERA",
  pk: "ID_RFQ",
  business: [
    col("ID_SOLICITUD", "idSolicitud", "number"),
    col("FECHA_EMISION", "fechaEmision", "timestamp", { insertable: false, updatable: false }),
    col("FECHA_LIMITE", "fechaLimite", "date"),
    col("ESTADO", "estado", "enum", { enumValues: RFQ_ESTADOS }),
  ],
  defaultSort: "idRfq",
  filterable: ["idSolicitud", "estado"],
  sortable: ["idRfq", "fechaLimite", "fechaEmision", "estado"],
  detail: { entityKey: "rfqProveedor", fk: "ID_RFQ" },
  search: {
    idColumns: ["idSolicitud"],
    refs: [
      // Proveedores invitados al RFQ.
      { own: "ID_RFQ", table: "COM_RFQ_PROVEEDOR", key: "ID_RFQ", via: { own: "ID_PROVEEDOR", table: "COM_PROVEEDOR", key: "ID_PROVEEDOR", columns: ["RAZON_SOCIAL", "NOMBRE_COMERCIAL", "NIT"] } },
    ],
  },
});

export const COM_RFQ_PROVEEDOR: EntityDescriptor = buildDescriptor({
  key: "rfqProveedor",
  table: "COM_RFQ_PROVEEDOR",
  pk: "ID_RFQ_PROVEEDOR",
  business: [
    col("ID_RFQ", "idRfq", "number"),
    col("ID_PROVEEDOR", "idProveedor", "number"),
    col("FECHA_INVITACION", "fechaInvitacion", "timestamp", { insertable: false, updatable: false }),
  ],
  defaultSort: "idRfqProveedor",
  recientesPrimero: false,
  filterable: ["idRfq", "idProveedor"],
  sortable: ["idRfqProveedor"],
});

export const COM_COTIZACION_PROVEEDOR: EntityDescriptor = buildDescriptor({
  key: "cotizacionProveedor",
  table: "COM_COTIZACION_PROVEEDOR",
  pk: "ID_COTIZACION",
  business: [
    col("ID_RFQ", "idRfq", "number"),
    col("ID_PROVEEDOR", "idProveedor", "number"),
    col("ID_CONDICION_PAGO", "idCondicionPago", "number"),
    col("ID_MONEDA", "idMoneda", "number"),
    col("TASA_CAMBIO", "tasaCambio", "number"),
    col("FECHA_COTIZACION", "fechaCotizacion", "timestamp", { insertable: false, updatable: false }),
    col("FECHA_VENCIMIENTO", "fechaVencimiento", "timestamp"),
  ],
  defaultSort: "idCotizacion",
  filterable: ["idRfq", "idProveedor", "idMoneda"],
  sortable: ["idCotizacion", "fechaVencimiento", "fechaCotizacion"],
  detail: { entityKey: "cotizacionDetalle", fk: "ID_COTIZACION" },
  search: {
    idColumns: ["idRfq"],
    refs: [
      { own: "ID_PROVEEDOR", table: "COM_PROVEEDOR", key: "ID_PROVEEDOR", columns: ["RAZON_SOCIAL", "NOMBRE_COMERCIAL", "NIT"] },
      { own: "ID_MONEDA", table: "COM_MONEDA", key: "ID_MONEDA", columns: ["CODIGO", "NOMBRE"] },
      { own: "ID_CONDICION_PAGO", table: "COM_CONDICION_PAGO", key: "ID_CONDICION_PAGO", columns: ["NOMBRE"] },
    ],
  },
});

export const COM_COTIZACION_DETALLE: EntityDescriptor = buildDescriptor({
  key: "cotizacionDetalle",
  table: "COM_COTIZACION_DETALLE",
  pk: "ID_COTIZACION_DETALLE",
  withVersion: true,
  business: [
    col("ID_COTIZACION", "idCotizacion", "number"),
    col("ID_SOLICITUD_DETALLE", "idSolicitudDetalle", "number"),
    col("PRECIO_UNITARIO", "precioUnitario", "number"),
    col("CANTIDAD", "cantidad", "number"),
    col("ID_UNIDAD_MEDIDA", "idUnidadMedida", "number"),
    col("PORCENTAJE_DESCUENTO", "porcentajeDescuento", "number"),
    col("PORCENTAJE_IMPUESTO", "porcentajeImpuesto", "number"),
    col("ADJUDICADO", "adjudicado", "boolLike"),
  ],
  defaultSort: "idCotizacionDetalle",
  recientesPrimero: false,
  filterable: ["idCotizacion", "idSolicitudDetalle", "adjudicado"],
  sortable: ["idCotizacionDetalle", "precioUnitario"],
});

export const COM_COMPARATIVO_COTIZACIONES: EntityDescriptor = buildDescriptor({
  key: "comparativoCotizaciones",
  table: "COM_COMPARATIVO_COTIZACIONES",
  pk: "ID_COMPARATIVO",
  business: [
    col("ID_SOLICITUD", "idSolicitud", "number"),
    col("ID_COTIZACION_DETALLE", "idCotizacionDetalle", "number"),
    col("CRITERIO", "criterio", "string"),
    col("PUNTUACION", "puntuacion", "number", { nullable: true }),
    col("NOTAS", "notas", "string", { nullable: true }),
  ],
  defaultSort: "idComparativo",
  filterable: ["idSolicitud", "idCotizacionDetalle", "criterio"],
  sortable: ["idComparativo", "puntuacion"],
});

// ===========================================================================
// Orden de compra + seguimiento + excepciones
// ===========================================================================

export const COM_ORDEN_COMPRA: EntityDescriptor = buildDescriptor({
  key: "ordenCompra",
  table: "COM_ORDEN_COMPRA",
  pk: "ID_ORDEN_COMPRA",
  withVersion: true,
  audit: "createOnly",
  business: [
    col("ID_PROVEEDOR", "idProveedor", "number"),
    col("ID_EMPLEADO_GERENTE_FINANCIERO", "idEmpleadoGerenteFinanciero", "number"),
    col("ID_MONEDA", "idMoneda", "number"),
    col("TASA_CAMBIO", "tasaCambio", "number"),
    col("ESTADO", "estado", "enum", { enumValues: ORDEN_COMPRA_ESTADOS }),
    col("NUMERO_REFERENCIA", "numeroReferencia", "string", { nullable: true }),
    col("FECHA_EMISION", "fechaEmision", "timestamp", { insertable: false, updatable: false }),
    col("FECHA_ENTREGA_ESPERADA", "fechaEntregaEsperada", "timestamp"),
  ],
  defaultSort: "idOrdenCompra",
  filterable: ["estado", "idProveedor", "idMoneda", "numeroReferencia"],
  sortable: ["idOrdenCompra", "estado", "fechaEmision", "fechaEntregaEsperada"],
  detail: { entityKey: "ordenCompraDetalle", fk: "ID_ORDEN_COMPRA" },
  search: {
    refs: [
      { own: "ID_PROVEEDOR", table: "COM_PROVEEDOR", key: "ID_PROVEEDOR", columns: ["RAZON_SOCIAL", "NOMBRE_COMERCIAL", "NIT"] },
      { own: "ID_MONEDA", table: "COM_MONEDA", key: "ID_MONEDA", columns: ["CODIGO", "NOMBRE"] },
      { own: "ID_ORDEN_COMPRA", table: "COM_ORDEN_COMPRA_DETALLE", key: "ID_ORDEN_COMPRA", columns: ["DESCRIPCION"] },
    ],
  },
});

export const COM_ORDEN_COMPRA_DETALLE: EntityDescriptor = buildDescriptor({
  key: "ordenCompraDetalle",
  table: "COM_ORDEN_COMPRA_DETALLE",
  pk: "ID_OC_DETALLE",
  withVersion: true,
  business: [
    col("ID_ORDEN_COMPRA", "idOrdenCompra", "number"),
    col("ID_COTIZACION_DETALLE", "idCotizacionDetalle", "number", { nullable: true }),
    col("ID_ARTICULO", "idArticulo", "number", { nullable: true }),
    col("DESCRIPCION", "descripcion", "string"),
    col("CANTIDAD", "cantidad", "number"),
    col("ID_UNIDAD_MEDIDA", "idUnidadMedida", "number"),
    col("PRECIO_UNITARIO", "precioUnitario", "number"),
    col("PORCENTAJE_DESCUENTO", "porcentajeDescuento", "number"),
    col("PORCENTAJE_IMPUESTO", "porcentajeImpuesto", "number"),
    col("TOLERANCIA_PORCENTAJE", "toleranciaPorcentaje", "number"),
    // Columna VIRTUAL de Oracle: solo lectura, jamas en INSERT/UPDATE.
    virtualCol("SUBTOTAL_CALCULADO", "subtotalCalculado", "number"),
  ],
  defaultSort: "idOcDetalle",
  recientesPrimero: false,
  filterable: ["idOrdenCompra", "idArticulo", "idCotizacionDetalle"],
  sortable: ["idOcDetalle", "precioUnitario", "cantidad"],
});

export const COM_SEGUIMIENTO_ORDEN: EntityDescriptor = buildDescriptor({
  key: "seguimientoOrden",
  table: "COM_SEGUIMIENTO_ORDEN",
  pk: "ID_SEGUIMIENTO",
  business: [
    col("ID_ORDEN_COMPRA", "idOrdenCompra", "number"),
    col("FECHA_CONTACTO", "fechaContacto", "timestamp", { insertable: false, updatable: false }),
    col("ESTADO_REPORTE", "estadoReporte", "string", { nullable: true }),
    col("NOTAS", "notas", "string", { nullable: true }),
  ],
  defaultSort: "idSeguimiento",
  filterable: ["idOrdenCompra"],
  sortable: ["idSeguimiento", "fechaContacto"],
});

export const COM_EXCEPCION_ORDEN: EntityDescriptor = buildDescriptor({
  key: "excepcionOrden",
  table: "COM_EXCEPCION_ORDEN",
  pk: "ID_EXCEPCION",
  business: [
    col("ID_ORDEN_COMPRA", "idOrdenCompra", "number"),
    col("TIPO", "tipo", "string"),
    col("DESCRIPCION", "descripcion", "string"),
    col("ID_EMPLEADO_REPORTA", "idEmpleadoReporta", "number"),
    col("FECHA_REPORTE", "fechaReporte", "timestamp", { insertable: false, updatable: false }),
    col("RESUELTA", "resuelta", "boolLike"),
    col("FECHA_RESOLUCION", "fechaResolucion", "timestamp", { nullable: true }),
  ],
  defaultSort: "idExcepcion",
  filterable: ["idOrdenCompra", "tipo", "resuelta", "idEmpleadoReporta"],
  sortable: ["idExcepcion", "fechaReporte"],
});

// ===========================================================================
// Recepcion + devoluciones
// ===========================================================================

export const COM_RECEPCION: EntityDescriptor = buildDescriptor({
  key: "recepcion",
  table: "COM_RECEPCION",
  pk: "ID_RECEPCION",
  business: [
    col("ID_ORDEN_COMPRA", "idOrdenCompra", "number"),
    col("ID_BODEGA", "idBodega", "number"),
    col("FECHA_RECEPCION", "fechaRecepcion", "timestamp", { insertable: false, updatable: false }),
    col("ID_EMPLEADO_RECIBE", "idEmpleadoRecibe", "number"),
    // FK circular con CXP_FACTURA_PROVEEDOR: nullable, se completa en 2 pasos.
    col("ID_FACTURA_PROVEEDOR", "idFacturaProveedor", "number", { nullable: true }),
    col("ESTADO", "estado", "enum", { nullable: true, enumValues: RECEPCION_ESTADOS }),
  ],
  defaultSort: "idRecepcion",
  filterable: ["idOrdenCompra", "idBodega", "estado", "idEmpleadoRecibe"],
  sortable: ["idRecepcion", "fechaRecepcion", "estado"],
  detail: { entityKey: "recepcionDetalle", fk: "ID_RECEPCION" },
  search: {
    idColumns: ["idOrdenCompra"],
    refs: [
      // Proveedor de la orden recibida.
      { own: "ID_ORDEN_COMPRA", table: "COM_ORDEN_COMPRA", key: "ID_ORDEN_COMPRA", via: { own: "ID_PROVEEDOR", table: "COM_PROVEEDOR", key: "ID_PROVEEDOR", columns: ["RAZON_SOCIAL", "NOMBRE_COMERCIAL", "NIT"] } },
      { own: "ID_BODEGA", table: "INV_BODEGA", key: "ID_BODEGA", columns: ["NOMBRE"] },
      { own: "ID_EMPLEADO_RECIBE", table: "NOM_EMPLEADO", key: "ID_EMPLEADO", columns: ["NOMBRES || ' ' || APELLIDOS", "CODIGO_EMPLEADO"] },
    ],
  },
});

export const COM_RECEPCION_DETALLE: EntityDescriptor = buildDescriptor({
  key: "recepcionDetalle",
  table: "COM_RECEPCION_DETALLE",
  pk: "ID_RECEPCION_DETALLE",
  withVersion: true,
  business: [
    col("ID_RECEPCION", "idRecepcion", "number"),
    col("ID_OC_DETALLE", "idOcDetalle", "number"),
    col("CANTIDAD_RECIBIDA", "cantidadRecibida", "number"),
    col("CANTIDAD_RECHAZADA", "cantidadRechazada", "number"),
  ],
  defaultSort: "idRecepcionDetalle",
  recientesPrimero: false,
  filterable: ["idRecepcion", "idOcDetalle"],
  sortable: ["idRecepcionDetalle"],
});

export const COM_DEVOLUCION_PROVEEDOR: EntityDescriptor = buildDescriptor({
  key: "devolucionProveedor",
  table: "COM_DEVOLUCION_PROVEEDOR",
  pk: "ID_DEVOLUCION",
  business: [
    col("ID_RECEPCION", "idRecepcion", "number"),
    col("FECHA_DEVOLUCION", "fechaDevolucion", "timestamp", { insertable: false, updatable: false }),
    col("MOTIVO", "motivo", "string"),
    col("ID_EMPLEADO_SOLICITA", "idEmpleadoSolicita", "number"),
  ],
  defaultSort: "idDevolucion",
  filterable: ["idRecepcion", "idEmpleadoSolicita"],
  sortable: ["idDevolucion", "fechaDevolucion"],
  detail: { entityKey: "devolucionDetalle", fk: "ID_DEVOLUCION" },
  search: {
    idColumns: ["idRecepcion"],
    refs: [
      { own: "ID_EMPLEADO_SOLICITA", table: "NOM_EMPLEADO", key: "ID_EMPLEADO", columns: ["NOMBRES || ' ' || APELLIDOS", "CODIGO_EMPLEADO"] },
      // Proveedor de la orden de la recepcion devuelta.
      { own: "ID_RECEPCION", table: "COM_RECEPCION", key: "ID_RECEPCION", via: { own: "ID_ORDEN_COMPRA", table: "COM_ORDEN_COMPRA", key: "ID_ORDEN_COMPRA", via: { own: "ID_PROVEEDOR", table: "COM_PROVEEDOR", key: "ID_PROVEEDOR", columns: ["RAZON_SOCIAL", "NOMBRE_COMERCIAL", "NIT"] } } },
    ],
  },
});

export const COM_DEVOLUCION_DETALLE: EntityDescriptor = buildDescriptor({
  key: "devolucionDetalle",
  table: "COM_DEVOLUCION_DETALLE",
  pk: "ID_DEVOLUCION_DETALLE",
  business: [
    col("ID_DEVOLUCION", "idDevolucion", "number"),
    col("ID_RECEPCION_DETALLE", "idRecepcionDetalle", "number"),
    col("CANTIDAD_DEVUELTA", "cantidadDevuelta", "number"),
  ],
  defaultSort: "idDevolucionDetalle",
  recientesPrimero: false,
  filterable: ["idDevolucion", "idRecepcionDetalle"],
  sortable: ["idDevolucionDetalle"],
});

// ===========================================================================
// Registro central: clave logica -> descriptor
// ===========================================================================

export const COM_DESCRIPTORS = {
  moneda: COM_MONEDA,
  categoriaCompra: COM_CATEGORIA_COMPRA,
  grupoCompra: COM_GRUPO_COMPRA,
  condicionPago: COM_CONDICION_PAGO,
  terminoEntrega: COM_TERMINO_ENTREGA,
  centroCosto: COM_CENTRO_COSTO,
  proveedor: COM_PROVEEDOR,
  articuloProveedor: COM_ARTICULO_PROVEEDOR,
  solicitudCompra: COM_SOLICITUD_COMPRA,
  solicitudDetalle: COM_SOLICITUD_DETALLE,
  workflowAprobacion: COM_WORKFLOW_APROBACION,
  acuerdoProveedor: COM_ACUERDO_PROVEEDOR,
  acuerdoDetalle: COM_ACUERDO_DETALLE,
  rfqCabecera: COM_RFQ_CABECERA,
  rfqProveedor: COM_RFQ_PROVEEDOR,
  cotizacionProveedor: COM_COTIZACION_PROVEEDOR,
  cotizacionDetalle: COM_COTIZACION_DETALLE,
  comparativoCotizaciones: COM_COMPARATIVO_COTIZACIONES,
  ordenCompra: COM_ORDEN_COMPRA,
  ordenCompraDetalle: COM_ORDEN_COMPRA_DETALLE,
  seguimientoOrden: COM_SEGUIMIENTO_ORDEN,
  excepcionOrden: COM_EXCEPCION_ORDEN,
  recepcion: COM_RECEPCION,
  recepcionDetalle: COM_RECEPCION_DETALLE,
  devolucionProveedor: COM_DEVOLUCION_PROVEEDOR,
  devolucionDetalle: COM_DEVOLUCION_DETALLE,
} as const satisfies Record<string, EntityDescriptor>;

export type ComEntityKey = keyof typeof COM_DESCRIPTORS;

export function getDescriptor(key: ComEntityKey): EntityDescriptor {
  return COM_DESCRIPTORS[key];
}

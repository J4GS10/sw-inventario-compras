/**
 * Capa 5 - Entidades (transversal).
 * Descriptores MINIMOS de tablas de otros modulos (INV_, CXP_) que el modulo de
 * Compras toca a traves de eventos de dominio. Cuando esos modulos se
 * implementen, estos descriptores se moveran alli y se importaran.
 * Fuente: database/ddl/SCRIPT_DDL.sql.
 */

import type { EntityDescriptor } from "../support/EntityDescriptor.js";
import { buildDescriptor, col } from "../support/descriptorHelpers.js";

export const INV_KARDEX_MOVIMIENTO: EntityDescriptor = buildDescriptor({
  key: "kardexMovimiento",
  table: "INV_KARDEX_MOVIMIENTO",
  pk: "ID_MOVIMIENTO",
  business: [
    col("ID_ARTICULO", "idArticulo", "number"),
    col("ID_BODEGA", "idBodega", "number"),
    col("FECHA_MOVIMIENTO", "fechaMovimiento", "timestamp"),
    col("TIPO_MOVIMIENTO", "tipoMovimiento", "enum", {
      enumValues: [
        "ENTRADA_COMPRA",
        "SALIDA_VENTA",
        "TRASLADO_ENTRADA",
        "TRASLADO_SALIDA",
        "SALIDA_REQUISICION",
        "AJUSTE_POSITIVO",
        "AJUSTE_NEGATIVO",
      ],
    }),
    col("TIPO_DOCUMENTO_REF", "tipoDocumentoRef", "string", { nullable: true }),
    col("ID_DOCUMENTO_REF", "idDocumentoRef", "number", { nullable: true }),
    col("CANTIDAD", "cantidad", "number"),
    col("COSTO_UNITARIO", "costoUnitario", "number"),
    col("SALDO_CANTIDAD", "saldoCantidad", "number"),
    col("SALDO_COSTO_PROMEDIO", "saldoCostoPromedio", "number"),
    col("ID_EMPLEADO_REGISTRO", "idEmpleadoRegistro", "number", { nullable: true }),
  ],
  defaultSort: "idMovimiento",
  filterable: ["idArticulo", "idBodega", "tipoMovimiento", "idDocumentoRef"],
  sortable: ["idMovimiento", "fechaMovimiento"],
});

export const INV_EXISTENCIA_BODEGA: EntityDescriptor = buildDescriptor({
  key: "existenciaBodega",
  table: "INV_EXISTENCIA_BODEGA",
  pk: "ID_EXISTENCIA",
  business: [
    col("ID_BODEGA", "idBodega", "number"),
    col("ID_ARTICULO", "idArticulo", "number"),
    col("CANTIDAD_ACTUAL", "cantidadActual", "number", { nullable: true }),
    col("COSTO_PROMEDIO_ACTUAL", "costoPromedioActual", "number", { nullable: true }),
  ],
  defaultSort: "idExistencia",
  filterable: ["idBodega", "idArticulo"],
  sortable: ["idExistencia"],
});

export const INV_ARTICULO: EntityDescriptor = buildDescriptor({
  key: "articulo",
  table: "INV_ARTICULO",
  pk: "ID_ARTICULO",
  business: [
    col("CODIGO", "codigo", "string"),
    col("NOMBRE", "nombre", "string"),
    col("ID_CATEGORIA", "idCategoria", "number", { nullable: true }),
    col("ID_UNIDAD_MEDIDA", "idUnidadMedida", "number"),
    col("TIPO_ARTICULO", "tipoArticulo", "string"),
    col("METODO_COSTEO", "metodoCosteo", "string", { nullable: true }),
    col("COSTO_PROMEDIO", "costoPromedio", "number", { nullable: true }),
    col("PRECIO_VENTA", "precioVenta", "number", { nullable: true }),
    // Umbrales de reposicion: INV_ALERTA_ESCASEZ/escasezSubscriber los leen
    // para decidir cuando avisar y cuanto sugerir reponer.
    col("STOCK_MINIMO", "stockMinimo", "number", { nullable: true }),
    col("STOCK_MAXIMO", "stockMaximo", "number", { nullable: true }),
    col("ESTADO", "estado", "enum", { nullable: true, enumValues: ["A", "I"] }),
  ],
  defaultSort: "codigo",
  filterable: ["codigo", "nombre", "idCategoria", "estado"],
  sortable: ["codigo", "nombre"],
});

/**
 * INV_ALERTA_ESCASEZ: escasez proactiva cuando la existencia cae bajo
 * STOCK_MINIMO. La crea/cierra escasezSubscriber (Observer sobre
 * ExistenciaActualizada); nadie mas escribe esta tabla.
 */
export const INV_ALERTA_ESCASEZ: EntityDescriptor = buildDescriptor({
  key: "alertaEscasez",
  table: "INV_ALERTA_ESCASEZ",
  pk: "ID_ALERTA",
  business: [
    col("ID_ARTICULO", "idArticulo", "number"),
    col("ID_BODEGA", "idBodega", "number"),
    col("FECHA_DETECCION", "fechaDeteccion", "date"),
    col("CANTIDAD_ACTUAL", "cantidadActual", "number"),
    col("STOCK_MINIMO", "stockMinimo", "number"),
    col("ID_SOLICITUD_GENERADA", "idSolicitudGenerada", "number", { nullable: true }),
    col("ESTADO", "estado", "enum", {
      nullable: true,
      enumValues: ["PENDIENTE", "ATENDIDA", "DESCARTADA"],
    }),
  ],
  defaultSort: "idAlerta",
  filterable: ["idArticulo", "idBodega", "estado"],
  sortable: ["idAlerta", "fechaDeteccion"],
});

export const NOM_EMPLEADO: EntityDescriptor = buildDescriptor({
  key: "empleado",
  table: "NOM_EMPLEADO",
  pk: "ID_EMPLEADO",
  business: [
    col("CODIGO_EMPLEADO", "codigoEmpleado", "string"),
    col("NOMBRES", "nombres", "string"),
    col("APELLIDOS", "apellidos", "string"),
    col("ID_SUCURSAL", "idSucursal", "number"),
    col("ID_DEPARTAMENTO", "idDepartamento", "number", { nullable: true }),
    col("ESTADO", "estado", "enum", { nullable: true, enumValues: ["A", "I"] }),
  ],
  defaultSort: "apellidos",
  filterable: ["codigoEmpleado", "nombres", "apellidos", "idSucursal", "estado"],
  sortable: ["apellidos", "codigoEmpleado"],
});

export const NOM_SUCURSAL: EntityDescriptor = buildDescriptor({
  key: "sucursal",
  table: "NOM_SUCURSAL",
  pk: "ID_SUCURSAL",
  business: [
    col("CODIGO", "codigo", "string"),
    col("NOMBRE", "nombre", "string"),
    col("TIPO", "tipo", "string", { nullable: true }),
    col("ESTADO", "estado", "enum", { nullable: true, enumValues: ["A", "I"] }),
  ],
  defaultSort: "nombre",
  filterable: ["codigo", "nombre", "estado"],
  sortable: ["codigo", "nombre"],
});

export const NOM_DEPARTAMENTO: EntityDescriptor = buildDescriptor({
  key: "departamento",
  table: "NOM_DEPARTAMENTO",
  pk: "ID_DEPARTAMENTO",
  business: [col("NOMBRE", "nombre", "string")],
  defaultSort: "nombre",
  filterable: ["nombre"],
  sortable: ["nombre"],
});

export const INV_CATEGORIA: EntityDescriptor = buildDescriptor({
  key: "categoria",
  table: "INV_CATEGORIA",
  pk: "ID_CATEGORIA",
  business: [col("NOMBRE", "nombre", "string")],
  defaultSort: "nombre",
  filterable: ["nombre"],
  sortable: ["nombre"],
});

export const INV_UNIDAD_MEDIDA: EntityDescriptor = buildDescriptor({
  key: "unidadMedida",
  table: "INV_UNIDAD_MEDIDA",
  pk: "ID_UNIDAD_MEDIDA",
  business: [
    col("CODIGO", "codigo", "string"),
    col("NOMBRE", "nombre", "string"),
    col("ABREVIATURA", "abreviatura", "string", { nullable: true }),
  ],
  defaultSort: "nombre",
  filterable: ["codigo", "nombre"],
  sortable: ["codigo", "nombre"],
});

export const INV_BODEGA: EntityDescriptor = buildDescriptor({
  key: "bodega",
  table: "INV_BODEGA",
  pk: "ID_BODEGA",
  business: [
    col("ID_SUCURSAL", "idSucursal", "number"),
    col("NOMBRE", "nombre", "string"),
    col("TIPO", "tipo", "string"),
    col("ESTADO", "estado", "enum", { nullable: true, enumValues: ["A", "I"] }),
  ],
  defaultSort: "nombre",
  filterable: ["nombre", "idSucursal", "estado", "tipo"],
  sortable: ["nombre"],
});

export const CXP_FACTURA_PROVEEDOR: EntityDescriptor = buildDescriptor({
  key: "facturaProveedor",
  table: "CXP_FACTURA_PROVEEDOR",
  pk: "ID_FACTURA_PROVEEDOR",
  business: [
    col("ID_PROVEEDOR", "idProveedor", "number"),
    col("ID_RECEPCION", "idRecepcion", "number", { nullable: true }),
    col("TIPO_DOCUMENTO", "tipoDocumento", "enum", {
      enumValues: ["FACTURA", "FACTURA_ESPECIAL", "NOTA_CREDITO", "NOTA_DEBITO"],
    }),
    col("NUMERO_DTE", "numeroDte", "string", { nullable: true }),
    col("SERIE_DTE", "serieDte", "string", { nullable: true }),
    col("FECHA_EMISION", "fechaEmision", "date"),
    col("FECHA_DOCUMENTO", "fechaDocumento", "date"),
    col("FECHA_VENCIMIENTO", "fechaVencimiento", "date", { nullable: true }),
    col("MONTO_TOTAL", "montoTotal", "number"),
    col("MONTO_RETENCION_IVA", "montoRetencionIva", "number", { nullable: true }),
    col("MONTO_RETENCION_ISR", "montoRetencionIsr", "number", { nullable: true }),
    col("SALDO_PENDIENTE", "saldoPendiente", "number"),
    col("ESTADO", "estado", "enum", {
      nullable: true,
      enumValues: ["PENDIENTE", "PAGADA_PARCIAL", "PAGADA", "ANULADA"],
    }),
  ],
  defaultSort: "idFacturaProveedor",
  filterable: ["idProveedor", "idRecepcion", "estado", "numeroDte"],
  sortable: ["idFacturaProveedor", "fechaDocumento"],
});

/**
 * CXP_CONTRASENA_PAGO: orden/contrasena de pago que autoriza liquidar una
 * factura de proveedor (CHEQUE/TRANSFERENCIA/EFECTIVO). La crea
 * `LiquidacionService.liquidar`.
 */
export const CXP_CONTRASENA_PAGO: EntityDescriptor = buildDescriptor({
  key: "contrasenaPago",
  table: "CXP_CONTRASENA_PAGO",
  pk: "ID_CONTRASENA",
  business: [
    col("ID_FACTURA_PROVEEDOR", "idFacturaProveedor", "number"),
    col("FECHA", "fecha", "date"),
    col("MONTO", "monto", "number"),
    col("FORMA_PAGO", "formaPago", "enum", {
      enumValues: ["CHEQUE", "TRANSFERENCIA", "EFECTIVO"],
    }),
    col("ESTADO", "estado", "enum", {
      nullable: true,
      enumValues: ["PENDIENTE", "EMITIDA", "PAGADA", "ANULADA"],
    }),
    col("ID_EMPLEADO_AUTORIZA", "idEmpleadoAutoriza", "number", { nullable: true }),
  ],
  defaultSort: "idContrasena",
  filterable: ["idFacturaProveedor", "estado"],
  sortable: ["idContrasena", "fecha"],
});

/**
 * CXP_CHEQUE: instrumento bancario del pago — numero de cheque para
 * FORMA_PAGO='CHEQUE', o el numero/confirmacion de la transferencia para
 * FORMA_PAGO='TRANSFERENCIA' (el DDL no distingue una tabla de referencia
 * ACH aparte; BANCO+NUMERO_CHEQUE ya cubren "banco + numero de referencia"
 * para ambos medios).
 */
export const CXP_CHEQUE: EntityDescriptor = buildDescriptor({
  key: "cheque",
  table: "CXP_CHEQUE",
  pk: "ID_CHEQUE",
  business: [
    col("ID_CONTRASENA_PAGO", "idContrasenaPago", "number"),
    col("BANCO", "banco", "string"),
    col("NUMERO_CHEQUE", "numeroCheque", "string"),
    col("FECHA_EMISION", "fechaEmision", "date"),
    col("FECHA_COBRO", "fechaCobro", "date", { nullable: true }),
    col("ESTADO", "estado", "enum", {
      nullable: true,
      enumValues: ["EMITIDO", "COBRADO", "ANULADO"],
    }),
  ],
  defaultSort: "idCheque",
  filterable: ["idContrasenaPago"],
  sortable: ["idCheque", "fechaEmision"],
});

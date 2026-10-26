/**
 * ARCHIVO GENERADO por scripts/gen-ddl-limits.ts a partir de database/ddl/SCRIPT_DDL.sql.
 * No editar a mano: ejecutar `pnpm --filter backend gen:limits`.
 *
 * l = longitud maxima; p/s = precision y escala NUMBER; min/max = rango CHECK;
 * minExcl = el minimo es exclusivo (CHECK (X > n)).
 */

export interface LimiteDdl {
  readonly l?: number;
  readonly p?: number;
  readonly s?: number;
  readonly min?: number;
  readonly minExcl?: true;
  readonly max?: number;
}

export const DDL_LIMITES: Readonly<Record<string, Readonly<Record<string, LimiteDdl>>>> = {
 "NOM_SUCURSAL": {
  "CODIGO": {
   "l": 10
  },
  "NOMBRE": {
   "l": 100
  },
  "TIPO": {
   "l": 20
  },
  "DIRECCION": {
   "l": 200
  },
  "TELEFONO": {
   "l": 20
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_DEPARTAMENTO": {
  "NOMBRE": {
   "l": 100
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_PUESTO": {
  "NOMBRE": {
   "l": 100
  },
  "ES_VENDEDOR": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_EMPLEADO": {
  "CODIGO_EMPLEADO": {
   "l": 15
  },
  "NOMBRES": {
   "l": 100
  },
  "APELLIDOS": {
   "l": 100
  },
  "DPI": {
   "l": 20
  },
  "NIT": {
   "l": 20
  },
  "TIPO_EMPLEADO": {
   "l": 20
  },
  "SALARIO_BASE": {
   "p": 12,
   "s": 2
  },
  "PORCENTAJE_COMISION": {
   "p": 6,
   "s": 5
  },
  "TIENE_VEHICULO": {
   "l": 1
  },
  "MONTO_DESCUENTO_PARQUEO": {
   "p": 8,
   "s": 2
  },
  "NO_AFILIACION_IGSS": {
   "l": 20
  },
  "CUENTA_BANCARIA": {
   "l": 30
  },
  "BANCO": {
   "l": 50
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_PARAMETRO": {
  "NOMBRE": {
   "l": 50
  },
  "VALOR": {
   "p": 12,
   "s": 4
  },
  "DESCRIPCION": {
   "l": 200
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_PERIODO": {
  "TIPO_PERIODO": {
   "l": 20
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_DETALLE": {
  "SALARIO_BASE": {
   "p": 12,
   "s": 2
  },
  "DIAS_TRABAJADOS": {
   "p": 4,
   "s": 1
  },
  "DIAS_AUSENCIA": {
   "p": 4,
   "s": 1
  },
  "TOTAL_HORAS_EXTRAS": {
   "p": 12,
   "s": 2
  },
  "TOTAL_COMISIONES": {
   "p": 12,
   "s": 2
  },
  "TOTAL_BONIFICACIONES": {
   "p": 12,
   "s": 2
  },
  "TOTAL_DEVENGADO": {
   "p": 12,
   "s": 2
  },
  "DESCUENTO_IGSS": {
   "p": 12,
   "s": 2
  },
  "DESCUENTO_ISR": {
   "p": 12,
   "s": 2
  },
  "DESCUENTO_PRESTAMOS": {
   "p": 12,
   "s": 2
  },
  "DESCUENTO_ANTICIPO": {
   "p": 12,
   "s": 2
  },
  "DESCUENTO_CONSUMO_TIENDA": {
   "p": 12,
   "s": 2
  },
  "DESCUENTO_PARQUEO": {
   "p": 12,
   "s": 2
  },
  "OTROS_DESCUENTOS": {
   "p": 12,
   "s": 2
  },
  "TOTAL_DESCUENTOS": {
   "p": 12,
   "s": 2
  },
  "LIQUIDO_A_PAGAR": {
   "p": 12,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_ANTICIPO_EMPLEADO": {
  "MONTO": {
   "p": 12,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_PRESTAMO_EMPLEADO": {
  "MONTO_TOTAL": {
   "p": 12,
   "s": 2
  },
  "NUMERO_CUOTAS": {
   "p": 4,
   "s": 0
  },
  "MONTO_CUOTA": {
   "p": 12,
   "s": 2
  },
  "SALDO_PENDIENTE": {
   "p": 12,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_PRESTAMO_CUOTA": {
  "NUMERO_CUOTA": {
   "p": 4,
   "s": 0
  },
  "MONTO_CUOTA": {
   "p": 12,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_HORA_EXTRA": {
  "CANTIDAD_HORAS": {
   "p": 5,
   "s": 2
  },
  "TIPO_HORA": {
   "l": 10
  },
  "MONTO": {
   "p": 10,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_COMISION_VENTA": {
  "MONTO_VENTA_NETA": {
   "p": 14,
   "s": 2
  },
  "PORCENTAJE_COMISION": {
   "p": 6,
   "s": 5
  },
  "MONTO_COMISION": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_CONSUMO_TIENDA_INTERNA": {
  "CANTIDAD": {
   "p": 10,
   "s": 2
  },
  "MONTO": {
   "p": 10,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_VACACION": {
  "DIAS_SOLICITADOS": {
   "p": 4,
   "s": 0
  },
  "DIAS_DISPONIBLES_ANTES": {
   "p": 5,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_SUSPENSION_PERMISO": {
  "TIPO": {
   "l": 20
  },
  "MOTIVO": {
   "l": 300
  },
  "NUMERO_CERTIFICADO": {
   "l": 50
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_LIQUIDACION_LABORAL": {
  "MOTIVO_EGRESO": {
   "l": 30
  },
  "TIEMPO_LABORADO_ANIOS": {
   "p": 6,
   "s": 2
  },
  "SALARIO_PROMEDIO_BASE": {
   "p": 12,
   "s": 2
  },
  "INDEMNIZACION_UNIVERSAL": {
   "p": 12,
   "s": 2
  },
  "VACACIONES_PENDIENTES": {
   "p": 12,
   "s": 2
  },
  "AGUINALDO_PROPORCIONAL": {
   "p": 12,
   "s": 2
  },
  "BONO14_PROPORCIONAL": {
   "p": 12,
   "s": 2
  },
  "TOTAL_LIQUIDACION": {
   "p": 12,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_TRANSFERENCIA_BANCARIA": {
  "BANCO": {
   "l": 50
  },
  "MONTO_TOTAL": {
   "p": 14,
   "s": 2
  },
  "NOMBRE_ARCHIVO": {
   "l": 200
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_TRANSFERENCIA_BANCARIA_DET": {
  "CUENTA_BANCARIA": {
   "l": 30
  },
  "BANCO": {
   "l": 50
  },
  "MONTO": {
   "p": 14,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "CODIGO_RESPUESTA_BANCO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_DESCUENTO_IGSS_SAT": {
  "TIPO": {
   "l": 10
  },
  "MONTO": {
   "p": 12,
   "s": 2
  },
  "NUMERO_PLANILLA": {
   "l": 50
  },
  "CONCEPTO": {
   "l": 10
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_PLANILLA_IGSS": {
  "NUMERO_PLANILLA": {
   "l": 50
  },
  "MONTO_TOTAL_LABORAL": {
   "p": 14,
   "s": 2
  },
  "MONTO_TOTAL_PATRONAL": {
   "p": 14,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "NOM_CONSTANCIA_PAGO": {
  "MEDIO_ENTREGA": {
   "l": 20
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "SEG_USUARIO": {
  "USERNAME": {
   "l": 50
  },
  "PASSWORD_HASH": {
   "l": 200
  },
  "INTENTOS_FALLIDOS": {
   "p": 3,
   "s": 0
  },
  "REQUIERE_CAMBIO_PASSWORD": {
   "l": 1
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "SEG_ROL": {
  "CODIGO": {
   "l": 30
  },
  "NOMBRE": {
   "l": 100
  },
  "DESCRIPCION": {
   "l": 300
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "SEG_PERMISO": {
  "CODIGO": {
   "l": 50
  },
  "NOMBRE": {
   "l": 150
  },
  "MODULO": {
   "l": 30
  },
  "DESCRIPCION": {
   "l": 300
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "SEG_ROL_PERMISO": {
  "ELIMINADO": {
   "l": 1
  }
 },
 "SEG_USUARIO_ROL": {
  "ELIMINADO": {
   "l": 1
  }
 },
 "SEG_BITACORA_ACCESO": {
  "USERNAME_INTENTO": {
   "l": 50
  },
  "TIPO_EVENTO": {
   "l": 30
  },
  "IP_ORIGEN": {
   "l": 45
  },
  "DETALLE": {
   "l": 300
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "SEG_BORRADOR_USUARIO": {
  "CLAVE": {
   "l": 200
  },
  "ACTUALIZADO_EN": {
   "p": 16,
   "s": 0
  }
 },
 "SEG_DELEGACION_APROBACION": {
  "MOTIVO": {
   "l": 200
  },
  "ESTADO": {
   "l": 10
  }
 },
 "INV_CATEGORIA": {
  "NOMBRE": {
   "l": 100
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_UNIDAD_MEDIDA": {
  "CODIGO": {
   "l": 10
  },
  "NOMBRE": {
   "l": 80
  },
  "ABREVIATURA": {
   "l": 5
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_CONVERSION_UDM": {
  "FACTOR_MULTIPLICADOR": {
   "p": 18,
   "s": 5,
   "min": 0,
   "minExcl": true
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_ARTICULO": {
  "CODIGO": {
   "l": 20
  },
  "NOMBRE": {
   "l": 150
  },
  "DESCRIPCION": {
   "l": 500
  },
  "TIPO_ARTICULO": {
   "l": 30
  },
  "METODO_COSTEO": {
   "l": 10
  },
  "COSTO_PROMEDIO": {
   "p": 14,
   "s": 4,
   "min": 0
  },
  "PRECIO_VENTA": {
   "p": 12,
   "s": 2,
   "min": 0
  },
  "STOCK_MINIMO": {
   "p": 12,
   "s": 2,
   "min": 0
  },
  "STOCK_MAXIMO": {
   "p": 12,
   "s": 2,
   "min": 0
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_BODEGA": {
  "NOMBRE": {
   "l": 100
  },
  "TIPO": {
   "l": 20
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_EXISTENCIA_BODEGA": {
  "CANTIDAD_ACTUAL": {
   "p": 14,
   "s": 2
  },
  "COSTO_PROMEDIO_ACTUAL": {
   "p": 14,
   "s": 4
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_EXISTENCIA_BODEGA_PERIODO": {
  "SALDO_INICIAL_CANTIDAD": {
   "p": 14,
   "s": 4,
   "min": 0
  },
  "SALDO_INICIAL_COSTO": {
   "p": 14,
   "s": 4
  },
  "SALDO_FINAL_CANTIDAD": {
   "p": 14,
   "s": 4,
   "min": 0
  },
  "SALDO_FINAL_COSTO": {
   "p": 14,
   "s": 4
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_LOTE_FIFO": {
  "CANTIDAD_ORIGINAL": {
   "p": 14,
   "s": 2,
   "min": 0,
   "minExcl": true
  },
  "CANTIDAD_DISPONIBLE": {
   "p": 14,
   "s": 2,
   "min": 0
  },
  "COSTO_UNITARIO": {
   "p": 14,
   "s": 4,
   "min": 0
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_KARDEX_MOVIMIENTO": {
  "TIPO_MOVIMIENTO": {
   "l": 30
  },
  "TIPO_DOCUMENTO_REF": {
   "l": 30
  },
  "CANTIDAD": {
   "p": 14,
   "s": 2,
   "min": 0,
   "minExcl": true
  },
  "COSTO_UNITARIO": {
   "p": 14,
   "s": 4,
   "min": 0
  },
  "SALDO_CANTIDAD": {
   "p": 14,
   "s": 2
  },
  "SALDO_COSTO_PROMEDIO": {
   "p": 14,
   "s": 4
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_ALERTA_ESCASEZ": {
  "CANTIDAD_ACTUAL": {
   "p": 14,
   "s": 2
  },
  "STOCK_MINIMO": {
   "p": 14,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_REQUISICION": {
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_REQUISICION_DETALLE": {
  "CANTIDAD_SOLICITADA": {
   "p": 14,
   "s": 2,
   "min": 0,
   "minExcl": true
  },
  "CANTIDAD_DESPACHADA": {
   "p": 14,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_TRASLADO_BODEGA": {
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_TRASLADO_BODEGA_DETALLE": {
  "CANTIDAD": {
   "p": 14,
   "s": 2,
   "min": 0,
   "minExcl": true
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_INVENTARIO_FISICO": {
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "INV_INVENTARIO_FISICO_DETALLE": {
  "CANTIDAD_SISTEMA": {
   "p": 14,
   "s": 2
  },
  "CANTIDAD_FISICA": {
   "p": 14,
   "s": 2
  },
  "DIFERENCIA": {
   "p": 14,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_MONEDA": {
  "CODIGO": {
   "l": 3
  },
  "NOMBRE": {
   "l": 50
  },
  "SIMBOLO": {
   "l": 5
  },
  "ACTIVA": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_CATEGORIA_COMPRA": {
  "NOMBRE": {
   "l": 80
  },
  "DESCRIPCION": {
   "l": 255
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_GRUPO_COMPRA": {
  "NOMBRE": {
   "l": 100
  },
  "DESCRIPCION": {
   "l": 255
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_CONDICION_PAGO": {
  "NOMBRE": {
   "l": 50
  },
  "DIAS": {
   "p": 3,
   "s": 0
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_TERMINO_ENTREGA": {
  "NOMBRE": {
   "l": 80
  },
  "DIAS_ESTIMADOS": {
   "p": 3,
   "s": 0
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_CENTRO_COSTO": {
  "CODIGO": {
   "l": 20
  },
  "NOMBRE": {
   "l": 100
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_PROVEEDOR": {
  "NIT": {
   "l": 20
  },
  "RAZON_SOCIAL": {
   "l": 150
  },
  "NOMBRE_COMERCIAL": {
   "l": 150
  },
  "DIRECCION": {
   "l": 200
  },
  "TELEFONO": {
   "l": 20
  },
  "EMAIL": {
   "l": 100
  },
  "DIAS_CREDITO": {
   "p": 3,
   "s": 0
  },
  "CALIFICACION": {
   "l": 20
  },
  "CUENTA_BANCARIA": {
   "l": 30
  },
  "BANCO": {
   "l": 50
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_ARTICULO_PROVEEDOR": {
  "PRECIO_ULTIMA_COMPRA": {
   "p": 12,
   "s": 4
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_SOLICITUD_COMPRA": {
  "ESTADO": {
   "l": 30
  },
  "JUSTIFICACION": {
   "l": 500
  },
  "PRIORIDAD": {
   "p": 1,
   "s": 0
  },
  "MONTO_ESTIMADO": {
   "p": 18,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_SOLICITUD_DETALLE": {
  "DESCRIPCION": {
   "l": 255
  },
  "CANTIDAD_SOLICITADA": {
   "p": 12,
   "s": 2,
   "min": 0,
   "minExcl": true
  },
  "CANTIDAD_AUTORIZADA": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_WORKFLOW_APROBACION": {
  "NIVEL_JERARQUICO": {
   "p": 2,
   "s": 0
  },
  "ESTADO_ANTERIOR": {
   "l": 30
  },
  "ESTADO_NUEVO": {
   "l": 30
  },
  "COMENTARIO": {
   "l": 500
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_ACUERDO_PROVEEDOR": {
  "PRECIO_FIJO": {
   "p": 18,
   "s": 5
  },
  "ACTIVO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_ACUERDO_DETALLE": {
  "CANTIDAD_MINIMA": {
   "p": 12,
   "s": 2
  },
  "PORCENTAJE_DESCUENTO": {
   "p": 5,
   "s": 2,
   "min": 0,
   "max": 100
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_RFQ_CABECERA": {
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_RFQ_PROVEEDOR": {
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_COTIZACION_PROVEEDOR": {
  "TASA_CAMBIO": {
   "p": 10,
   "s": 5
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_COTIZACION_DETALLE": {
  "PRECIO_UNITARIO": {
   "p": 18,
   "s": 5
  },
  "CANTIDAD": {
   "p": 12,
   "s": 2
  },
  "PORCENTAJE_DESCUENTO": {
   "p": 5,
   "s": 2,
   "min": 0,
   "max": 100
  },
  "PORCENTAJE_IMPUESTO": {
   "p": 5,
   "s": 2,
   "min": 0,
   "max": 100
  },
  "ADJUDICADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_COMPARATIVO_COTIZACIONES": {
  "CRITERIO": {
   "l": 100
  },
  "PUNTUACION": {
   "p": 5,
   "s": 2
  },
  "NOTAS": {
   "l": 500
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_ORDEN_COMPRA": {
  "TASA_CAMBIO": {
   "p": 10,
   "s": 5
  },
  "ESTADO": {
   "l": 30
  },
  "NUMERO_REFERENCIA": {
   "l": 50
  },
  "COSTO_ENVIO": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_ORDEN_COMPRA_DETALLE": {
  "DESCRIPCION": {
   "l": 255
  },
  "CANTIDAD": {
   "p": 12,
   "s": 2
  },
  "PRECIO_UNITARIO": {
   "p": 18,
   "s": 5
  },
  "PORCENTAJE_DESCUENTO": {
   "p": 5,
   "s": 2,
   "min": 0,
   "max": 100
  },
  "PORCENTAJE_IMPUESTO": {
   "p": 5,
   "s": 2,
   "min": 0,
   "max": 100
  },
  "TOLERANCIA_PORCENTAJE": {
   "p": 5,
   "s": 2,
   "min": 0,
   "max": 100
  },
  "SUBTOTAL_CALCULADO": {
   "p": 18,
   "s": 5
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_SEGUIMIENTO_ORDEN": {
  "ESTADO_REPORTE": {
   "l": 100
  },
  "NOTAS": {
   "l": 500
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_EXCEPCION_ORDEN": {
  "TIPO": {
   "l": 50
  },
  "DESCRIPCION": {
   "l": 500
  },
  "RESUELTA": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_RECEPCION": {
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_RECEPCION_DETALLE": {
  "CANTIDAD_RECIBIDA": {
   "p": 12,
   "s": 2
  },
  "CANTIDAD_RECHAZADA": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_DEVOLUCION_PROVEEDOR": {
  "MOTIVO": {
   "l": 255
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "COM_DEVOLUCION_DETALLE": {
  "CANTIDAD_DEVUELTA": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXP_FACTURA_PROVEEDOR": {
  "TIPO_DOCUMENTO": {
   "l": 20
  },
  "NUMERO_DTE": {
   "l": 50
  },
  "SERIE_DTE": {
   "l": 50
  },
  "MONTO_TOTAL": {
   "p": 14,
   "s": 2
  },
  "MONTO_RETENCION_IVA": {
   "p": 14,
   "s": 2
  },
  "MONTO_RETENCION_ISR": {
   "p": 14,
   "s": 2
  },
  "SALDO_PENDIENTE": {
   "p": 14,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXP_FACTURA_PROVEEDOR_DETALLE": {
  "DESCRIPCION": {
   "l": 300
  },
  "CANTIDAD": {
   "p": 14,
   "s": 2
  },
  "PRECIO_UNITARIO": {
   "p": 14,
   "s": 4
  },
  "SUBTOTAL": {
   "p": 14,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXP_RETENCION": {
  "TIPO_RETENCION": {
   "l": 10
  },
  "BASE_IMPONIBLE": {
   "p": 14,
   "s": 2
  },
  "PORCENTAJE": {
   "p": 5,
   "s": 2
  },
  "MONTO": {
   "p": 14,
   "s": 2
  },
  "NUMERO_CONSTANCIA": {
   "l": 50
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXP_CONTRASENA_PAGO": {
  "MONTO": {
   "p": 14,
   "s": 2
  },
  "FORMA_PAGO": {
   "l": 20
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXP_CHEQUE": {
  "BANCO": {
   "l": 50
  },
  "NUMERO_CHEQUE": {
   "l": 20
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXP_CAJA_CHICA": {
  "FONDO_ASIGNADO": {
   "p": 10,
   "s": 2
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXP_CAJA_CHICA_MOVIMIENTO": {
  "TIPO_MOVIMIENTO": {
   "l": 20
  },
  "CONCEPTO": {
   "l": 300
  },
  "MONTO": {
   "p": 10,
   "s": 2
  },
  "NUMERO_COMPROBANTE": {
   "l": 50
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_ZONA_GEOGRAFICA": {
  "NOMBRE_ZONA": {
   "l": 100
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_CLASIFICACION_MORA": {
  "DESCRIPCION_RANGO": {
   "l": 50
  },
  "PORCENTAJE_RECARGO": {
   "p": 5,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_CLIENTE": {
  "NIT": {
   "l": 20
  },
  "NOMBRE_CLIENTE": {
   "l": 200
  },
  "DIRECCION": {
   "l": 200
  },
  "TELEFONO": {
   "l": 20
  },
  "EMAIL": {
   "l": 100
  },
  "LIMITE_CREDITO": {
   "p": 12,
   "s": 2
  },
  "SALDO_ACTUAL": {
   "p": 12,
   "s": 2
  },
  "CALIFICACION_CREDITO": {
   "l": 20
  },
  "ESTADO": {
   "l": 1
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_TURNO_CAJA": {
  "MONTO_INICIAL": {
   "p": 12,
   "s": 2
  },
  "MONTO_EFECTIVO_FINAL": {
   "p": 12,
   "s": 2
  },
  "ESTADO_TURNO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_DOCUMENTO_VENTA": {
  "TIPO_DOCUMENTO": {
   "l": 30
  },
  "TIPO_PAGO": {
   "l": 20
  },
  "MONTO_TOTAL": {
   "p": 12,
   "s": 2
  },
  "NIT_CLIENTE": {
   "l": 20
  },
  "UUID_DOCTO": {
   "l": 36
  },
  "SERIE_DOCTO": {
   "l": 20
  },
  "NUM_DOCTO": {
   "p": 19,
   "s": 0
  },
  "ESTADO_FEL": {
   "l": 20
  },
  "DOC_AFECTADO_SERIE": {
   "l": 20
  },
  "DOC_AFECTADO_NUM": {
   "p": 19,
   "s": 0
  },
  "DOC_AFECTADO_UUID": {
   "l": 36
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_DOCUMENTO_VENTA_DETALLE": {
  "CANTIDAD": {
   "p": 10,
   "s": 2
  },
  "PRECIO_UNITARIO": {
   "p": 12,
   "s": 2
  },
  "SUBTOTAL": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_CUENTA_POR_COBRAR": {
  "MONTO_ORIGINAL": {
   "p": 12,
   "s": 2
  },
  "SALDO_PENDIENTE": {
   "p": 12,
   "s": 2
  },
  "ESTADO_CXC": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_TRANSACCION_AJUSTE": {
  "TIPO_AJUSTE": {
   "l": 20
  },
  "MONTO_APLICADO": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_REGISTRO_CERTIFICACION_DTE": {
  "NIT_CERTIFICADOR": {
   "l": 20
  },
  "NOMBRE_CERTIFICADOR": {
   "l": 100
  },
  "ESTADO_COMUNICACION": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_COLA_CONTINGENCIA_FEL": {
  "ESTADO_COLA": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_LOTE_CONCILIACION_SAT": {
  "NOMBRE_ARCHIVO": {
   "l": 200
  },
  "ESTADO_LOTE": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_DETALLE_SAT_VIRTUAL": {
  "UUID_SAT": {
   "l": 36
  },
  "NIT_RECEPTOR": {
   "l": 20
  },
  "MONTO_SAT": {
   "p": 12,
   "s": 2
  },
  "MONTO_IVA_SAT": {
   "p": 12,
   "s": 2
  },
  "ESTADO_SAT": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_DISCREPANCIA_AUDITORIA": {
  "UUID_INVOLUCRADO": {
   "l": 36
  },
  "TIPO_DISCREPANCIA": {
   "l": 100
  },
  "MONTO_DIFERENCIA": {
   "p": 12,
   "s": 2
  },
  "NIVEL_SEVERIDAD": {
   "l": 20
  },
  "ESTADO_RESOLUCION": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_BITACORA_RESOLUCION_DISCRE": {
  "ACCION_TOMADA": {
   "l": 150
  },
  "EVIDENCIA_ADJUNTA_URL": {
   "l": 255
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_COBRADOR": {
  "PORCENTAJE_COMISION": {
   "p": 5,
   "s": 2
  },
  "ESTADO_COBRADOR": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_RECIBO_COBRO": {
  "FORMA_PAGO": {
   "l": 20
  },
  "MONTO_RECUPERADO": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_DEPOSITO_COBRADOR": {
  "TOTAL_COBRADO": {
   "p": 12,
   "s": 2
  },
  "EFECTIVO": {
   "p": 12,
   "s": 2
  },
  "OBSERVACIONES": {
   "l": 300
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_DEPOSITO_BANCARIO": {
  "BANCO": {
   "l": 100
  },
  "NUMERO_BOLETA": {
   "l": 50
  },
  "MONTO": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_CONCILIACION_BANCARIA": {
  "SALDO_SISTEMA": {
   "p": 12,
   "s": 2
  },
  "ESTADO": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_RUTA_COBRO": {
  "ESTADO_RUTA": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_RUTA_COBRO_DETALLE": {
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_GESTION_COBRANZA": {
  "TIPO_CONTACTO": {
   "l": 50
  },
  "RESULTADO": {
   "l": 100
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_LIBRO_VENTAS": {
  "PERIODO": {
   "l": 10
  },
  "NIT": {
   "l": 20
  },
  "TOTAL": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_BITACORA_SISTEMA_GENERAL": {
  "TABLA_AFECTADA": {
   "l": 100
  },
  "ACCION": {
   "l": 50
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_COLA_NOMINA_TRANSMISION": {
  "ESTADO_TRANSMISION": {
   "l": 20
  },
  "ELIMINADO": {
   "l": 1
  }
 },
 "CXC_COMPENSACION_SALDOS": {
  "MONTO_COMPENSADO": {
   "p": 12,
   "s": 2
  },
  "ELIMINADO": {
   "l": 1
  }
 }
};

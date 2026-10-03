/**
 * Configuracion de los formularios de captura del ciclo de compra.
 * Cada campo declara su "kind" (control + ancho segun el dato) y, si aplica,
 * de que endpoint saca sus opciones.
 */

import type { DocumentFormConfig } from "../../components/DocumentForm.js";
import { MOTIVO_DEVOLUCION, PRIORIDAD_SOLICITUD } from "../../core/catalogosEstaticos.js";

const EMPLEADOS = { path: "/api/com/ref/empleados", value: "idEmpleado", label: "nombres", label2: "apellidos" };
const SUCURSALES = { path: "/api/com/ref/sucursales", value: "idSucursal", label: "nombre" };
const ARTICULOS = { path: "/api/com/ref/articulos", value: "idArticulo", label: "codigo", label2: "nombre" };
const UNIDADES = { path: "/api/com/ref/unidades-medida", value: "idUnidadMedida", label: "nombre" };
const BODEGAS = { path: "/api/com/ref/bodegas", value: "idBodega", label: "nombre" };
const PROVEEDORES = { path: "/api/com/proveedores", value: "idProveedor", label: "razonSocial" };
const MONEDAS = { path: "/api/com/monedas", value: "idMoneda", label: "codigo", label2: "nombre" };
const COND_PAGO = { path: "/api/com/condiciones-pago", value: "idCondicionPago", label: "nombre" };
const GRUPOS = { path: "/api/com/grupos-compra", value: "idGrupoCompra", label: "nombre" };
const TERMINOS = { path: "/api/com/terminos-entrega", value: "idTerminoEntrega", label: "nombre" };
const CENTROS = { path: "/api/com/centros-costo", value: "idCentroCosto", label: "nombre" };
// labelTpl en vez de "label: id" a secas: antes los selects de documentos
// mostraban solo el numero crudo ("#187"), ilegible para elegir a ojo.
const SOLICITUDES = { path: "/api/com/solicitudes", value: "idSolicitud", labelTpl: "SOL-{idSolicitud} · {justificacion}" };
// Con la justificacion de la solicitud y cuantos proveedores invito — no el
// numero de RFQ a secas, que no dice a que corresponde cada opcion.
const RFQS = {
  path: "/api/com/ref/rfq/seleccionables",
  value: "idRfq",
  labelTpl: "{resumen} · {proveedoresInvitados} proveedores · vence {fechaLimite} · {estado}",
};
const RECEPCIONES = { path: "/api/com/recepciones", value: "idRecepcion", labelTpl: "REC-{idRecepcion} · OC-{idOrdenCompra} · {estado}" };

export const DOCUMENT_FORMS: Record<string, DocumentFormConfig> = {
  solicitudes: {
    title: "Solicitud de compra",
    submitPath: "/api/com/solicitudes",
    shape: "cabecera-detalles",
    lineLabel: "Articulos solicitados",
    minLines: 1,
    confirmBeforeSubmit: true,
    headerFields: [
      { name: "idEmpleadoSolicitante", label: "Empleado solicitante", kind: "select", required: true, optionsFrom: EMPLEADOS, fromSession: "idEmpleado" },
      { name: "idSucursal", label: "Sucursal", kind: "select", required: true, optionsFrom: SUCURSALES, defaultFromSessionEmpleado: "idSucursal" },
      { name: "idGrupoCompra", label: "Grupo de compra", kind: "select", required: true, optionsFrom: GRUPOS },
      { name: "idTerminoEntrega", label: "Termino de entrega", kind: "select", required: true, optionsFrom: TERMINOS },
      { name: "idCentroCosto", label: "Centro de costo", kind: "select", optionsFrom: CENTROS },
      { name: "prioridad", label: "Prioridad", kind: "select", required: true, optionsStatic: PRIORIDAD_SOLICITUD },
      { name: "montoEstimado", label: "Monto estimado", kind: "money" },
      { name: "justificacion", label: "Justificacion", kind: "textarea", required: true },
    ],
    lineFields: [
      { name: "idArticulo", label: "Articulo", kind: "select", optionsFrom: ARTICULOS },
      { name: "descripcion", label: "Descripcion", kind: "shortText", required: true },
      { name: "cantidadSolicitada", label: "Cantidad", kind: "quantity", required: true },
      { name: "idUnidadMedida", label: "Unidad", kind: "select", required: true, optionsFrom: UNIDADES },
      { name: "fechaRequerida", label: "Fecha requerida", kind: "date", required: true },
    ],
  },

  rfq: {
    title: "RFQ / Invitacion a cotizar",
    submitPath: "/api/com/rfq",
    shape: "flat",
    linesKey: "proveedores",
    lineLabel: "Proveedores invitados",
    // El flujo exige cotizar con al menos 3 proveedores distintos
    // (RfqService.MIN_PROVEEDORES) — se refleja aqui para que el formulario lo
    // impida antes de enviar, en vez de que el usuario se entere con un 422.
    minLines: 3,
    lineTransform: (l) => Number(l["idProveedor"]),
    headerFields: [
      { name: "idSolicitud", label: "Solicitud", kind: "select", required: true, optionsFrom: SOLICITUDES },
      { name: "fechaLimite", label: "Fecha limite", kind: "date", required: true },
    ],
    lineFields: [
      {
        name: "idProveedor",
        label: "Proveedor",
        kind: "select",
        required: true,
        // Los habituales (ya suministraron algo de esta solicitud) salen
        // primero y marcados — no hace falta buscarlos entre todo el catalogo.
        optionsFrom: {
          path: "/api/com/ref/solicitud/{idSolicitud}/proveedores-sugeridos",
          value: "idProveedor",
          label: "etiqueta",
          dependsOn: "idSolicitud",
        },
      },
    ],
  },

  cotizaciones: {
    title: "Cotizacion de proveedor",
    submitPath: "/api/com/cotizaciones",
    shape: "flat",
    lineLabel: "Lineas cotizadas",
    minLines: 1,
    headerFields: [
      {
        name: "idRfq",
        label: "RFQ (invitacion a cotizar)",
        kind: "select",
        required: true,
        optionsFrom: RFQS,
        help: "La invitacion a cotizar que ya se envio a los proveedores para la solicitud que aparece en la opcion.",
      },
      {
        // El proveedor solo puede ser uno de los invitados a ese RFQ (no todo el catalogo).
        name: "idProveedor",
        label: "Proveedor (invitado al RFQ)",
        kind: "select",
        required: true,
        optionsFrom: {
          path: "/api/com/ref/rfq/{idRfq}/proveedores",
          value: "idProveedor",
          label: "razonSocial",
          dependsOn: "idRfq",
        },
      },
      { name: "idCondicionPago", label: "Condicion de pago", kind: "select", required: true, optionsFrom: COND_PAGO },
      { name: "idMoneda", label: "Moneda", kind: "select", required: true, optionsFrom: MONEDAS },
      { name: "tasaCambio", label: "Tasa de cambio", kind: "rate", required: true },
      { name: "fechaVencimiento", label: "Vence", kind: "datetime", required: true },
    ],
    lineFields: [
      {
        name: "idSolicitudDetalle",
        label: "Renglon de la solicitud",
        kind: "select",
        required: true,
        optionsFrom: {
          path: "/api/com/ref/rfq/{idRfq}/lineas-solicitud",
          value: "idSolicitudDetalle",
          labelTpl: "#{idSolicitudDetalle} · {descripcion} · {cantidadSolicitada} {unidadMedida}",
          dependsOn: "idRfq",
        },
      },
      { name: "precioUnitario", label: "Precio unitario", kind: "money", required: true },
      { name: "cantidad", label: "Cantidad", kind: "quantity", required: true },
      { name: "idUnidadMedida", label: "Unidad", kind: "select", required: true, optionsFrom: UNIDADES },
      { name: "porcentajeDescuento", label: "Descuento", kind: "percent" },
      { name: "porcentajeImpuesto", label: "Impuesto", kind: "percent" },
    ],
  },

  ordenesCompra: {
    title: "Orden de compra",
    submitPath: "/api/com/ordenes-compra",
    shape: "flat",
    lineLabel: "Lineas de la orden",
    minLines: 1,
    confirmBeforeSubmit: true,
    // Inferencia: al elegir la solicitud y, por linea, la cotizacion adjudicada,
    // el proveedor / moneda / tasa / precio se toman de la cotizacion y quedan
    // bloqueados (el usuario no re-elige lo que ya esta decidido).
    autoFill: {
      source: "/api/com/ref/cotizaciones-adjudicadas?idSolicitud={idSolicitud}",
      matchLineField: "idCotizacionDetalle",
      matchKey: "idCotizacionDetalle",
      lineMap: {
        descripcion: "descripcion",
        idUnidadMedida: "idUnidadMedida",
        precioUnitario: "precioUnitario",
        porcentajeDescuento: "porcentajeDescuento",
        porcentajeImpuesto: "porcentajeImpuesto",
      },
      headerMapIfUniform: {
        idProveedor: "idProveedor",
        idMoneda: "idMoneda",
        tasaCambio: "tasaCambio",
      },
    },
    headerFields: [
      { name: "idSolicitud", label: "Solicitud adjudicada", kind: "select", required: true, optionsFrom: SOLICITUDES },
      { name: "idProveedor", label: "Proveedor", kind: "select", required: true, optionsFrom: PROVEEDORES, help: "Se toma de la cotizacion adjudicada" },
      // Rol fusionado con financiero: quien genera la OC autoriza la orden a
      // su propio nombre (antes se elegia entre TODOS los empleados, incluida
      // bodega, sin ningun filtro por rol).
      { name: "idEmpleadoGerenteFinanciero", label: "Autoriza la orden", kind: "select", required: true, optionsFrom: EMPLEADOS, fromSession: "idEmpleado" },
      { name: "idMoneda", label: "Moneda", kind: "select", required: true, optionsFrom: MONEDAS, help: "Se toma de la cotizacion" },
      { name: "tasaCambio", label: "Tasa de cambio", kind: "rate", required: true, help: "Se toma de la cotizacion" },
      { name: "fechaEntregaEsperada", label: "Entrega esperada", kind: "datetime", required: true },
      { name: "numeroReferencia", label: "Referencia", kind: "code" },
    ],
    lineFields: [
      {
        name: "idCotizacionDetalle",
        label: "Cotizacion adjudicada",
        kind: "select",
        required: true,
        help: "Fija proveedor, moneda, tasa y precio",
        optionsFrom: {
          path: "/api/com/ref/cotizaciones-adjudicadas?idSolicitud={idSolicitud}",
          value: "idCotizacionDetalle",
          labelTpl: "{proveedor} · {descripcion} · Q{precioUnitario}",
          dependsOn: "idSolicitud",
        },
      },
      { name: "idArticulo", label: "Articulo", kind: "select", optionsFrom: ARTICULOS },
      { name: "descripcion", label: "Descripcion", kind: "shortText", required: true },
      { name: "cantidad", label: "Cantidad", kind: "quantity", required: true },
      { name: "idUnidadMedida", label: "Unidad", kind: "select", required: true, optionsFrom: UNIDADES },
      { name: "precioUnitario", label: "Precio unitario", kind: "money", help: "Se toma de la cotizacion adjudicada" },
      { name: "porcentajeDescuento", label: "Descuento", kind: "percent" },
      { name: "porcentajeImpuesto", label: "Impuesto", kind: "percent" },
      { name: "toleranciaPorcentaje", label: "Tolerancia", kind: "percent" },
    ],
  },

  recepciones: {
    title: "Recepcion de mercaderia",
    submitPath: "/api/com/recepciones",
    shape: "flat",
    lineLabel: "Lineas recibidas",
    minLines: 1,
    confirmBeforeSubmit: true,
    headerFields: [
      {
        name: "idOrdenCompra",
        label: "Orden de compra",
        kind: "select",
        required: true,
        // Referencia acotada (Bodega no gestiona OC, no puede listar el
        // documento completo) — solo OC que todavia admiten recepcion.
        optionsFrom: {
          path: "/api/com/ref/oc/receptibles",
          value: "idOrdenCompra",
          labelTpl: "OC-{idOrdenCompra} · {proveedor} · {estado}",
        },
      },
      { name: "idBodega", label: "Bodega", kind: "select", required: true, optionsFrom: BODEGAS },
      { name: "idEmpleadoRecibe", label: "Recibe", kind: "select", required: true, optionsFrom: EMPLEADOS, fromSession: "idEmpleado" },
    ],
    lineFields: [
      {
        name: "idOcDetalle",
        label: "Renglon de la orden",
        kind: "select",
        required: true,
        // Conteo ciego: sin cantidad esperada/pendiente en la etiqueta (ver
        // RecepcionGuiada.tsx, el flujo real de captura para este documento).
        optionsFrom: {
          path: "/api/com/ref/oc/{idOrdenCompra}/lineas-pendientes",
          value: "idOcDetalle",
          labelTpl: "#{idOcDetalle} · {descripcion}",
          dependsOn: "idOrdenCompra",
        },
      },
      { name: "cantidadRecibida", label: "Cantidad recibida", kind: "quantity", required: true },
      { name: "cantidadRechazada", label: "Cantidad rechazada", kind: "quantity" },
    ],
  },

  devoluciones: {
    title: "Devolucion a proveedor",
    submitPath: "/api/com/devoluciones",
    shape: "flat",
    lineLabel: "Lineas devueltas",
    minLines: 1,
    headerFields: [
      { name: "idRecepcion", label: "Recepcion", kind: "select", required: true, optionsFrom: RECEPCIONES },
      { name: "motivo", label: "Motivo", kind: "select", required: true, optionsStatic: MOTIVO_DEVOLUCION },
      { name: "idEmpleadoSolicita", label: "Solicita", kind: "select", required: true, optionsFrom: EMPLEADOS, fromSession: "idEmpleado" },
    ],
    lineFields: [
      {
        name: "idRecepcionDetalle",
        label: "Renglon de la recepcion",
        kind: "select",
        required: true,
        optionsFrom: {
          path: "/api/com/recepciones/{idRecepcion}",
          value: "idRecepcionDetalle",
          labelTpl: "#{idRecepcionDetalle} · OC-renglon {idOcDetalle} · recibido {cantidadRecibida}",
          dependsOn: "idRecepcion",
          pick: "details",
        },
      },
      { name: "cantidadDevuelta", label: "Cantidad devuelta", kind: "quantity", required: true },
    ],
  },
};

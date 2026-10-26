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
    lineLabel: "Artículos solicitados",
    minLines: 1,
    confirmBeforeSubmit: true,
    headerFields: [
      { name: "idEmpleadoSolicitante", label: "Empleado solicitante", kind: "select", required: true, optionsFrom: EMPLEADOS, fromSession: "idEmpleado" },
      { name: "idSucursal", label: "Sucursal", kind: "select", required: true, optionsFrom: SUCURSALES, defaultFromSessionEmpleado: "idSucursal" },
      { name: "idGrupoCompra", label: "Grupo de compra", kind: "select", required: true, optionsFrom: GRUPOS, remember: true },
      { name: "idTerminoEntrega", label: "Término de entrega", kind: "select", required: true, optionsFrom: TERMINOS, remember: true },
      { name: "prioridad", label: "Prioridad", kind: "select", required: true, optionsStatic: PRIORIDAD_SOLICITUD, defaultValue: "3", remember: true },
      { name: "idCentroCosto", label: "Centro de costo", kind: "select", optionsFrom: CENTROS, remember: true, advanced: true },
      { name: "montoEstimado", label: "Monto estimado", kind: "money", advanced: true },
      { name: "justificacion", label: "Justificación", kind: "textarea", required: true },
    ],
    lineFields: [
      // Elegir el articulo completa solo la descripcion y la unidad: no se teclea lo que el sistema ya sabe.
      { name: "idArticulo", label: "Artículo", kind: "select", optionsFrom: ARTICULOS, fillOnSelect: { descripcion: "nombre", idUnidadMedida: "idUnidadMedida" } },
      { name: "descripcion", label: "Descripción", kind: "shortText", required: true },
      { name: "cantidadSolicitada", label: "Cantidad", kind: "quantity", required: true, positive: true, defaultValue: "1" },
      { name: "idUnidadMedida", label: "Unidad", kind: "select", required: true, optionsFrom: UNIDADES, remember: true },
      { name: "fechaRequerida", label: "Fecha requerida", kind: "date", required: true, minDate: "today", defaultDays: 14 },
    ],
  },

  rfq: {
    title: "RFQ / Invitación a cotizar",
    submitPath: "/api/com/rfq",
    shape: "flat",
    linesKey: "proveedores",
    lineLabel: "Proveedores invitados",
    // Al elegir la solicitud, ya se proponen los 3 proveedores habituales (los que ya suministraron algo).
    seedLines: {
      when: "idSolicitud",
      source: "/api/com/ref/solicitud/{idSolicitud}/proveedores-sugeridos",
      map: { idProveedor: "idProveedor" },
      limit: 3,
    },
    // El flujo exige cotizar con al menos 3 proveedores distintos
    // (RfqService.MIN_PROVEEDORES) — se refleja aqui para que el formulario lo
    // impida antes de enviar, en vez de que el usuario se entere con un 422.
    minLines: 3,
    lineTransform: (l) => Number(l["idProveedor"]),
    headerFields: [
      { name: "idSolicitud", label: "Solicitud", kind: "select", required: true, optionsFrom: SOLICITUDES },
      { name: "fechaLimite", label: "Fecha límite", kind: "date", required: true, minDate: "today", defaultDays: 5, help: "Hasta cuándo se reciben ofertas. No puede ser anterior a hoy." },
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
    title: "Cotización de proveedor",
    submitPath: "/api/com/cotizaciones",
    shape: "flat",
    lineLabel: "Líneas cotizadas",
    minLines: 1,
    // Al elegir el RFQ, cada articulo que se pidio ya viene como renglon (cantidad y unidad incluidas):
    // el usuario solo escribe los precios.
    seedLines: {
      when: "idRfq",
      source: "/api/com/ref/rfq/{idRfq}/lineas-solicitud",
      map: { idSolicitudDetalle: "idSolicitudDetalle", cantidad: "cantidadSolicitada", idUnidadMedida: "idUnidadMedida" },
    },
    headerFields: [
      {
        name: "idRfq",
        label: "RFQ (invitación a cotizar)",
        kind: "select",
        required: true,
        optionsFrom: RFQS,
        help: "La invitación a cotizar que ya se envió a los proveedores para la solicitud que aparece en la opción.",
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
      { name: "idCondicionPago", label: "Condición de pago", kind: "select", required: true, optionsFrom: COND_PAGO, remember: true },
      { name: "idMoneda", label: "Moneda", kind: "select", required: true, optionsFrom: MONEDAS, remember: true },
      { name: "tasaCambio", label: "Tasa de cambio", kind: "rate", required: true, defaultValue: "1", help: "1.00 si cotiza en quetzales" },
      { name: "fechaVencimiento", label: "Vence", kind: "datetime", required: true, minDate: "today", defaultDays: 15 },
    ],
    lineFields: [
      {
        name: "idSolicitudDetalle",
        label: "Renglón de la solicitud",
        kind: "select",
        required: true,
        optionsFrom: {
          path: "/api/com/ref/rfq/{idRfq}/lineas-solicitud",
          value: "idSolicitudDetalle",
          labelTpl: "#{idSolicitudDetalle} · {descripcion} · {cantidadSolicitada} {unidadMedida}",
          dependsOn: "idRfq",
        },
      },
      { name: "precioUnitario", label: "Precio unitario", kind: "money", required: true, positive: true },
      { name: "cantidad", label: "Cantidad", kind: "quantity", required: true, positive: true },
      { name: "idUnidadMedida", label: "Unidad", kind: "select", required: true, optionsFrom: UNIDADES },
      { name: "porcentajeDescuento", label: "Descuento", kind: "percent", defaultValue: "0" },
      { name: "porcentajeImpuesto", label: "Impuesto", kind: "percent", defaultValue: "12", remember: true },
    ],
  },

  ordenesCompra: {
    title: "Orden de compra",
    submitPath: "/api/com/ordenes-compra",
    shape: "flat",
    lineLabel: "Líneas de la orden",
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
      { name: "idProveedor", label: "Proveedor", kind: "select", required: true, optionsFrom: PROVEEDORES, help: "Se toma de la cotización adjudicada" },
      // Rol fusionado con financiero: quien genera la OC autoriza la orden a
      // su propio nombre (antes se elegia entre TODOS los empleados, incluida
      // bodega, sin ningun filtro por rol).
      { name: "idEmpleadoGerenteFinanciero", label: "Autoriza la orden", kind: "select", required: true, optionsFrom: EMPLEADOS, fromSession: "idEmpleado" },
      { name: "idMoneda", label: "Moneda", kind: "select", required: true, optionsFrom: MONEDAS, help: "Se toma de la cotización" },
      { name: "tasaCambio", label: "Tasa de cambio", kind: "rate", required: true, help: "Se toma de la cotización" },
      { name: "fechaEntregaEsperada", label: "Entrega esperada", kind: "datetime", required: true, minDate: "today", defaultDays: 14, help: "No puede ser anterior a hoy." },
      { name: "costoEnvio", label: "Costo de envío", kind: "money", help: "Flete que cobra el proveedor. 0 = envío gratuito; vacío = no se sabe. Alimenta el reporte de evaluación de proveedores." },
      { name: "numeroReferencia", label: "Referencia", kind: "code", advanced: true },
    ],
    lineFields: [
      {
        name: "idCotizacionDetalle",
        label: "Cotización adjudicada",
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
      { name: "idArticulo", label: "Artículo", kind: "select", optionsFrom: ARTICULOS },
      { name: "descripcion", label: "Descripción", kind: "shortText", required: true },
      { name: "cantidad", label: "Cantidad", kind: "quantity", required: true, positive: true },
      { name: "idUnidadMedida", label: "Unidad", kind: "select", required: true, optionsFrom: UNIDADES },
      { name: "precioUnitario", label: "Precio unitario", kind: "money", help: "Se toma de la cotización adjudicada" },
      { name: "porcentajeDescuento", label: "Descuento", kind: "percent" },
      { name: "porcentajeImpuesto", label: "Impuesto", kind: "percent" },
      { name: "toleranciaPorcentaje", label: "Tolerancia", kind: "percent" },
    ],
  },

  recepciones: {
    title: "Recepción de mercadería",
    submitPath: "/api/com/recepciones",
    shape: "flat",
    lineLabel: "Líneas recibidas",
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
      { name: "idBodega", label: "Bodega", kind: "select", required: true, optionsFrom: BODEGAS, remember: true },
      { name: "idEmpleadoRecibe", label: "Recibe", kind: "select", required: true, optionsFrom: EMPLEADOS, fromSession: "idEmpleado" },
    ],
    lineFields: [
      {
        name: "idOcDetalle",
        label: "Renglón de la orden",
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
      { name: "cantidadRecibida", label: "Cantidad recibida", kind: "quantity", required: true, positive: true },
      { name: "cantidadRechazada", label: "Cantidad rechazada", kind: "quantity" },
    ],
  },

  devoluciones: {
    title: "Devolución a proveedor",
    submitPath: "/api/com/devoluciones",
    shape: "flat",
    lineLabel: "Líneas devueltas",
    minLines: 1,
    // Al elegir la recepcion, sus renglones ya vienen cargados: solo se indica cuanto se devuelve.
    seedLines: {
      when: "idRecepcion",
      source: "/api/com/recepciones/{idRecepcion}",
      pick: "details",
      map: { idRecepcionDetalle: "idRecepcionDetalle" },
    },
    headerFields: [
      { name: "idRecepcion", label: "Recepción", kind: "select", required: true, optionsFrom: RECEPCIONES },
      { name: "motivo", label: "Motivo", kind: "select", required: true, optionsStatic: MOTIVO_DEVOLUCION },
      { name: "idEmpleadoSolicita", label: "Solicita", kind: "select", required: true, optionsFrom: EMPLEADOS, fromSession: "idEmpleado" },
    ],
    lineFields: [
      {
        name: "idRecepcionDetalle",
        label: "Renglón de la recepción",
        kind: "select",
        required: true,
        optionsFrom: {
          path: "/api/com/recepciones/{idRecepcion}",
          value: "idRecepcionDetalle",
          labelTpl: "#{idRecepcionDetalle} · OC-renglón {idOcDetalle} · recibido {cantidadRecibida}",
          dependsOn: "idRecepcion",
          pick: "details",
        },
      },
      {
        name: "cantidadDevuelta",
        label: "Cantidad devuelta",
        kind: "quantity",
        required: true,
        positive: true,
        limitFrom: { select: "idRecepcionDetalle", prop: "cantidadRecibida", noun: "recibido" },
      },
    ],
  },
};

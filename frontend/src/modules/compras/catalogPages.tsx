/**
 * Configuracion declarativa de los catalogos del modulo. Cada catalogo = un
 * objeto: columnas (con tipo) + campos de formulario (con "kind" que fija el
 * control y su ancho segun el dato).
 */

import CrudPage, { type CrudPageConfig } from "../../components/CrudPage.js";
import type { Column } from "../../ui/DataTable.js";
import { StarRating } from "../../ui/primitives.js";
import { Permisos } from "../../core/auth/permisos.js";
import { calificacionProveedorEstrellas } from "../../core/estados.js";
import {
  CALIFICACION_PROVEEDOR,
  ESTADO_AI,
  ESTADO_SEGUIMIENTO_ORDEN,
  TIPO_EXCEPCION_ORDEN,
} from "../../core/catalogosEstaticos.js";
import type { SelectOption } from "../../ui/Field.js";

type Row = Record<string, unknown>;
const estadoAI = ESTADO_AI;

const REF_ARTICULOS = { path: "/api/com/ref/articulos", value: "idArticulo", label: "codigo", label2: "nombre" };
const REF_DEPARTAMENTOS = { path: "/api/com/ref/departamentos", value: "idDepartamento", label: "nombre" };
const REF_ORDENES = { path: "/api/com/ordenes-compra", value: "idOrdenCompra", label: "idOrdenCompra", prefix: "OC-" };
const REF_EMPLEADOS = { path: "/api/com/ref/empleados", value: "idEmpleado", label: "nombres", label2: "apellidos" };
const REF_CATEGORIAS = { path: "/api/com/ref/categorias-articulo", value: "idCategoria", label: "nombre" };
const REF_UNIDADES = { path: "/api/com/ref/unidades-medida", value: "idUnidadMedida", label: "nombre" };

const TIPO_ARTICULO_OPCIONES: readonly SelectOption[] = [
  { value: "MERCADERIA_VENTA", label: "Mercaderia de venta" },
  { value: "ACTIVO_FIJO", label: "Activo fijo" },
  { value: "MATERIAL_USO_INTERNO", label: "Material de uso interno" },
  { value: "TIENDA_INTERNA_EMPLEADOS", label: "Tienda interna de empleados" },
];

const col = (key: string, header: string, opts: Partial<Column<Row>> = {}): Column<Row> => ({
  key,
  header,
  value: (r) => r[key] as string | number | null,
  ...opts,
});

/** Etiqueta legible de un catalogo estatico (codigo -> label) para columnas. */
const staticLabel = (options: readonly SelectOption[], code: unknown): string =>
  options.find((o) => o.value === String(code))?.label ?? (code === null || code === undefined || code === "" ? "—" : String(code));

export const CATALOG_CONFIGS: Record<string, CrudPageConfig> = {
  monedas: {
    title: "Monedas",
    subtitle: "Divisas admitidas en ordenes de compra y cotizaciones.",
    basePath: "/api/com/monedas",
    idField: "idMoneda",
    writePerm: Permisos.CATALOGO_ADMIN,
    searchField: "nombre",
    searchPlaceholder: "Buscar monedas...",
    filterFields: [{ key: "activa", label: "Estado", options: [{ value: "S", label: "Activa" }, { value: "N", label: "Inactiva" }] }],
    columns: [
      col("codigo", "Codigo", { sortable: true }),
      col("nombre", "Nombre", { sortable: true }),
      col("simbolo", "Simbolo"),
      col("activa", "Activa", { render: (r) => (r["activa"] === true ? "Si" : "No") }),
    ],
    fields: [
      { name: "codigo", label: "Codigo ISO", kind: "code", required: true, help: "3 letras (GTQ, USD…)" },
      { name: "nombre", label: "Nombre", kind: "shortText", required: true },
      { name: "simbolo", label: "Simbolo", kind: "code", help: "Q, $, EUR" },
      { name: "activa", label: "Activa", kind: "switch" },
    ],
    help: {
      title: "Monedas — para que sirve",
      body: (
        <>
          <p>
            Cada Cotización y Orden de compra elige una moneda y fija su{" "}
            <b>tasa de cambio</b> en ese momento (no aquí) — este catálogo
            solo define qué monedas existen y si están activas para elegir
            en un documento nuevo.
          </p>
          <p>
            Catálogo <b>sensible</b>: solo el administrador del módulo puede
            crear/editar monedas (afecta cómo se convierte todo a GTQ en
            reportes y dashboard).
          </p>
        </>
      ),
    },
  },

  proveedores: {
    title: "Proveedores",
    subtitle: "Proveedores de mercaderia, activos y servicios.",
    basePath: "/api/com/proveedores",
    idField: "idProveedor",
    searchField: "razonSocial",
    searchPlaceholder: "Buscar proveedores...",
    filterFields: [{ key: "estado", label: "Estado", options: estadoAI }],
    derivedTags: { path: "/api/com/ref/proveedores/familias", columnKey: "familias" },
    stats: (rows, total, derivedTags) => {
      const familias = new Set(Object.values(derivedTags).flat()).size;
      const calificaciones = rows
        .map((r) => calificacionProveedorEstrellas(r["calificacion"] as string | null))
        .filter((n) => n > 0);
      const promedio = calificaciones.length > 0 ? calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length : 0;
      return [
        { icon: "users", tone: "brand", title: `${total} Proveedores`, subtitle: "Registrados en el sistema" },
        { icon: "layers", tone: "success", title: `${familias || "—"}`, subtitle: familias > 0 ? "Familias de producto (en esta pagina)" : "Sin historial de compras aun" },
        { icon: "award", tone: "warning", title: promedio > 0 ? `${promedio.toFixed(1)} / 5` : "—", subtitle: "Calificacion promedio" },
      ];
    },
    columns: [
      col("nit", "NIT", { sortable: true, width: 112 }),
      col("razonSocial", "Razon social", { sortable: true, grow: true }),
      col("nombreComercial", "Nombre comercial", { width: 200, priority: "secondary" }),
      col("email", "Email", { width: 220, priority: "secondary" }),
      col("familias", "Familias de producto", { width: 220, priority: "secondary" }),
      col("calificacion", "Calificacion", {
        width: 130,
        render: (r) => <StarRating value={calificacionProveedorEstrellas(r["calificacion"] as string | null)} label={String(r["calificacion"] ?? "Nuevo")} />,
      }),
      col("diasCredito", "Dias credito", { type: "num", sortable: true }),
      col("estado", "Estado", { type: "estado" }),
    ],
    formTabs: [
      { id: "gen", label: "Generales", fields: ["nit", "razonSocial", "nombreComercial", "estado"] },
      { id: "cto", label: "Contacto", fields: ["direccion", "telefono", "email"] },
      { id: "com", label: "Comercial", fields: ["diasCredito", "calificacion", "cuentaBancaria", "banco"] },
    ],
    fields: [
      { name: "nit", label: "NIT", kind: "nit", required: true },
      { name: "razonSocial", label: "Razon social", kind: "name", required: true },
      { name: "nombreComercial", label: "Nombre comercial", kind: "name" },
      { name: "estado", label: "Estado", kind: "select", options: estadoAI, required: true },
      { name: "direccion", label: "Direccion", kind: "longText" },
      { name: "telefono", label: "Telefono", kind: "phone" },
      { name: "email", label: "Email", kind: "email" },
      { name: "diasCredito", label: "Dias de credito", kind: "integer" },
      { name: "calificacion", label: "Calificacion", kind: "select", optionsStatic: CALIFICACION_PROVEEDOR },
      { name: "cuentaBancaria", label: "Cuenta bancaria", kind: "shortText" },
      { name: "banco", label: "Banco", kind: "shortText" },
    ],
    help: {
      title: "Proveedores — para que sirve",
      body: (
        <>
          <p>
            Ficha maestra de cada proveedor: NIT (único), datos de contacto y
            condición comercial. Se usa para invitar proveedores a un RFQ,
            registrar cotizaciones y generar Órdenes de compra.
          </p>
          <p>
            <b>Estado "Inactivo"</b> no borra al proveedor ni sus documentos
            históricos, solo lo saca de los selectores de documentos nuevos.
          </p>
        </>
      ),
    },
  },

  categoriasCompra: {
    title: "Categorias de compra",
    subtitle: "Clasificacion de alto nivel del gasto de compras.",
    basePath: "/api/com/categorias-compra",
    idField: "idCategoriaCompra",
    searchField: "nombre",
    searchPlaceholder: "Buscar categorias...",
    filterFields: [{ key: "estado", label: "Estado", options: estadoAI }],
    columns: [
      col("nombre", "Nombre", { sortable: true, grow: true }),
      col("descripcion", "Descripcion", { priority: "secondary" }),
      col("estado", "Estado", { type: "estado" }),
    ],
    fields: [
      { name: "nombre", label: "Nombre", kind: "shortText", required: true },
      { name: "descripcion", label: "Descripcion", kind: "longText" },
      { name: "estado", label: "Estado", kind: "select", options: estadoAI, required: true },
    ],
    help: {
      title: "Categorías de compra — para que sirve",
      body: (
        <p>
          Clasificación de más alto nivel del gasto (p. ej. "Tecnología",
          "Suministros de oficina"). Cada <b>Grupo de compra</b> pertenece a
          una categoría — sirve para agrupar el gasto al analizarlo, no
          afecta el flujo de aprobación.
        </p>
      ),
    },
  },

  gruposCompra: {
    title: "Grupos de compra",
    subtitle: "Subdivisiones operativas dentro de cada categoria.",
    basePath: "/api/com/grupos-compra",
    idField: "idGrupoCompra",
    searchField: "nombre",
    searchPlaceholder: "Buscar grupos de compra...",
    columns: [
      col("nombre", "Nombre", { sortable: true, grow: true }),
      col("idCategoriaCompra", "Categoria", { refKind: "categoriaCompra" }),
      col("descripcion", "Descripcion", { priority: "secondary" }),
    ],
    fields: [
      {
        name: "idCategoriaCompra",
        label: "Categoria",
        kind: "select",
        required: true,
        optionsFrom: { path: "/api/com/categorias-compra", value: "idCategoriaCompra", label: "nombre" },
      },
      { name: "nombre", label: "Nombre", kind: "shortText", required: true },
      { name: "descripcion", label: "Descripcion", kind: "longText" },
    ],
    help: {
      title: "Grupos de compra — para que sirve",
      body: (
        <p>
          Subdivisión operativa dentro de una Categoría de compra. Toda{" "}
          <b>Solicitud de compra</b> elige un grupo — es el dato que después
          permite ver el gasto desglosado por área operativa dentro de cada
          categoría.
        </p>
      ),
    },
  },

  condicionesPago: {
    title: "Condiciones de pago",
    subtitle: "Plazos de credito ofrecidos por los proveedores.",
    basePath: "/api/com/condiciones-pago",
    idField: "idCondicionPago",
    searchField: "nombre",
    searchPlaceholder: "Buscar condiciones de pago...",
    columns: [
      col("nombre", "Nombre", { sortable: true }),
      col("dias", "Dias", { type: "num", sortable: true }),
    ],
    fields: [
      { name: "nombre", label: "Nombre", kind: "shortText", required: true },
      { name: "dias", label: "Dias", kind: "integer", required: true },
    ],
    help: {
      title: "Condiciones de pago — para que sirve",
      body: (
        <p>
          Plazos de crédito que un proveedor ofrece (p. ej. "30 días",
          "Contado"). Cada <b>Cotización</b> elige una — informativo para
          negociar y para Cuentas por Pagar; no cambia el flujo de
          aprobación ni el precio.
        </p>
      ),
    },
  },

  terminosEntrega: {
    title: "Terminos de entrega",
    subtitle: "Tiempos estimados de entrega por modalidad.",
    basePath: "/api/com/terminos-entrega",
    idField: "idTerminoEntrega",
    searchField: "nombre",
    searchPlaceholder: "Buscar terminos de entrega...",
    columns: [
      col("nombre", "Nombre", { sortable: true }),
      col("diasEstimados", "Dias estimados", { type: "num", sortable: true }),
    ],
    fields: [
      { name: "nombre", label: "Nombre", kind: "shortText", required: true },
      { name: "diasEstimados", label: "Dias estimados", kind: "integer", required: true },
    ],
    help: {
      title: "Términos de entrega — para que sirve",
      body: (
        <p>
          Modalidad y tiempo estimado de entrega (p. ej. "Entrega en
          bodega, 5 días"). Cada <b>Solicitud de compra</b> elige uno — es
          una referencia de expectativa, no genera automáticamente la fecha
          de entrega esperada de la Orden de compra (esa se fija al crear la
          OC).
        </p>
      ),
    },
  },

  centrosCosto: {
    title: "Centros de costo",
    subtitle: "Imputacion contable de las compras.",
    basePath: "/api/com/centros-costo",
    idField: "idCentroCosto",
    searchField: "nombre",
    searchPlaceholder: "Buscar centros de costo...",
    filterFields: [{ key: "estado", label: "Estado", options: estadoAI }],
    columns: [
      col("codigo", "Codigo", { sortable: true }),
      col("nombre", "Nombre", { sortable: true }),
      col("estado", "Estado", { type: "estado" }),
    ],
    fields: [
      { name: "codigo", label: "Codigo", kind: "code", required: true },
      { name: "nombre", label: "Nombre", kind: "shortText", required: true },
      { name: "idDepartamento", label: "Departamento", kind: "select", optionsFrom: REF_DEPARTAMENTOS },
      { name: "estado", label: "Estado", kind: "select", options: estadoAI, required: true },
    ],
    help: {
      title: "Centros de costo — para que sirve",
      body: (
        <p>
          Imputación contable de una compra, ligada a un departamento.
          Sirve para que Cuentas por Pagar sepa a qué centro cargar el
          gasto — no cambia quién aprueba ni el monto.
        </p>
      ),
    },
  },

  acuerdos: {
    title: "Acuerdos marco",
    subtitle: "Precio fijo pactado con un proveedor para un articulo.",
    basePath: "/api/com/acuerdos-proveedor",
    idField: "idAcuerdo",
    columns: [
      col("idProveedor", "Proveedor", { refKind: "proveedor", grow: true }),
      col("idArticulo", "Articulo", { refKind: "articulo", width: 220 }),
      col("precioFijo", "Precio fijo", { type: "money" }),
      col("fechaInicio", "Desde", { type: "date", priority: "secondary" }),
      col("fechaFin", "Hasta", { type: "date", priority: "secondary" }),
      col("activo", "Activo", { width: 84, render: (r) => (r["activo"] === true ? "Si" : "No") }),
    ],
    fields: [
      {
        name: "idProveedor",
        label: "Proveedor",
        kind: "select",
        required: true,
        optionsFrom: { path: "/api/com/proveedores", value: "idProveedor", label: "razonSocial" },
      },
      { name: "idArticulo", label: "Articulo", kind: "select", required: true, optionsFrom: REF_ARTICULOS },
      { name: "precioFijo", label: "Precio fijo", kind: "money" },
      { name: "fechaInicio", label: "Vigente desde", kind: "datetime", required: true },
      { name: "fechaFin", label: "Vigente hasta", kind: "datetime", required: true },
      { name: "activo", label: "Activo", kind: "switch" },
    ],
    help: {
      title: "Acuerdos marco — para que sirve",
      body: (
        <>
          <p>
            Precio fijo pactado con un proveedor para un artículo, vigente
            en un rango de fechas. Cuando se genera una Orden de compra sin
            cotización adjudicada (línea manual), el sistema busca aquí
            primero un acuerdo vigente para fijar el precio automáticamente.
          </p>
          <p>
            Orden de prioridad de precio al generar OC: 1) cotización
            adjudicada, 2) <b>acuerdo marco vigente</b> (este catálogo), 3)
            último precio de compra (catálogo Artículo-Proveedor).
          </p>
        </>
      ),
    },
  },

  articuloProveedor: {
    title: "Articulo-Proveedor",
    subtitle: "Ultimo precio de compra por articulo y proveedor (respaldo cuando no hay acuerdo marco ni cotizacion adjudicada).",
    basePath: "/api/com/articulo-proveedor",
    idField: "idArticuloProveedor",
    columns: [
      col("idProveedor", "Proveedor", { refKind: "proveedor", grow: true }),
      col("idArticulo", "Articulo", { refKind: "articulo", width: 220 }),
      col("precioUltimaCompra", "Ultimo precio", { type: "money" }),
      col("fechaUltimaCompra", "Fecha", { type: "date", priority: "secondary" }),
    ],
    fields: [
      {
        name: "idProveedor",
        label: "Proveedor",
        kind: "select",
        required: true,
        optionsFrom: { path: "/api/com/proveedores", value: "idProveedor", label: "razonSocial" },
      },
      { name: "idArticulo", label: "Articulo", kind: "select", required: true, optionsFrom: REF_ARTICULOS },
      { name: "precioUltimaCompra", label: "Ultimo precio de compra", kind: "money" },
      { name: "fechaUltimaCompra", label: "Fecha de la ultima compra", kind: "date" },
    ],
    help: {
      title: "Artículo-Proveedor — para que sirve",
      body: (
        <p>
          Respaldo de precio: si al generar una Orden de compra manual no
          hay cotización adjudicada ni acuerdo marco vigente para ese
          artículo y proveedor, el sistema usa el <b>último precio de compra</b>{" "}
          registrado aquí (último escalón de la cadena de precio; ver ayuda
          de "Acuerdos marco" para el orden completo).
        </p>
      ),
    },
  },

  seguimientoOrden: {
    title: "Seguimiento de OC",
    subtitle: "Bitacora de contactos con el proveedor sobre el despacho de una orden.",
    basePath: "/api/com/seguimiento-orden",
    idField: "idSeguimiento",
    writePerm: Permisos.OC_GESTIONAR,
    columns: [
      col("idOrdenCompra", "OC", { refKind: "docOrden", width: 96 }),
      col("fechaContacto", "Fecha", { type: "datetime" }),
      col("estadoReporte", "Estado", {
        width: 160,
        render: (r) => staticLabel(ESTADO_SEGUIMIENTO_ORDEN, r["estadoReporte"]),
      }),
      col("notas", "Notas", { type: "text", grow: true, priority: "secondary" }),
    ],
    fields: [
      { name: "idOrdenCompra", label: "Orden de compra", kind: "select", required: true, optionsFrom: REF_ORDENES },
      { name: "estadoReporte", label: "Estado del reporte", kind: "select", optionsStatic: ESTADO_SEGUIMIENTO_ORDEN },
      { name: "notas", label: "Notas", kind: "textarea" },
    ],
    help: {
      title: "Seguimiento de OC — para que sirve",
      body: (
        <p>
          Bitácora libre de contactos con el proveedor sobre el despacho de
          una Orden de compra ("llamé, confirma envío para el viernes"). Es
          solo un registro informativo — <b>no cambia el estado</b> de la OC;
          eso se hace desde "Órdenes de compra → Cambiar estado".
        </p>
      ),
    },
  },

  excepcionOrden: {
    title: "Excepciones de OC",
    subtitle: "Incidencias reportadas sobre una orden (faltantes, danos, retrasos…).",
    basePath: "/api/com/excepciones-orden",
    idField: "idExcepcion",
    writePerm: Permisos.OC_GESTIONAR,
    columns: [
      col("idOrdenCompra", "OC", { refKind: "docOrden", width: 96 }),
      col("tipo", "Tipo", { width: 170, render: (r) => staticLabel(TIPO_EXCEPCION_ORDEN, r["tipo"]) }),
      col("descripcion", "Descripcion", { type: "text", grow: true, priority: "secondary" }),
      col("resuelta", "Resuelta", { width: 90, render: (r) => (r["resuelta"] === true ? "Si" : "No") }),
      col("fechaResolucion", "Resuelta el", { type: "date", priority: "secondary" }),
    ],
    fields: [
      { name: "idOrdenCompra", label: "Orden de compra", kind: "select", required: true, optionsFrom: REF_ORDENES },
      { name: "tipo", label: "Tipo de excepcion", kind: "select", required: true, optionsStatic: TIPO_EXCEPCION_ORDEN },
      { name: "descripcion", label: "Descripcion", kind: "longText", required: true },
      { name: "idEmpleadoReporta", label: "Reporta", kind: "select", required: true, optionsFrom: REF_EMPLEADOS },
      { name: "resuelta", label: "Resuelta", kind: "switch" },
      { name: "fechaResolucion", label: "Fecha de resolucion", kind: "datetime" },
    ],
    help: {
      title: "Excepciones de OC — para que sirve",
      body: (
        <p>
          Incidencias reportadas sobre una Orden de compra (faltante, daño,
          retraso). Igual que Seguimiento, es un registro para
          trazabilidad/auditoría — marcarla "Resuelta" no dispara ninguna
          acción automática sobre la OC ni sobre el kardex.
        </p>
      ),
    },
  },

  articulos: {
    title: "Articulos",
    subtitle: "Catalogo de productos: categoria y umbrales de inventario.",
    basePath: "/api/com/articulos",
    idField: "idArticulo",
    searchField: "nombre",
    searchPlaceholder: "Buscar articulos... (ej. martillo)",
    filterFields: [
      { key: "idCategoria", label: "Categoria", optionsFrom: REF_CATEGORIAS },
      { key: "estado", label: "Estado", options: estadoAI },
    ],
    columns: [
      col("codigo", "Codigo", { sortable: true, width: 110 }),
      col("nombre", "Nombre", { sortable: true, grow: true }),
      col("idCategoria", "Categoria", { refKind: "categoria", priority: "secondary" }),
      col("idUnidadMedida", "Unidad", { refKind: "unidadMedida", width: 110, priority: "secondary" }),
      col("stockMinimo", "Stock minimo", { type: "num", width: 110, priority: "secondary" }),
      col("stockMaximo", "Stock maximo", { type: "num", width: 110, priority: "secondary" }),
      col("estado", "Estado", { type: "estado" }),
    ],
    fields: [
      { name: "codigo", label: "Codigo", kind: "code", required: true },
      { name: "nombre", label: "Nombre", kind: "name", required: true },
      {
        name: "idCategoria",
        label: "Categoria",
        kind: "select",
        optionsFrom: REF_CATEGORIAS,
        help: "Asi al buscar o filtrar aparece junto a los de su familia (martillos con martillos, no con taladros).",
      },
      { name: "idUnidadMedida", label: "Unidad de medida", kind: "select", required: true, optionsFrom: REF_UNIDADES },
      { name: "tipoArticulo", label: "Tipo de articulo", kind: "select", required: true, optionsStatic: TIPO_ARTICULO_OPCIONES },
      {
        name: "stockMinimo",
        label: "Stock minimo",
        kind: "quantity",
        help: "Bajo este nivel el sistema avisa automaticamente que hay que reabastecer.",
      },
      {
        name: "stockMaximo",
        label: "Stock maximo",
        kind: "quantity",
        help: "Nivel objetivo: la cantidad sugerida de reposicion llega hasta aqui.",
      },
      { name: "estado", label: "Estado", kind: "select", options: estadoAI, required: true },
    ],
    help: {
      title: "Artículos — para que sirve",
      body: (
        <>
          <p>
            Catálogo maestro de productos. La <b>categoría</b> es lo que
            permite filtrar y buscar sin mezclar familias distintas —
            martillos no aparecen al buscar o filtrar taladros.
          </p>
          <p>
            <b>Stock mínimo/máximo</b> alimentan la alerta automática de
            reabastecimiento: si la existencia cae bajo el mínimo, el
            artículo aparece en la campana de notificaciones con una
            cantidad sugerida de reposición (hasta el máximo).
          </p>
        </>
      ),
    },
  },
};

export function CatalogScreen(props: { configKey: string }): React.ReactElement {
  const config = CATALOG_CONFIGS[props.configKey];
  if (config === undefined) return <p>Configuracion no encontrada: {props.configKey}</p>;
  return <CrudPage config={config} />;
}

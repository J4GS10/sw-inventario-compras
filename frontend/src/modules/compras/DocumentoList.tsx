/**
 * Listado de documentos del flujo de compras con acciones de flujo por tipo
 * (aprobar/rechazar solicitud, cambiar estado de OC, cerrar RFQ). Sistema de
 * diseno: PageHeader + DataTable + Modal de accion + Toast.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable, type Column, type RowAction } from "../../ui/DataTable.js";
import Icon from "../../ui/Icon.js";
import { Modal, ConfirmDialog, Tabs } from "../../ui/Modal.js";
import { Field, FormGrid, type FieldValue } from "../../ui/Field.js";
import { Button, PageHeader, StatCard, StatRow } from "../../ui/primitives.js";
import { FlowStepper, type FlowStep } from "../../ui/FlowStepper.js";
import { useToast } from "../../ui/Toast.js";
import { DocumentForm } from "../../components/DocumentForm.js";
import { RecepcionGuiada } from "./RecepcionGuiada.js";
import { OrdenCompraPreview } from "../../components/OrdenCompraPreview.js";
import { Trazabilidad } from "../../components/Trazabilidad.js";
import { AsistenteCotizacion } from "./AsistenteCotizacion.js";
import {
  DocumentoDetalle,
  type CampoDetalle,
  type ColumnaLinea,
} from "../../components/DocumentoDetalle.js";
import { DOCUMENT_FORMS } from "./documentForms.js";
import { DocumentoAppService, type TipoDocAdjunto } from "../../core/CompraServices.js";
import { downloadService } from "../../core/DownloadService.js";
import type { HelpContent } from "../../ui/HelpTip.js";
import { messageOf } from "../../core/errors.js";
import { estadoLabel, prioridadLabel } from "../../core/estados.js";
import { formatMoney, formatQty } from "../../core/format.js";
import { useRefs } from "../../core/RefContext.js";
import { AppEvents, eventBus } from "../../core/EventBus.js";
import { LiveEvents } from "../../core/liveEvents.js";
import {
  FILTROS_RAPIDOS,
  SIGUIENTE_PASO,
  columnaUrgencia,
  guardarVista,
  leerVista,
} from "./listaUx.js";
import { http } from "../../core/HttpClient.js";
import { useAuth } from "../../core/auth/AuthContext.js";
import { Permisos } from "../../core/auth/permisos.js";

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
/** Precio neto de linea: precio x (1 - desc/100). */
const neto = (l: Record<string, unknown>): number =>
  n(l["precioUnitario"]) * (1 - n(l["porcentajeDescuento"]) / 100);
/** Total de linea con impuesto: cantidad x neto x (1 + imp/100). */
const totalLinea = (l: Record<string, unknown>): number =>
  n(l["cantidad"]) * neto(l) * (1 + n(l["porcentajeImpuesto"]) / 100);

/** Etapa del ciclo de compras que representa cada listado (para el FlowStepper). */
const FLOW_STEP: Record<string, FlowStep> = {
  solicitudes: "solicitud",
  rfq: "rfq",
  cotizaciones: "cotizacion",
  ordenesCompra: "orden",
  recepciones: "recepcion",
  devoluciones: "devolucion",
};

const opt = (values: readonly string[]): readonly { value: string; label: string }[] =>
  values.map((v) => ({ value: v, label: estadoLabel(v) }));

/**
 * Ayuda del buscador por documento. TODOS los documentos buscan (`?q=`) en
 * todos sus campos y en sus relaciones (proveedor, solicitante, lineas...); el
 * texto solo le dice al usuario por que puede buscar.
 */
const SEARCH_HINT: Record<string, string> = {
  solicitudes: "Buscar por N.º (SOL-12), solicitante, producto, estado, justificación…",
  rfq: "Buscar por N.º de RFQ, solicitud (SOL-12), proveedor invitado, estado…",
  cotizaciones: "Buscar por N.º, proveedor, RFQ, moneda, condición de pago…",
  ordenesCompra: "Buscar por N.º (OC-12), proveedor, producto, estado, referencia, fecha…",
  recepciones: "Buscar por N.º, orden (OC-12), proveedor, bodega, quien recibió…",
  devoluciones: "Buscar por N.º, recepción, proveedor, motivo, quien solicitó…",
};

/** Qué hacer cuando la lista está vacía: el siguiente paso del flujo. */
const EMPTY_HINT: Record<string, string> = {
  solicitudes: "Crea la primera con «Nuevo». El jefe y el gerente la aprueban antes de cotizar.",
  rfq: "Primero aprueba una solicitud; luego crea el RFQ e invita al menos 3 proveedores.",
  cotizaciones: "Registra aquí las ofertas que responden a un RFQ abierto.",
  ordenesCompra: "Se generan desde el Comparativo, adjudicando la mejor cotización de cada renglón.",
  recepciones: "Registra el ingreso físico cuando llegue la mercadería de una orden enviada.",
  devoluciones: "Se registran contra una recepción, por la mercadería que se devuelve al proveedor.",
};

/** Permiso que habilita "Nuevo" / editar / eliminar en cada tipo de documento. */
const CREAR_PERM: Record<string, string> = {
  solicitudes: Permisos.SOLICITUD_CREAR,
  rfq: Permisos.RFQ_GESTIONAR,
  cotizaciones: Permisos.COTIZACION_GESTIONAR,
  ordenesCompra: Permisos.OC_GESTIONAR,
  recepciones: Permisos.RECEPCION_GESTIONAR,
  devoluciones: Permisos.DEVOLUCION_GESTIONAR,
};

/** configKey -> segmento de ruta para adjuntos (documentos con soporte de adjuntos). */
const TIPO_ADJUNTO: Partial<Record<string, TipoDocAdjunto>> = {
  solicitudes: "solicitudes",
  cotizaciones: "cotizaciones",
  ordenesCompra: "ordenes-compra",
  recepciones: "recepciones",
  devoluciones: "devoluciones",
};

/**
 * configKey -> tiene accion "Detalle" (modal con campos + lineas). Incluye RFQ,
 * que no tiene adjuntos backend (`DocumentoDetalle` recibe `tipoAdjunto`
 * `undefined` y oculta el panel de adjuntos).
 */
const DETALLE_KEYS = new Set<string>([
  "solicitudes",
  "rfq",
  "cotizaciones",
  "ordenesCompra",
  "recepciones",
  "devoluciones",
]);

/**
 * Devuelve true si la fila esta BLOQUEADA para eliminar (se oculta la accion).
 * El backend igual valida el cerrojo; esto evita ofrecer algo que dara 409.
 */
const LOCK_ELIMINAR: Record<string, (r: Record<string, unknown>) => boolean> = {
  solicitudes: (r) => String(r["estado"]) !== "PENDIENTE_JEFE",
  // rfq: cerrojo real resuelto en vivo, ver `rfqEliminable` abajo (un RFQ
  // ABIERTO con cotizaciones ya registradas igual se rechaza con 409).
  // cotizaciones: cerrojo real resuelto en vivo, ver `cotizacionEditable` abajo
  // (depende del estado del RFQ y de si hay linea adjudicada, no de la propia fila).
  ordenesCompra: (r) =>
    !["EMITIDA", "CANCELADA", "RECHAZADA"].includes(String(r["estado"])),
  recepciones: (r) => String(r["estado"]) !== "RECIBIDO",
  devoluciones: () => false,
};

/** configKey -> subconjunto de campos de cabecera editables (modo edicion del DocumentForm). */
const EDIT_FIELDS: Record<string, readonly string[]> = {
  cotizaciones: ["idCondicionPago", "idMoneda", "tasaCambio", "fechaVencimiento"],
  ordenesCompra: ["fechaEntregaEsperada", "costoEnvio", "numeroReferencia", "idMoneda", "tasaCambio"],
};

/** Solo estas filas admiten "Editar" (ademas del permiso). */
const LOCK_EDITAR: Record<string, (r: Record<string, unknown>) => boolean> = {
  ordenesCompra: (r) => String(r["estado"]) !== "EMITIDA",
};

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

const c = (key: string, header: string, opts: Partial<Column<Row>> = {}): Column<Row> => ({
  key,
  header,
  value: (r) => r[key] as string | number | null,
  ...opts,
});

interface DocConfig {
  readonly title: string;
  readonly subtitle: string;
  readonly basePath: string;
  readonly idField: string;
  readonly columns: readonly Column<Row>[];
  /** Boton "?" junto al titulo — el usuario elige verla, nunca se abre sola. */
  readonly help?: HelpContent;
  /** Tarjetas KPI sobre la lista (a partir de la pagina cargada + el total). */
  readonly stats?: (
    rows: readonly Row[],
    total: number,
  ) => readonly { icon: import("../../ui/Icon.js").IconName; tone?: import("../../ui/primitives.js").ChipTone; title: string; subtitle: string }[];
  /** Boton "Filtrar": un select por campo (server-side, via `campo__eq`). */
  readonly filterFields?: readonly {
    readonly key: string;
    readonly label: string;
    readonly options: readonly { value: string; label: string }[];
  }[];
}

export const DOCUMENTO_CONFIGS: Record<string, DocConfig> = {
  solicitudes: {
    title: "Solicitudes de compra",
    subtitle: "Requisiciones internas y su flujo de aprobación jerárquico.",
    basePath: "/api/com/solicitudes",
    idField: "idSolicitud",
    columns: [
      c("idSolicitud", "#", { sortable: true, type: "id", width: 84 }),
      c("justificacion", "Qué se pide", { type: "text", grow: true }),
      c("estado", "Estado", { type: "estado", sortable: true }),
      c("montoEstimado", "Monto", { type: "money", sortable: true }),
      c("fechaCreacion", "Creada", { type: "datetime", sortable: true, priority: "secondary" }),
      c("idGrupoCompra", "Grupo de compra", { refKind: "grupoCompra", priority: "secondary" }),
      c("prioridad", "Prioridad", { type: "prioridad", sortable: true, priority: "secondary" }),
    ],
    help: {
      title: "Solicitudes de compra — cómo funciona el flujo",
      body: (
        <>
          <p>
            Punto de entrada del ciclo completo: un empleado pide algo, y
            pasa por <b>2 niveles de aprobación</b> — jefe inmediato, luego
            gerente de área. Cualquiera puede rechazarla; el jefe además
            puede ajustar las cantidades al aprobar.
          </p>
          <p>
            Solo se puede <b>editar o eliminar</b> mientras está{" "}
            <code>PENDIENTE_JEFE</code> — una vez que el jefe decide, queda
            fija. Si ves el toggle "Pendientes de mi nivel / De otro nivel",
            filtra entre lo que te toca decidir a ti y lo que espera a otro
            nivel.
          </p>
          <p>
            Al aprobar el gerente pasa a <code>EN_COTIZACION</code> — ahí
            Compras arma el RFQ con el botón "Iniciar cotización".
          </p>
        </>
      ),
    },
  },
  rfq: {
    title: "RFQ",
    subtitle: "Solicitudes formales de cotización enviadas a proveedores.",
    basePath: "/api/com/rfq",
    idField: "idRfq",
    columns: [
      c("idRfq", "#", { sortable: true, type: "id", width: 84 }),
      c("idSolicitud", "Solicitud", { refKind: "docSolicitud", width: 104 }),
      c("estado", "Estado", { type: "estado", sortable: true }),
      c("fechaEmision", "Emitido", { type: "datetime", sortable: true, priority: "secondary" }),
      c("fechaLimite", "Fecha límite", { type: "date", sortable: true, priority: "secondary" }),
    ],
    filterFields: [{ key: "estado", label: "Estado", options: opt(["ABIERTO", "CERRADO", "CANCELADO"]) }],
    help: {
      title: "RFQ — cómo funciona",
      body: (
        <>
          <p>
            Solicitud formal de cotización a <b>mínimo 3 proveedores</b>{" "}
            para una Solicitud ya aprobada. Mientras está{" "}
            <code>ABIERTO</code> se pueden registrar cotizaciones contra él
            y editar su fecha límite.
          </p>
          <p>
            "Cerrar" lo pasa a <code>CERRADO</code> (ya no admite
            cotizaciones nuevas, para ir al Comparativo a adjudicar).
            "Cancelar RFQ" lo descontinúa por completo — solo posible
            mientras esté ABIERTO. Eliminarlo solo se puede si aún no tiene
            ninguna cotización registrada.
          </p>
        </>
      ),
    },
  },
  cotizaciones: {
    title: "Cotizaciones de proveedor",
    subtitle: "Ofertas recibidas, multi-moneda.",
    basePath: "/api/com/cotizaciones",
    idField: "idCotizacion",
    columns: [
      c("idCotizacion", "#", { sortable: true, type: "id", width: 84 }),
      c("idRfq", "RFQ", { refKind: "docRfq", width: 96 }),
      c("idProveedor", "Proveedor", { refKind: "proveedor", grow: true }),
      c("idMoneda", "Moneda", { refKind: "moneda", width: 96, priority: "secondary" }),
      c("tasaCambio", "Tasa", { type: "rate", priority: "secondary" }),
      c("fechaVencimiento", "Vence", { type: "date", sortable: true }),
      c("fechaCotizacion", "Registrada", { type: "datetime", sortable: true, priority: "secondary" }),
    ],
    help: {
      title: "Cotizaciones — cómo funciona",
      body: (
        <>
          <p>
            Oferta de un proveedor invitado a un RFQ, con precios por
            renglón — cada una en su propia moneda y tasa de cambio.
            "Comparar" abre el Comparativo con todas las cotizaciones del
            mismo RFQ lado a lado para adjudicar la mejor por renglón.
          </p>
          <p>
            <b>Editar/Eliminar</b> solo aparecen si el RFQ sigue{" "}
            <code>ABIERTO</code> y ninguna de sus líneas ya fue adjudicada
            — una vez que se adjudica o el RFQ se cierra, la cotización
            queda fija.
          </p>
        </>
      ),
    },
  },
  ordenesCompra: {
    title: "Órdenes de compra",
    subtitle: "Órdenes emitidas al proveedor y su ciclo de vida.",
    basePath: "/api/com/ordenes-compra",
    idField: "idOrdenCompra",
    columns: [
      c("idOrdenCompra", "#", { sortable: true, type: "id", width: 84 }),
      c("idProveedor", "Proveedor", { refKind: "proveedor", grow: true }),
      c("estado", "Estado", { type: "estado", sortable: true }),
      c("idMoneda", "Moneda", { refKind: "moneda", width: 96, priority: "secondary" }),
      c("tasaCambio", "Tasa", { type: "rate", priority: "secondary" }),
      c("fechaEmision", "Emisión", { type: "datetime", sortable: true, priority: "secondary" }),
      c("fechaEntregaEsperada", "Entrega esperada", { type: "date", sortable: true, priority: "secondary" }),
    ],
    filterFields: [
      {
        key: "estado",
        label: "Estado",
        options: opt(["EMITIDA", "ENVIADA", "EN_TRANSITO", "RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "CANCELADA", "RECHAZADA"]),
      },
    ],
    help: {
      title: "Órdenes de compra — cómo funciona",
      body: (
        <>
          <p>
            El compromiso formal con el proveedor. Se genera desde el
            Comparativo (precio de la cotización adjudicada) o manualmente
            — en ese caso el precio se resuelve solo, en orden: cotización
            adjudicada → acuerdo marco vigente → último precio de compra.
          </p>
          <p>
            Ciclo de estado: <code>EMITIDA → ENVIADA → EN_TRANSITO →
            RECIBIDA_PARCIAL/COMPLETA</code> (o CANCELADA/RECHAZADA en
            cualquier punto antes de recibir). "Descargar PDF" genera el
            documento formal para entregar al proveedor.
          </p>
        </>
      ),
    },
  },
  recepciones: {
    title: "Recepciones",
    subtitle: "Ingreso físico de mercadería contra orden de compra.",
    basePath: "/api/com/recepciones",
    idField: "idRecepcion",
    columns: [
      c("idRecepcion", "#", { sortable: true, type: "id", width: 84 }),
      c("idOrdenCompra", "OC", { refKind: "docOrden", width: 96 }),
      c("idBodega", "Bodega", { refKind: "bodega", priority: "secondary" }),
      c("estado", "Estado", { type: "estado", sortable: true }),
      c("fechaRecepcion", "Fecha", { type: "datetime", sortable: true }),
    ],
    help: {
      title: "Recepciones — cómo funciona",
      body: (
        <>
          <p>
            Ingreso físico de mercadería contra una Orden de compra —
            puede ser <b>parcial</b> (varias recepciones hasta completar lo
            ordenado; el selector de renglón muestra cuánto queda
            pendiente, y el sistema no deja recibir más de lo ordenado).
          </p>
          <p>
            Cada recepción dispara automáticamente el ingreso al{" "}
            <b>kardex de inventario</b> y la generación de la{" "}
            <b>factura en Cuentas por Pagar</b> — no hace falta ningún paso
            extra. "Reversar CxP" deshace ambos si la factura aún no tiene
            pagos aplicados.
          </p>
        </>
      ),
    },
  },
  devoluciones: {
    title: "Devoluciones a proveedor",
    subtitle: "Devolución de mercadería recibida.",
    basePath: "/api/com/devoluciones",
    idField: "idDevolucion",
    columns: [
      c("idDevolucion", "#", { sortable: true, type: "id", width: 84 }),
      c("idRecepcion", "Recepción", { refKind: "docRecepcion", width: 104 }),
      c("motivo", "Motivo", { type: "text", grow: true }),
      c("fechaDevolucion", "Fecha", { type: "datetime", sortable: true }),
    ],
    help: {
      title: "Devoluciones a proveedor — cómo funciona",
      body: (
        <p>
          Devuelve mercadería ya recibida (defectuosa, incorrecta, etc.)
          contra una Recepción concreta — no puede devolverse más cantidad
          de la que esa recepción realmente recibió. Se puede eliminar solo
          el mismo día en que se registró (corrección de captura).
        </p>
      ),
    },
  },
};

/** Todos los estados posibles de una solicitud (StateMachine del backend). */
const SOLICITUD_ESTADOS_TODOS: readonly string[] = [
  "PENDIENTE_JEFE",
  "PENDIENTE_GERENTE",
  "EN_COTIZACION",
  "ORDEN_GENERADA",
  "RECHAZADA",
];

const OC_TRANSICIONES: Record<string, readonly string[]> = {
  EMITIDA: ["ENVIADA", "CANCELADA", "RECHAZADA"],
  ENVIADA: ["EN_TRANSITO", "RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "CANCELADA"],
  EN_TRANSITO: ["RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "CANCELADA"],
  RECIBIDA_PARCIAL: ["RECIBIDA_COMPLETA"],
};

type ActionModalState =
  | null
  | { kind: "aprobar" | "rechazar"; id: number; estado: string }
  | { kind: "estado"; id: number; opciones: readonly string[] };

/** Que sigue si se aprueba, segun el nivel actual — para decirlo ANTES de confirmar, no solo despues. */
const SIGUIENTE_SI_APRUEBA: Record<string, string> = {
  PENDIENTE_JEFE: "Pasará a la aprobación del Gerente de área.",
  PENDIENTE_GERENTE: "Pasará a Cotización — el Departamento de Compras podrá invitar proveedores.",
};

export default function DocumentoList(props: {
  configKey: string;
  onAbrirComparativo?: (idSolicitud: number) => void;
  onFlowStep?: (leafId: string) => void;
}): React.ReactElement {
  const config = DOCUMENTO_CONFIGS[props.configKey];
  const toast = useToast();
  const refs = useRefs();
  const { hasPerm, sesion } = useAuth();
  const puedeAprobarJefe = hasPerm(Permisos.SOLICITUD_APROBAR_JEFE);
  const puedeAprobarGerente = hasPerm(Permisos.SOLICITUD_APROBAR_GERENTE);
  const puedeAprobar = puedeAprobarJefe || puedeAprobarGerente;
  /** El nivel de la fila debe coincidir con el permiso del rol — un gerente
   *  sin `APROBAR_JEFE` no debe ver "Aprobar" en algo que aun espera al jefe,
   *  y viceversa (el backend ya lo rechaza con 403; esto evita ofrecerlo). */
  const puedeDecidirNivel = (r: Row): boolean => {
    const estado = String(r["estado"]);
    if (estado === "PENDIENTE_JEFE") return puedeAprobarJefe;
    if (estado === "PENDIENTE_GERENTE") return puedeAprobarGerente;
    return false;
  };
  // Estados que le corresponden al rol (uno o ambos, si tuviera los 2 permisos).
  const nivelesPropios = [
    ...(puedeAprobarJefe ? ["PENDIENTE_JEFE"] : []),
    ...(puedeAprobarGerente ? ["PENDIENTE_GERENTE"] : []),
  ];
  const muestraToggleAprobacion = props.configKey === "solicitudes" && puedeAprobar;
  const [vistaAprobacion, setVistaAprobacion] = useState<"mio" | "otros">("mio");
  const puedeCrear = hasPerm(CREAR_PERM[props.configKey] ?? "__none__");
  const tipoAdjunto = TIPO_ADJUNTO[props.configKey];
  const service = useMemo(
    () => new DocumentoAppService(config?.basePath ?? "/api/com/solicitudes"),
    [config?.basePath],
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  // La vista (busqueda, filtros, orden) se RECUERDA por pantalla: al volver no se pierde lo que se habia puesto.
  const vistaInicial = useMemo(() => leerVista(props.configKey), [props.configKey]);
  const [search, setSearch] = useState(vistaInicial.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(vistaInicial.search ?? "");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(vistaInicial.filtros ?? {});
  /** Orden elegido en un encabezado (server-side). null = lo mas reciente primero. */
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(vistaInicial.sort ?? null);
  /** Filtro rapido activo (chips sobre la tabla). */
  const [filtroRapido, setFiltroRapido] = useState<string>(vistaInicial.filtroRapido ?? "todas");
  useEffect(() => {
    guardarVista(props.configKey, { search, filtros: filterValues, sort, filtroRapido });
  }, [props.configKey, search, filterValues, sort, filtroRapido]);
  /** Descarta respuestas viejas: si el usuario teclea rapido, solo la ultima consulta pinta. */
  const loadSeq = useRef(0);

  // Debounce: solo dispara la re-consulta 300ms despues de dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [modal, setModal] = useState<ActionModalState>(null);
  const [form, setForm] = useState<Record<string, FieldValue>>({});
  const [nuevoOpen, setNuevoOpen] = useState(false);
  // Recepciones usa el asistente guiado (lineas pendientes ya pobladas, tope
  // dinamico, confirmacion) en vez del DocumentForm generico de "Nuevo".
  const [recepcionGuiadaOpen, setRecepcionGuiadaOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  /** Fila recien creada/editada (se resalta unos segundos). */
  const [resaltarId, setResaltarId] = useState<number | null>(null);
  useEffect(() => {
    if (resaltarId === null) return;
    const t = window.setTimeout(() => setResaltarId(null), 5000);
    return () => window.clearTimeout(t);
  }, [resaltarId]);
  /** Conteos REALES (de todo el filtro, no de la pagina) para los filtros rapidos. */
  const [conteosRapidos, setConteosRapidos] = useState<Record<string, number>>({});
  /** Cuantas solicitudes hay en cada pestana de aprobacion (se ve sin entrar a cada una). */
  const [conteoVistas, setConteoVistas] = useState<{ mio: number; otros: number } | null>(null);
  /** Tras decidir desde el panel de detalle: pasar al siguiente pendiente de la cola. */
  const avanzarDetalle = useRef<{ desde: number; cola: number[] } | null>(null);
  const [vistaPreviaId, setVistaPreviaId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [toReverse, setToReverse] = useState<number | null>(null);
  const [toCancelRfq, setToCancelRfq] = useState<number | null>(null);
  const [asistenteSolicitud, setAsistenteSolicitud] = useState<number | null>(null);
  const [editState, setEditState] = useState<{
    id: number;
    initial: { header: Record<string, string>; lines?: Record<string, string>[] };
    fields: readonly string[];
    editLines?: boolean;
  } | null>(null);
  const nuevoConfig = DOCUMENT_FORMS[props.configKey];
  // Articulos bajo su stock minimo (INV_ALERTA_ESCASEZ via escasezSubscriber):
  // solo se pide en la pantalla de Solicitudes, para quien puede crearlas.
  const [bajoMinimo, setBajoMinimo] = useState<Row[]>([]);
  const [sugerenciaInicial, setSugerenciaInicial] = useState<{
    header: Record<string, string>;
    lines: Record<string, string>[];
    /** Aviso al registrar (por omision: reabastecimiento). */
    mensaje?: string;
    /** Al registrar: p. ej. vincular las alertas de escasez con la solicitud creada. */
    alCrear?: (creado?: Record<string, unknown>) => void;
  } | null>(null);
  useEffect(() => {
    if (props.configKey !== "solicitudes" || !puedeCrear) return;
    let alive = true;
    void (async () => {
      try {
        const page = await http.list<Row>("/api/com/ref/articulos/bajo-minimo");
        if (alive) setBajoMinimo([...page.data]);
      } catch {
        if (alive) setBajoMinimo([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.configKey, puedeCrear]);
  // Cerrojo real de Editar/Eliminar de cotizaciones (RFQ ABIERTO + sin linea
  // adjudicada) — depende de datos que la propia fila no trae, se resuelve
  // aparte con `GET /api/com/ref/cotizaciones-editables`.
  const [cotizacionesEditables, setCotizacionesEditables] = useState<Map<number, boolean>>(
    new Map(),
  );
  const cotizacionEditable = useCallback(
    (r: Row) => cotizacionesEditables.get(Number(r["idCotizacion"])) === true,
    [cotizacionesEditables],
  );
  // Mismo problema para RFQ: "ABIERTO" no basta, tambien exige que no tenga
  // cotizaciones registradas (`RfqService.eliminar`).
  const [rfqEliminableMap, setRfqEliminableMap] = useState<Map<number, boolean>>(new Map());
  const rfqEliminable = useCallback(
    (r: Row) => rfqEliminableMap.get(Number(r["idRfq"])) === true,
    [rfqEliminableMap],
  );
  // Responsable del siguiente paso de cada solicitud (jefe/gerente/Compras) —
  // para que el solicitante o quien acaba de decidir sepa a quien pedirle que
  // continue, sin tener que preguntar o adivinar.
  const [responsables, setResponsables] = useState<
    Record<number, { rol: string; nombre: string | null } | null>
  >({});

  /** Parametros de consulta de la vista ACTUAL (busqueda + filtros + orden). Los usan la lista y "Exportar todo". */
  function construirExtra(): Record<string, string | number> | undefined {
    let extra: Record<string, string | number> | undefined;
    if (muestraToggleAprobacion) {
      const estadosVista =
        vistaAprobacion === "mio"
          ? nivelesPropios
          : SOLICITUD_ESTADOS_TODOS.filter((e) => !nivelesPropios.includes(e));
      extra = { estado__in: estadosVista.join(",") };
    } else {
      const chip = (FILTROS_RAPIDOS[props.configKey] ?? []).find((c) => c.id === filtroRapido);
      if (chip !== undefined && Object.keys(chip.extra).length > 0) extra = { ...chip.extra };
    }
    if (debouncedSearch.trim() !== "") extra = { ...extra, q: debouncedSearch.trim() };
    if (sort !== null) extra = { ...extra, sort: sort.key, order: sort.dir };
    for (const [k, v] of Object.entries(filterValues)) {
      if (v !== "") extra = { ...extra, [`${k}__eq`]: v };
    }
    return extra;
  }

  /** Todo lo que cumple el filtro actual (hasta 2000 filas), no solo la pagina visible. */
  async function exportarTodo(): Promise<readonly Row[]> {
    const extra = construirExtra();
    const out: Row[] = [];
    for (let p = 1; p <= 10; p++) {
      const r = await service.list(p, 200, extra);
      out.push(...(r.data as Row[]));
      if (p >= r.meta.totalPages) break;
    }
    return out;
  }

  const load = useCallback(async () => {
    if (config === undefined) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const extra = construirExtra();
      const res = await service.list(page, 20, extra);
      if (seq !== loadSeq.current) return; // llego una consulta mas nueva
      setRows(res.data as Row[]);
      setMeta(res.meta);
      if (props.configKey === "cotizaciones") {
        try {
          const est = await http.raw<{ data: { idCotizacion: number; editable: boolean }[] }>(
            "/api/com/ref/cotizaciones-editables",
          );
          setCotizacionesEditables(new Map(est.data.map((e) => [e.idCotizacion, e.editable])));
        } catch {
          setCotizacionesEditables(new Map());
        }
      }
      if (props.configKey === "rfq") {
        try {
          const est = await http.raw<{ data: { idRfq: number; eliminable: boolean }[] }>(
            "/api/com/ref/rfq-eliminable",
          );
          setRfqEliminableMap(new Map(est.data.map((e) => [e.idRfq, e.eliminable])));
        } catch {
          setRfqEliminableMap(new Map());
        }
      }
      if (muestraToggleAprobacion) {
        const mios = nivelesPropios.join(",");
        const otros = SOLICITUD_ESTADOS_TODOS.filter((e) => !nivelesPropios.includes(e)).join(",");
        void Promise.all([service.list(1, 1, { estado__in: mios }), service.list(1, 1, { estado__in: otros })])
          .then(([a, b]) => setConteoVistas({ mio: a.meta.total, otros: b.meta.total }))
          .catch(() => undefined);
      }
      if (props.configKey === "solicitudes") {
        const ids = (res.data as Row[]).map((r) => Number(r["idSolicitud"])).filter((n) => Number.isFinite(n));
        if (ids.length === 0) {
          setResponsables({});
        } else {
          try {
            const r = await http.raw<{ data: Record<string, { rol: string; nombre: string | null } | null> }>(
              "/api/com/ref/solicitudes/responsables",
              { ids: ids.join(",") },
            );
            setResponsables(r.data);
          } catch {
            setResponsables({});
          }
        }
      }
    } catch (e: unknown) {
      if (seq === loadSeq.current) toast.error(messageOf(e));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, service, page, toast, muestraToggleAprobacion, vistaAprobacion, nivelesPropios.join(","), props.configKey, debouncedSearch, filterValues, sort, filtroRapido]);

  useEffect(() => {
    void load();
  }, [load]);

  // En vivo: si este documento cambia en otro lado (alguien aprobo/rechazo, o se
  // reconecto el canal), la lista se actualiza sola — sin recargar la pagina.
  useEffect(() => {
    if (config === undefined) return;
    const recargar = (p: { resource: string }): void => {
      if (p.resource === config.basePath) void load();
    };
    const offs = [AppEvents.EntityCreated, AppEvents.EntityUpdated, AppEvents.EntityRemoved].map((ev) =>
      eventBus.on<{ resource: string }>(ev, recargar),
    );
    offs.push(eventBus.on(LiveEvents.Reconectado, () => void load()));
    return () => offs.forEach((off) => off());
  }, [config, load]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaAprobacion]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sort, filtroRapido]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValues]);

  if (config === undefined) return <p>Configuración no encontrada</p>;

  const detalleIdRef = useRef<number | null>(null);
  detalleIdRef.current = detalleId;

  async function runAction(
    fn: () => Promise<unknown>,
    okMsg: string | ((result: unknown) => Promise<string>),
  ): Promise<void> {
    try {
      const result = await fn();
      toast.success(typeof okMsg === "function" ? await okMsg(result) : okMsg);
      setModal(null);
      await load();
      const av = avanzarDetalle.current;
      avanzarDetalle.current = null;
      if (av !== null && detalleIdRef.current === av.desde) {
        const siguiente = av.cola[0];
        setDetalleId(siguiente ?? null);
        if (siguiente === undefined) toast.info("No quedan más pendientes en tu lista");
      }
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  /** "{prefijo} — ahora depende de Ana Castillo (Gerente de área)". */
  async function mensajeConResponsable(idSolicitud: number, prefijo: string): Promise<string> {
    if (!Number.isFinite(idSolicitud)) return prefijo;
    try {
      const r = await http.raw<{ data: Record<string, { rol: string; nombre: string | null } | null> }>(
        "/api/com/ref/solicitudes/responsables",
        { ids: String(idSolicitud) },
      );
      const resp = r.data[String(idSolicitud)];
      if (resp === null || resp === undefined) return `${prefijo} — ya no queda nadie más por decidir`;
      const quien = resp.nombre !== null ? `${resp.nombre} (${resp.rol})` : resp.rol;
      return `${prefijo} — ahora depende de ${quien}`;
    } catch {
      return prefijo;
    }
  }

  async function mensajeTrasAprobar(result: unknown): Promise<string> {
    return mensajeConResponsable(Number((result as Row)["idSolicitud"]), "Solicitud aprobada");
  }

  async function eliminarDoc(): Promise<void> {
    if (toDelete === null) return;
    const id = toDelete;
    setToDelete(null);
    setDetalleId(null);
    // Borrado con DESHACER: la fila desaparece al instante y la baja real se ejecuta a los 6 s,
    // salvo que el usuario pulse "Deshacer".
    setRows((rs) => rs.filter((r) => Number(r[config!.idField]) !== id));
    let deshecho = false;
    const timer = window.setTimeout(() => {
      if (deshecho) return;
      void (async () => {
        try {
          await service.eliminar(id);
        } catch (e: unknown) {
          toast.error(messageOf(e));
        } finally {
          await load();
        }
      })();
    }, 6000);
    toast.info("Documento eliminado", 6000, {
      label: "Deshacer",
      onClick: () => {
        deshecho = true;
        window.clearTimeout(timer);
        void load();
      },
    });
  }

  /** Aprobacion masiva de solicitudes (solo las del nivel del usuario). */
  async function aprobarMasivo(filas: readonly Row[]): Promise<void> {
    const idEmpleado = sesion?.idEmpleado ?? 0;
    if (idEmpleado <= 0) {
      toast.error("Tu usuario no tiene un empleado asociado");
      return;
    }
    const mias = filas.filter((r) => puedeDecidirNivel(r));
    if (mias.length === 0) {
      toast.info("Ninguna de las seleccionadas espera tu aprobación");
      return;
    }
    let ok = 0;
    let fallos = 0;
    for (const r of mias) {
      try {
        await service.accion(`${Number(r["idSolicitud"])}/aprobar`, { idEmpleado, comentario: "Aprobación masiva" });
        ok++;
      } catch {
        fallos++;
      }
    }
    if (ok > 0) toast.success(`${ok} solicitud${ok === 1 ? "" : "es"} aprobada${ok === 1 ? "" : "s"}${fallos > 0 ? ` · ${fallos} no se pudo` : ""}`);
    else toast.error("No se pudo aprobar ninguna de las seleccionadas");
    await load();
  }

  async function cancelarRfq(): Promise<void> {
    if (toCancelRfq === null) return;
    try {
      await service.accion(`${toCancelRfq}/cancelar`);
      toast.success("RFQ cancelado");
      setToCancelRfq(null);
      await load();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  async function reversarRecepcion(): Promise<void> {
    if (toReverse === null) return;
    try {
      await service.accion(`${toReverse}/reversar`);
      toast.success("Recepción reversada; factura de CxP anulada");
      setToReverse(null);
      setDetalleId(null);
      await load();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  async function abrirComparativoDeCotizacion(r: Row): Promise<void> {
    try {
      const rfqId = Number(r["idRfq"]);
      const rfq = (await http.get(`/api/com/rfq/${rfqId}`)) as
        | { header?: { idSolicitud?: number }; idSolicitud?: number }
        | undefined;
      const idSol = Number(rfq?.header?.idSolicitud ?? rfq?.idSolicitud);
      if (Number.isInteger(idSol) && idSol > 0) props.onAbrirComparativo?.(idSol);
      else toast.error("No se pudo ubicar la solicitud de esta cotización");
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  const seedEdit = (r: Row): void => {
    const fields = EDIT_FIELDS[props.configKey] ?? [];
    const header: Record<string, string> = {};
    for (const f of fields) header[f] = str(r[f]);
    if (r["version"] !== undefined) header["version"] = str(r["version"]);
    setEditState({ id: Number(r[config.idField]), fields, initial: { header } });
  };

  /** Cotizacion: edita cabecera + reemplaza las lineas (el backend ya lo soporta
   *  con RFQ ABIERTO y sin adjudicar). Trae el documento completo para sembrar. */
  const seedEditCotizacion = async (r: Row): Promise<void> => {
    try {
      const full = (await service.obtener(Number(r[config.idField]))) as {
        header?: Row;
        details?: Row[];
      };
      const h = full.header ?? r;
      const details = full.details ?? [];
      setEditState({
        id: Number(r[config.idField]),
        fields: EDIT_FIELDS["cotizaciones"] ?? [],
        editLines: true,
        initial: {
          header: {
            // idRfq no es editable pero se necesita para resolver el select
            // dependiente "Renglon de la solicitud" de cada linea.
            idRfq: str(h["idRfq"]),
            idCondicionPago: str(h["idCondicionPago"]),
            idMoneda: str(h["idMoneda"]),
            tasaCambio: str(h["tasaCambio"]),
            fechaVencimiento: str(h["fechaVencimiento"]).slice(0, 16),
            version: str(h["version"]),
          },
          lines: details.map((d) => ({
            idSolicitudDetalle: str(d["idSolicitudDetalle"]),
            precioUnitario: str(d["precioUnitario"]),
            cantidad: str(d["cantidad"]),
            idUnidadMedida: str(d["idUnidadMedida"]),
            porcentajeDescuento: str(d["porcentajeDescuento"]),
            porcentajeImpuesto: str(d["porcentajeImpuesto"]),
          })),
        },
      });
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  };

  /**
   * Repetir una compra: abre una SOLICITUD nueva con los articulos y cantidades de esta orden (que recorrera el flujo
   * normal: aprobacion, cotizacion, adjudicacion). La OC no se copia tal cual porque exige una oferta adjudicada.
   */
  const [recompra, setRecompra] = useState<{ header: Record<string, string>; lines: Record<string, string>[]; origen: number } | null>(null);
  const repetirCompra = async (r: Row): Promise<void> => {
    try {
      const idOc = Number(r[config.idField]);
      const full = (await service.obtener(idOc)) as { header?: Row; details?: Row[] };
      const h = full.header ?? r;
      let grupo = "";
      let termino = "";
      let centro = "";
      let prioridad = "3";
      const idSol = Number(h["idSolicitud"]);
      if (Number.isFinite(idSol) && idSol > 0) {
        try {
          const sol = (await http.get<{ header?: Row }>(`/api/com/solicitudes/${idSol}`)).header;
          grupo = str(sol?.["idGrupoCompra"]);
          termino = str(sol?.["idTerminoEntrega"]);
          centro = str(sol?.["idCentroCosto"]);
          prioridad = str(sol?.["prioridad"]) || "3";
        } catch {
          /* la solicitud origen puede no ser visible para este usuario: se piden esos datos a mano */
        }
      }
      setRecompra({
        origen: idOc,
        header: {
          idGrupoCompra: grupo,
          idTerminoEntrega: termino,
          idCentroCosto: centro,
          prioridad,
          justificacion: `Recompra de la orden OC-${idOc}.`,
        },
        lines: (full.details ?? []).map((d) => ({
          idArticulo: str(d["idArticulo"]),
          descripcion: str(d["descripcion"]),
          cantidadSolicitada: str(d["cantidad"]),
          idUnidadMedida: str(d["idUnidadMedida"]),
        })),
      });
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  };

  /** Duplicar: abre una solicitud NUEVA con los mismos datos y renglones (la fecha requerida vuelve a hoy + 14 d). */
  /** Vincula alertas de escasez con la solicitud creada para no volver a ofrecerlas. */
  const vincularAlertas = (idAlertas: number[]) => (creado?: Record<string, unknown>): void => {
    const h = (creado?.["header"] ?? creado) as Record<string, unknown> | undefined;
    const idSolicitud = Number(h?.["idSolicitud"]);
    if (!Number.isFinite(idSolicitud) || idSolicitud <= 0) return;
    void http
      .post("/api/com/ref/articulos/bajo-minimo/vincular", { idSolicitud, idAlertas })
      .then(() => setBajoMinimo((prev) => prev.filter((a) => !idAlertas.includes(Number(a["idAlerta"])))))
      .catch(() => undefined);
  };

  const duplicarSolicitud = async (r: Row): Promise<void> => {
    try {
      const full = (await service.obtener(Number(r[config.idField]))) as { header?: Row; details?: Row[] };
      const h = full.header ?? r;
      setSugerenciaInicial({
        mensaje: `Solicitud duplicada de SOL-${str(r[config.idField])} registrada`,
        header: {
          idGrupoCompra: str(h["idGrupoCompra"]),
          idTerminoEntrega: str(h["idTerminoEntrega"]),
          idCentroCosto: str(h["idCentroCosto"]),
          prioridad: str(h["prioridad"]),
          montoEstimado: str(h["montoEstimado"]),
          justificacion: str(h["justificacion"]),
        },
        lines: (full.details ?? []).map((d) => ({
          idArticulo: str(d["idArticulo"]),
          descripcion: str(d["descripcion"]),
          cantidadSolicitada: str(d["cantidadSolicitada"]),
          idUnidadMedida: str(d["idUnidadMedida"]),
        })),
      });
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  };

  const detalleCampos = (): readonly CampoDetalle[] => {
    const ck = props.configKey;
    if (ck === "rfq") {
      return [
        { label: "Solicitud", render: (h) => `SOL-${str(h["idSolicitud"])}` },
        { label: "Fecha límite", render: (h) => str(h["fechaLimite"]).slice(0, 10) || "—" },
      ];
    }
    if (ck === "cotizaciones") {
      return [
        { label: "RFQ", render: (h) => `RFQ-${str(h["idRfq"])}` },
        { label: "Proveedor", render: (h) => refs.label("proveedor", h["idProveedor"]) },
        { label: "Condición de pago", render: (h) => refs.label("condicionPago", h["idCondicionPago"]) },
        { label: "Moneda", render: (h) => refs.label("moneda", h["idMoneda"]) },
        { label: "Tasa de cambio", render: (h) => `x ${n(h["tasaCambio"]).toFixed(2)}` },
        { label: "Fecha cotización", render: (h) => str(h["fechaCotizacion"]).slice(0, 10) || "—" },
        { label: "Vence", render: (h) => str(h["fechaVencimiento"]).slice(0, 10) || "—" },
      ];
    }
    if (ck === "ordenesCompra") {
      return [
        { label: "Proveedor", render: (h) => refs.label("proveedor", h["idProveedor"]) },
        { label: "Gerente financiero", render: (h) => refs.label("empleado", h["idEmpleadoGerenteFinanciero"]) },
        { label: "Moneda", render: (h) => refs.label("moneda", h["idMoneda"]) },
        { label: "Tasa de cambio", render: (h) => `x ${n(h["tasaCambio"]).toFixed(2)}` },
        { label: "Emisión", render: (h) => str(h["fechaEmision"]).slice(0, 10) || "—" },
        { label: "Entrega esperada", render: (h) => str(h["fechaEntregaEsperada"]).slice(0, 10) || "—" },
        {
          label: "Costo de envío",
          render: (h) => (h["costoEnvio"] === null || h["costoEnvio"] === undefined ? "No registrado" : n(h["costoEnvio"]) === 0 ? "Gratuito" : n(h["costoEnvio"]).toFixed(2)),
        },
        { label: "Referencia", render: (h) => str(h["numeroReferencia"]) || "—" },
      ];
    }
    if (ck === "recepciones") {
      return [
        { label: "Orden de compra", render: (h) => `OC-${str(h["idOrdenCompra"])}` },
        { label: "Bodega", render: (h) => refs.label("bodega", h["idBodega"]) },
        { label: "Recibe", render: (h) => refs.label("empleado", h["idEmpleadoRecibe"]) },
        { label: "Fecha", render: (h) => str(h["fechaRecepcion"]).slice(0, 16).replace("T", " ") || "—" },
      ];
    }
    if (ck === "devoluciones") {
      return [
        { label: "Recepción", render: (h) => `REC-${str(h["idRecepcion"])}` },
        { label: "Motivo", render: (h) => str(h["motivo"]) || "—" },
        { label: "Solicita", render: (h) => refs.label("empleado", h["idEmpleadoSolicita"]) },
        { label: "Fecha", render: (h) => str(h["fechaDevolucion"]).slice(0, 16).replace("T", " ") || "—" },
      ];
    }
    // solicitudes
    return [
      { label: "Solicitante", render: (h) => refs.label("empleado", h["idEmpleadoSolicitante"]) },
      { label: "Grupo de compra", render: (h) => refs.label("grupoCompra", h["idGrupoCompra"]) },
      { label: "Sucursal", render: (h) => refs.label("sucursal", h["idSucursal"]) },
      { label: "Prioridad", render: (h) => prioridadLabel(str(h["prioridad"])) },
      { label: "Monto estimado", render: (h) => (n(h["montoEstimado"]) > 0 ? formatMoney(n(h["montoEstimado"])) : "Sin monto") },
      { label: "Justificación", render: (h) => str(h["justificacion"]) || "—" },
    ];
  };

  const detalleColumnas = (): readonly ColumnaLinea[] => {
    const ck = props.configKey;
    if (ck === "rfq") {
      return [
        { header: "Proveedor invitado", render: (l) => refs.label("proveedor", l["idProveedor"]) },
      ];
    }
    if (ck === "cotizaciones") {
      return [
        { header: "Renglón sol.", render: (l) => `#${str(l["idSolicitudDetalle"])}` },
        { header: "Cant.", num: true, render: (l) => formatQty(n(l["cantidad"])) },
        { header: "P. unitario", num: true, render: (l) => formatMoney(n(l["precioUnitario"])) },
        { header: "Desc %", num: true, render: (l) => str(l["porcentajeDescuento"]) },
        { header: "Imp %", num: true, render: (l) => str(l["porcentajeImpuesto"]) },
        { header: "P. neto", num: true, render: (l) => formatMoney(neto(l)) },
        { header: "Total línea", num: true, render: (l) => formatMoney(totalLinea(l)) },
        { header: "Adj.", render: (l) => (l["adjudicado"] === "S" || l["adjudicado"] === true ? "Sí" : "") },
      ];
    }
    if (ck === "ordenesCompra") {
      return [
        { header: "Descripción", render: (l) => str(l["descripcion"]) },
        { header: "Cant.", num: true, render: (l) => formatQty(n(l["cantidad"])) },
        { header: "P. unitario", num: true, render: (l) => formatMoney(n(l["precioUnitario"])) },
        { header: "Desc %", num: true, render: (l) => str(l["porcentajeDescuento"]) },
        { header: "Subtotal", num: true, render: (l) => formatMoney(n(l["subtotalCalculado"] ?? neto(l) * n(l["cantidad"]))) },
      ];
    }
    if (ck === "recepciones") {
      return [
        { header: "Renglón OC", render: (l) => `#${str(l["idOcDetalle"])}` },
        { header: "Recibido", num: true, render: (l) => formatQty(n(l["cantidadRecibida"])) },
        { header: "Rechazado", num: true, render: (l) => formatQty(n(l["cantidadRechazada"])) },
      ];
    }
    if (ck === "devoluciones") {
      return [
        { header: "Renglón recep.", render: (l) => `#${str(l["idRecepcionDetalle"])}` },
        { header: "Devuelto", num: true, render: (l) => formatQty(n(l["cantidadDevuelta"])) },
      ];
    }
    return [
      // Un solo dato por renglon: el artículo (su nombre ya lo describe); la descripcion libre solo si no hay artículo.
      {
        header: "Artículo",
        render: (l) => (l["idArticulo"] !== null && l["idArticulo"] !== undefined && l["idArticulo"] !== "" ? refs.label("articulo", l["idArticulo"]) : str(l["descripcion"])),
      },
      { header: "Cant.", num: true, render: (l) => formatQty(n(l["cantidadSolicitada"])) },
      { header: "Unidad", render: (l) => refs.label("unidadMedida", l["idUnidadMedida"]) },
    ];
  };

  const actions: RowAction<Row>[] = [];

  if (DETALLE_KEYS.has(props.configKey)) {
    actions.push({
      label: "Detalle",
      hotkey: "d",
      icon: "search",
      tone: "muted",
      primary: props.configKey === "cotizaciones" || props.configKey === "recepciones",
      onClick: (r) => setDetalleId(Number(r[config.idField])),
    });
  }

  if (props.configKey === "cotizaciones") {
    if (hasPerm(Permisos.ANALISIS_VER)) {
      actions.push({
        label: "Comparar",
        hotkey: "c",
        icon: "award",
        tone: "muted",
        onClick: (r) => void abrirComparativoDeCotizacion(r),
      });
    }
    if (puedeCrear) {
      actions.push({
        label: "Editar",
        hotkey: "e",
        icon: "edit",
        hidden: (r) => !cotizacionEditable(r),
        onClick: (r) => void seedEditCotizacion(r),
      });
    }
  }

  if (props.configKey === "ordenesCompra" && hasPerm(Permisos.SOLICITUD_CREAR)) {
    actions.push({
      label: "Repetir compra",
      hotkey: "u",
      icon: "copy",
      tone: "muted",
      onClick: (r) => void repetirCompra(r),
    });
  }

  if (props.configKey === "ordenesCompra" && puedeCrear) {
    actions.push({
      label: "Editar",
      hotkey: "e",
      icon: "edit",
      hidden: (r) => LOCK_EDITAR["ordenesCompra"]?.(r) ?? true,
      onClick: (r) => seedEdit(r),
    });
  }

  if (props.configKey === "solicitudes") {
    // Orden por importancia: la decision de aprobacion primero, luego rechazo,
    // y por ultimo la ayuda de navegacion al comparativo.
    if (puedeAprobar) {
      actions.push(
        {
          label: "Aprobar",
          hotkey: "a",
          icon: "check",
          primary: true,
          hidden: (r) => !puedeDecidirNivel(r),
          onClick: (r) => {
            setForm({ comentario: "" });
            setModal({ kind: "aprobar", id: Number(r["idSolicitud"]), estado: String(r["estado"] ?? "") });
          },
        },
        {
          label: "Rechazar",
          hotkey: "r",
          icon: "x",
          tone: "danger",
          primary: true,
          hidden: (r) => !puedeDecidirNivel(r),
          onClick: (r) => {
            setForm({ comentario: "" });
            setModal({ kind: "rechazar", id: Number(r["idSolicitud"]), estado: String(r["estado"] ?? "") });
          },
        },
      );
    }
    if (puedeCrear) {
      actions.push({
        label: "Duplicar",
        hotkey: "u",
        icon: "copy",
        tone: "muted",
        onClick: (r) => void duplicarSolicitud(r),
      });
      // Editar la cabecera SOLO mientras nadie la ha aprobado (PENDIENTE_JEFE).
      actions.push({
        label: "Editar",
        hotkey: "e",
        icon: "edit",
        hidden: (r) => String(r["estado"]) !== "PENDIENTE_JEFE",
        onClick: (r) =>
          setEditState({
            id: Number(r["idSolicitud"]),
            fields: [
              "idGrupoCompra",
              "idTerminoEntrega",
              "idCentroCosto",
              "prioridad",
              "montoEstimado",
              "justificacion",
            ],
            initial: {
              header: {
                idGrupoCompra: str(r["idGrupoCompra"]),
                idTerminoEntrega: str(r["idTerminoEntrega"]),
                idCentroCosto: str(r["idCentroCosto"]),
                prioridad: str(r["prioridad"]),
                montoEstimado: str(r["montoEstimado"]),
                justificacion: str(r["justificacion"]),
                version: str(r["version"]),
              },
            },
          }),
      });
    }
    if (hasPerm(Permisos.RFQ_GESTIONAR)) {
      // Asistente guiado: RFQ -> cotizacion por proveedor -> comparativo, sin
      // saltar entre pantallas copiando IDs a mano.
      actions.push({
        label: "Iniciar cotización",
        icon: "send",
        tone: "brand",
        primary: true,
        hidden: (r) => String(r["estado"]) !== "EN_COTIZACION",
        onClick: (r) => setAsistenteSolicitud(Number(r["idSolicitud"])),
      });
    }
    if (hasPerm(Permisos.ANALISIS_VER)) {
      actions.push({
        label: "Comparativo",
        icon: "award",
        tone: "muted",
        onClick: (r) => props.onAbrirComparativo?.(Number(r["idSolicitud"])),
      });
    }
  }

  if (props.configKey === "ordenesCompra") {
    actions.push({
      label: "Vista previa",
      icon: "search",
      primary: true,
      onClick: (r) => setVistaPreviaId(Number(r["idOrdenCompra"])),
    });
    actions.push({
      label: "Descargar PDF",
      icon: "package",
      tone: "muted",
      onClick: (r) => {
        void downloadService
          .descargarOrdenCompraPdf(Number(r["idOrdenCompra"]))
          .catch((e: unknown) => toast.error(messageOf(e)));
      },
    });
  }

  if (props.configKey === "ordenesCompra" && hasPerm(Permisos.OC_GESTIONAR)) {
    actions.push({
      label: "Cambiar estado",
      icon: "arrow-right",
      primary: true,
      onClick: (r) => {
        const opciones = OC_TRANSICIONES[String(r["estado"])] ?? [];
        if (opciones.length === 0) {
          toast.info(`La OC en estado ${String(r["estado"])} no admite cambios`);
          return;
        }
        setForm({ estado: opciones[0] ?? "" });
        setModal({ kind: "estado", id: Number(r["idOrdenCompra"]), opciones });
      },
    });
  }

  if (props.configKey === "rfq" && hasPerm(Permisos.RFQ_GESTIONAR)) {
    actions.push(
      {
        label: "Editar",
        hotkey: "e",
        icon: "edit",
        hidden: (r) => String(r["estado"]) !== "ABIERTO",
        onClick: (r) =>
          setEditState({
            id: Number(r["idRfq"]),
            fields: ["fechaLimite"],
            initial: { header: { fechaLimite: str(r["fechaLimite"]).slice(0, 10) } },
          }),
      },
      {
        label: "Cerrar",
        icon: "check",
        primary: true,
        hidden: (r) => String(r["estado"]) !== "ABIERTO",
        onClick: (r) =>
          void runAction(() => service.accion(`${Number(r["idRfq"])}/cerrar`), "RFQ cerrado"),
      },
      {
        label: "Cancelar RFQ",
        icon: "x",
        tone: "danger",
        // Descontinuar la solicitud de cotizacion (p. ej. el proyecto se cancelo).
        // El backend ya lo soporta (RfqService.cancelar); solo faltaba el boton.
        hidden: (r) => String(r["estado"]) !== "ABIERTO",
        onClick: (r) => setToCancelRfq(Number(r["idRfq"])),
      },
    );
  }

  // Nota de ingreso oficial — disponible para cualquiera que vea Recepciones.
  if (props.configKey === "recepciones") {
    actions.push({
      label: "Descargar Nota de Ingreso",
      icon: "package",
      tone: "muted",
      onClick: (r) => {
        void downloadService
          .descargarNotaIngresoPdf(Number(r["idRecepcion"]))
          .catch((e: unknown) => toast.error(messageOf(e)));
      },
    });
  }

  // Reversar recepcion que ya alimento CxP (anula la factura + compensa kardex).
  if (props.configKey === "recepciones" && puedeCrear) {
    actions.push({
      label: "Reversar CxP",
      icon: "undo",
      tone: "danger",
      hidden: (r) => String(r["estado"]) !== "ALIMENTADO_CXP",
      onClick: (r) => setToReverse(Number(r["idRecepcion"])),
    });
  }

  // Eliminar (borrado logico) — comun a todos, con cerrojo por estado.
  if (puedeCrear) {
    actions.push({
      label: "Eliminar",
      hotkey: "x",
      icon: "trash",
      tone: "danger",
      hidden: (r) => {
        if (props.configKey === "cotizaciones") return !cotizacionEditable(r);
        if (props.configKey === "rfq") return !rfqEliminable(r);
        return LOCK_ELIMINAR[props.configKey]?.(r) ?? false;
      },
      onClick: (r) => setToDelete(Number(r[config.idField])),
    });
  }

  // La accion principal de cada fila es discreta (aparece al pasar el cursor): la lista no se llena de botones iguales.
  for (let i = 0; i < actions.length; i++) if (actions[i]!.primary === true) actions[i] = { ...actions[i]!, alPasar: true };

  // Columna extra "Esperando a" solo en Solicitudes: a quien le toca decidir
  // ahora (persona si es jefe/gerente especifico, o el departamento cuando el
  // turno es de Compras). "—" cuando ya no hay nadie esperando (resuelta).
  const columnasListado: readonly Column<Row>[] =
    props.configKey !== "solicitudes"
      ? config.columns
      : (() => {
          const idx = config.columns.findIndex((col) => col.key === "estado");
          const columnaResponsable: Column<Row> = {
            key: "responsable",
            header: "Esperando a",
            priority: "secondary",
            width: 190,
            render: (r) => {
              const resp = responsables[Number(r["idSolicitud"])];
              if (resp === undefined || resp === null) {
                return <span style={{ color: "var(--color-ink-faint)" }}>—</span>;
              }
              return (
                <span style={{ color: "var(--color-ink-soft)" }}>
                  {resp.nombre ?? resp.rol}
                  {resp.nombre !== null && (
                    <span style={{ color: "var(--color-ink-faint)" }}> · {resp.rol}</span>
                  )}
                </span>
              );
            },
          };
          const next = [...config.columns];
          next.splice(idx + 1, 0, columnaResponsable);
          return next;
        })();

  // Urgencia visible (antiguedad / plazo / atraso) como columna propia, justo tras el estado.
  const urgencia = columnaUrgencia(props.configKey);
  const columnasFinal: readonly Column<Row>[] = (() => {
    if (urgencia === null) return columnasListado;
    const i = columnasListado.findIndex((c) => c.key === "estado");
    const next = [...columnasListado];
    next.splice(i >= 0 ? i + 1 : next.length, 0, urgencia);
    return next;
  })();
  const chipsRapidos = FILTROS_RAPIDOS[props.configKey];
  const abrirNuevo = (): void => (props.configKey === "recepciones" ? setRecepcionGuiadaOpen(true) : setNuevoOpen(true));

  // Conteo real por filtro rapido (se refresca con cada recarga de la lista).
  useEffect(() => {
    if (chipsRapidos === undefined) return;
    let vivo = true;
    void Promise.all(
      chipsRapidos.map(async (c) => {
        try {
          const r = await http.list<unknown>(config.basePath, { pageSize: 1, ...c.extra });
          return [c.id, r.meta.total] as const;
        } catch {
          return [c.id, -1] as const;
        }
      }),
    ).then((pares) => {
      if (vivo) setConteosRapidos(Object.fromEntries(pares.filter(([, n]) => n >= 0)));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, props.configKey]);

  // Panel de detalle: navegación entre los documentos de la lista y decisiones sin cerrarlo.
  const idsFilas = rows.map((r) => Number(r[config.idField]));
  const posDetalle = detalleId === null ? -1 : idsFilas.indexOf(detalleId);
  const filaDetalle = posDetalle >= 0 ? rows[posDetalle] : undefined;
  const decidirDesdeDetalle = (kind: "aprobar" | "rechazar"): void => {
    if (filaDetalle === undefined || detalleId === null) return;
    avanzarDetalle.current = {
      desde: detalleId,
      cola: rows.slice(posDetalle + 1).filter((r) => puedeDecidirNivel(r)).map((r) => Number(r[config.idField])),
    };
    setForm({ comentario: "" });
    setModal({ kind, id: detalleId, estado: String(filaDetalle["estado"] ?? "") });
  };
  const accionesDetalle: React.ReactNode[] = [];
  if (detalleId !== null && (props.configKey === "solicitudes" || props.configKey === "recepciones")) {
    accionesDetalle.push(
      <Button
        key="pdf"
        variant="secondary"
        icon="download"
        onClick={() => {
          const svc = downloadService;
          void (props.configKey === "solicitudes" ? svc.descargarSolicitudPdf(detalleId) : svc.descargarNotaIngresoPdf(detalleId)).catch((e: unknown) => toast.error(messageOf(e)));
        }}
      >
        PDF
      </Button>,
    );
  }
  if (props.configKey === "solicitudes" && puedeAprobar && filaDetalle !== undefined && puedeDecidirNivel(filaDetalle)) {
    accionesDetalle.push(
      <Button key="rechazar" variant="danger" icon="x" onClick={() => decidirDesdeDetalle("rechazar")}>
        Rechazar
      </Button>,
      <Button key="aprobar" icon="check" onClick={() => decidirDesdeDetalle("aprobar")}>
        Aprobar
      </Button>,
    );
  }
  const bulkAprobar = props.configKey === "solicitudes" && puedeAprobar;
  const paso = SIGUIENTE_PASO[props.configKey];
  const abrirDetalle = (r: Row): void => {
    const id = Number(r[config.idField]);
    if (DETALLE_KEYS.has(props.configKey)) setDetalleId(id);
    else if (props.configKey === "ordenesCompra") setVistaPreviaId(id);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        help={config.help}
        actions={
          nuevoConfig !== undefined && puedeCrear ? (
            <Button icon="plus" onClick={abrirNuevo}>
              Nuevo
            </Button>
          ) : undefined
        }
      />

      <FlowStepper current={FLOW_STEP[props.configKey]} onStep={props.onFlowStep} />

      {props.configKey === "solicitudes" && bajoMinimo.length > 0 && (
        <div className="card grid gap-2 p-4" style={{ borderColor: "var(--color-warning)" }}>
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--color-warning)" }}>
              <Icon name="package" size={16} />
            </span>
            <span className="text-[0.85rem] font-semibold" style={{ color: "var(--color-heading)" }}>
              {bajoMinimo.length} artículo{bajoMinimo.length > 1 ? "s" : ""} bajo el stock mínimo
            </span>
            {bajoMinimo.length > 1 && (
              <Button
                size="sm"
                icon="zap"
                className="ml-auto"
                onClick={() =>
                  setSugerenciaInicial({
                    mensaje: `Solicitud de reabastecimiento registrada (${bajoMinimo.length} artículos)`,
                    alCrear: vincularAlertas(bajoMinimo.map((a) => Number(a["idAlerta"]))),
                    header: {
                      justificacion: `Reabastecimiento automático de ${bajoMinimo.length} artículos con existencia bajo el mínimo.`,
                    },
                    lines: bajoMinimo.map((a) => ({
                      idArticulo: String(a["idArticulo"]),
                      descripcion: String(a["nombre"]),
                      cantidadSolicitada: String(a["cantidadSugerida"]),
                    })),
                  })
                }
              >
                Reabastecer todo en una solicitud
              </Button>
            )}
          </div>
          <div className="grid gap-1.5">
            {bajoMinimo.slice(0, 5).map((a) => (
              <div key={Number(a["idAlerta"])} className="flex flex-wrap items-center justify-between gap-2 text-[0.82rem]">
                <span style={{ color: "var(--color-ink-soft)" }}>
                  <b style={{ color: "var(--color-ink)" }}>{String(a["nombre"])}</b> en {String(a["bodega"])} — quedan{" "}
                  {formatQty(Number(a["cantidadActual"]))}, mínimo {formatQty(Number(a["stockMinimo"]))}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="plus"
                  onClick={() =>
                    setSugerenciaInicial({
                      alCrear: vincularAlertas([Number(a["idAlerta"])]),
                      header: {
                        justificacion: `Reabastecimiento automático — existencia bajo el mínimo (quedan ${formatQty(Number(a["cantidadActual"]))}, mínimo ${formatQty(Number(a["stockMinimo"]))}).`,
                      },
                      lines: [
                        {
                          idArticulo: String(a["idArticulo"]),
                          descripcion: String(a["nombre"]),
                          cantidadSolicitada: String(a["cantidadSugerida"]),
                        },
                      ],
                    })
                  }
                >
                  Generar solicitud
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(() => {
        const stats = config.stats?.(rows, meta.total) ?? [];
        return stats.length > 0 ? (
          <StatRow>
            {stats.map((s, i) => (
              // Indice como key: el numero/orden de tarjetas es fijo por config.
              <StatCard key={i} icon={s.icon} tone={s.tone} title={s.title} subtitle={s.subtitle} />
            ))}
          </StatRow>
        ) : null;
      })()}

      {muestraToggleAprobacion ? (
        <Tabs
          tabs={[
            { id: "mio", label: `Pendientes de mi nivel${conteoVistas !== null ? ` · ${conteoVistas.mio}` : ""}` },
            { id: "otros", label: `De otro nivel${conteoVistas !== null ? ` · ${conteoVistas.otros}` : ""}` },
          ]}
          active={vistaAprobacion}
          onChange={(id) => setVistaAprobacion(id as "mio" | "otros")}
        />
      ) : undefined}

      {chipsRapidos !== undefined && !muestraToggleAprobacion && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros rápidos">
          {chipsRapidos.map((c) => {
            const activo = filtroRapido === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltroRapido(c.id)}
                className="rounded-full px-3 py-1 text-[0.8rem] font-semibold transition-fluent"
                style={{
                  background: activo ? "var(--color-brand)" : "var(--color-surface)",
                  color: activo ? "#fff" : "var(--color-ink-soft)",
                  border: `1px solid ${activo ? "var(--color-brand)" : "var(--color-line)"}`,
                }}
              >
                {c.label}
                {conteosRapidos[c.id] !== undefined && (
                  <span style={{ opacity: 0.8, fontWeight: 500 }}> · {conteosRapidos[c.id]}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <DataTable<Row>
        columns={columnasFinal}
        rows={rows}
        onRowClick={abrirDetalle}
        columnsKey={props.configKey}
        highlightKey={resaltarId}
        {...(nuevoConfig !== undefined && puedeCrear ? { emptyAction: { label: "Crear el primero", onClick: abrirNuevo } } : {})}
        exportAll={exportarTodo}
        selectable={bulkAprobar}
        bulkActions={
          bulkAprobar ? [{ label: "Aprobar seleccionadas", icon: "check", onClick: (rs) => void aprobarMasivo(rs) }] : []
        }
        rowKey={(r) => Number(r[config.idField])}
        loading={loading}
        actions={actions}
        emptyTitle={`Aún no hay ${config.title.toLowerCase()}`}
        emptyHint={EMPTY_HINT[props.configKey]}
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPage={setPage}
        onReload={() => void load()}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: SEARCH_HINT[props.configKey] ?? `Buscar en ${config.title.toLowerCase()}…`,
        }}
        sort={sort}
        onSort={setSort}
        filters={
          config.filterFields !== undefined && config.filterFields.length > 0
            ? {
                fields: config.filterFields,
                values: filterValues,
                onChange: (key, value) => setFilterValues((prev) => ({ ...prev, [key]: value })),
                onClear: () => setFilterValues({}),
              }
            : undefined
        }
        exportFilename={props.configKey}
      />

      <Modal
        open={modal !== null}
        title={
          modal?.kind === "estado"
            ? "Cambiar estado de la orden"
            : modal?.kind === "aprobar"
              ? "Aprobar solicitud"
              : "Rechazar solicitud"
        }
        onClose={() => setModal(null)}
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button
              icon="check"
              variant={modal?.kind === "rechazar" ? "danger" : "primary"}
              onClick={() => {
                if (modal === null) return;
                if (modal.kind === "estado") {
                  void runAction(
                    () => service.accion(`${modal.id}/estado`, { estado: String(form["estado"]) }),
                    "Estado actualizado",
                  );
                } else {
                  // El aprobador es el propio usuario en sesion; no se pide a mano.
                  const idEmpleado = sesion?.idEmpleado ?? 0;
                  if (idEmpleado <= 0) {
                    toast.error("Tu usuario no tiene un empleado asociado");
                    return;
                  }
                  if (modal.kind === "rechazar" && String(form["comentario"] ?? "").trim().length < 3) {
                    toast.error("Escribe el motivo del rechazo: es lo que verá quien hizo la solicitud");
                    return;
                  }
                  const enviar = (): Promise<void> =>
                    runAction(
                      () =>
                        service.accion(`${modal.id}/${modal.kind}`, {
                          idEmpleado,
                          comentario: String(form["comentario"] ?? ""),
                        }),
                      modal.kind === "aprobar" ? mensajeTrasAprobar : "Solicitud rechazada",
                    );
                  if (modal.kind !== "rechazar") {
                    void enviar();
                    return;
                  }
                  // Rechazar con DESHACER: se confirma a los 6 s (el solicitante no recibe aviso antes), salvo que el usuario se arrepienta.
                  const idRechazada = modal.id;
                  setModal(null);
                  setRows((rs) => rs.filter((r) => Number(r["idSolicitud"]) !== idRechazada));
                  let deshecho = false;
                  const timer = window.setTimeout(() => {
                    if (!deshecho) void enviar();
                  }, 6000);
                  toast.info(`SOL-${idRechazada} se rechazará en unos segundos`, 6000, {
                    label: "Deshacer",
                    onClick: () => {
                      deshecho = true;
                      window.clearTimeout(timer);
                      void load();
                    },
                  });
                }
              }}
            >
              Confirmar
            </Button>
          </>
        }
      >
        {modal?.kind === "estado" ? (
          <div className="grid gap-3">
            <p className="text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
              El nuevo estado queda visible de inmediato para quien le da seguimiento a esta orden. No se puede deshacer desde aquí — si te equivocas, hay que corregirlo con otro cambio de estado.
            </p>
            <FormGrid>
              <Field
                def={{
                  name: "estado",
                  label: "Nuevo estado",
                  kind: "select",
                  required: true,
                  options: modal.opciones.map((o) => ({ value: o, label: estadoLabel(o) })),
                }}
                value={form["estado"] ?? ""}
                onChange={(v) => setForm((p) => ({ ...p, estado: v }))}
              />
            </FormGrid>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
              {modal?.kind === "aprobar"
                ? "Confirmas la aprobación de esta solicitud como "
                : "Vas a rechazar esta solicitud como "}
              <strong style={{ color: "var(--color-ink)" }}>{sesion?.nombre ?? "—"}</strong>.{" "}
              {modal?.kind === "aprobar"
                ? (SIGUIENTE_SI_APRUEBA[modal.estado] ?? "Avanzará al siguiente nivel del flujo.")
                : "La solicitud quedará RECHAZADA y cerrada — el solicitante verá el motivo que escribas abajo."}
            </p>
            <FormGrid>
              <Field
                def={{
                  name: "comentario",
                  label: modal?.kind === "rechazar" ? "Motivo del rechazo" : "Comentario (opcional)",
                  required: modal?.kind === "rechazar",
                  kind: "textarea",
                }}
                value={form["comentario"] ?? ""}
                onChange={(v) => setForm((p) => ({ ...p, comentario: v }))}
              />
            </FormGrid>
          </div>
        )}
      </Modal>

      {nuevoConfig !== undefined && (
        <DocumentForm
          open={nuevoOpen}
          config={nuevoConfig}
          onClose={() => setNuevoOpen(false)}
          {...(paso !== undefined && props.onFlowStep !== undefined
            ? { successAction: { label: paso.boton, onClick: () => props.onFlowStep!(paso.leafId) } }
            : {})}
          onSuccess={(created) => {
            if (props.configKey === "solicitudes" && created !== undefined) {
              void mensajeConResponsable(Number(created["idSolicitud"]), "Solicitud registrada").then((m) =>
                toast.success(m),
              );
            }
            if (created !== undefined && Number.isFinite(Number(created[config.idField]))) setResaltarId(Number(created[config.idField]));
            void load();
          }}
        />
      )}

      {props.configKey === "recepciones" && (
        <RecepcionGuiada
          open={recepcionGuiadaOpen}
          onClose={() => setRecepcionGuiadaOpen(false)}
          onSuccess={(created) => {
            setRecepcionGuiadaOpen(false);
            if (created !== undefined && Number.isFinite(Number(created[config.idField]))) setResaltarId(Number(created[config.idField]));
            void load();
          }}
        />
      )}

      {recompra !== null && DOCUMENT_FORMS["solicitudes"] !== undefined && (
        <DocumentForm
          open
          config={DOCUMENT_FORMS["solicitudes"]}
          initial={{ header: recompra.header, lines: recompra.lines }}
          onClose={() => setRecompra(null)}
          onSuccess={() => {
            toast.success(`Solicitud de recompra de OC-${recompra.origen} registrada: sigue el flujo de aprobación`);
            setRecompra(null);
          }}
        />
      )}

      {nuevoConfig !== undefined && sugerenciaInicial !== null && (
        <DocumentForm
          open
          config={nuevoConfig}
          initial={sugerenciaInicial}
          onClose={() => setSugerenciaInicial(null)}
          onSuccess={(creado) => {
            toast.success(sugerenciaInicial.mensaje ?? "Solicitud de reabastecimiento registrada");
            sugerenciaInicial.alCrear?.(creado);
            setSugerenciaInicial(null);
            void load();
          }}
        />
      )}

      {nuevoConfig !== undefined && editState !== null && (
        <DocumentForm
          open
          config={nuevoConfig}
          editId={editState.id}
          editFields={editState.fields}
          editLines={editState.editLines}
          initial={editState.initial}
          onClose={() => setEditState(null)}
          onSuccess={() => {
            setResaltarId(editState.id);
            setEditState(null);
            void load();
          }}
        />
      )}

      {DETALLE_KEYS.has(props.configKey) && detalleId !== null && (
        <DocumentoDetalle
          open
          basePath={config.basePath}
          tipoAdjunto={tipoAdjunto}
          id={detalleId}
          titulo={`${config.title} #${detalleId}`}
          campos={detalleCampos()}
          columnasLinea={detalleColumnas()}
          canWrite={puedeCrear}
          onClose={() => setDetalleId(null)}
          onEliminar={puedeCrear ? () => setToDelete(detalleId) : undefined}
          extraAcciones={accionesDetalle.length > 0 ? accionesDetalle : undefined}
          onPrev={posDetalle > 0 ? () => setDetalleId(idsFilas[posDetalle - 1]!) : undefined}
          onNext={posDetalle >= 0 && posDetalle < idsFilas.length - 1 ? () => setDetalleId(idsFilas[posDetalle + 1]!) : undefined}
          posicion={posDetalle >= 0 ? `${posDetalle + 1} de ${idsFilas.length}` : undefined}
          extraContent={
            props.configKey === "solicitudes" ? <Trazabilidad idSolicitud={detalleId} /> : undefined
          }
        />
      )}

      {vistaPreviaId !== null && (
        <OrdenCompraPreview open id={vistaPreviaId} onClose={() => setVistaPreviaId(null)} />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar documento"
        message="Se marcará como eliminado (borrado lógico). Esta acción respeta el cerrojo por estado del backend."
        onConfirm={() => void eliminarDoc()}
        onCancel={() => setToDelete(null)}
      />

      {asistenteSolicitud !== null && (
        <AsistenteCotizacion
          idSolicitud={asistenteSolicitud}
          onClose={() => setAsistenteSolicitud(null)}
          onFinish={(idSolicitud) => {
            setAsistenteSolicitud(null);
            props.onAbrirComparativo?.(idSolicitud);
          }}
        />
      )}

      <ConfirmDialog
        open={toCancelRfq !== null}
        title="Cancelar RFQ"
        confirmLabel="Cancelar RFQ"
        message="El RFQ dejará de admitir cotizaciones o cierre normal. Usa esto cuando la solicitud de cotización ya no aplica (p. ej. la compra se descartó)."
        onConfirm={() => void cancelarRfq()}
        onCancel={() => setToCancelRfq(null)}
      />

      <ConfirmDialog
        open={toReverse !== null}
        title="Reversar recepción"
        confirmLabel="Reversar"
        message="Se anulará la factura de CxP generada, se compensará el kardex con un ajuste negativo y la recepción quedará eliminada. Solo procede si la factura no tiene pagos aplicados ni devoluciones."
        onConfirm={() => void reversarRecepcion()}
        onCancel={() => setToReverse(null)}
      />
    </div>
  );
}

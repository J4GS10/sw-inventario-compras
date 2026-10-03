/**
 * Listado de documentos del flujo de compras con acciones de flujo por tipo
 * (aprobar/rechazar solicitud, cambiar estado de OC, cerrar RFQ). Sistema de
 * diseno: PageHeader + DataTable + Modal de accion + Toast.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { HistorialAprobacion } from "../../components/HistorialAprobacion.js";
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
import { estadoLabel } from "../../core/estados.js";
import { formatMoney, formatQty } from "../../core/format.js";
import { useRefs } from "../../core/RefContext.js";
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

/** Campo de texto libre por el que se puede buscar (server-side, `campo__like`). Sin entrada: sin buscador. */
const SEARCH_FIELD: Partial<Record<string, string>> = {
  solicitudes: "justificacion",
  ordenesCompra: "numeroReferencia",
  devoluciones: "motivo",
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
  ordenesCompra: ["fechaEntregaEsperada", "numeroReferencia", "idMoneda", "tasaCambio"],
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
    subtitle: "Requisiciones internas y su flujo de aprobacion jerarquico.",
    basePath: "/api/com/solicitudes",
    idField: "idSolicitud",
    columns: [
      c("idSolicitud", "#", { sortable: true, type: "num", width: 64 }),
      c("estado", "Estado", { type: "estado" }),
      c("idGrupoCompra", "Grupo de compra", { refKind: "grupoCompra", priority: "secondary" }),
      c("prioridad", "Prioridad", { type: "prioridad", sortable: true }),
      c("justificacion", "Justificacion", { type: "text", grow: true, priority: "secondary" }),
      c("montoEstimado", "Monto estimado", { type: "money" }),
    ],
    help: {
      title: "Solicitudes de compra — como funciona el flujo",
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
    subtitle: "Solicitudes formales de cotizacion enviadas a proveedores.",
    basePath: "/api/com/rfq",
    idField: "idRfq",
    columns: [
      c("idRfq", "#", { sortable: true, type: "num", width: 64 }),
      c("idSolicitud", "Solicitud", { refKind: "docSolicitud", width: 104 }),
      c("estado", "Estado", { type: "estado" }),
      c("fechaLimite", "Fecha limite", { type: "date" }),
    ],
    filterFields: [{ key: "estado", label: "Estado", options: opt(["ABIERTO", "CERRADO", "CANCELADO"]) }],
    help: {
      title: "RFQ — como funciona",
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
      c("idCotizacion", "#", { sortable: true, type: "num", width: 70 }),
      c("idRfq", "RFQ", { refKind: "docRfq", width: 96 }),
      c("idProveedor", "Proveedor", { refKind: "proveedor", grow: true }),
      c("idMoneda", "Moneda", { refKind: "moneda", width: 96, priority: "secondary" }),
      c("tasaCambio", "Tasa", { type: "rate", priority: "secondary" }),
    ],
    help: {
      title: "Cotizaciones — como funciona",
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
    title: "Ordenes de compra",
    subtitle: "Ordenes emitidas al proveedor y su ciclo de vida.",
    basePath: "/api/com/ordenes-compra",
    idField: "idOrdenCompra",
    columns: [
      c("idOrdenCompra", "#", { sortable: true, type: "num", width: 76 }),
      c("idProveedor", "Proveedor", { refKind: "proveedor", grow: true }),
      c("estado", "Estado", { type: "estado", sortable: true }),
      c("idMoneda", "Moneda", { refKind: "moneda", width: 96, priority: "secondary" }),
      c("tasaCambio", "Tasa", { type: "rate", priority: "secondary" }),
      c("fechaEmision", "Emision", { type: "date" }),
    ],
    filterFields: [
      {
        key: "estado",
        label: "Estado",
        options: opt(["EMITIDA", "ENVIADA", "EN_TRANSITO", "RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "CANCELADA", "RECHAZADA"]),
      },
    ],
    stats: (rows, total) => {
      const activas = rows.filter((r) => !["RECIBIDA_COMPLETA", "CANCELADA", "RECHAZADA"].includes(String(r["estado"] ?? ""))).length;
      const pendientesRecepcion = rows.filter((r) => ["ENVIADA", "EN_TRANSITO", "RECIBIDA_PARCIAL"].includes(String(r["estado"] ?? ""))).length;
      const completadas = rows.filter((r) => r["estado"] === "RECIBIDA_COMPLETA").length;
      return [
        { icon: "truck", tone: "brand", title: `${activas}`, subtitle: "OC activas (en esta pagina)" },
        { icon: "clock", tone: "warning", title: `${pendientesRecepcion}`, subtitle: "Pendientes de recepcion" },
        { icon: "check", tone: "success", title: `${completadas}`, subtitle: "Completadas (en esta pagina)" },
        { icon: "list", tone: "neutral", title: `${total}`, subtitle: "Total de ordenes" },
      ];
    },
    help: {
      title: "Órdenes de compra — como funciona",
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
    subtitle: "Ingreso fisico de mercaderia contra orden de compra.",
    basePath: "/api/com/recepciones",
    idField: "idRecepcion",
    columns: [
      c("idRecepcion", "#", { sortable: true, type: "num", width: 80 }),
      c("idOrdenCompra", "OC", { refKind: "docOrden", width: 96 }),
      c("idBodega", "Bodega", { refKind: "bodega", priority: "secondary" }),
      c("estado", "Estado", { type: "estado" }),
      c("fechaRecepcion", "Fecha", { type: "datetime" }),
    ],
    help: {
      title: "Recepciones — como funciona",
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
    subtitle: "Devolucion de mercaderia recibida.",
    basePath: "/api/com/devoluciones",
    idField: "idDevolucion",
    columns: [
      c("idDevolucion", "#", { sortable: true, type: "num", width: 84 }),
      c("idRecepcion", "Recepcion", { refKind: "docRecepcion", width: 104 }),
      c("motivo", "Motivo", { type: "text", grow: true, priority: "secondary" }),
      c("fechaDevolucion", "Fecha", { type: "date" }),
    ],
    help: {
      title: "Devoluciones a proveedor — como funciona",
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
  PENDIENTE_JEFE: "Pasara a la aprobacion del Gerente de area.",
  PENDIENTE_GERENTE: "Pasara a Cotizacion — el Departamento de Compras podra invitar proveedores.",
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchField = SEARCH_FIELD[props.configKey];
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

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

  const load = useCallback(async () => {
    if (config === undefined) return;
    setLoading(true);
    try {
      let extra: Record<string, string | number> | undefined;
      if (muestraToggleAprobacion) {
        const estadosVista =
          vistaAprobacion === "mio"
            ? nivelesPropios
            : SOLICITUD_ESTADOS_TODOS.filter((e) => !nivelesPropios.includes(e));
        extra = { estado__in: estadosVista.join(",") };
      }
      if (searchField !== undefined && debouncedSearch.trim() !== "") {
        extra = { ...extra, [`${searchField}__like`]: debouncedSearch.trim() };
      }
      for (const [k, v] of Object.entries(filterValues)) {
        if (v !== "") extra = { ...extra, [`${k}__eq`]: v };
      }
      const res = await service.list(page, 20, extra);
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
      toast.error(messageOf(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, service, page, toast, muestraToggleAprobacion, vistaAprobacion, nivelesPropios.join(","), props.configKey, searchField, debouncedSearch, filterValues]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaAprobacion]);

  useEffect(() => {
    if (searchField !== undefined) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValues]);

  if (config === undefined) return <p>Configuracion no encontrada</p>;

  async function runAction(
    fn: () => Promise<unknown>,
    okMsg: string | ((result: unknown) => Promise<string>),
  ): Promise<void> {
    try {
      const result = await fn();
      toast.success(typeof okMsg === "function" ? await okMsg(result) : okMsg);
      setModal(null);
      await load();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  /** "{prefijo} — ahora depende de Ana Castillo (Gerente de area)". */
  async function mensajeConResponsable(idSolicitud: number, prefijo: string): Promise<string> {
    if (!Number.isFinite(idSolicitud)) return prefijo;
    try {
      const r = await http.raw<{ data: Record<string, { rol: string; nombre: string | null } | null> }>(
        "/api/com/ref/solicitudes/responsables",
        { ids: String(idSolicitud) },
      );
      const resp = r.data[String(idSolicitud)];
      if (resp === null || resp === undefined) return `${prefijo} — ya no queda nadie mas por decidir`;
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
    try {
      await service.eliminar(toDelete);
      toast.success("Documento eliminado");
      setToDelete(null);
      setDetalleId(null);
      await load();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
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
      toast.success("Recepcion reversada; factura de CxP anulada");
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
      else toast.error("No se pudo ubicar la solicitud de esta cotizacion");
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

  const detalleCampos = (): readonly CampoDetalle[] => {
    const ck = props.configKey;
    if (ck === "rfq") {
      return [
        { label: "Solicitud", render: (h) => `SOL-${str(h["idSolicitud"])}` },
        { label: "Fecha limite", render: (h) => str(h["fechaLimite"]).slice(0, 10) || "—" },
      ];
    }
    if (ck === "cotizaciones") {
      return [
        { label: "RFQ", render: (h) => `RFQ-${str(h["idRfq"])}` },
        { label: "Proveedor", render: (h) => refs.label("proveedor", h["idProveedor"]) },
        { label: "Condicion de pago", render: (h) => refs.label("condicionPago", h["idCondicionPago"]) },
        { label: "Moneda", render: (h) => refs.label("moneda", h["idMoneda"]) },
        { label: "Tasa de cambio", render: (h) => `x ${n(h["tasaCambio"]).toFixed(2)}` },
        { label: "Fecha cotizacion", render: (h) => str(h["fechaCotizacion"]).slice(0, 10) || "—" },
        { label: "Vence", render: (h) => str(h["fechaVencimiento"]).slice(0, 10) || "—" },
      ];
    }
    if (ck === "ordenesCompra") {
      return [
        { label: "Proveedor", render: (h) => refs.label("proveedor", h["idProveedor"]) },
        { label: "Gerente financiero", render: (h) => refs.label("empleado", h["idEmpleadoGerenteFinanciero"]) },
        { label: "Moneda", render: (h) => refs.label("moneda", h["idMoneda"]) },
        { label: "Tasa de cambio", render: (h) => `x ${n(h["tasaCambio"]).toFixed(2)}` },
        { label: "Emision", render: (h) => str(h["fechaEmision"]).slice(0, 10) || "—" },
        { label: "Entrega esperada", render: (h) => str(h["fechaEntregaEsperada"]).slice(0, 10) || "—" },
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
        { label: "Recepcion", render: (h) => `REC-${str(h["idRecepcion"])}` },
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
      { label: "Prioridad", render: (h) => str(h["prioridad"]) },
      { label: "Monto estimado", render: (h) => formatMoney(n(h["montoEstimado"])) },
      { label: "Justificacion", render: (h) => str(h["justificacion"]) || "—" },
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
        { header: "Renglon sol.", render: (l) => `#${str(l["idSolicitudDetalle"])}` },
        { header: "Cant.", num: true, render: (l) => formatQty(n(l["cantidad"])) },
        { header: "P. unitario", num: true, render: (l) => formatMoney(n(l["precioUnitario"])) },
        { header: "Desc %", num: true, render: (l) => str(l["porcentajeDescuento"]) },
        { header: "Imp %", num: true, render: (l) => str(l["porcentajeImpuesto"]) },
        { header: "P. neto", num: true, render: (l) => formatMoney(neto(l)) },
        { header: "Total linea", num: true, render: (l) => formatMoney(totalLinea(l)) },
        { header: "Adj.", render: (l) => (l["adjudicado"] === "S" || l["adjudicado"] === true ? "Si" : "") },
      ];
    }
    if (ck === "ordenesCompra") {
      return [
        { header: "Descripcion", render: (l) => str(l["descripcion"]) },
        { header: "Cant.", num: true, render: (l) => formatQty(n(l["cantidad"])) },
        { header: "P. unitario", num: true, render: (l) => formatMoney(n(l["precioUnitario"])) },
        { header: "Desc %", num: true, render: (l) => str(l["porcentajeDescuento"]) },
        { header: "Subtotal", num: true, render: (l) => formatMoney(n(l["subtotalCalculado"] ?? neto(l) * n(l["cantidad"]))) },
      ];
    }
    if (ck === "recepciones") {
      return [
        { header: "Renglon OC", render: (l) => `#${str(l["idOcDetalle"])}` },
        { header: "Recibido", num: true, render: (l) => formatQty(n(l["cantidadRecibida"])) },
        { header: "Rechazado", num: true, render: (l) => formatQty(n(l["cantidadRechazada"])) },
      ];
    }
    if (ck === "devoluciones") {
      return [
        { header: "Renglon recep.", render: (l) => `#${str(l["idRecepcionDetalle"])}` },
        { header: "Devuelto", num: true, render: (l) => formatQty(n(l["cantidadDevuelta"])) },
      ];
    }
    return [
      { header: "Articulo", render: (l) => refs.label("articulo", l["idArticulo"]) },
      { header: "Descripcion", render: (l) => str(l["descripcion"]) },
      { header: "Cant.", num: true, render: (l) => formatQty(n(l["cantidadSolicitada"])) },
      { header: "Unidad", render: (l) => refs.label("unidadMedida", l["idUnidadMedida"]) },
    ];
  };

  const actions: RowAction<Row>[] = [];

  if (DETALLE_KEYS.has(props.configKey)) {
    actions.push({
      label: "Detalle",
      icon: "search",
      tone: "muted",
      primary: props.configKey === "cotizaciones" || props.configKey === "recepciones",
      onClick: (r) => setDetalleId(Number(r[config.idField])),
    });
  }

  // Atajo directo al historial de aprobacion (mismo modal de Detalle, que ya
  // lo incluye) — la accion "Detalle" por si sola no deja claro que ahi esta
  // el historial, asi que se ofrece tambien con su propio nombre y icono.
  if (props.configKey === "solicitudes") {
    actions.push({
      label: "Historial de aprobacion",
      icon: "clock",
      tone: "muted",
      onClick: (r) => setDetalleId(Number(r[config.idField])),
    });
  }

  if (props.configKey === "cotizaciones") {
    if (hasPerm(Permisos.ANALISIS_VER)) {
      actions.push({
        label: "Comparar",
        icon: "award",
        tone: "muted",
        onClick: (r) => void abrirComparativoDeCotizacion(r),
      });
    }
    if (puedeCrear) {
      actions.push({
        label: "Editar",
        icon: "edit",
        hidden: (r) => !cotizacionEditable(r),
        onClick: (r) => void seedEditCotizacion(r),
      });
    }
  }

  if (props.configKey === "ordenesCompra" && puedeCrear) {
    actions.push({
      label: "Editar",
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
      // Editar la cabecera SOLO mientras nadie la ha aprobado (PENDIENTE_JEFE).
      actions.push({
        label: "Editar",
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
        label: "Iniciar cotizacion",
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

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        help={config.help}
        actions={
          nuevoConfig !== undefined && puedeCrear ? (
            <Button
              icon="plus"
              onClick={() =>
                props.configKey === "recepciones" ? setRecepcionGuiadaOpen(true) : setNuevoOpen(true)
              }
            >
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
              {bajoMinimo.length} articulo{bajoMinimo.length > 1 ? "s" : ""} bajo el stock minimo
            </span>
          </div>
          <div className="grid gap-1.5">
            {bajoMinimo.slice(0, 5).map((a) => (
              <div key={Number(a["idAlerta"])} className="flex flex-wrap items-center justify-between gap-2 text-[0.82rem]">
                <span style={{ color: "var(--color-ink-soft)" }}>
                  <b style={{ color: "var(--color-ink)" }}>{String(a["nombre"])}</b> en {String(a["bodega"])} — quedan{" "}
                  {formatQty(Number(a["cantidadActual"]))}, minimo {formatQty(Number(a["stockMinimo"]))}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="plus"
                  onClick={() =>
                    setSugerenciaInicial({
                      header: {
                        justificacion: `Reabastecimiento automatico — existencia bajo el minimo (quedan ${formatQty(Number(a["cantidadActual"]))}, minimo ${formatQty(Number(a["stockMinimo"]))}).`,
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
            { id: "mio", label: "Pendientes de mi nivel" },
            { id: "otros", label: "De otro nivel" },
          ]}
          active={vistaAprobacion}
          onChange={(id) => setVistaAprobacion(id as "mio" | "otros")}
        />
      ) : undefined}

      <DataTable<Row>
        columns={columnasListado}
        rows={rows}
        rowKey={(r) => Number(r[config.idField])}
        loading={loading}
        actions={actions}
        emptyTitle={`Aun no hay ${config.title.toLowerCase()}`}
        emptyHint={EMPTY_HINT[props.configKey]}
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPage={setPage}
        onReload={() => void load()}
        search={
          searchField !== undefined
            ? { value: search, onChange: setSearch, placeholder: `Buscar ${config.title.toLowerCase()}...` }
            : undefined
        }
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
                  void runAction(
                    () =>
                      service.accion(`${modal.id}/${modal.kind}`, {
                        idEmpleado,
                        comentario: String(form["comentario"] ?? ""),
                      }),
                    modal.kind === "aprobar" ? mensajeTrasAprobar : "Solicitud rechazada",
                  );
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
              El nuevo estado queda visible de inmediato para quien le da seguimiento a esta orden. No se puede deshacer desde aqui — si te equivocas, hay que corregirlo con otro cambio de estado.
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
                ? "Confirmas la aprobacion de esta solicitud como "
                : "Vas a rechazar esta solicitud como "}
              <strong style={{ color: "var(--color-ink)" }}>{sesion?.nombre ?? "—"}</strong>.{" "}
              {modal?.kind === "aprobar"
                ? (SIGUIENTE_SI_APRUEBA[modal.estado] ?? "Avanzara al siguiente nivel del flujo.")
                : "La solicitud quedara RECHAZADA y cerrada — el solicitante vera el motivo que escribas abajo."}
            </p>
            <FormGrid>
              <Field
                def={{
                  name: "comentario",
                  label: modal?.kind === "rechazar" ? "Motivo (recomendado)" : "Comentario",
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
          onSuccess={(created) => {
            if (props.configKey === "solicitudes" && created !== undefined) {
              void mensajeConResponsable(Number(created["idSolicitud"]), "Solicitud registrada").then((m) =>
                toast.success(m),
              );
            }
            void load();
          }}
        />
      )}

      {props.configKey === "recepciones" && (
        <RecepcionGuiada
          open={recepcionGuiadaOpen}
          onClose={() => setRecepcionGuiadaOpen(false)}
          onSuccess={() => {
            setRecepcionGuiadaOpen(false);
            void load();
          }}
        />
      )}

      {nuevoConfig !== undefined && sugerenciaInicial !== null && (
        <DocumentForm
          open
          config={nuevoConfig}
          initial={sugerenciaInicial}
          onClose={() => setSugerenciaInicial(null)}
          onSuccess={() => {
            toast.success("Solicitud de reabastecimiento registrada");
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
          extraContent={
            props.configKey === "solicitudes" ? <HistorialAprobacion idSolicitud={detalleId} /> : undefined
          }
        />
      )}

      {vistaPreviaId !== null && (
        <OrdenCompraPreview open id={vistaPreviaId} onClose={() => setVistaPreviaId(null)} />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar documento"
        message="Se marcara como eliminado (borrado logico). Esta accion respeta el cerrojo por estado del backend."
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
        message="El RFQ dejara de admitir cotizaciones o cierre normal. Usa esto cuando la solicitud de cotizacion ya no aplica (p. ej. la compra se descarto)."
        onConfirm={() => void cancelarRfq()}
        onCancel={() => setToCancelRfq(null)}
      />

      <ConfirmDialog
        open={toReverse !== null}
        title="Reversar recepcion"
        confirmLabel="Reversar"
        message="Se anulara la factura de CxP generada, se compensara el kardex con un ajuste negativo y la recepcion quedara eliminada. Solo procede si la factura no tiene pagos aplicados ni devoluciones."
        onConfirm={() => void reversarRecepcion()}
        onCancel={() => setToReverse(null)}
      />
    </div>
  );
}

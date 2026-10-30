/**
 * Reporteria del modulo de Compras: una pestana por reporte, las que el ROL
 * puede ver y en el orden que le sirve para decidir (`perfilAnalitico`).
 *
 * Cada pestana es un `PanelReporte`: declara sus filtros (FieldDef), sus KPIs
 * y su tabla. El panel guarda los filtros APLICADOS y con ellos pide tanto la
 * tabla como el PDF: lo que se descarga es exactamente lo que se ve (antes la
 * busqueda de la tabla era local y el PDF salia con todos los registros).
 * skills/patron-diseno.md §7/§8.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  reporteService,
  type AccionDisponibilidad,
  type AreaItem,
  type ArticuloCompradoItem,
  type DesempenoProveedorItem,
  type DisponibilidadArticuloItem,
  type GastoProveedorItem,
  type HallazgoItem,
  type InventarioCategoriaItem,
  type OcPendienteItem,
  type ReporteAuditoria,
  type ReporteDesempenoProveedores,
  type ReporteDisponibilidad,
  type ReporteGastoArea,
  type ReporteGastoProveedor,
  type ReporteInventarioCategoria,
  type ReporteOcPendientes,
  type ReporteRiesgoProveedores,
  type RiesgoProveedorItem,
  type RutaReporte,
  type SeveridadHallazgo,
  type TipoHallazgo,
} from "../../core/CompraServices.js";
import { http } from "../../core/HttpClient.js";
import { messageOf } from "../../core/errors.js";
import { Button, Card, Chip, KpiCard, PageHeader, type ChipTone } from "../../ui/primitives.js";
import { Tabs } from "../../ui/Modal.js";
import { DataTable, type Column } from "../../ui/DataTable.js";
import { FilterBar } from "../../ui/FilterBar.js";
import type { FieldDef } from "../../ui/Field.js";
import { useToast } from "../../ui/Toast.js";
import { formatMoney, formatPercent } from "../../core/format.js";
import { useAuth } from "../../core/auth/AuthContext.js";
import { Permisos, grants } from "../../core/auth/permisos.js";
import {
  PRIORIDAD_POR_PERFIL,
  perfilAnalitico,
  reportesVisibles,
  type ReporteId,
} from "../../core/auth/perfilAnalitico.js";
import EvaluacionProveedoresView from "./EvaluacionProveedores.js";
import {
  CamposFiltro,
  aFiltros,
  campoBuscar,
  camposRango,
  contarActivos,
  describirFiltros,
  selectTodos,
  useOpcionesFiltro,
  type OpcionesFiltro,
  type ValoresFiltro,
} from "./filtrosReporte.js";

const AYUDA_REPORTES = {
  title: "Reportes — qué calcula cada uno",
  body: (
    <>
      <p>
        Cada pestaña tiene su panel <b>Filtros</b>: elige periodo, proveedor, categoría o escribe en <b>Buscar</b> y pulsa{" "}
        <b>Aplicar</b>. La tabla y el botón <b>Descargar PDF</b> usan exactamente esos filtros: el PDF trae solo lo que ves y
        anota en su encabezado con qué filtros se generó. Las pestañas que ves y su orden dependen de tu rol.
      </p>
      <p>
        <b>Disponibilidad de artículos</b>: antes de pedir, muestra la existencia, lo que ya viene en camino (órdenes sin
        recibir) y lo que ya se solicitó, y recomienda <i>pedir</i>, <i>no duplicar</i> o <i>no pedir</i>.
      </p>
      <p>
        <b>Gasto por área</b>: cuánto compromete cada departamento en órdenes de compra, cuántas solicitudes tiene por aprobar,
        su % de rechazo y cuánto tarda en aprobarse una solicitud. Jefes y gerentes ven solo su equipo o su departamento.
      </p>
      <p>
        <b>Hallazgos de auditoría</b>: autoaprobaciones, compras con una sola cotización, adjudicaciones que no fueron la oferta
        más baja, precios sobre el histórico, recepciones con rechazo alto y compras a proveedores de riesgo alto.
      </p>
      <p>
        <b>Riesgo de proveedores</b>: score 0-100 (más alto es mejor) con su recomendación — mantener, vigilar o restringir — y
        los motivos. Quien administra proveedores puede <b>restringir</b> desde aquí: a un proveedor restringido no se le pueden
        emitir órdenes.
      </p>
      <p>
        <b>Evaluación de proveedores</b>: elige el enfoque, o <b>Personalizado</b> para decidir tú cuánto pesa cada criterio, y
        fija requisitos mínimos (rechazo máximo, % a tiempo, días máximos) para quedarte solo con las mejores opciones.
      </p>
    </>
  ),
};

const TAB_LABEL: Record<ReporteId, string> = {
  evaluacion: "Evaluación de proveedores",
  gasto: "Gasto por proveedor",
  pendientes: "Órdenes por recibir",
  desempeno: "Desempeño de proveedores",
  riesgo: "Riesgo de proveedores",
  inventario: "Inventario por categoría",
  disponibilidad: "Disponibilidad (¿pedir?)",
  area: "Gasto por área",
  auditoria: "Hallazgos de auditoría",
};

/* ---- Panel generico ------------------------------------------------------ */

interface PanelProps<T> {
  readonly ruta: RutaReporte;
  readonly campos: readonly FieldDef[];
  readonly inicial: ValoresFiltro;
  /** Cuantas filas trae el PDF (para rotular el boton). */
  readonly filas: (d: T) => number;
  readonly children: (d: T, loading: boolean, recargar: () => void) => React.ReactNode;
}

function PanelReporte<T>(props: PanelProps<T>): React.ReactElement {
  const toast = useToast();
  const [valores, setValores] = useState<ValoresFiltro>(props.inicial);
  const [aplicados, setAplicados] = useState<ValoresFiltro>(props.inicial);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);

  const cargar = useCallback(
    async (f: ValoresFiltro): Promise<void> => {
      setLoading(true);
      try {
        setData(await reporteService.consultar<T>(props.ruta, aFiltros(f)));
        setAplicados(f);
      } catch (e: unknown) {
        toast.error(messageOf(e));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.ruta],
  );

  useEffect(() => {
    void cargar(props.inicial);
    // Carga inicial; despues, solo con "Aplicar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar]);

  async function descargarPdf(): Promise<void> {
    setBusyPdf(true);
    try {
      await reporteService.descargarPdf(props.ruta, aFiltros(aplicados), describirFiltros(props.campos, aplicados));
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setBusyPdf(false);
    }
  }

  const sinAplicar = JSON.stringify(valores) !== JSON.stringify(aplicados);

  return (
    <div className="grid grid-cols-1 gap-4">
      <FilterBar
        activeCount={contarActivos(aplicados, props.inicial)}
        defaultOpen
        onApply={() => void cargar(valores)}
        onClear={() => {
          setValores(props.inicial);
          void cargar(props.inicial);
        }}
      >
        <CamposFiltro campos={props.campos} valores={valores} onChange={setValores} />
        {sinAplicar && (
          <p className="mt-2 text-[0.75rem]" style={{ color: "var(--color-warning)" }}>
            Hay cambios sin aplicar: la tabla y el PDF muestran los últimos filtros aplicados.
          </p>
        )}
      </FilterBar>
      {data === null ? (
        <Card>
          <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
            {loading ? "Cargando..." : "Sin datos."}
          </p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.76rem]" style={{ color: "var(--color-ink-faint)" }}>
              {describirFiltros(props.campos, aplicados) || "Sin filtros: todos los registros"}
            </p>
            <Button variant="secondary" icon="download" disabled={busyPdf} onClick={() => void descargarPdf()}>
              {busyPdf ? "..." : `Descargar PDF (${props.filas(data)} registros)`}
            </Button>
          </div>
          {props.children(data, loading, () => void cargar(aplicados))}
        </>
      )}
    </div>
  );
}

function Kpis(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
      {props.children}
    </div>
  );
}

const dias = (n: number | null): string => (n === null ? "—" : `${n} d`);

/* ---- Gasto por proveedor -------------------------------------------------- */

const gastoColumns: readonly Column<GastoProveedorItem>[] = [
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
  { key: "nit", header: "NIT", type: "text", value: (r) => r.nit, priority: "secondary" },
  { key: "ordenes", header: "OC", type: "num", value: (r) => r.ordenes },
  { key: "monto", header: "Monto", type: "money", value: (r) => r.monto },
  { key: "porcentaje", header: "% del total", type: "num", width: 110, value: (r) => r.porcentaje, render: (r) => formatPercent(r.porcentaje) },
];

function TabGasto(props: { o: OpcionesFiltro }): React.ReactElement {
  const campos: FieldDef[] = [
    ...camposRango(),
    selectTodos("idProveedor", "Proveedor", props.o.proveedores),
    selectTodos("idCategoria", "Categoría de artículo", props.o.categorias),
    campoBuscar("Buscar proveedor o NIT"),
  ];
  return (
    <PanelReporte<ReporteGastoProveedor>
      ruta="gasto-proveedor"
      campos={campos}
      inicial={{ desde: "", hasta: "", idProveedor: "", idCategoria: "", q: "" }}
      filas={(d) => d.proveedores.length}
    >
      {(d, loading) => (
        <>
          <Kpis>
            <KpiCard label="Monto total" value={formatMoney(d.montoTotal)} icon="coins" tone="brand" />
            <KpiCard label="Órdenes de compra" value={String(d.ordenesTotal)} icon="cart" tone="navy" />
            <KpiCard
              label="Proveedor principal"
              value={d.proveedores[0] === undefined ? "—" : formatPercent(d.proveedores[0].porcentaje)}
              icon="truck"
              tone={(d.proveedores[0]?.porcentaje ?? 0) >= 50 ? "warning" : "success"}
              hint={d.proveedores[0] === undefined ? undefined : `${d.proveedores[0].proveedor}: concentración del gasto`}
            />
          </Kpis>
          <DataTable<GastoProveedorItem>
            columns={gastoColumns}
            rows={d.proveedores}
            rowKey={(r) => String(r.idProveedor)}
            loading={loading}
            emptyTitle="Sin órdenes de compra con estos filtros"
          />
        </>
      )}
    </PanelReporte>
  );
}

/* ---- Ordenes por recibir -------------------------------------------------- */

const pendientesColumns: readonly Column<OcPendienteItem>[] = [
  { key: "idOrdenCompra", header: "OC", type: "text", value: (r) => `OC-${r.idOrdenCompra}` },
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
  { key: "estado", header: "Estado", type: "estado", value: (r) => r.estado },
  { key: "fechaEmision", header: "Emisión", type: "date", value: (r) => r.fechaEmision, priority: "secondary" },
  { key: "fechaEntregaEsperada", header: "Entrega esp.", type: "date", value: (r) => r.fechaEntregaEsperada },
  {
    key: "diasVencida",
    header: "Atraso",
    type: "num",
    width: 100,
    value: (r) => r.diasVencida,
    render: (r) => (r.diasVencida > 0 ? <Chip tone={r.diasVencida > 15 ? "danger" : "warning"}>{r.diasVencida} d</Chip> : <Chip tone="success">A tiempo</Chip>),
  },
  { key: "monto", header: "Monto", type: "money", value: (r) => r.monto, priority: "secondary" },
];

function TabPendientes(props: { o: OpcionesFiltro }): React.ReactElement {
  const campos: FieldDef[] = [
    ...camposRango("Entrega esperada desde", "Entrega esperada hasta"),
    selectTodos("idProveedor", "Proveedor", props.o.proveedores),
    campoBuscar("Buscar proveedor, orden (OC-12) o estado"),
    { name: "soloVencidas", label: "Solo atrasadas", kind: "switch", help: "Órdenes que ya pasaron su fecha de entrega." },
  ];
  return (
    <PanelReporte<ReporteOcPendientes>
      ruta="oc-pendientes"
      campos={campos}
      inicial={{ desde: "", hasta: "", idProveedor: "", q: "", soloVencidas: false }}
      filas={(d) => d.ordenes.length}
    >
      {(d, loading, recargar) => (
        <>
          <Kpis>
            <KpiCard label="Órdenes por recibir" value={String(d.totalOrdenes)} icon="cart" tone="navy" />
            <KpiCard label="Atrasadas" value={String(d.totalVencidas)} icon="clock" tone={d.totalVencidas > 0 ? "warning" : "success"} hint="Ya pasaron su fecha de entrega" />
            <KpiCard label="Llegan en 7 días" value={String(d.proximas7Dias)} icon="truck" tone="brand" hint="Prepara espacio y personal" />
            <KpiCard label="Monto en tránsito" value={formatMoney(d.montoTotal)} icon="coins" tone="brand" />
          </Kpis>
          <DataTable<OcPendienteItem>
            columns={pendientesColumns}
            rows={d.ordenes}
            rowKey={(r) => String(r.idOrdenCompra)}
            loading={loading}
            emptyTitle="No hay órdenes pendientes con estos filtros"
            onReload={recargar}
          />
        </>
      )}
    </PanelReporte>
  );
}

/* ---- Desempeno ------------------------------------------------------------ */

const desempenoColumns: readonly Column<DesempenoProveedorItem>[] = [
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
  { key: "ordenesRecibidas", header: "OC recib.", type: "num", width: 90, value: (r) => r.ordenesRecibidas },
  { key: "diasPromedioEntrega", header: "Días entrega", type: "num", width: 130, value: (r) => r.diasPromedioEntrega ?? undefined, render: (r) => dias(r.diasPromedioEntrega) },
  { key: "cantidadRecibida", header: "Recibido", type: "num", value: (r) => r.cantidadRecibida, priority: "secondary" },
  { key: "porcentajeRechazo", header: "% Rechazo", type: "num", width: 110, value: (r) => r.porcentajeRechazo, render: (r) => formatPercent(r.porcentajeRechazo) },
];

function TabDesempeno(props: { o: OpcionesFiltro }): React.ReactElement {
  const campos: FieldDef[] = [
    ...camposRango(),
    selectTodos("idProveedor", "Proveedor", props.o.proveedores),
    selectTodos("idCategoria", "Categoría de artículo", props.o.categorias),
    campoBuscar("Buscar proveedor"),
  ];
  return (
    <PanelReporte<ReporteDesempenoProveedores>
      ruta="desempeno-proveedores"
      campos={campos}
      inicial={{ desde: "", hasta: "", idProveedor: "", idCategoria: "", q: "" }}
      filas={(d) => d.proveedores.length}
    >
      {(d, loading) => (
        <>
          <Kpis>
            <KpiCard label="Días promedio de entrega" value={dias(d.diasPromedioGeneral)} icon="clock" tone="brand" />
            <KpiCard label="Proveedores evaluados" value={String(d.proveedores.length)} icon="truck" tone="navy" />
            <KpiCard
              label="Con rechazo > 5 %"
              value={String(d.proveedores.filter((p) => p.porcentajeRechazo > 5).length)}
              icon="x"
              tone={d.proveedores.some((p) => p.porcentajeRechazo > 5) ? "warning" : "success"}
            />
          </Kpis>
          <DataTable<DesempenoProveedorItem>
            columns={desempenoColumns}
            rows={d.proveedores}
            rowKey={(r) => String(r.idProveedor)}
            loading={loading}
            emptyTitle="Sin recepciones con estos filtros"
          />
        </>
      )}
    </PanelReporte>
  );
}

/* ---- Riesgo (con accion: restringir) ------------------------------------- */

const NIVEL_TONO: Record<RiesgoProveedorItem["nivel"], ChipTone> = { bajo: "success", medio: "warning", alto: "danger" };
const NIVEL_LABEL: Record<RiesgoProveedorItem["nivel"], string> = { bajo: "Bajo", medio: "Medio", alto: "Alto" };
const RECO: Record<RiesgoProveedorItem["recomendacion"], { label: string; tone: ChipTone }> = {
  MANTENER: { label: "Mantener", tone: "success" },
  VIGILAR: { label: "Vigilar", tone: "warning" },
  RESTRINGIR: { label: "Restringir", tone: "danger" },
};

function TabRiesgo(props: { puedeRestringir: boolean }): React.ReactElement {
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const campos: FieldDef[] = [
    {
      name: "nivel",
      label: "Nivel de riesgo",
      kind: "select",
      options: [
        { value: "", label: "Todos" },
        { value: "alto", label: "Alto (restringir)" },
        { value: "medio", label: "Medio (vigilar)" },
        { value: "bajo", label: "Bajo (mantener)" },
      ],
    },
    { name: "minOrdenes", label: "Mínimo de OC recibidas", kind: "integer", help: "Con pocas entregas el score no es representativo." },
    campoBuscar("Buscar proveedor o calificación"),
    { name: "soloActivos", label: "Ocultar ya restringidos", kind: "switch" },
  ];

  async function cambiarEstado(p: RiesgoProveedorItem, recargar: () => void): Promise<void> {
    const restringir = p.estado === "A";
    const msg = restringir
      ? `¿Restringir a ${p.proveedor}? No se le podrán emitir nuevas órdenes de compra hasta habilitarlo de nuevo.`
      : `¿Habilitar de nuevo a ${p.proveedor} para recibir órdenes de compra?`;
    if (!window.confirm(msg)) return;
    setBusy(p.idProveedor);
    try {
      await http.put(`/api/com/proveedores/${p.idProveedor}`, { estado: restringir ? "I" : "A" });
      toast.success(restringir ? `${p.proveedor} restringido` : `${p.proveedor} habilitado`);
      recargar();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <PanelReporte<ReporteRiesgoProveedores>
      ruta="riesgo-proveedores"
      campos={campos}
      inicial={{ nivel: "", minOrdenes: "", q: "", soloActivos: false }}
      filas={(d) => d.proveedores.length}
    >
      {(d, loading, recargar) => {
        const columnas: Column<RiesgoProveedorItem>[] = [
          { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
          { key: "nivel", header: "Riesgo", type: "text", width: 110, value: (r) => r.score, render: (r) => <Chip tone={NIVEL_TONO[r.nivel]}>{r.score} · {NIVEL_LABEL[r.nivel]}</Chip> },
          {
            key: "recomendacion",
            header: "Recomendación",
            type: "text",
            width: 130,
            value: (r) => RECO[r.recomendacion].label,
            render: (r) => <Chip tone={RECO[r.recomendacion].tone}>{RECO[r.recomendacion].label}</Chip>,
            title: (r) => r.motivos.join(" · "),
          },
          { key: "motivos", header: "Por qué", type: "text", value: (r) => r.motivos.join(" · "), priority: "secondary" },
          { key: "diasPromedioEntrega", header: "Días entrega", type: "num", width: 110, value: (r) => r.diasPromedioEntrega ?? undefined, render: (r) => dias(r.diasPromedioEntrega), priority: "secondary" },
          { key: "porcentajeRechazo", header: "% Rechazo", type: "num", width: 100, value: (r) => r.porcentajeRechazo, render: (r) => formatPercent(r.porcentajeRechazo) },
          { key: "estado", header: "Estado", type: "text", width: 110, value: (r) => (r.estado === "A" ? "Activo" : "Restringido"), render: (r) => <Chip tone={r.estado === "A" ? "neutral" : "danger"}>{r.estado === "A" ? "Activo" : "Restringido"}</Chip> },
        ];
        if (props.puedeRestringir) {
          columnas.push({
            key: "accion",
            header: "Acción",
            type: "text",
            width: 130,
            value: () => "",
            render: (r) => (
              <Button size="sm" variant={r.estado === "A" ? "secondary" : "ghost"} disabled={busy === r.idProveedor} onClick={() => void cambiarEstado(r, recargar)}>
                {busy === r.idProveedor ? "..." : r.estado === "A" ? "Restringir" : "Habilitar"}
              </Button>
            ),
          });
        }
        const aRestringir = d.proveedores.filter((p) => p.recomendacion === "RESTRINGIR" && p.estado === "A").length;
        return (
          <>
            <Kpis>
              <KpiCard label="Días promedio de entrega (general)" value={dias(d.diasPromedioGeneral)} icon="clock" tone="brand" />
              <KpiCard label="Proveedores listados" value={String(d.proveedores.length)} icon="truck" tone="navy" />
              <KpiCard label="Recomendado restringir" value={String(aRestringir)} icon="shield" tone={aRestringir > 0 ? "danger" : "success"} hint="Riesgo alto y aún activos" />
              <KpiCard label="A vigilar" value={String(d.proveedores.filter((p) => p.recomendacion === "VIGILAR").length)} icon="help" tone="warning" />
            </Kpis>
            <DataTable<RiesgoProveedorItem>
              columns={columnas}
              rows={d.proveedores}
              rowKey={(r) => String(r.idProveedor)}
              loading={loading}
              emptyTitle="Ningún proveedor con estos filtros"
            />
          </>
        );
      }}
    </PanelReporte>
  );
}

/* ---- Inventario por categoria -------------------------------------------- */

const inventarioColumns: readonly Column<InventarioCategoriaItem>[] = [
  { key: "categoria", header: "Categoría", type: "text", value: (r) => r.categoria, grow: true },
  { key: "articulos", header: "Artículos", type: "num", width: 100, value: (r) => r.articulos, priority: "secondary" },
  { key: "unidades", header: "Unidades", type: "num", width: 110, value: (r) => r.unidades },
  { key: "valor", header: "Valor total", type: "money", width: 140, value: (r) => r.valor },
  { key: "porcentaje", header: "% del valor", type: "num", width: 110, value: (r) => r.porcentaje, render: (r) => formatPercent(r.porcentaje) },
];

function TabInventario(props: { o: OpcionesFiltro }): React.ReactElement {
  return (
    <PanelReporte<ReporteInventarioCategoria>
      ruta="inventario-categoria"
      campos={[selectTodos("idCategoria", "Categoría", props.o.categorias), campoBuscar("Buscar categoría")]}
      inicial={{ idCategoria: "", q: "" }}
      filas={(d) => d.categorias.length}
    >
      {(d, loading) => (
        <>
          <Kpis>
            <KpiCard label="Valor del inventario" value={formatMoney(d.valorTotal)} icon="coins" tone="brand" />
            <KpiCard label="Unidades en existencia" value={String(d.unidadesTotal)} icon="package" tone="navy" />
            <KpiCard label="Artículos" value={String(d.articulosTotal)} icon="tag" tone="success" />
          </Kpis>
          <DataTable<InventarioCategoriaItem>
            columns={inventarioColumns}
            rows={d.categorias}
            rowKey={(r) => String(r.idCategoria ?? "sin-categoria")}
            loading={loading}
            emptyTitle="Sin existencias con estos filtros"
          />
        </>
      )}
    </PanelReporte>
  );
}

/* ---- Disponibilidad (¿conviene pedir?) ----------------------------------- */

const ACCION: Record<AccionDisponibilidad, { label: string; tone: ChipTone }> = {
  PEDIR: { label: "Pedir", tone: "danger" },
  EN_CURSO: { label: "Ya solicitado", tone: "warning" },
  EN_TRANSITO: { label: "En camino", tone: "brand" },
  SUFICIENTE: { label: "Suficiente", tone: "success" },
  EXCEDIDO: { label: "Sobre el máximo", tone: "neutral" },
};

const disponibilidadColumns: readonly Column<DisponibilidadArticuloItem>[] = [
  { key: "articulo", header: "Artículo", type: "text", value: (r) => `${r.codigo} · ${r.articulo}`, grow: true },
  { key: "accion", header: "Recomendación", type: "text", width: 140, value: (r) => ACCION[r.accion].label, render: (r) => <Chip tone={ACCION[r.accion].tone}>{ACCION[r.accion].label}</Chip>, title: (r) => r.motivo },
  { key: "existencia", header: "Existencia", type: "num", width: 100, value: (r) => r.existencia },
  { key: "enTransito", header: "En camino", type: "num", width: 100, value: (r) => r.enTransito },
  { key: "solicitado", header: "Ya solicitado", type: "num", width: 110, value: (r) => r.solicitado },
  { key: "sugeridoPedir", header: "Sugerido", type: "num", width: 95, value: (r) => r.sugeridoPedir ?? undefined, render: (r) => (r.sugeridoPedir === null ? "—" : String(r.sugeridoPedir)), title: () => "Lo que falta para llegar al máximo (o mínimo), descontando lo ya solicitado" },
  { key: "minmax", header: "Mín / Máx", type: "text", width: 100, value: (r) => `${r.stockMinimo} / ${r.stockMaximo}`, priority: "secondary" },
  { key: "ultimoPrecio", header: "Último precio", type: "money", value: (r) => r.ultimoPrecio ?? undefined, priority: "secondary" },
  { key: "ultimoProveedor", header: "Último proveedor", type: "text", value: (r) => r.ultimoProveedor ?? "—", priority: "secondary" },
  { key: "motivo", header: "Motivo", type: "text", value: (r) => r.motivo, priority: "secondary" },
];

function TabDisponibilidad(props: { o: OpcionesFiltro }): React.ReactElement {
  const campos: FieldDef[] = [
    campoBuscar("Buscar artículo, código o proveedor"),
    selectTodos("idCategoria", "Categoría", props.o.categorias),
    {
      name: "accion",
      label: "Recomendación",
      kind: "select",
      options: [{ value: "", label: "Todas" }, ...(Object.keys(ACCION) as AccionDisponibilidad[]).map((a) => ({ value: a, label: ACCION[a].label }))],
    },
  ];
  return (
    <PanelReporte<ReporteDisponibilidad>
      ruta="disponibilidad-articulos"
      campos={campos}
      inicial={{ q: "", idCategoria: "", accion: "" }}
      filas={(d) => d.articulos.length}
    >
      {(d, loading) => (
        <>
          <Kpis>
            <KpiCard label="Conviene pedir" value={String(d.resumen.PEDIR)} icon="cart" tone={d.resumen.PEDIR > 0 ? "danger" : "success"} hint="Sin cobertura y sin solicitud en trámite" />
            <KpiCard label="Ya solicitados" value={String(d.resumen.EN_CURSO)} icon="clipboard" tone="warning" hint="No dupliques el pedido" />
            <KpiCard label="En camino" value={String(d.resumen.EN_TRANSITO)} icon="truck" tone="brand" hint="Lo que viene cubre el mínimo" />
            <KpiCard label="Suficientes" value={String(d.resumen.SUFICIENTE + d.resumen.EXCEDIDO)} icon="check" tone="success" hint="No hace falta pedir" />
          </Kpis>
          <DataTable<DisponibilidadArticuloItem>
            columns={disponibilidadColumns}
            rows={d.articulos}
            rowKey={(r) => String(r.idArticulo)}
            loading={loading}
            emptyTitle="Ningún artículo con estos filtros"
          />
        </>
      )}
    </PanelReporte>
  );
}

/* ---- Gasto por area ------------------------------------------------------- */

const areaColumns: readonly Column<AreaItem>[] = [
  { key: "departamento", header: "Área", type: "text", value: (r) => r.departamento, grow: true },
  { key: "montoComprometido", header: "Comprometido en OC", type: "money", value: (r) => r.montoComprometido },
  { key: "porcentajeGasto", header: "% del gasto", type: "num", width: 105, value: (r) => r.porcentajeGasto, render: (r) => formatPercent(r.porcentajeGasto) },
  { key: "solicitudes", header: "Solicitudes", type: "num", width: 105, value: (r) => r.solicitudes },
  { key: "porAprobar", header: "Por aprobar", type: "num", width: 105, value: (r) => r.porAprobar, render: (r) => (r.porAprobar > 0 ? <Chip tone="warning">{r.porAprobar}</Chip> : "0") },
  { key: "porcentajeRechazo", header: "% Rechazo", type: "num", width: 100, value: (r) => r.porcentajeRechazo ?? undefined, render: (r) => (r.porcentajeRechazo === null ? "—" : formatPercent(r.porcentajeRechazo)), priority: "secondary" },
  { key: "diasPromedioAprobacion", header: "Días en aprobar", type: "num", width: 120, value: (r) => r.diasPromedioAprobacion ?? undefined, render: (r) => dias(r.diasPromedioAprobacion), priority: "secondary" },
  { key: "montoEstimado", header: "Estimado solicitado", type: "money", value: (r) => r.montoEstimado, priority: "secondary" },
];

const topColumns: readonly Column<ArticuloCompradoItem>[] = [
  { key: "articulo", header: "Artículo", type: "text", value: (r) => r.articulo, grow: true },
  { key: "cantidad", header: "Cantidad", type: "num", value: (r) => r.cantidad },
  { key: "ordenes", header: "OC", type: "num", width: 80, value: (r) => r.ordenes },
  { key: "monto", header: "Monto", type: "money", value: (r) => r.monto },
];

function TabArea(props: { o: OpcionesFiltro }): React.ReactElement {
  const campos: FieldDef[] = [
    ...camposRango(),
    selectTodos("idDepartamento", "Área / departamento", props.o.departamentos, "Si eres jefe o gerente, solo verás tu equipo o tu departamento."),
    campoBuscar("Buscar área"),
  ];
  return (
    <PanelReporte<ReporteGastoArea>
      ruta="gasto-area"
      campos={campos}
      inicial={{ desde: "", hasta: "", idDepartamento: "", q: "" }}
      filas={(d) => d.areas.length}
    >
      {(d, loading) => {
        const conDias = d.areas.filter((a) => a.diasPromedioAprobacion !== null);
        const diasProm = conDias.length > 0 ? Number((conDias.reduce((s, a) => s + (a.diasPromedioAprobacion ?? 0), 0) / conDias.length).toFixed(1)) : null;
        return (
          <>
            {d.acotado && (
              <p className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                Ves solo las solicitudes de tu equipo o tu departamento.
              </p>
            )}
            <Kpis>
              <KpiCard label="Comprometido en OC" value={formatMoney(d.montoTotal)} icon="coins" tone="brand" />
              <KpiCard label="Solicitudes" value={String(d.solicitudesTotal)} icon="clipboard" tone="navy" />
              <KpiCard label="Por aprobar" value={String(d.porAprobarTotal)} icon="clock" tone={d.porAprobarTotal > 0 ? "warning" : "success"} />
              <KpiCard label="Días promedio en aprobar" value={dias(diasProm)} icon="zap" tone="success" />
            </Kpis>
            <DataTable<AreaItem>
              columns={areaColumns}
              rows={d.areas}
              rowKey={(r) => String(r.idDepartamento ?? "sin")}
              loading={loading}
              emptyTitle="Sin solicitudes ni órdenes con estos filtros"
            />
            {d.articulosTop.length > 0 && (
              <>
                <h3 style={{ color: "var(--color-heading)" }}>En qué se gasta (top 10)</h3>
                <DataTable<ArticuloCompradoItem> columns={topColumns} rows={d.articulosTop} rowKey={(r) => r.articulo} loading={loading} emptyTitle="Sin compras" />
              </>
            )}
          </>
        );
      }}
    </PanelReporte>
  );
}

/* ---- Hallazgos de auditoria ---------------------------------------------- */

const TIPO_LABEL: Record<TipoHallazgo, string> = {
  AUTOAPROBACION: "Autoaprobación",
  SIN_COMPETENCIA: "Sin competencia",
  NO_MAS_BARATA: "No fue la oferta más baja",
  SOBREPRECIO_HISTORICO: "Precio sobre el histórico",
  RECHAZO_ALTO: "Rechazo alto",
  PROVEEDOR_RIESGO: "Proveedor de riesgo alto",
};
const SEV_TONO: Record<SeveridadHallazgo, ChipTone> = { alta: "danger", media: "warning", baja: "neutral" };

const auditoriaColumns: readonly Column<HallazgoItem>[] = [
  { key: "severidad", header: "Severidad", type: "text", width: 105, value: (r) => r.severidad, render: (r) => <Chip tone={SEV_TONO[r.severidad]}>{r.severidad === "alta" ? "Alta" : r.severidad === "media" ? "Media" : "Baja"}</Chip> },
  { key: "tipo", header: "Tipo", type: "text", width: 190, value: (r) => TIPO_LABEL[r.tipo] },
  { key: "codigo", header: "Documento", type: "text", width: 110, value: (r) => r.codigo },
  { key: "detalle", header: "Hallazgo", type: "text", value: (r) => r.detalle, grow: true, title: (r) => r.detalle },
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor ?? "—", priority: "secondary" },
  { key: "fecha", header: "Fecha", type: "date", value: (r) => r.fecha, priority: "secondary" },
  { key: "monto", header: "Monto", type: "money", value: (r) => r.monto, priority: "secondary" },
];

function TabAuditoria(props: { o: OpcionesFiltro }): React.ReactElement {
  const campos: FieldDef[] = [
    ...camposRango(),
    {
      name: "tipo",
      label: "Tipo de hallazgo",
      kind: "select",
      options: [{ value: "", label: "Todos" }, ...(Object.keys(TIPO_LABEL) as TipoHallazgo[]).map((t) => ({ value: t, label: TIPO_LABEL[t] }))],
    },
    {
      name: "severidad",
      label: "Severidad",
      kind: "select",
      options: [
        { value: "", label: "Todas" },
        { value: "alta", label: "Alta" },
        { value: "media", label: "Media" },
        { value: "baja", label: "Baja" },
      ],
    },
    selectTodos("idProveedor", "Proveedor", props.o.proveedores),
    campoBuscar("Buscar documento, proveedor o detalle"),
  ];
  return (
    <PanelReporte<ReporteAuditoria>
      ruta="auditoria-compras"
      campos={campos}
      inicial={{ desde: "", hasta: "", tipo: "", severidad: "", idProveedor: "", q: "" }}
      filas={(d) => d.hallazgos.length}
    >
      {(d, loading) => (
        <>
          <Kpis>
            <KpiCard label="Severidad alta" value={String(d.porSeveridad.alta)} icon="shield" tone={d.porSeveridad.alta > 0 ? "danger" : "success"} />
            <KpiCard label="Severidad media" value={String(d.porSeveridad.media)} icon="help" tone="warning" />
            <KpiCard label="Severidad baja" value={String(d.porSeveridad.baja)} icon="dot" tone="navy" />
            <KpiCard label="Sobrecosto / valor en riesgo" value={formatMoney(d.montoEnRiesgo)} icon="coins" tone="brand" hint="Sobreprecios, rechazos y compras a proveedores de riesgo" />
          </Kpis>
          {Object.keys(d.porTipo).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(d.porTipo).map(([t, n]) => (
                <Chip key={t} tone="neutral">
                  {TIPO_LABEL[t as TipoHallazgo] ?? t}: {n}
                </Chip>
              ))}
            </div>
          )}
          <DataTable<HallazgoItem>
            columns={auditoriaColumns}
            rows={d.hallazgos}
            rowKey={(r) => `${r.tipo}-${r.codigo}-${r.referencia ?? ""}-${r.fecha}`}
            loading={loading}
            emptyTitle="Sin hallazgos con estos filtros"
          />
        </>
      )}
    </PanelReporte>
  );
}

/* ---- Vista ---------------------------------------------------------------- */

export default function ReportesView(): React.ReactElement {
  const { sesion } = useAuth();
  const permisos = sesion?.permisos ?? [];
  const roles = sesion?.roles ?? [];
  // Pestañas y orden segun el rol: cada area abre en lo que le sirve para decidir.
  const perfil = perfilAnalitico(permisos, roles);
  const permitidos = useMemo(() => reportesVisibles(permisos, roles), [permisos, roles]);
  const tabs = permitidos.map((id) => ({ id, label: TAB_LABEL[id] }));
  const [tab, setTab] = useState<ReporteId | null>(permitidos[0] ?? null);
  const opciones = useOpcionesFiltro();
  const puedeRestringir = grants(permisos, Permisos.CATALOGO_EDITAR);

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Reportes"
        subtitle="Lo que tu rol necesita para decidir, con filtros que también se aplican al PDF."
        help={AYUDA_REPORTES}
      />

      {tab === null && (
        <Card>
          <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
            Tu rol no tiene reportes asignados.
          </p>
        </Card>
      )}

      {tab !== null && tabs.length > 1 && <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as ReporteId)} />}

      {tab === "evaluacion" && <EvaluacionProveedoresView prioridadInicial={PRIORIDAD_POR_PERFIL[perfil]} />}
      {tab === "gasto" && <TabGasto o={opciones} />}
      {tab === "pendientes" && <TabPendientes o={opciones} />}
      {tab === "desempeno" && <TabDesempeno o={opciones} />}
      {tab === "riesgo" && <TabRiesgo puedeRestringir={puedeRestringir} />}
      {tab === "inventario" && <TabInventario o={opciones} />}
      {tab === "disponibilidad" && <TabDisponibilidad o={opciones} />}
      {tab === "area" && <TabArea o={opciones} />}
      {tab === "auditoria" && <TabAuditoria o={opciones} />}
    </div>
  );
}

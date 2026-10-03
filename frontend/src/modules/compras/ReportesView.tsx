/**
 * Reporteria del modulo de Compras: gasto por proveedor, ordenes de compra
 * pendientes de recibir y desempeno de proveedores. Un tab por reporte
 * (mismo patron `Tabs` de `ui/Modal.tsx`); cada uno trae su propio filtro,
 * KPIs de apertura, tabla de detalle y descarga de PDF profesional (Builder
 * en el backend, `PdfBuilder`). skills/patron-diseno.md §7/§8.
 */

import { useCallback, useEffect, useState } from "react";
import {
  reporteService,
  type DesempenoProveedorItem,
  type GastoProveedorItem,
  type OcPendienteItem,
  type ReporteDesempenoProveedores,
  type ReporteGastoProveedor,
  type ReporteOcPendientes,
  type ReporteRiesgoProveedores,
  type RiesgoProveedorItem,
} from "../../core/CompraServices.js";
import { messageOf } from "../../core/errors.js";
import { Button, Card, Chip, KpiCard, PageHeader } from "../../ui/primitives.js";
import { Tabs } from "../../ui/Modal.js";
import { DataTable, type Column } from "../../ui/DataTable.js";
import { FilterBar } from "../../ui/FilterBar.js";
import { Field, FormGrid, type FieldValue } from "../../ui/Field.js";
import { useToast } from "../../ui/Toast.js";
import { formatMoney, formatPercent } from "../../core/format.js";

type ReporteId = "gasto" | "pendientes" | "desempeno" | "riesgo";

const AYUDA_REPORTES = {
  title: "Reportes — que calcula cada uno",
  body: (
    <>
      <p>
        <b>Gasto por proveedor</b>: suma el monto (neto de descuento, en GTQ)
        de las órdenes de compra emitidas en el rango de fechas — excluye
        las canceladas o rechazadas. El % es la participación de cada
        proveedor sobre el total del rango.
      </p>
      <p>
        <b>Órdenes pendientes de recibir</b>: fotografía de <i>hoy</i> (no
        admite rango de fechas) de toda OC que aún no llegó a "Recibida
        completa". "Días vencida" es cuánto pasó la fecha de entrega
        esperada — 0 significa que todavía no vence.
      </p>
      <p>
        <b>Desempeño de proveedores</b>: por cada OC que sí llegó a
        "Recibida completa", mide los días entre su emisión y su última
        recepción (tiempo de entrega real) y el % de unidades rechazadas
        sobre lo recibido — ambos en el rango de fechas de emisión.
      </p>
      <p>
        <b>Riesgo de proveedores</b>: un score 0-100 (más alto es mejor) que
        combina qué tan más lento entrega que el resto, su % de rechazo y su
        calificación declarada. Es todo el histórico, no admite rango de
        fechas — el riesgo se evalúa con la trayectoria completa.
      </p>
      <p>
        Cada pestaña tiene su botón <b>Descargar PDF</b> — genera el mismo
        reporte con los filtros activos, listo para compartir o archivar.
      </p>
    </>
  ),
};

const TABS: readonly { id: ReporteId; label: string }[] = [
  { id: "gasto", label: "Gasto por proveedor" },
  { id: "pendientes", label: "Ordenes pendientes de recibir" },
  { id: "desempeno", label: "Desempeno de proveedores" },
  { id: "riesgo", label: "Riesgo de proveedores" },
];

/** Filtro de fecha compartido por los reportes "gasto" y "desempeno". */
function RangoFechas(props: {
  value: { desde: string; hasta: string };
  onChange: (v: { desde: string; hasta: string }) => void;
  onApply: () => void;
}): React.ReactElement {
  const activeCount = ["desde", "hasta"].filter(
    (k) => props.value[k as "desde" | "hasta"] !== "",
  ).length;
  return (
    <FilterBar
      activeCount={activeCount}
      onApply={props.onApply}
      onClear={() => {
        props.onChange({ desde: "", hasta: "" });
      }}
    >
      <FormGrid>
        <Field
          def={{ name: "desde", label: "Desde", kind: "date" }}
          value={props.value.desde}
          onChange={(v: FieldValue) => props.onChange({ ...props.value, desde: String(v ?? "") })}
        />
        <Field
          def={{ name: "hasta", label: "Hasta", kind: "date" }}
          value={props.value.hasta}
          onChange={(v: FieldValue) => props.onChange({ ...props.value, hasta: String(v ?? "") })}
        />
      </FormGrid>
    </FilterBar>
  );
}

const gastoColumns: readonly Column<GastoProveedorItem>[] = [
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
  { key: "nit", header: "NIT", type: "text", value: (r) => r.nit, priority: "secondary" },
  { key: "ordenes", header: "OC", type: "num", value: (r) => r.ordenes },
  { key: "monto", header: "Monto", type: "money", value: (r) => r.monto },
  {
    key: "porcentaje",
    header: "% del total",
    type: "num",
    width: 110,
    value: (r) => r.porcentaje,
    render: (r) => formatPercent(r.porcentaje),
    priority: "secondary",
  },
];

const pendientesColumns: readonly Column<OcPendienteItem>[] = [
  { key: "idOrdenCompra", header: "OC", type: "text", value: (r) => `OC-${r.idOrdenCompra}` },
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
  { key: "estado", header: "Estado", type: "estado", value: (r) => r.estado },
  { key: "fechaEmision", header: "Emision", type: "date", value: (r) => r.fechaEmision },
  {
    key: "fechaEntregaEsperada",
    header: "Entrega esp.",
    type: "date",
    value: (r) => r.fechaEntregaEsperada,
    priority: "secondary",
  },
  { key: "diasTranscurridos", header: "Dias trans.", type: "num", value: (r) => r.diasTranscurridos, priority: "secondary" },
  { key: "diasVencida", header: "Dias venc.", type: "num", value: (r) => r.diasVencida },
  { key: "monto", header: "Monto", type: "money", value: (r) => r.monto, priority: "secondary" },
];

const desempenoColumns: readonly Column<DesempenoProveedorItem>[] = [
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
  { key: "ordenesRecibidas", header: "OC recib.", type: "num", width: 90, value: (r) => r.ordenesRecibidas },
  {
    key: "diasPromedioEntrega",
    header: "Dias entrega",
    type: "num",
    width: 130,
    value: (r) => r.diasPromedioEntrega ?? undefined,
    render: (r) => (r.diasPromedioEntrega === null ? "—" : `${r.diasPromedioEntrega} d`),
  },
  { key: "cantidadRecibida", header: "Recibido", type: "num", value: (r) => r.cantidadRecibida, priority: "secondary" },
  {
    key: "porcentajeRechazo",
    header: "% Rechazo",
    type: "num",
    width: 110,
    value: (r) => r.porcentajeRechazo,
    render: (r) => formatPercent(r.porcentajeRechazo),
  },
];

const NIVEL_TONO: Record<RiesgoProveedorItem["nivel"], "success" | "warning" | "danger"> = {
  bajo: "success",
  medio: "warning",
  alto: "danger",
};
const NIVEL_LABEL: Record<RiesgoProveedorItem["nivel"], string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
};

const riesgoColumns: readonly Column<RiesgoProveedorItem>[] = [
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
  { key: "calificacion", header: "Calificacion", type: "text", width: 100, value: (r) => r.calificacion ?? "—" },
  { key: "ordenesRecibidas", header: "OC recib.", type: "num", width: 80, value: (r) => r.ordenesRecibidas },
  {
    key: "diasPromedioEntrega",
    header: "Dias entrega",
    type: "num",
    width: 110,
    value: (r) => r.diasPromedioEntrega ?? undefined,
    render: (r) => (r.diasPromedioEntrega === null ? "—" : `${r.diasPromedioEntrega} d`),
  },
  {
    key: "porcentajeRechazo",
    header: "% Rechazo",
    type: "num",
    width: 100,
    value: (r) => r.porcentajeRechazo,
    render: (r) => formatPercent(r.porcentajeRechazo),
  },
  {
    key: "tieneArticulosEnEscasez",
    header: "Escasez",
    type: "text",
    width: 80,
    value: (r) => (r.tieneArticulosEnEscasez ? "Si" : "No"),
    priority: "secondary",
  },
  {
    key: "nivel",
    header: "Riesgo",
    type: "text",
    width: 110,
    value: (r) => r.score,
    render: (r) => (
      <Chip tone={NIVEL_TONO[r.nivel]}>
        {r.score} · {NIVEL_LABEL[r.nivel]}
      </Chip>
    ),
  },
];

export default function ReportesView(): React.ReactElement {
  const toast = useToast();
  const [tab, setTab] = useState<ReporteId>("gasto");

  const [rangoGasto, setRangoGasto] = useState({ desde: "", hasta: "" });
  const [gasto, setGasto] = useState<ReporteGastoProveedor | null>(null);
  const [loadingGasto, setLoadingGasto] = useState(false);
  const [busyGastoPdf, setBusyGastoPdf] = useState(false);

  const [pendientes, setPendientes] = useState<ReporteOcPendientes | null>(null);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  const [busyPendientesPdf, setBusyPendientesPdf] = useState(false);

  const [rangoDesempeno, setRangoDesempeno] = useState({ desde: "", hasta: "" });
  const [desempeno, setDesempeno] = useState<ReporteDesempenoProveedores | null>(null);
  const [loadingDesempeno, setLoadingDesempeno] = useState(false);
  const [busyDesempenoPdf, setBusyDesempenoPdf] = useState(false);

  const [riesgo, setRiesgo] = useState<ReporteRiesgoProveedores | null>(null);
  const [loadingRiesgo, setLoadingRiesgo] = useState(false);
  const [busyRiesgoPdf, setBusyRiesgoPdf] = useState(false);

  const cargarGasto = useCallback(async (): Promise<void> => {
    setLoadingGasto(true);
    try {
      setGasto(await reporteService.gastoPorProveedor(rangoGasto.desde, rangoGasto.hasta));
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setLoadingGasto(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarPendientes = useCallback(async (): Promise<void> => {
    setLoadingPendientes(true);
    try {
      setPendientes(await reporteService.ocPendientesRecibir());
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setLoadingPendientes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDesempeno = useCallback(async (): Promise<void> => {
    setLoadingDesempeno(true);
    try {
      setDesempeno(await reporteService.desempenoProveedores(rangoDesempeno.desde, rangoDesempeno.hasta));
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setLoadingDesempeno(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarRiesgo = useCallback(async (): Promise<void> => {
    setLoadingRiesgo(true);
    try {
      setRiesgo(await reporteService.riesgoProveedores());
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setLoadingRiesgo(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void cargarGasto();
    void cargarPendientes();
    void cargarDesempeno();
    void cargarRiesgo();
  }, [cargarGasto, cargarPendientes, cargarDesempeno, cargarRiesgo]);

  async function descargarGastoPdf(): Promise<void> {
    setBusyGastoPdf(true);
    try {
      await reporteService.descargarGastoProveedorPdf(rangoGasto.desde, rangoGasto.hasta);
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setBusyGastoPdf(false);
    }
  }
  async function descargarPendientesPdf(): Promise<void> {
    setBusyPendientesPdf(true);
    try {
      await reporteService.descargarOcPendientesPdf();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setBusyPendientesPdf(false);
    }
  }
  async function descargarDesempenoPdf(): Promise<void> {
    setBusyDesempenoPdf(true);
    try {
      await reporteService.descargarDesempenoProveedoresPdf(rangoDesempeno.desde, rangoDesempeno.hasta);
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setBusyDesempenoPdf(false);
    }
  }
  async function descargarRiesgoPdf(): Promise<void> {
    setBusyRiesgoPdf(true);
    try {
      await reporteService.descargarRiesgoProveedoresPdf();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setBusyRiesgoPdf(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Reportes"
        subtitle="Gasto, atrasos y desempeno de proveedores, listos para exportar a PDF."
        help={AYUDA_REPORTES}
      />

      <Tabs tabs={TABS} active={tab} onChange={(id) => setTab(id as ReporteId)} />

      {tab === "gasto" && (
        <div className="grid grid-cols-1 gap-4">
          <RangoFechas
            value={rangoGasto}
            onChange={setRangoGasto}
            onApply={() => void cargarGasto()}
          />
          {gasto !== null && (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                <KpiCard label="Monto total" value={formatMoney(gasto.montoTotal)} icon="coins" tone="brand" />
                <KpiCard label="Ordenes de compra" value={String(gasto.ordenesTotal)} icon="cart" tone="navy" />
                <KpiCard label="Proveedores" value={String(gasto.proveedores.length)} icon="truck" tone="success" />
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" icon="package" disabled={busyGastoPdf} onClick={() => void descargarGastoPdf()}>
                  {busyGastoPdf ? "..." : "Descargar PDF"}
                </Button>
              </div>
              <DataTable<GastoProveedorItem>
                columns={gastoColumns}
                rows={gasto.proveedores}
                rowKey={(r) => String(r.idProveedor)}
                loading={loadingGasto}
                emptyTitle="Sin ordenes de compra en el periodo"
              />
            </>
          )}
          {gasto === null && (
            <Card>
              <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
                {loadingGasto ? "Cargando..." : "Sin datos."}
              </p>
            </Card>
          )}
        </div>
      )}

      {tab === "pendientes" && (
        <div className="grid grid-cols-1 gap-4">
          {pendientes !== null && (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                <KpiCard label="Ordenes pendientes" value={String(pendientes.totalOrdenes)} icon="cart" tone="navy" />
                <KpiCard
                  label="Vencidas"
                  value={String(pendientes.totalVencidas)}
                  icon="clock"
                  tone={pendientes.totalVencidas > 0 ? "warning" : "success"}
                />
                <KpiCard label="Monto en transito" value={formatMoney(pendientes.montoTotal)} icon="coins" tone="brand" />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  icon="package"
                  disabled={busyPendientesPdf}
                  onClick={() => void descargarPendientesPdf()}
                >
                  {busyPendientesPdf ? "..." : "Descargar PDF"}
                </Button>
              </div>
              <DataTable<OcPendienteItem>
                columns={pendientesColumns}
                rows={pendientes.ordenes}
                rowKey={(r) => String(r.idOrdenCompra)}
                loading={loadingPendientes}
                emptyTitle="No hay ordenes de compra pendientes de recibir"
                onReload={() => void cargarPendientes()}
              />
            </>
          )}
          {pendientes === null && (
            <Card>
              <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
                {loadingPendientes ? "Cargando..." : "Sin datos."}
              </p>
            </Card>
          )}
        </div>
      )}

      {tab === "desempeno" && (
        <div className="grid grid-cols-1 gap-4">
          <RangoFechas
            value={rangoDesempeno}
            onChange={setRangoDesempeno}
            onApply={() => void cargarDesempeno()}
          />
          {desempeno !== null && (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                <KpiCard
                  label="Dias promedio de entrega"
                  value={desempeno.diasPromedioGeneral === null ? "—" : `${desempeno.diasPromedioGeneral} d`}
                  icon="clock"
                  tone="brand"
                />
                <KpiCard label="Proveedores evaluados" value={String(desempeno.proveedores.length)} icon="truck" tone="navy" />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  icon="package"
                  disabled={busyDesempenoPdf}
                  onClick={() => void descargarDesempenoPdf()}
                >
                  {busyDesempenoPdf ? "..." : "Descargar PDF"}
                </Button>
              </div>
              <DataTable<DesempenoProveedorItem>
                columns={desempenoColumns}
                rows={desempeno.proveedores}
                rowKey={(r) => String(r.idProveedor)}
                loading={loadingDesempeno}
                emptyTitle="Sin recepciones registradas en el periodo"
              />
            </>
          )}
          {desempeno === null && (
            <Card>
              <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
                {loadingDesempeno ? "Cargando..." : "Sin datos."}
              </p>
            </Card>
          )}
        </div>
      )}

      {tab === "riesgo" && (
        <div className="grid grid-cols-1 gap-4">
          {riesgo !== null && (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                <KpiCard
                  label="Dias promedio de entrega (general)"
                  value={riesgo.diasPromedioGeneral === null ? "—" : `${riesgo.diasPromedioGeneral} d`}
                  icon="clock"
                  tone="brand"
                />
                <KpiCard label="Proveedores evaluados" value={String(riesgo.proveedores.length)} icon="truck" tone="navy" />
                <KpiCard
                  label="En riesgo alto"
                  value={String(riesgo.proveedores.filter((p) => p.nivel === "alto").length)}
                  icon="clock"
                  tone={riesgo.proveedores.some((p) => p.nivel === "alto") ? "warning" : "success"}
                />
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" icon="package" disabled={busyRiesgoPdf} onClick={() => void descargarRiesgoPdf()}>
                  {busyRiesgoPdf ? "..." : "Descargar PDF"}
                </Button>
              </div>
              <DataTable<RiesgoProveedorItem>
                columns={riesgoColumns}
                rows={riesgo.proveedores}
                rowKey={(r) => String(r.idProveedor)}
                loading={loadingRiesgo}
                emptyTitle="Sin proveedores con ordenes recibidas todavia"
              />
            </>
          )}
          {riesgo === null && (
            <Card>
              <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
                {loadingRiesgo ? "Cargando..." : "Sin datos."}
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

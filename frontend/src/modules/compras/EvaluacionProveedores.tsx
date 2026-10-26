/**
 * Evaluacion de proveedores: a quien conviene comprarle. Cruza descuento,
 * velocidad y cumplimiento de entrega, calidad (rechazo) y envio (gratuito /
 * costo) sobre las OC vigentes, con filtros para decidir:
 * periodo, categoria de articulo, minimo de OC, solo envio gratuito y el
 * ENFOQUE (equilibrado / ahorro / rapidez / calidad) que pondera el score.
 * skills/patron-diseno.md §7/§8.
 */

import { useCallback, useEffect, useState } from "react";
import {
  reporteService,
  type EvaluacionProveedorItem,
  type FiltroEvaluacion,
  type MejorProveedor,
  type PrioridadEvaluacion,
  type ReporteEvaluacionProveedores,
} from "../../core/CompraServices.js";
import { http } from "../../core/HttpClient.js";
import { messageOf } from "../../core/errors.js";
import { formatMoney, formatPercent } from "../../core/format.js";
import { Button, Card, Chip, KpiCard } from "../../ui/primitives.js";
import { DataTable, type Column } from "../../ui/DataTable.js";
import { FilterBar } from "../../ui/FilterBar.js";
import { Field, FormGrid, type FieldValue } from "../../ui/Field.js";
import { useToast } from "../../ui/Toast.js";

export const ENFOQUES: readonly { value: PrioridadEvaluacion; label: string; hint: string }[] = [
  { value: "equilibrado", label: "Equilibrado", hint: "Descuento, entrega, cumplimiento, calidad y envío con peso parejo." },
  { value: "ahorro", label: "Priorizar ahorro", hint: "Pesa sobre todo el descuento y el costo de envío." },
  { value: "rapidez", label: "Priorizar rapidez", hint: "Pesa sobre todo los días de entrega y cumplir la fecha prometida." },
  { value: "calidad", label: "Priorizar calidad", hint: "Pesa sobre todo el bajo rechazo y el cumplimiento." },
];

interface FiltrosUi {
  desde: string;
  hasta: string;
  idCategoria: string;
  minOrdenes: string;
  prioridad: PrioridadEvaluacion;
  soloEnvioGratis: boolean;
}

function aFiltro(f: FiltrosUi): FiltroEvaluacion {
  const min = Number.parseInt(f.minOrdenes, 10);
  return {
    desde: f.desde,
    hasta: f.hasta,
    idCategoria: f.idCategoria === "" ? null : Number(f.idCategoria),
    minOrdenes: Number.isFinite(min) && min > 0 ? min : 1,
    prioridad: f.prioridad,
    soloEnvioGratis: f.soloEnvioGratis,
  };
}

function scoreTone(score: number): "success" | "warning" | "danger" {
  return score >= 70 ? "success" : score >= 45 ? "warning" : "danger";
}

/** Tarjeta "quien destaca" de un criterio. */
function Destacado(props: {
  titulo: string;
  mejor: MejorProveedor | null;
  valor: (m: MejorProveedor) => string;
  vacio: string;
}): React.ReactElement {
  return (
    <Card>
      <div className="text-[0.68rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
        {props.titulo}
      </div>
      {props.mejor === null ? (
        <p className="mt-1 text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
          {props.vacio}
        </p>
      ) : (
        <>
          <div className="mt-1 truncate text-[0.95rem] font-bold" style={{ color: "var(--color-heading)" }} title={props.mejor.proveedor}>
            {props.mejor.proveedor}
          </div>
          <div className="text-[1.1rem] font-bold" style={{ color: "var(--color-brand-ink)" }}>
            {props.valor(props.mejor)}
          </div>
        </>
      )}
    </Card>
  );
}

const SIN_DATO = "Sin diferencias entre proveedores (o sin datos)";

/** Las 6 tarjetas de "quien destaca"; reutilizadas por el Dashboard del comprador. */
export function Destacados(props: { mejores: ReporteEvaluacionProveedores["mejores"]; compacto?: boolean }): React.ReactElement {
  const m = props.mejores;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      <Destacado titulo="Mayor descuento" mejor={m.descuento} valor={(x) => formatPercent(x.valor)} vacio={SIN_DATO} />
      <Destacado titulo="Entrega más rápida" mejor={m.entrega} valor={(x) => `${x.valor} días`} vacio={SIN_DATO} />
      <Destacado
        titulo="Envío gratuito"
        mejor={m.envio}
        valor={(x) => `${formatPercent(x.valor)} de sus OC`}
        vacio="Nadie ha despachado sin costo, o aún no se registra el costo de envío en las OC"
      />
      {props.compacto !== true && (
        <>
          <Destacado titulo="Cumple la fecha" mejor={m.cumplimiento} valor={(x) => `${formatPercent(x.valor)} a tiempo`} vacio={SIN_DATO} />
          <Destacado titulo="Menor rechazo" mejor={m.calidad} valor={(x) => formatPercent(x.valor)} vacio={SIN_DATO} />
          <Destacado titulo="Más conveniente" mejor={m.conveniencia} valor={(x) => `Score ${x.valor}`} vacio={SIN_DATO} />
        </>
      )}
    </div>
  );
}

const columnas: readonly Column<EvaluacionProveedorItem>[] = [
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, grow: true },
  { key: "ordenes", header: "OC", type: "num", width: 64, value: (r) => r.ordenes },
  { key: "montoNeto", header: "Monto neto", type: "money", value: (r) => r.montoNeto },
  {
    key: "descuentoPct",
    header: "Descuento",
    type: "num",
    width: 104,
    value: (r) => r.descuentoPct,
    render: (r) => formatPercent(r.descuentoPct),
  },
  { key: "ahorroDescuento", header: "Ahorro por desc.", type: "money", value: (r) => r.ahorroDescuento, priority: "secondary" },
  {
    key: "diasEntrega",
    header: "Días entrega",
    type: "num",
    width: 112,
    value: (r) => r.diasEntrega ?? undefined,
    render: (r) => (r.diasEntrega === null ? "—" : `${r.diasEntrega} d${r.diasEntregaEsPrometido ? " *" : ""}`),
    title: (r) => (r.diasEntregaEsPrometido ? "Plazo prometido: aún sin órdenes completas que midan el real" : "Días reales entre la emisión y la última recepción"),
  },
  {
    key: "porcentajeATiempo",
    header: "A tiempo",
    type: "num",
    width: 100,
    value: (r) => r.porcentajeATiempo ?? undefined,
    render: (r) => (r.porcentajeATiempo === null ? "—" : formatPercent(r.porcentajeATiempo)),
  },
  {
    key: "porcentajeRechazo",
    header: "Rechazo",
    type: "num",
    width: 96,
    value: (r) => r.porcentajeRechazo ?? undefined,
    render: (r) => (r.porcentajeRechazo === null ? "—" : formatPercent(r.porcentajeRechazo)),
    priority: "secondary",
  },
  {
    key: "porcentajeEnvioGratis",
    header: "Envío gratis",
    type: "num",
    width: 112,
    value: (r) => r.porcentajeEnvioGratis ?? undefined,
    render: (r) => (r.porcentajeEnvioGratis === null ? "s/d" : formatPercent(r.porcentajeEnvioGratis)),
    title: (r) =>
      r.ordenesConEnvio === 0
        ? "Sin dato: ninguna OC registró costo de envío"
        : `${r.ordenesEnvioGratis} de ${r.ordenesConEnvio} OC con envío registrado fueron gratuitas`,
  },
  {
    key: "costoEnvioPromedio",
    header: "Flete prom.",
    type: "money",
    value: (r) => r.costoEnvioPromedio ?? undefined,
    priority: "secondary",
  },
  { key: "diasCredito", header: "Crédito", type: "num", width: 88, value: (r) => r.diasCredito, render: (r) => `${r.diasCredito} d`, priority: "secondary" },
  {
    key: "score",
    header: "Score",
    type: "num",
    width: 96,
    value: (r) => (r.elegible ? r.score : undefined),
    render: (r) => (r.elegible ? <Chip tone={scoreTone(r.score)}>{r.score}</Chip> : <Chip tone="neutral">n/c</Chip>),
    title: (r) => (r.elegible ? "Índice de conveniencia 0-100 según el enfoque" : "No compite: tiene menos OC que el mínimo pedido"),
  },
];

export default function EvaluacionProveedoresView(props: {
  prioridadInicial?: PrioridadEvaluacion;
}): React.ReactElement {
  const toast = useToast();
  const [filtros, setFiltros] = useState<FiltrosUi>({
    desde: "",
    hasta: "",
    idCategoria: "",
    minOrdenes: "2",
    prioridad: props.prioridadInicial ?? "equilibrado",
    soloEnvioGratis: false,
  });
  const [data, setData] = useState<ReporteEvaluacionProveedores | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const [categorias, setCategorias] = useState<readonly { value: string; label: string }[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await http.list<Record<string, unknown>>("/api/com/ref/categorias-articulo", { pageSize: 200 });
        setCategorias(r.data.map((c) => ({ value: String(c["idCategoria"]), label: String(c["nombre"] ?? c["idCategoria"]) })));
      } catch {
        setCategorias([]);
      }
    })();
  }, []);

  const cargar = useCallback(async (f: FiltrosUi): Promise<void> => {
    setLoading(true);
    try {
      setData(await reporteService.evaluacionProveedores(aFiltro(f)));
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void cargar(filtros);
    // Carga inicial; los cambios posteriores se aplican con el boton "Aplicar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function descargarPdf(): Promise<void> {
    setBusyPdf(true);
    try {
      await reporteService.descargarEvaluacionProveedoresPdf(aFiltro(filtros));
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setBusyPdf(false);
    }
  }

  const activos =
    (filtros.desde !== "" ? 1 : 0) +
    (filtros.hasta !== "" ? 1 : 0) +
    (filtros.idCategoria !== "" ? 1 : 0) +
    (filtros.soloEnvioGratis ? 1 : 0) +
    (filtros.minOrdenes !== "2" ? 1 : 0);
  const enfoque = ENFOQUES.find((e) => e.value === filtros.prioridad);

  return (
    <div className="grid grid-cols-1 gap-4">
      <FilterBar
        activeCount={activos}
        defaultOpen
        onApply={() => void cargar(filtros)}
        onClear={() => {
          const limpio: FiltrosUi = { ...filtros, desde: "", hasta: "", idCategoria: "", minOrdenes: "2", soloEnvioGratis: false };
          setFiltros(limpio);
          void cargar(limpio);
        }}
      >
        <FormGrid>
          <Field
            def={{ name: "prioridad", label: "Enfoque de la decisión", kind: "select", options: ENFOQUES.map((e) => ({ value: e.value, label: e.label })), help: enfoque?.hint }}
            value={filtros.prioridad}
            onChange={(v: FieldValue) => setFiltros({ ...filtros, prioridad: String(v) as PrioridadEvaluacion })}
          />
          <Field
            def={{ name: "idCategoria", label: "Categoría de artículo", kind: "select", options: [{ value: "", label: "Todas" }, ...categorias] }}
            value={filtros.idCategoria}
            onChange={(v: FieldValue) => setFiltros({ ...filtros, idCategoria: String(v ?? "") })}
          />
          <Field
            def={{ name: "desde", label: "Desde", kind: "date" }}
            value={filtros.desde}
            onChange={(v: FieldValue) => setFiltros({ ...filtros, desde: String(v ?? "") })}
          />
          <Field
            def={{ name: "hasta", label: "Hasta", kind: "date", minDateField: "desde" }}
            values={{ desde: filtros.desde, hasta: filtros.hasta }}
            value={filtros.hasta}
            onChange={(v: FieldValue) => setFiltros({ ...filtros, hasta: String(v ?? "") })}
          />
          <Field
            def={{ name: "minOrdenes", label: "Mínimo de órdenes", kind: "integer", help: "Un proveedor con pocas OC no compite por 'mejor': evita ganadores de una sola compra." }}
            value={filtros.minOrdenes}
            onChange={(v: FieldValue) => setFiltros({ ...filtros, minOrdenes: String(v ?? "") })}
          />
          <Field
            def={{ name: "soloEnvioGratis", label: "Solo con envío gratuito", kind: "switch", help: "Deja los proveedores que han despachado al menos una OC sin costo de envío." }}
            value={filtros.soloEnvioGratis}
            onChange={(v: FieldValue) => setFiltros({ ...filtros, soloEnvioGratis: v === true })}
          />
        </FormGrid>
      </FilterBar>

      {data === null ? (
        <Card>
          <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
            {loading ? "Cargando..." : "Sin datos."}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <KpiCard label="Monto neto" value={formatMoney(data.resumen.montoNeto)} icon="coins" tone="brand" />
            <KpiCard
              label="Ahorro por descuentos"
              value={formatMoney(data.resumen.ahorroDescuento)}
              icon="award"
              tone="success"
              hint={`${formatPercent(data.resumen.descuentoPromedioPct)} promedio ponderado`}
            />
            <KpiCard
              label="Días de entrega (prom.)"
              value={data.resumen.diasEntregaPromedio === null ? "—" : `${data.resumen.diasEntregaPromedio} d`}
              icon="clock"
              tone="navy"
              hint={data.resumen.porcentajeATiempo === null ? undefined : `${formatPercent(data.resumen.porcentajeATiempo)} a tiempo`}
            />
            <KpiCard
              label="Envío gratuito"
              value={data.resumen.ordenesConEnvio === 0 ? "s/d" : `${data.resumen.ordenesEnvioGratis} de ${data.resumen.ordenesConEnvio}`}
              icon="truck"
              tone="warning"
              hint={data.resumen.ordenesConEnvio === 0 ? "Registra el costo de envío en las OC" : "OC con flete registrado"}
            />
          </div>

          <div>
            <h3 className="mb-2" style={{ color: "var(--color-heading)" }}>
              Quién destaca en cada criterio
            </h3>
            <Destacados mejores={data.mejores} />
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" icon="package" disabled={busyPdf} onClick={() => void descargarPdf()}>
              {busyPdf ? "..." : "Descargar PDF"}
            </Button>
          </div>

          <DataTable<EvaluacionProveedorItem>
            columns={columnas}
            rows={data.proveedores}
            rowKey={(r) => String(r.idProveedor)}
            localSearch={{ placeholder: "Buscar proveedor, NIT…" }}
            loading={loading}
            emptyTitle="Sin órdenes de compra vigentes con estos filtros"
          />
          <p className="text-[0.74rem]" style={{ color: "var(--color-ink-faint)" }}>
            Descuento ponderado por monto · Días de entrega reales (emisión → última recepción); * = plazo prometido, aún sin órdenes completas ·
            Envío gratis: % de las OC con flete registrado (s/d = sin dato) · n/c = menos órdenes que el mínimo, no compite.
          </p>
        </>
      )}
    </div>
  );
}

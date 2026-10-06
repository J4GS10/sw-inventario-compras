/**
 * Historial de precios reales de compra por proveedor.
 * Capa de presentacion: consume `HistorialAppService` (capa 3). Filtros en un
 * panel colapsable (no invasivo), KPIs de resumen y tabla paginada.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { historialService, type HistorialResp } from "../../core/CompraServices.js";
import { messageOf } from "../../core/errors.js";
import { Card, KpiCard, PageHeader } from "../../ui/primitives.js";
import { DataTable, type Column } from "../../ui/DataTable.js";
import { FilterBar } from "../../ui/FilterBar.js";
import { Field, FormGrid, type FieldValue, type SelectOption } from "../../ui/Field.js";
import { useToast } from "../../ui/Toast.js";
import { formatMoney as money, formatQty } from "../../core/format.js";

type HistRow = HistorialResp["data"][number];

// Primarias: lo minimo para escanear la lista. Secundarias (Proveedor, %, Moneda,
// Tasa) se colapsan a un disclosure por fila cuando no caben (patron-diseno.md §11).
const columns: readonly Column<HistRow>[] = [
  { key: "fechaCompra", header: "Fecha", type: "date", value: (r) => r.fechaCompra },
  { key: "proveedor", header: "Proveedor", type: "text", value: (r) => r.proveedor, priority: "secondary" },
  { key: "articulo", header: "Artículo", type: "text", value: (r) => `${r.articuloCodigo} — ${r.articulo}`, grow: true },
  { key: "precioAcordado", header: "P. acordado", type: "money", value: (r) => r.precioAcordado },
  { key: "porcentajeDescuento", header: "Desc %", type: "num", value: (r) => r.porcentajeDescuento, priority: "secondary" },
  { key: "porcentajeImpuesto", header: "Imp %", type: "num", value: (r) => r.porcentajeImpuesto, priority: "secondary" },
  { key: "cantidadRealComprada", header: "Cantidad", type: "num", value: (r) => r.cantidadRealComprada },
  { key: "idMoneda", header: "Moneda", refKind: "moneda", value: (r) => r.idMoneda, width: 96, priority: "secondary" },
  { key: "tasaCambio", header: "Tasa", type: "rate", value: (r) => r.tasaCambio, priority: "secondary" },
  // Origen de la linea: sin esto, dos compras reales distintas que coinciden
  // en fecha+articulo+proveedor+precio son indistinguibles en pantalla.
  { key: "idOrdenCompra", header: "Orden", refKind: "docOrden", value: (r) => r.idOrdenCompra, width: 90, priority: "secondary" },
  { key: "idRecepcion", header: "Recepción", refKind: "docRecepcion", value: (r) => r.idRecepcion, width: 100, priority: "secondary" },
];

const AYUDA_HISTORIAL = {
  title: "Historial de precios — cómo leerlo",
  body: (
    <>
      <p>
        Cada fila es <b>una línea recibida realmente</b> — no una cotización
        ni un precio de catálogo. Sale de cruzar cada <b>Recepción</b> con el
        renglón de la <b>Orden de compra</b> que la originó: por eso el
        precio, el descuento y el impuesto son los que de verdad se pagaron,
        no una lista de precios aparte.
      </p>
      <p>
        <b>¿Por qué a veces se ven dos filas casi iguales?</b> Es normal: si
        se recibió el mismo artículo, del mismo proveedor, al mismo precio,
        en dos recepciones distintas (incluso el mismo día), cada una es una
        fila propia. Las columnas <b>Orden</b> y <b>Recepción</b> (a la
        derecha, en el menú "+" si la pantalla es angosta) muestran de cuál
        documento salió cada una — ahí se distinguen aunque el resto de
        datos coincida.
      </p>
      <p>
        <b>Filtros</b>: Proveedor y Artículo acotan a una combinación
        puntual; Desde/Hasta acotan por fecha de recepción. Los 5 números de
        arriba (mínimo, promedio, máximo, cantidad total) se recalculan
        sobre el filtro aplicado, no solo sobre lo que se ve en la página
        actual — sirven para negociar el próximo precio con ese proveedor.
      </p>
    </>
  ),
};

export default function HistorialProveedorView(): React.ReactElement {
  const toast = useToast();
  const [proveedores, setProveedores] = useState<SelectOption[]>([]);
  const [articulos, setArticulos] = useState<SelectOption[]>([]);
  const [f, setF] = useState<Record<string, FieldValue>>({
    idProveedor: "",
    idArticulo: "",
    desde: "",
    hasta: "",
  });
  const [page, setPage] = useState(1);
  const [resp, setResp] = useState<HistorialResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    historialService
      .referencias("/api/com/proveedores")
      .then((r) =>
        setProveedores(
          r.data.map((p) => ({ value: String(p["idProveedor"]), label: String(p["razonSocial"]) })),
        ),
      )
      .catch(() => setProveedores([]));
    historialService
      .referencias("/api/com/ref/articulos")
      .then((r) =>
        setArticulos(
          r.data.map((a) => ({
            value: String(a["idArticulo"]),
            label: [a["codigo"], a["nombre"]].filter(Boolean).join(" — "),
          })),
        ),
      )
      .catch(() => setArticulos([]));
  }, []);

  const cargar = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setResp(
        await historialService.consultar({
          idProveedor: String(f["idProveedor"] ?? ""),
          idArticulo: String(f["idArticulo"] ?? ""),
          desde: String(f["desde"] ?? ""),
          hasta: String(f["hasta"] ?? ""),
          page,
          pageSize: 25,
        }),
      );
    } catch (e: unknown) {
      setResp(null);
      toast.error(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [f, page, toast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const activeCount = useMemo(
    () => (["idProveedor", "idArticulo", "desde", "hasta"] as const).filter((k) => String(f[k] ?? "") !== "").length,
    [f],
  );

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Historial de precios por proveedor"
        subtitle="Precios realmente pagados por artículo y proveedor, con resumen estadístico."
        help={AYUDA_HISTORIAL}
      />

      <FilterBar
        activeCount={activeCount}
        onApply={() => {
          setPage(1);
          void cargar();
        }}
        onClear={() => {
          setF({ idProveedor: "", idArticulo: "", desde: "", hasta: "" });
          setPage(1);
        }}
      >
        <FormGrid>
          <Field
            def={{ name: "idProveedor", label: "Proveedor", kind: "select", options: proveedores }}
            value={f["idProveedor"] ?? ""}
            onChange={(v) => setF((p) => ({ ...p, idProveedor: v }))}
          />
          <Field
            def={{ name: "idArticulo", label: "Artículo", kind: "select", options: articulos }}
            value={f["idArticulo"] ?? ""}
            onChange={(v) => setF((p) => ({ ...p, idArticulo: v }))}
          />
          <Field
            def={{ name: "desde", label: "Desde", kind: "date" }}
            value={f["desde"] ?? ""}
            onChange={(v) => setF((p) => ({ ...p, desde: v }))}
          />
          <Field
            def={{ name: "hasta", label: "Hasta", kind: "date", minDateField: "desde" }}
            values={f}
            value={f["hasta"] ?? ""}
            onChange={(v) => setF((p) => ({ ...p, hasta: v }))}
          />
        </FormGrid>
      </FilterBar>

      {resp !== null && (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <KpiCard label="Registros" value={String(resp.resumen.registros)} icon="list" tone="navy" />
            <KpiCard label="Precio mínimo" value={money(resp.resumen.precioMin)} icon="chart" tone="success" />
            <KpiCard label="Precio promedio" value={money(resp.resumen.precioPromedio)} icon="chart" tone="brand" />
            <KpiCard label="Precio máximo" value={money(resp.resumen.precioMax)} icon="chart" tone="warning" />
            <KpiCard label="Cantidad total" value={formatQty(resp.resumen.cantidadTotal)} icon="package" tone="brand" />
          </div>

          <DataTable<HistRow>
            columns={columns}
            rows={resp.data}
            // El indice desambigua compras historicas identicas en fecha+articulo+
            // proveedor+precio (pasa con datos reales) — sin el, React ve claves
            // duplicadas y puede duplicar/omitir filas al re-renderizar.
            rowKey={(r) => `${r.fechaCompra}|${r.articuloCodigo}|${r.proveedor}|${r.precioAcordado}|${resp.data.indexOf(r)}`}
            loading={loading}
            emptyTitle="Sin compras registradas para el filtro"
            page={resp.meta.page}
            totalPages={resp.meta.totalPages}
            total={resp.meta.total}
            onPage={setPage}
            onReload={() => void cargar()}
          />
        </>
      )}
      {resp === null && (
        <Card>
          <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
            {loading ? "Cargando..." : "Sin datos."}
          </p>
        </Card>
      )}
    </div>
  );
}

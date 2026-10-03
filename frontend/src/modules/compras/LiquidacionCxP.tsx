/**
 * Cuentas por Pagar: liquidacion de facturas de proveedor generadas por una
 * Recepcion. Lista las facturas pendientes (numero de orden, proveedor,
 * fecha de recepcion, monto a liquidar, estado) y, al elegir una, muestra el
 * 3-way match (Solicitud -> OC -> Recepcion) antes de registrar los datos
 * reales del FEL y el medio de pago (cheque o transferencia).
 */
import { useCallback, useEffect, useState } from "react";
import { http } from "../../core/HttpClient.js";
import { messageOf } from "../../core/errors.js";
import { formatMoney } from "../../core/format.js";
import { useToast } from "../../ui/Toast.js";
import { DataTable, type Column, type RowAction } from "../../ui/DataTable.js";
import { Modal } from "../../ui/Modal.js";
import { Button, Card, PageHeader } from "../../ui/primitives.js";
import { Field, FormGrid, type FieldValue } from "../../ui/Field.js";
import { TimeBars } from "../../ui/Charts.js";
import Icon from "../../ui/Icon.js";

interface BucketPago {
  readonly id: string;
  readonly etiqueta: string;
  readonly monto: number;
  readonly facturas: number;
}
interface ProyeccionPagos {
  readonly buckets: readonly BucketPago[];
  readonly totalPendiente: number;
  readonly montoVencido: number;
}
const moneyCompact = (n: number): string =>
  `Q ${n.toLocaleString("es-GT", { notation: "compact", maximumFractionDigits: 1 })}`;

type Row = Record<string, unknown>;

const col = (key: string, header: string, opts: Partial<Column<Row>> = {}): Column<Row> => ({
  key,
  header,
  value: (r) => r[key] as string | number | null,
  ...opts,
});

const COLUMNS: readonly Column<Row>[] = [
  col("idOrdenCompra", "Orden", { refKind: "docOrden", width: 100, sortable: false }),
  col("proveedor", "Proveedor", { grow: true }),
  col("fechaRecepcion", "Recepcion", { type: "date" }),
  col("montoTotal", "Monto a liquidar", { type: "money" }),
  col("estado", "Estado", { type: "estado" }),
];

export default function LiquidacionCxP(): React.ReactElement {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [proyeccion, setProyeccion] = useState<ProyeccionPagos | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void http
      .list<Row>("/api/com/cxp/pendientes")
      .then((page) => setRows([...page.data]))
      .catch((e: unknown) => toast.error(messageOf(e)))
      .finally(() => setLoading(false));
    void http
      .raw<{ data: ProyeccionPagos }>("/api/com/cxp/proyeccion-pagos")
      .then((r) => setProyeccion(r.data))
      .catch(() => setProyeccion(null));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const actions: readonly RowAction<Row>[] = [
    {
      label: "Liquidar",
      icon: "check",
      primary: true,
      onClick: (r) => setDetalleId(Number(r["idFacturaProveedor"])),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Cuentas por pagar"
        subtitle="Facturas de proveedor con recepcion fisica ya registrada, listas para liquidar."
      />

      {proyeccion !== null && (
        <Card>
          <h3 className="mb-1" style={{ color: "var(--color-heading)" }}>
            Proyeccion de flujo de pagos
          </h3>
          <p className="mb-3 text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
            Cuanto hay que pagar y cuando — suma exacta de lo pendiente, organizada por cuando vence.
          </p>
          <TimeBars
            data={proyeccion.buckets.map((b) => ({ label: b.etiqueta, value: b.monto }))}
            format={moneyCompact}
            ariaLabel="Monto pendiente de pago por semana de vencimiento"
            valueHeader="Monto (GTQ)"
            emptyText="No hay facturas pendientes de liquidar."
          />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.78rem]" style={{ color: "var(--color-ink-soft)" }}>
            <span>
              Total pendiente: <b style={{ color: "var(--color-heading)" }}>{formatMoney(proyeccion.totalPendiente)}</b>
            </span>
            {proyeccion.montoVencido > 0 && (
              <span>
                Ya vencido: <b style={{ color: "var(--color-danger)" }}>{formatMoney(proyeccion.montoVencido)}</b>
              </span>
            )}
          </div>
        </Card>
      )}

      <DataTable<Row>
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => Number(r["idFacturaProveedor"])}
        loading={loading}
        actions={actions}
        emptyTitle="No hay facturas pendientes de liquidar"
        emptyHint="Aparecen aqui automaticamente cuando Bodega registra una recepcion."
        page={1}
        totalPages={1}
        total={rows.length}
        onPage={() => {}}
        onReload={load}
      />

      {detalleId !== null && (
        <LiquidarModal
          idFacturaProveedor={detalleId}
          onClose={() => setDetalleId(null)}
          onSuccess={() => {
            setDetalleId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface ChequeoMatch {
  readonly ok: boolean;
}
interface TresWayMatch {
  readonly idOrdenCompra: number;
  readonly idRecepcion: number;
  readonly solicitudOrden: ChequeoMatch & { readonly lineasOc: number; readonly lineasTrazadas: number };
  readonly ordenRecepcion: ChequeoMatch & { readonly lineasRecepcion: number; readonly lineasValidas: number };
  readonly recepcionFactura: ChequeoMatch & {
    readonly montoSistema: number;
    readonly montoFactura: number;
    readonly diferencia: number;
  };
  readonly ok: boolean;
}

function ChequeoFila(props: { ok: boolean; titulo: string; detalle: string }): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-0.5 grid shrink-0 place-items-center"
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          background: props.ok ? "var(--color-success)" : "var(--color-warning)",
          color: "#fff",
        }}
      >
        <Icon name={props.ok ? "check" : "x"} size={13} />
      </span>
      <span className="text-[0.82rem]" style={{ color: "var(--color-ink)" }}>
        <b>{props.titulo}</b> — {props.detalle}
      </span>
    </div>
  );
}

const FORMA_PAGO_OPCIONES = [
  { value: "TRANSFERENCIA", label: "Transferencia (ACH)" },
  { value: "CHEQUE", label: "Cheque" },
];

function LiquidarModal(props: {
  idFacturaProveedor: number;
  onClose: () => void;
  onSuccess: () => void;
}): React.ReactElement {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [factura, setFactura] = useState<Row | null>(null);
  const [match, setMatch] = useState<TresWayMatch | null>(null);
  const [form, setForm] = useState<Record<string, FieldValue>>({});
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const body = await http.raw<{ data: { factura: Row; tresWayMatch: TresWayMatch } }>(
          `/api/com/cxp/${props.idFacturaProveedor}`,
        );
        if (!alive) return;
        setFactura(body.data.factura);
        setMatch(body.data.tresWayMatch);
        setForm((f) => ({
          ...f,
          montoTotal: String(body.data.factura["montoTotal"] ?? ""),
          formaPago: "TRANSFERENCIA",
          fechaEmision: String(body.data.factura["fechaEmision"] ?? "").slice(0, 10),
          fechaDocumento: String(body.data.factura["fechaDocumento"] ?? "").slice(0, 10),
          fechaPago: new Date().toISOString().slice(0, 10),
        }));
      } catch (e: unknown) {
        toast.error(messageOf(e));
        props.onClose();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.idFacturaProveedor]);

  function set(name: string, v: FieldValue): void {
    setForm((f) => ({ ...f, [name]: v }));
  }

  async function liquidar(): Promise<void> {
    const requeridos = [
      "numeroDte",
      "serieDte",
      "fechaEmision",
      "fechaDocumento",
      "montoTotal",
      "formaPago",
      "banco",
      "numeroReferencia",
      "fechaPago",
    ];
    for (const campo of requeridos) {
      if (String(form[campo] ?? "").trim() === "") {
        setShowErrors(true);
        toast.error("Completa todos los campos antes de liquidar");
        return;
      }
    }
    setSaving(true);
    try {
      await http.post(`/api/com/cxp/${props.idFacturaProveedor}/liquidar`, {
        numeroDte: form["numeroDte"],
        serieDte: form["serieDte"],
        fechaEmision: form["fechaEmision"],
        fechaDocumento: form["fechaDocumento"],
        montoTotal: Number(form["montoTotal"]),
        formaPago: form["formaPago"],
        banco: form["banco"],
        numeroReferencia: form["numeroReferencia"],
        fechaPago: form["fechaPago"],
      });
      toast.success("Factura liquidada — orden marcada como PAGADA");
      props.onSuccess();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={`Liquidar factura · OC-${match !== null ? String(match.idOrdenCompra) : "…"}`}
      onClose={props.onClose}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose}>
            Cancelar
          </Button>
          <Button icon="check" disabled={loading || saving} onClick={() => void liquidar()}>
            {saving ? "Liquidando..." : "Confirmar y liquidar"}
          </Button>
        </>
      }
    >
      {loading || match === null || factura === null ? (
        <p className="text-[0.85rem]" style={{ color: "var(--color-ink-faint)" }}>
          Cargando...
        </p>
      ) : (
        <div className="grid gap-4">
          <section className="grid gap-2">
            <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              3-way match — Solicitud → Orden de compra → Recepcion
            </h3>
            <div
              className="surface-2 grid gap-2 rounded-xl p-3"
              style={{ border: `1px solid ${match.ok ? "var(--color-success)" : "var(--color-warning)"}` }}
            >
              <ChequeoFila
                ok={match.solicitudOrden.ok}
                titulo="Solicitud → Orden"
                detalle={`${match.solicitudOrden.lineasTrazadas} de ${match.solicitudOrden.lineasOc} renglones de la OC trazan a una solicitud aprobada`}
              />
              <ChequeoFila
                ok={match.ordenRecepcion.ok}
                titulo="Orden → Recepcion"
                detalle={`${match.ordenRecepcion.lineasValidas} de ${match.ordenRecepcion.lineasRecepcion} renglones recibidos corresponden a la OC`}
              />
              <ChequeoFila
                ok={match.recepcionFactura.ok}
                titulo="Recepcion → Factura"
                detalle={`Sistema ${formatMoney(match.recepcionFactura.montoSistema)} vs. factura ${formatMoney(match.recepcionFactura.montoFactura)} (diferencia ${formatMoney(match.recepcionFactura.diferencia)})`}
              />
              {!match.ok && (
                <p className="text-[0.78rem]" style={{ color: "var(--color-warning)" }}>
                  Hay una diferencia fuera de tolerancia — puedes continuar, pero revisala antes de confirmar.
                </p>
              )}
            </div>
          </section>

          <section className="grid gap-2">
            <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              Datos de la factura (FEL)
            </h3>
            <FormGrid>
              <Field def={{ name: "numeroDte", label: "Numero de DTE", kind: "code", required: true }} value={form["numeroDte"] ?? ""} onChange={(v) => set("numeroDte", v)} showErrors={showErrors} />
              <Field def={{ name: "serieDte", label: "Serie", kind: "code", required: true }} value={form["serieDte"] ?? ""} onChange={(v) => set("serieDte", v)} showErrors={showErrors} />
              <Field def={{ name: "fechaEmision", label: "Fecha de emision", kind: "date", required: true }} value={form["fechaEmision"] ?? ""} onChange={(v) => set("fechaEmision", v)} showErrors={showErrors} />
              <Field def={{ name: "fechaDocumento", label: "Fecha del documento", kind: "date", required: true }} value={form["fechaDocumento"] ?? ""} onChange={(v) => set("fechaDocumento", v)} showErrors={showErrors} />
              <Field def={{ name: "montoTotal", label: "Monto total", kind: "money", required: true }} value={form["montoTotal"] ?? ""} onChange={(v) => set("montoTotal", v)} showErrors={showErrors} />
            </FormGrid>
          </section>

          <section className="grid gap-2">
            <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              Pago
            </h3>
            <FormGrid>
              <Field
                def={{ name: "formaPago", label: "Forma de pago", kind: "select", required: true, options: FORMA_PAGO_OPCIONES }}
                value={form["formaPago"] ?? "TRANSFERENCIA"}
                onChange={(v) => set("formaPago", v)}
                showErrors={showErrors}
              />
              <Field def={{ name: "banco", label: "Banco", kind: "shortText", required: true }} value={form["banco"] ?? ""} onChange={(v) => set("banco", v)} showErrors={showErrors} />
              <Field
                def={{
                  name: "numeroReferencia",
                  label: "Numero de referencia",
                  kind: "code",
                  required: true,
                  help: form["formaPago"] === "CHEQUE" ? "Numero de cheque" : "Numero/confirmacion de la transferencia",
                }}
                value={form["numeroReferencia"] ?? ""}
                onChange={(v) => set("numeroReferencia", v)}
                showErrors={showErrors}
              />
              <Field def={{ name: "fechaPago", label: "Fecha de pago", kind: "date", required: true }} value={form["fechaPago"] ?? ""} onChange={(v) => set("fechaPago", v)} showErrors={showErrors} />
            </FormGrid>
          </section>
        </div>
      )}
    </Modal>
  );
}

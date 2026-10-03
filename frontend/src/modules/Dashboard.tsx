/**
 * Dashboard: linea del proceso + contenido SEGUN EL ROL de la sesion.
 * skills/patron-diseno.md §8 (pantallas clave) y §13 (modelo mental): cada
 * rol ve lo que le aporta valor para decidir su proximo paso, no un panel
 * generico igual para todos — un bodeguero no tiene Dashboard (no gestiona
 * nada agregable) y, entre quienes si lo tienen, un solicitante ve sus
 * propias solicitudes y a quien le corresponde continuarlas, mientras que
 * Finanzas ve el panorama de gasto/ahorro. El grafico financiero sigue la
 * guia de la skill `dataviz`: una sola serie -> un solo hue de marca,
 * etiquetas y valores siempre visibles, marcas finas con extremo redondeado.
 */

import { useEffect, useState } from "react";
import { http } from "../core/HttpClient.js";
import { dashboardService, type DashboardResumen } from "../core/CompraServices.js";
import { Button, Card, KpiCard, PageHeader } from "../ui/primitives.js";
import type { HelpContent } from "../ui/HelpTip.js";
import type { IconName } from "../ui/Icon.js";
import Icon from "../ui/Icon.js";
import { FlowStepper } from "../ui/FlowStepper.js";
import { TimeBars, Gauge } from "../ui/Charts.js";
import { estadoLabel } from "../core/estados.js";
import { formatMoney } from "../core/format.js";
import { useNotificaciones } from "../hooks/useNotificaciones.js";
import { ALL_LEAVES, leafVisible } from "../nav.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { Permisos } from "../core/auth/permisos.js";

type Row = Record<string, unknown>;
interface Responsable {
  readonly rol: string;
  readonly nombre: string | null;
}

const AYUDA_DASHBOARD: HelpContent = {
  title: "Dashboard — como leerlo",
  body: (
    <p>
      La linea de arriba (Solicitud → Aprobacion → ... → CxP/Devolucion) es
      el mapa del ciclo completo — cada paso navega a su pantalla. Debajo,
      cada tarjeta muestra solo lo que le corresponde decidir o seguir a tu
      rol — no el mismo panel para todos.
    </p>
  ),
};

const Q_COMPACT = new Intl.NumberFormat("es-GT", { notation: "compact", maximumFractionDigits: 1 });
const moneyCompact = (n: number): string => `Q ${Q_COMPACT.format(n)}`;
const veces = (n: number): string => `${n.toFixed(2)}×`;

async function total(path: string, query?: Record<string, string>): Promise<number> {
  try {
    const r = await http.list<unknown>(path, { pageSize: 1, ...query });
    return r.meta.total;
  } catch {
    return 0;
  }
}

/** Fila de una lista "esperando a" — reutilizada por Mis solicitudes y Compras. */
function FilaEsperando(props: { titulo: string; responsable: Responsable | null }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 text-[0.82rem]">
      <span className="truncate" style={{ color: "var(--color-ink)" }}>
        {props.titulo}
      </span>
      <span className="shrink-0 whitespace-nowrap" style={{ color: "var(--color-ink-faint)" }}>
        {props.responsable === null
          ? "—"
          : props.responsable.nombre !== null
            ? `${props.responsable.nombre} · ${props.responsable.rol}`
            : props.responsable.rol}
      </span>
    </div>
  );
}

/** Grafico de barras horizontales: OC por estado (una serie, hue de marca). */
function OrdenesPorEstado(props: { data: readonly { estado: string; n: number }[] }): React.ReactElement {
  const max = Math.max(1, ...props.data.map((d) => d.n));
  const totalOc = props.data.reduce((a, d) => a + d.n, 0);
  if (totalOc === 0) {
    return (
      <p className="text-[0.82rem]" style={{ color: "var(--color-ink-faint)" }}>
        Aun no hay ordenes de compra registradas.
      </p>
    );
  }
  return (
    <div className="grid gap-1.5" role="img" aria-label="Ordenes de compra por estado">
      {props.data.map((d) => (
        <div
          key={d.estado}
          className="grid items-center gap-2"
          style={{ gridTemplateColumns: "128px 1fr 2.5rem" }}
          title={`${estadoLabel(d.estado)}: ${d.n}`}
        >
          <span className="truncate text-[0.75rem]" style={{ color: "var(--color-ink-soft)" }}>
            {estadoLabel(d.estado)}
          </span>
          <span
            className="block h-3"
            style={{ width: `${Math.max(4, (d.n / max) * 100)}%`, background: "var(--color-brand)", borderRadius: 4 }}
          />
          <span className="text-right text-[0.78rem] font-semibold" style={{ color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
            {d.n}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard(props: { onNavigateById: (leafId: string) => void }): React.ReactElement {
  const { sesion, hasPerm, hasAnyPerm } = useAuth();
  const { bandeja } = useNotificaciones();

  // --- Quien es, en terminos de que le sirve ver (permiso, no nombre de rol) ---
  const esSolicitante = hasPerm(Permisos.SOLICITUD_CREAR);
  const esAprobador = hasAnyPerm([Permisos.SOLICITUD_APROBAR_JEFE, Permisos.SOLICITUD_APROBAR_GERENTE]);
  const esComprador = hasPerm(Permisos.RFQ_GESTIONAR);
  const esFinanciero = hasPerm(Permisos.COTIZACION_ADJUDICAR);
  const esLiquidador = hasPerm(Permisos.CATALOGO_ADMIN);
  const esAuditor = (sesion?.roles ?? []).includes("AUDITOR");
  const vePanelGestion = esComprador || esFinanciero || esAuditor;
  const veFinanciero = esFinanciero || esAuditor;

  const cantidadBandeja = (tipo: string): number => bandeja.items.find((i) => i.tipo === tipo)?.cantidad ?? 0;

  /**
   * Antes de pedir un conteo, confirma que el rol puede ver esa pantalla —
   * evita 403 innecesarios (y ruido en consola) para quien no gestiona ese
   * recurso (ej. Auditor/Financiero no tienen Recepciones; Comprador tampoco).
   * Misma fuente que ya filtra las tarjetas KPI mas abajo.
   */
  const puedeVer = (leafId: string): boolean => {
    const leaf = ALL_LEAVES.find((l) => l.id === leafId);
    return leaf === undefined || leafVisible(leaf, hasAnyPerm);
  };

  const [c, setC] = useState<{
    proveedores: number; solicitudes: number; ordenes: number; recepciones: number; cotizaciones: number; comprasRegistros: number;
  } | null>(null);
  const [ocEstados, setOcEstados] = useState<readonly { estado: string; n: number }[]>([]);
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [misSolicitudes, setMisSolicitudes] = useState<{
    pendienteJefe: number; pendienteGerente: number; enCotizacion: number; ordenGenerada: number; rechazada: number;
  } | null>(null);
  const [esperando, setEsperando] = useState<readonly { idSolicitud: number; justificacion: string; responsable: Responsable | null }[]>([]);
  const [facturasPorLiquidar, setFacturasPorLiquidar] = useState<number | null>(null);

  useEffect(() => {
    if (!vePanelGestion) return;
    void (async () => {
      const [proveedores, solicitudes, ordenes, recepciones, cotizaciones] = await Promise.all([
        puedeVer("com-cat-proveedores") ? total("/api/com/proveedores") : Promise.resolve(0),
        puedeVer("com-doc-solicitudes") ? total("/api/com/solicitudes") : Promise.resolve(0),
        puedeVer("com-doc-ordenes") ? total("/api/com/ordenes-compra") : Promise.resolve(0),
        puedeVer("com-doc-recepciones") ? total("/api/com/recepciones") : Promise.resolve(0),
        puedeVer("com-doc-cotizaciones") ? total("/api/com/cotizaciones") : Promise.resolve(0),
      ]);
      let comprasRegistros = 0;
      if (puedeVer("com-an-historial")) {
        try {
          const h = await http.raw<{ resumen: { registros: number } }>("/api/com/historial-precios", { pageSize: 1 });
          comprasRegistros = h.resumen.registros;
        } catch {
          comprasRegistros = 0;
        }
      }
      setC({ proveedores, solicitudes, ordenes, recepciones, cotizaciones, comprasRegistros });

      if (puedeVer("com-doc-ordenes")) {
        try {
          const oc = await http.list<{ estado: string }>("/api/com/ordenes-compra", { pageSize: 200 });
          const conteo = new Map<string, number>();
          for (const r of oc.data) conteo.set(String(r.estado ?? "—"), (conteo.get(String(r.estado ?? "—")) ?? 0) + 1);
          const orden = ["EMITIDA", "ENVIADA", "EN_TRANSITO", "RECIBIDA_PARCIAL", "RECIBIDA_COMPLETA", "CANCELADA", "RECHAZADA"];
          setOcEstados(
            [...conteo.entries()]
              .sort((a, b) => {
                const ia = orden.indexOf(a[0]);
                const ib = orden.indexOf(b[0]);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
              })
              .map(([estado, n]) => ({ estado, n })),
          );
        } catch {
          setOcEstados([]);
        }
      } else {
        setOcEstados([]);
      }
    })();
  }, [vePanelGestion]);

  useEffect(() => {
    if (!veFinanciero) return;
    void (async () => {
      try {
        setResumen(await dashboardService.resumen());
      } catch {
        setResumen(null);
      }
    })();
  }, [veFinanciero]);

  useEffect(() => {
    if (!esLiquidador) return;
    void (async () => {
      try {
        const r = await http.raw<{ data: readonly unknown[] }>("/api/com/cxp/pendientes");
        setFacturasPorLiquidar(r.data.length);
      } catch {
        setFacturasPorLiquidar(null);
      }
    })();
  }, [esLiquidador]);

  useEffect(() => {
    if (!esSolicitante && !esAprobador) return;
    void (async () => {
      const [pendienteJefe, pendienteGerente, enCotizacion, ordenGenerada, rechazada] = await Promise.all([
        total("/api/com/solicitudes", { estado__eq: "PENDIENTE_JEFE" }),
        total("/api/com/solicitudes", { estado__eq: "PENDIENTE_GERENTE" }),
        total("/api/com/solicitudes", { estado__eq: "EN_COTIZACION" }),
        total("/api/com/solicitudes", { estado__eq: "ORDEN_GENERADA" }),
        total("/api/com/solicitudes", { estado__eq: "RECHAZADA" }),
      ]);
      setMisSolicitudes({ pendienteJefe, pendienteGerente, enCotizacion, ordenGenerada, rechazada });

      try {
        const pend = await http.list<Row>("/api/com/solicitudes", {
          estado__in: "PENDIENTE_JEFE,PENDIENTE_GERENTE",
          pageSize: 5,
          sort: "idSolicitud",
          order: "desc",
        });
        const ids = pend.data.map((r) => Number(r["idSolicitud"])).filter((n) => Number.isFinite(n));
        if (ids.length === 0) {
          setEsperando([]);
          return;
        }
        const resp = await http.raw<{ data: Record<string, Responsable | null> }>(
          "/api/com/ref/solicitudes/responsables",
          { ids: ids.join(",") },
        );
        setEsperando(
          pend.data.map((r) => ({
            idSolicitud: Number(r["idSolicitud"]),
            justificacion: String(r["justificacion"] ?? ""),
            responsable: resp.data[String(r["idSolicitud"])] ?? null,
          })),
        );
      } catch {
        setEsperando([]);
      }
    })();
  }, [esSolicitante, esAprobador]);

  const allKpis: readonly { label: string; value: number | undefined; icon: IconName; tone: "brand" | "success" | "warning" | "danger" | "navy"; leafId: string }[] = [
    { label: "Proveedores", value: c?.proveedores, icon: "truck", tone: "brand", leafId: "com-cat-proveedores" },
    { label: "Solicitudes", value: c?.solicitudes, icon: "clipboard", tone: "navy", leafId: "com-doc-solicitudes" },
    { label: "Cotizaciones", value: c?.cotizaciones, icon: "coins", tone: "brand", leafId: "com-doc-cotizaciones" },
    { label: "Ordenes de compra", value: c?.ordenes, icon: "cart", tone: "warning", leafId: "com-doc-ordenes" },
    { label: "Recepciones", value: c?.recepciones, icon: "package", tone: "success", leafId: "com-doc-recepciones" },
    { label: "Historial de precios", value: c?.comprasRegistros, icon: "chart", tone: "brand", leafId: "com-an-historial" },
  ];
  const kpis = allKpis.filter((k) => {
    const leaf = ALL_LEAVES.find((l) => l.id === k.leafId);
    return leaf === undefined || leafVisible(leaf, hasAnyPerm);
  });

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="Dashboard de compras" subtitle="Lo que te corresponde seguir, de un vistazo." help={AYUDA_DASHBOARD} />

      <FlowStepper onStep={props.onNavigateById} />

      {/* --- Aprobaciones pendientes (jefe / gerente de area) --- */}
      {esAprobador && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="mb-1" style={{ color: "var(--color-heading)" }}>
                Aprobaciones pendientes de tu equipo
              </h3>
              <p className="text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
                {cantidadBandeja("APROBAR_JEFE") + cantidadBandeja("APROBAR_GERENTE") > 0
                  ? "Estan esperando tu decision — apruebalas o rechazalas desde Solicitudes."
                  : "No hay nada esperando tu aprobacion en este momento."}
              </p>
            </div>
            <Button icon="clipboard" variant="secondary" onClick={() => props.onNavigateById("com-doc-solicitudes")}>
              {cantidadBandeja("APROBAR_JEFE") + cantidadBandeja("APROBAR_GERENTE")}
            </Button>
          </div>
        </Card>
      )}

      {/* --- Mis solicitudes (solicitante / jefe que tambien solicita) --- */}
      {esSolicitante && misSolicitudes !== null && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 style={{ color: "var(--color-heading)" }}>Tus solicitudes</h3>
            <Button size="sm" icon="clipboard" onClick={() => props.onNavigateById("com-doc-solicitudes")}>
              Nueva solicitud
            </Button>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
            <KpiCard label="Esperando al jefe" value={String(misSolicitudes.pendienteJefe)} icon="clock" tone="warning" />
            <KpiCard label="Esperando al gerente" value={String(misSolicitudes.pendienteGerente)} icon="clock" tone="warning" />
            <KpiCard label="En cotizacion" value={String(misSolicitudes.enCotizacion)} icon="coins" tone="brand" />
            <KpiCard label="Orden generada" value={String(misSolicitudes.ordenGenerada)} icon="check" tone="success" />
            <KpiCard label="Rechazadas" value={String(misSolicitudes.rechazada)} icon="x" tone="danger" />
          </div>
          {esperando.length > 0 && (
            <div className="mt-3 grid gap-1.5 border-t pt-3" style={{ borderColor: "var(--color-line)" }}>
              <span className="text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>
                Esperando decision — a quien preguntarle
              </span>
              {esperando.map((e) => (
                <FilaEsperando key={e.idSolicitud} titulo={`#${e.idSolicitud} · ${e.justificacion}`} responsable={e.responsable} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* --- Departamento de Compras --- */}
      {esComprador && (
        <Card>
          <h3 className="mb-3" style={{ color: "var(--color-heading)" }}>
            Departamento de Compras
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => props.onNavigateById("com-doc-rfq")}
              className="transition-fluent"
              style={{ cursor: "pointer" }}
            >
              <KpiCard label="Listas para cotizar" value={String(cantidadBandeja("COTIZAR"))} icon="send" tone="brand" />
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => props.onNavigateById("com-an-comparativo")}
              className="transition-fluent"
              style={{ cursor: "pointer" }}
            >
              <KpiCard label="Listas para generar OC" value={String(cantidadBandeja("ORDEN_PENDIENTE"))} icon="cart" tone="success" />
            </div>
          </div>
        </Card>
      )}

      {/* --- Panel de gestion: KPIs generales + OC por estado (comprador/financiero/auditor) --- */}
      {vePanelGestion && (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            {kpis.map((k) => (
              <div
                key={k.label}
                role="button"
                tabIndex={0}
                aria-label={`Ir a ${k.label}`}
                onClick={() => props.onNavigateById(k.leafId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onNavigateById(k.leafId);
                  }
                }}
                className="transition-fluent"
                style={{ cursor: "pointer", borderRadius: "var(--radius-lg)" }}
              >
                <KpiCard label={k.label} value={k.value === undefined ? "…" : String(k.value)} icon={k.icon} tone={k.tone} />
              </div>
            ))}
          </div>

          <Card>
            <h3 className="mb-1" style={{ color: "var(--color-heading)" }}>
              Ordenes de compra por estado
            </h3>
            <p className="mb-3 text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
              Donde estan las ordenes activas del periodo.
            </p>
            <OrdenesPorEstado data={ocEstados} />
          </Card>
        </>
      )}

      {/* --- Finanzas: panorama de gasto + ahorro + liquidacion (financiero/auditor) --- */}
      {veFinanciero && resumen !== null && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <h3 className="mb-1" style={{ color: "var(--color-heading)" }}>
                Compras por mes
              </h3>
              <p className="mb-3 text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                Monto (GTQ) de ordenes de compra emitidas, ultimos {resumen.meses} meses.
              </p>
              <TimeBars
                data={resumen.comprasPorMes.map((p) => ({ label: p.label, value: p.monto }))}
                format={moneyCompact}
                ariaLabel={`Monto de compras por mes, ultimos ${resumen.meses} meses`}
                valueHeader="Monto (GTQ)"
                emptyText="Aun no se han emitido ordenes de compra."
              />
              {resumen.proyeccionGasto !== null && (
                <p className="mt-3 text-[0.78rem]" style={{ color: "var(--color-ink-soft)" }}>
                  Proyeccion del proximo mes:{" "}
                  <b style={{ color: "var(--color-heading)" }}>
                    {formatMoney(resumen.proyeccionGasto.proximoMes)}
                  </b>{" "}
                  (entre {formatMoney(resumen.proyeccionGasto.rangoMin)} y {formatMoney(resumen.proyeccionGasto.rangoMax)}) · tendencia{" "}
                  <b
                    style={{
                      color:
                        resumen.proyeccionGasto.tendencia === "alza"
                          ? "var(--color-warning)"
                          : resumen.proyeccionGasto.tendencia === "baja"
                            ? "var(--color-success)"
                            : "var(--color-heading)",
                    }}
                  >
                    en {resumen.proyeccionGasto.tendencia}
                  </b>
                  . Regresion lineal sobre los ultimos {Math.min(6, resumen.comprasPorMes.length)} meses, no una garantia.
                </p>
              )}
            </Card>

            <Card>
              <h3 className="mb-1" style={{ color: "var(--color-heading)" }}>
                Rotacion de inventario
              </h3>
              <p className="mb-3 text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                Valor de entradas por compra del mes ÷ existencia valorizada actual.
              </p>
              <TimeBars
                data={resumen.rotacion.porMes.map((p) => ({ label: p.label, value: p.rotacion }))}
                format={veces}
                ariaLabel={`Rotacion de inventario por mes, ultimos ${resumen.meses} meses`}
                valueHeader="Rotacion (×)"
                emptyText="Aun no hay recepciones ni existencia valorizada."
              />
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.78rem]" style={{ color: "var(--color-ink-soft)" }}>
                <span>
                  Rotacion {resumen.meses} m: <b style={{ color: "var(--color-heading)" }}>{veces(resumen.rotacion.rotacion12m)}</b>
                </span>
                <span>
                  Existencia valorizada: <b style={{ color: "var(--color-heading)" }}>{formatMoney(resumen.rotacion.existenciaValorizada)}</b>
                </span>
              </div>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card>
              <h3 className="mb-2" style={{ color: "var(--color-heading)" }}>
                Ahorro de adjudicacion
              </h3>
              <Gauge
                value={resumen.ahorroAdjudicacion.ahorroPonderadoPct}
                label="Ahorro ponderado por monto"
                caption={
                  resumen.ahorroAdjudicacion.lineasConAlternativa > 0
                    ? `${resumen.ahorroAdjudicacion.lineasConAlternativa} lineas con alternativa · promedio simple ${Math.round(resumen.ahorroAdjudicacion.ahorroPromedioPct)} %`
                    : "Aun sin lineas adjudicadas con alternativa"
                }
              />
              <p className="mt-2 text-[0.72rem]" style={{ color: "var(--color-ink-faint)" }}>
                Precio adjudicado vs. el mas caro cotizado para la misma linea: mas alto = mejores negociaciones.
              </p>
            </Card>

            <Card>
              <h3 className="mb-2" style={{ color: "var(--color-heading)" }}>
                Decisiones pendientes
              </h3>
              <div className="grid gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => props.onNavigateById("com-an-comparativo")}
                  style={{ cursor: "pointer" }}
                >
                  <KpiCard label="Comparativos por adjudicar" value={String(cantidadBandeja("ADJUDICAR"))} icon="award" tone="warning" />
                </div>
                {esLiquidador && facturasPorLiquidar !== null && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => props.onNavigateById("com-cxp-liquidacion")}
                    style={{ cursor: "pointer" }}
                  >
                    <KpiCard label="Facturas por liquidar" value={String(facturasPorLiquidar)} icon="wallet" tone="brand" />
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <h3 className="mb-1" style={{ color: "var(--color-heading)" }}>
                Monto adjudicado vs. evitado
              </h3>
              <div className="grid gap-2 text-[0.82rem]" style={{ color: "var(--color-ink-soft)" }}>
                <span>
                  Monto adjudicado: <b style={{ color: "var(--color-heading)" }}>{formatMoney(resumen.ahorroAdjudicacion.montoAdjudicado)}</b>
                </span>
                <span>
                  Monto evitado: <b style={{ color: "var(--color-success)" }}>{formatMoney(resumen.ahorroAdjudicacion.montoEvitado)}</b>
                </span>
                <span>
                  Lineas adjudicadas: <b style={{ color: "var(--color-heading)" }}>{resumen.ahorroAdjudicacion.lineasAdjudicadas}</b>
                </span>
              </div>
            </Card>
          </div>
        </>
      )}

      {!esAprobador && !esSolicitante && !esComprador && !veFinanciero && (
        <Card>
          <div className="flex items-center gap-2">
            <Icon name="chart" size={18} />
            <p className="text-[0.85rem]" style={{ color: "var(--color-ink-soft)" }}>
              Tu rol no tiene indicadores propios en este Dashboard todavia.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

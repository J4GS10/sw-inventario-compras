/**
 * Paneles del Dashboard segun el PERFIL de la sesion (ver `core/auth/perfilAnalitico.ts`).
 * Cada area ve SOLO lo que decide — y cada panel usa unicamente el reporte que
 * ese rol tiene permitido (si no, la API responderia 403):
 *
 *  - Compras      -> A quien comprarle (evaluacion) + entregas atrasadas + que reponer.
 *  - Finanzas     -> Concentracion del gasto por proveedor y por area.
 *  - Auditoria    -> Hallazgos de control por severidad + proveedores a vigilar.
 *  - Gerencia/jefes -> Sus aprobaciones pendientes + gasto de su area + si lo pedido ya existe.
 *  - Bodega       -> Lo que llega: atrasado, proximos 7 dias.
 *  - Solicitante  -> Antes de pedir: si ya hay, si viene en camino o si alguien ya lo pidio.
 *
 * Este componente no calcula negocio, solo presenta lo que devuelven los reportes.
 */

import { useEffect, useState } from "react";
import {
  reporteService,
  type ReporteAuditoria,
  type ReporteDisponibilidad,
  type ReporteEvaluacionProveedores,
  type ReporteGastoArea,
  type ReporteGastoProveedor,
  type ReporteOcPendientes,
  type ReporteRiesgoProveedores,
} from "../core/CompraServices.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { Permisos, grants } from "../core/auth/permisos.js";
import { PRIORIDAD_POR_PERFIL, perfilAnalitico, type PerfilAnalitico } from "../core/auth/perfilAnalitico.js";
import { formatMoney, formatPercent } from "../core/format.js";
import { useNotificaciones } from "../hooks/useNotificaciones.js";
import { Button, Card, KpiCard } from "../ui/primitives.js";
import { Destacados } from "./compras/EvaluacionProveedores.js";

const EN_COMPRAS: readonly PerfilAnalitico[] = ["comprador", "total"];
const EN_FINANZAS: readonly PerfilAnalitico[] = ["financiero", "total"];
const EN_AUDITORIA: readonly PerfilAnalitico[] = ["auditor", "total"];
const EN_GERENCIA: readonly PerfilAnalitico[] = ["gerencia"];
const EN_BODEGA: readonly PerfilAnalitico[] = ["bodega"];
const EN_SOLICITUD: readonly PerfilAnalitico[] = ["solicitante", "gerencia"];

/** Lista de barras horizontales: una serie, hue de marca, valor siempre visible. */
function Barras(props: {
  filas: readonly { id: number | string; etiqueta: string; valor: number; texto: string }[];
  vacio: string;
  ariaLabel: string;
}): React.ReactElement {
  if (props.filas.length === 0) {
    return (
      <p className="text-[0.82rem]" style={{ color: "var(--color-ink-faint)" }}>
        {props.vacio}
      </p>
    );
  }
  const max = Math.max(1e-9, ...props.filas.map((f) => f.valor));
  return (
    <div className="grid gap-1.5" role="img" aria-label={props.ariaLabel}>
      {props.filas.map((f) => (
        <div key={f.id} className="grid items-center gap-2" style={{ gridTemplateColumns: "minmax(90px, 160px) 1fr 5.5rem" }} title={`${f.etiqueta}: ${f.texto}`}>
          <span className="truncate text-[0.75rem]" style={{ color: "var(--color-ink-soft)" }}>
            {f.etiqueta}
          </span>
          <span className="block h-3" style={{ width: `${Math.max(4, (f.valor / max) * 100)}%`, background: "var(--color-brand)", borderRadius: 4 }} />
          <span className="text-right text-[0.78rem] font-semibold" style={{ color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
            {f.texto}
          </span>
        </div>
      ))}
    </div>
  );
}

function Clicable(props: { onClick: () => void; children: React.ReactNode; label: string }): React.ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={props.label}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick();
        }
      }}
      style={{ cursor: "pointer" }}
    >
      {props.children}
    </div>
  );
}

function Encabezado(props: { titulo: string; detalle: string; accion: string; onClick: () => void }): React.ReactElement {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 style={{ color: "var(--color-heading)" }}>{props.titulo}</h3>
        <p className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
          {props.detalle}
        </p>
      </div>
      <Button size="sm" variant="secondary" icon="filter" onClick={props.onClick}>
        {props.accion}
      </Button>
    </div>
  );
}

function Grid(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
      {props.children}
    </div>
  );
}

/** Proveedores de riesgo medio o alto, del mas riesgoso al menos (el reporte ya viene ordenado por score). */
function aVigilar(r: ReporteRiesgoProveedores): ReporteRiesgoProveedores["proveedores"] {
  return r.proveedores.filter((p) => p.nivel !== "bajo").slice(0, 6);
}

export default function DashboardRol(props: { onNavigateById: (leafId: string) => void }): React.ReactElement | null {
  const { sesion } = useAuth();
  const { bandeja } = useNotificaciones();
  const permisos = sesion?.permisos ?? [];
  const perfil = perfilAnalitico(permisos, sesion?.roles ?? []);
  const [evaluacion, setEvaluacion] = useState<ReporteEvaluacionProveedores | null>(null);
  const [pendientes, setPendientes] = useState<ReporteOcPendientes | null>(null);
  const [gasto, setGasto] = useState<ReporteGastoProveedor | null>(null);
  const [riesgo, setRiesgo] = useState<ReporteRiesgoProveedores | null>(null);
  const [disponibilidad, setDisponibilidad] = useState<ReporteDisponibilidad | null>(null);
  const [area, setArea] = useState<ReporteGastoArea | null>(null);
  const [auditoria, setAuditoria] = useState<ReporteAuditoria | null>(null);

  // Cada panel pide SOLO su reporte, y solo si el permiso de la sesion lo concede.
  useEffect(() => {
    void (async () => {
      const tiene = (p: string): boolean => grants(permisos, p);
      const intenta = async <T,>(ok: boolean, f: () => Promise<T>, set: (v: T | null) => void): Promise<void> => {
        if (!ok) return;
        try {
          set(await f());
        } catch {
          set(null);
        }
      };
      await Promise.all([
        intenta(EN_COMPRAS.includes(perfil) && tiene(Permisos.REPORTE_EVALUACION), () => reporteService.evaluacionProveedores({ minOrdenes: 2, prioridad: PRIORIDAD_POR_PERFIL[perfil] }), setEvaluacion),
        intenta(tiene(Permisos.REPORTE_ENTREGAS) && (EN_COMPRAS.includes(perfil) || EN_BODEGA.includes(perfil)), () => reporteService.ocPendientesRecibir(), setPendientes),
        intenta(EN_FINANZAS.includes(perfil) && tiene(Permisos.REPORTE_GASTO), () => reporteService.gastoPorProveedor(), setGasto),
        intenta(EN_AUDITORIA.includes(perfil) && tiene(Permisos.REPORTE_RIESGO), () => reporteService.riesgoProveedores(), setRiesgo),
        intenta(tiene(Permisos.REPORTE_DISPONIBILIDAD) && perfil !== "financiero" && perfil !== "auditor", () => reporteService.disponibilidadArticulos(), setDisponibilidad),
        intenta(tiene(Permisos.REPORTE_GASTO_AREA) && (EN_GERENCIA.includes(perfil) || EN_FINANZAS.includes(perfil)), () => reporteService.gastoPorArea(), setArea),
        intenta(EN_AUDITORIA.includes(perfil) && tiene(Permisos.REPORTE_AUDITORIA), () => reporteService.auditoriaCompras(), setAuditoria),
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil]);

  const irReportes = (): void => props.onNavigateById("com-an-reportes");

  const porAprobar = bandeja.items
    .filter((i) => i.tipo === "APROBAR_JEFE" || i.tipo === "APROBAR_GERENTE")
    .reduce((a, i) => a + i.cantidad, 0);

  /** "Antes de pedir": compartido por solicitante, jefes y gerentes (y compras para reponer). */
  const panelDisponibilidad =
    disponibilidad === null ? null : (
      <Card>
        <Encabezado
          titulo={perfil === "comprador" || perfil === "total" ? "Qué conviene reponer" : "Antes de pedir"}
          detalle="Existencia, lo que ya viene en camino y lo que alguien ya solicitó: evita pedidos duplicados o innecesarios."
          accion="Ver artículos"
          onClick={irReportes}
        />
        <Grid>
          <KpiCard label="Conviene pedir" value={String(disponibilidad.resumen.PEDIR)} icon="cart" tone={disponibilidad.resumen.PEDIR > 0 ? "danger" : "success"} />
          <KpiCard label="Ya solicitados" value={String(disponibilidad.resumen.EN_CURSO)} icon="clipboard" tone="warning" hint="No dupliques el pedido" />
          <KpiCard label="En camino" value={String(disponibilidad.resumen.EN_TRANSITO)} icon="truck" tone="brand" />
          <KpiCard label="Con existencia suficiente" value={String(disponibilidad.resumen.SUFICIENTE + disponibilidad.resumen.EXCEDIDO)} icon="check" tone="success" />
        </Grid>
      </Card>
    );

  return (
    <>
      {/* --- Compras: a quien comprarle --- */}
      {EN_COMPRAS.includes(perfil) && evaluacion !== null && (
        <Card>
          <Encabezado
            titulo="A quién conviene comprarle"
            detalle="Proveedores con 2 o más órdenes: quién da más descuento, entrega más rápido y envía gratis. En Reportes puedes fijar tus propios pesos y requisitos."
            accion="Elegir criterios"
            onClick={irReportes}
          />
          <Destacados mejores={evaluacion.mejores} compacto />
          {pendientes !== null && (
            <div className="mt-3 max-w-sm">
              <Clicable onClick={irReportes} label="Ver órdenes pendientes de recibir">
                <KpiCard
                  label="Entregas atrasadas"
                  value={String(pendientes.totalVencidas)}
                  icon="clock"
                  tone={pendientes.totalVencidas > 0 ? "warning" : "success"}
                  hint={`${pendientes.totalOrdenes} órdenes por recibir · ${formatMoney(pendientes.montoTotal)}`}
                />
              </Clicable>
            </div>
          )}
        </Card>
      )}
      {EN_COMPRAS.includes(perfil) && panelDisponibilidad}

      {/* --- Bodega: lo que llega --- */}
      {EN_BODEGA.includes(perfil) && pendientes !== null && (
        <Card>
          <Encabezado
            titulo="Lo que viene en camino"
            detalle="Planifica la recepción: qué está atrasado y qué llega esta semana."
            accion="Filtrar entregas"
            onClick={irReportes}
          />
          <Grid>
            <KpiCard label="Atrasadas" value={String(pendientes.totalVencidas)} icon="clock" tone={pendientes.totalVencidas > 0 ? "danger" : "success"} hint="Llama al proveedor" />
            <KpiCard label="Llegan en 7 días" value={String(pendientes.proximas7Dias)} icon="truck" tone="brand" hint="Prepara espacio y personal" />
            <KpiCard label="Órdenes por recibir" value={String(pendientes.totalOrdenes)} icon="package" tone="navy" />
          </Grid>
          <div className="mt-3">
            <Barras
              ariaLabel="Órdenes más atrasadas"
              vacio="No hay entregas atrasadas."
              filas={pendientes.ordenes
                .filter((o) => o.diasVencida > 0)
                .slice(0, 6)
                .map((o) => ({ id: o.idOrdenCompra, etiqueta: `OC-${o.idOrdenCompra} · ${o.proveedor}`, valor: o.diasVencida, texto: `${o.diasVencida} d` }))}
            />
          </div>
        </Card>
      )}
      {EN_BODEGA.includes(perfil) && panelDisponibilidad}

      {/* --- Finanzas: con quien se concentra el gasto y que area gasta --- */}
      {EN_FINANZAS.includes(perfil) && gasto !== null && (
        <Card>
          <Encabezado
            titulo="Concentración del gasto"
            detalle={`Cuánto del gasto (${formatMoney(gasto.montoTotal)} en ${gasto.ordenesTotal} órdenes) depende de cada proveedor.`}
            accion="Filtrar"
            onClick={irReportes}
          />
          <Barras
            ariaLabel="Participación en el gasto por proveedor"
            vacio="Aún no hay órdenes de compra."
            filas={gasto.proveedores.slice(0, 6).map((p) => ({ id: p.idProveedor, etiqueta: p.proveedor, valor: p.monto, texto: formatPercent(p.porcentaje) }))}
          />
        </Card>
      )}
      {EN_FINANZAS.includes(perfil) && area !== null && (
        <Card>
          <Encabezado titulo="Gasto por área" detalle="Qué departamento compromete más en órdenes de compra." accion="Filtrar" onClick={irReportes} />
          <Barras
            ariaLabel="Gasto comprometido por área"
            vacio="Sin órdenes atribuidas a un área."
            filas={area.areas.slice(0, 6).map((a) => ({ id: a.idDepartamento ?? "sin", etiqueta: a.departamento, valor: a.montoComprometido, texto: formatMoney(a.montoComprometido) }))}
          />
        </Card>
      )}

      {/* --- Auditoria: hallazgos y a quien vigilar --- */}
      {EN_AUDITORIA.includes(perfil) && auditoria !== null && (
        <Card>
          <Encabezado
            titulo="Hallazgos de control interno"
            detalle="Autoaprobaciones, compras sin competencia, sobreprecios y compras a proveedores de riesgo."
            accion="Revisar hallazgos"
            onClick={irReportes}
          />
          <Grid>
            <KpiCard label="Severidad alta" value={String(auditoria.porSeveridad.alta)} icon="shield" tone={auditoria.porSeveridad.alta > 0 ? "danger" : "success"} />
            <KpiCard label="Severidad media" value={String(auditoria.porSeveridad.media)} icon="help" tone="warning" />
            <KpiCard label="Severidad baja" value={String(auditoria.porSeveridad.baja)} icon="dot" tone="navy" />
            <KpiCard label="Sobrecosto / en riesgo" value={formatMoney(auditoria.montoEnRiesgo)} icon="coins" tone="brand" />
          </Grid>
        </Card>
      )}
      {EN_AUDITORIA.includes(perfil) && riesgo !== null && (
        <Card>
          <Encabezado
            titulo="Proveedores a vigilar"
            detalle="Riesgo medio o alto según su confiabilidad (tardanza, rechazo y calificación). Desde Reportes se pueden restringir."
            accion="Ver riesgo"
            onClick={irReportes}
          />
          <Barras
            ariaLabel="Proveedores de riesgo medio o alto"
            vacio="Ningún proveedor está en riesgo medio o alto."
            filas={aVigilar(riesgo).map((p) => ({ id: p.idProveedor, etiqueta: p.proveedor, valor: 100 - p.score, texto: `${p.score} · ${p.nivel === "alto" ? "Alto" : "Medio"}` }))}
          />
        </Card>
      )}

      {/* --- Gerencia de area / jefes --- */}
      {EN_GERENCIA.includes(perfil) && (
        <Card>
          <Encabezado
            titulo="Tu área"
            detalle={area?.acotado === true ? "Solo las solicitudes de tu equipo o tu departamento." : "Solicitudes y gasto de las áreas a tu cargo."}
            accion="Ver gasto por área"
            onClick={irReportes}
          />
          <Grid>
            <Clicable onClick={() => props.onNavigateById("com-doc-solicitudes")} label="Ir a solicitudes por aprobar">
              <KpiCard label="Pendientes de tu aprobación" value={String(porAprobar)} icon="clipboard" tone={porAprobar > 0 ? "warning" : "success"} />
            </Clicable>
            {area !== null && (
              <>
                <KpiCard label="Comprometido en OC" value={formatMoney(area.montoTotal)} icon="coins" tone="brand" />
                <KpiCard
                  label="% rechazadas"
                  value={(() => {
                    const ap = area.areas.reduce((s, a) => s + a.aprobadas, 0);
                    const re = area.areas.reduce((s, a) => s + a.rechazadas, 0);
                    return ap + re > 0 ? formatPercent((re / (ap + re)) * 100) : "—";
                  })()}
                  icon="x"
                  tone="navy"
                  hint="De las solicitudes ya decididas"
                />
              </>
            )}
          </Grid>
          {area !== null && area.articulosTop.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[0.78rem] font-semibold" style={{ color: "var(--color-ink-soft)" }}>
                En qué se gasta
              </p>
              <Barras
                ariaLabel="Artículos de mayor gasto del área"
                vacio=""
                filas={area.articulosTop.slice(0, 5).map((a) => ({ id: a.articulo, etiqueta: a.articulo, valor: a.monto, texto: formatMoney(a.monto) }))}
              />
            </div>
          )}
        </Card>
      )}
      {EN_SOLICITUD.includes(perfil) && panelDisponibilidad}
    </>
  );
}

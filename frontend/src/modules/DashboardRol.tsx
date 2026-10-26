/**
 * Paneles del Dashboard segun el PERFIL de la sesion (ver `core/auth/perfilAnalitico.ts`).
 * Cada area ve SOLO lo que decide con sus reportes — y cada panel usa unicamente el
 * reporte que ese rol tiene permitido (si no, la API responderia 403):
 *
 *  - Compras      -> A quien conviene comprarle (evaluacion) + entregas atrasadas (pendientes).
 *  - Finanzas     -> Concentracion del gasto por proveedor (reporte de gasto).
 *  - Auditoria    -> Proveedores a vigilar (reporte de riesgo).
 *  - Gerencia/jefes -> sus decisiones pendientes (no tienen reportes de proveedores ni gasto).
 *
 * Este componente no calcula negocio, solo presenta lo que devuelven los reportes.
 */

import { useEffect, useState } from "react";
import {
  reporteService,
  type ReporteEvaluacionProveedores,
  type ReporteGastoProveedor,
  type ReporteOcPendientes,
  type ReporteRiesgoProveedores,
} from "../core/CompraServices.js";
import { useAuth } from "../core/auth/AuthContext.js";
import { PRIORIDAD_POR_PERFIL, perfilAnalitico, type PerfilAnalitico } from "../core/auth/perfilAnalitico.js";
import { formatMoney, formatPercent } from "../core/format.js";
import { useNotificaciones } from "../hooks/useNotificaciones.js";
import { Button, Card, KpiCard } from "../ui/primitives.js";
import { Destacados } from "./compras/EvaluacionProveedores.js";

const EN_COMPRAS: readonly PerfilAnalitico[] = ["comprador", "total"];
const EN_FINANZAS: readonly PerfilAnalitico[] = ["financiero", "total"];
const EN_AUDITORIA: readonly PerfilAnalitico[] = ["auditor", "total"];
const EN_GERENCIA: readonly PerfilAnalitico[] = ["gerencia"];


/** Lista de barras horizontales: una serie, hue de marca, valor siempre visible. */
function Barras(props: {
  filas: readonly { id: number; etiqueta: string; valor: number; texto: string }[];
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

/** Proveedores de riesgo medio o alto, del mas riesgoso al menos (el reporte ya viene ordenado por score). */
function aVigilar(r: ReporteRiesgoProveedores): ReporteRiesgoProveedores["proveedores"] {
  return r.proveedores.filter((p) => p.nivel !== "bajo").slice(0, 6);
}

export default function DashboardRol(props: { onNavigateById: (leafId: string) => void }): React.ReactElement | null {
  const { sesion } = useAuth();
  const { bandeja } = useNotificaciones();
  const perfil = perfilAnalitico(sesion?.permisos ?? [], sesion?.roles ?? []);
  const [evaluacion, setEvaluacion] = useState<ReporteEvaluacionProveedores | null>(null);
  const [pendientes, setPendientes] = useState<ReporteOcPendientes | null>(null);
  const [gasto, setGasto] = useState<ReporteGastoProveedor | null>(null);
  const [riesgo, setRiesgo] = useState<ReporteRiesgoProveedores | null>(null);

  // Cada rol pide SOLO su reporte; los permisos de la sesion deciden cual existe.
  useEffect(() => {
    void (async () => {
      const intenta = async <T,>(ok: boolean, f: () => Promise<T>, set: (v: T | null) => void): Promise<void> => {
        if (!ok) return;
        try {
          set(await f());
        } catch {
          set(null);
        }
      };
      await Promise.all([
        intenta(EN_COMPRAS.includes(perfil), () => reporteService.evaluacionProveedores({ minOrdenes: 2, prioridad: PRIORIDAD_POR_PERFIL[perfil] }), setEvaluacion),
        intenta(EN_COMPRAS.includes(perfil), () => reporteService.ocPendientesRecibir(), setPendientes),
        intenta(EN_FINANZAS.includes(perfil), () => reporteService.gastoPorProveedor(), setGasto),
        intenta(EN_AUDITORIA.includes(perfil), () => reporteService.riesgoProveedores(), setRiesgo),
      ]);
    })();
  }, [perfil]);

  const irReportes = (): void => props.onNavigateById("com-an-reportes");
  const entregasAtrasadas =
    pendientes === null ? null : (
      <Clicable onClick={irReportes} label="Ver órdenes pendientes de recibir">
        <KpiCard
          label="Entregas atrasadas"
          value={String(pendientes.totalVencidas)}
          icon="clock"
          tone={pendientes.totalVencidas > 0 ? "warning" : "success"}
          hint={`${pendientes.totalOrdenes} órdenes por recibir · ${formatMoney(pendientes.montoTotal)}`}
        />
      </Clicable>
    );

  const porAprobar = bandeja.items
    .filter((i) => i.tipo === "APROBAR_JEFE" || i.tipo === "APROBAR_GERENTE")
    .reduce((a, i) => a + i.cantidad, 0);

  return (
    <>
      {/* --- Compras: a quien comprarle --- */}
      {EN_COMPRAS.includes(perfil) && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 style={{ color: "var(--color-heading)" }}>A quién conviene comprarle</h3>
              <p className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                Proveedores con 2 o más órdenes: quién da más descuento, entrega más rápido y envía gratis.
              </p>
            </div>
            <Button size="sm" variant="secondary" icon="chart" onClick={irReportes}>
              Filtrar y comparar
            </Button>
          </div>
          {evaluacion === null ? (
            <p className="text-[0.82rem]" style={{ color: "var(--color-ink-faint)" }}>
              Cargando evaluación…
            </p>
          ) : (
            <Destacados mejores={evaluacion.mejores} compacto />
          )}
          {entregasAtrasadas !== null && <div className="mt-3 max-w-sm">{entregasAtrasadas}</div>}
        </Card>
      )}

      {/* --- Finanzas: con quien se concentra el gasto --- */}
      {EN_FINANZAS.includes(perfil) && gasto !== null && (
        <Card>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 style={{ color: "var(--color-heading)" }}>Concentración del gasto</h3>
            <Button size="sm" variant="secondary" icon="chart" onClick={irReportes}>
              Detalle
            </Button>
          </div>
          <p className="mb-3 text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
            Cuánto del gasto ({formatMoney(gasto.montoTotal)} en {gasto.ordenesTotal} órdenes) depende de cada proveedor.
          </p>
          <Barras
            ariaLabel="Participación en el gasto por proveedor"
            vacio="Aún no hay órdenes de compra."
            filas={gasto.proveedores.slice(0, 6).map((p) => ({
              id: p.idProveedor,
              etiqueta: p.proveedor,
              valor: p.monto,
              texto: formatPercent(p.porcentaje),
            }))}
          />
        </Card>
      )}

      {/* --- Auditoria: a quien vigilar --- */}
      {EN_AUDITORIA.includes(perfil) && riesgo !== null && (
        <Card>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 style={{ color: "var(--color-heading)" }}>Proveedores a vigilar</h3>
            <Button size="sm" variant="secondary" icon="chart" onClick={irReportes}>
              Ver reportes
            </Button>
          </div>
          <p className="mb-3 text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
            Riesgo medio o alto según su confiabilidad (tardanza, rechazo y calificación).
          </p>
          <Barras
            ariaLabel="Proveedores de riesgo medio o alto"
            vacio="Ningún proveedor está en riesgo medio o alto."
            filas={aVigilar(riesgo).map((p) => ({
              id: p.idProveedor,
              etiqueta: p.proveedor,
              valor: 100 - p.score,
              texto: `${p.score} · ${p.nivel === "alto" ? "Alto" : "Medio"}`,
            }))}
          />
        </Card>
      )}

      {/* --- Gerencia de area / jefes --- */}
      {EN_GERENCIA.includes(perfil) && (
        <Card>
          <h3 className="mb-3" style={{ color: "var(--color-heading)" }}>
            Tu decisión
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Clicable onClick={() => props.onNavigateById("com-doc-solicitudes")} label="Ir a solicitudes por aprobar">
              <KpiCard label="Pendientes de tu aprobación" value={String(porAprobar)} icon="clipboard" tone={porAprobar > 0 ? "warning" : "success"} />
            </Clicable>
          </div>
        </Card>
      )}
    </>
  );
}

/**
 * Linea de proceso del modulo de Compras (skills/patron-diseno.md §8).
 * Muestra las 8 etapas del ciclo y resalta en cual esta el usuario, para que
 * "se entienda lo que se esta trabajando". Cada etapa navega a su pantalla.
 *
 *   Solicitud -> Aprobacion -> RFQ -> Cotizacion -> Comparativo -> Orden ->
 *   Recepcion -> CxP / Devolucion
 */

import Icon, { type IconName } from "./Icon.js";
import { ALL_LEAVES, leafVisible } from "../nav.js";
import { useAuth } from "../core/auth/AuthContext.js";

export type FlowStep =
  | "solicitud"
  | "aprobacion"
  | "rfq"
  | "cotizacion"
  | "comparativo"
  | "orden"
  | "recepcion"
  | "devolucion";

interface StepDef {
  readonly key: FlowStep;
  readonly label: string;
  readonly icon: IconName;
  /** Id de hoja de navegacion a la que salta al hacer clic. */
  readonly leafId: string;
}

const STEPS: readonly StepDef[] = [
  { key: "solicitud", label: "Solicitud", icon: "clipboard", leafId: "com-doc-solicitudes" },
  { key: "aprobacion", label: "Aprobación", icon: "check", leafId: "com-doc-solicitudes" },
  { key: "rfq", label: "RFQ", icon: "send", leafId: "com-doc-rfq" },
  { key: "cotizacion", label: "Cotización", icon: "coins", leafId: "com-doc-cotizaciones" },
  { key: "comparativo", label: "Comparativo", icon: "award", leafId: "com-an-comparativo" },
  { key: "orden", label: "Orden de compra", icon: "cart", leafId: "com-doc-ordenes" },
  { key: "recepcion", label: "Recepción", icon: "package", leafId: "com-doc-recepciones" },
  { key: "devolucion", label: "CxP / Devolución", icon: "undo", leafId: "com-doc-devoluciones" },
];

export function FlowStepper(props: {
  /** Etapa actual (resaltada). Omitir en pantallas sin etapa concreta. */
  current?: FlowStep;
  /** Navega a la pantalla de una etapa. */
  onStep?: (leafId: string) => void;
}): React.ReactElement {
  const { hasAnyPerm } = useAuth();
  const activeIdx = props.current
    ? STEPS.findIndex((s) => s.key === props.current)
    : -1;

  return (
    <nav
      aria-label="Ciclo de compras"
      className="table-scroll flex items-center gap-0.5 overflow-x-auto"
    >
      {STEPS.map((s, i) => {
        const done = activeIdx >= 0 && i < activeIdx;
        const active = i === activeIdx;
        // Un paso hacia una pantalla que el rol no puede ver queda atenuado y
        // deshabilitado: la linea de proceso se ve completa igual, pero no se
        // puede navegar a algo que el backend va a rechazar con 403.
        const leaf = ALL_LEAVES.find((l) => l.id === s.leafId);
        const reachable = leaf === undefined || leafVisible(leaf, hasAnyPerm);
        const fg = !reachable
          ? "var(--color-ink-faint)"
          : active
            ? "var(--color-brand-ink)"
            : done
              ? "var(--color-success)"
              : "var(--color-ink-faint)";
        const bg = active
          ? "var(--color-brand-050)"
          : done
            ? "var(--color-success-050)"
            : "transparent";
        return (
          <div key={`${s.key}-${i}`} className="flex items-center">
            <button
              type="button"
              onClick={() => props.onStep?.(s.leafId)}
              disabled={!reachable}
              aria-current={active ? "step" : undefined}
              title={reachable ? s.label : `${s.label} — sin acceso para tu rol`}
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[0.72rem] font-medium transition-fluent"
              style={{
                background: bg,
                color: fg,
                opacity: reachable ? 1 : 0.55,
                cursor: reachable ? "pointer" : "not-allowed",
              }}
            >
              <Icon name={done ? "check" : s.icon} size={12} />
              <span className="whitespace-nowrap">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <Icon name="chevron-right" size={11} className="shrink-0 opacity-40" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

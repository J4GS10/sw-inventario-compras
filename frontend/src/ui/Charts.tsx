/**
 * Graficos del dashboard (skills/patron-diseno.md + skill `dataviz`).
 *
 * Todos de UNA sola serie -> un unico hue de marca (`--color-brand`), sin
 * leyenda; la identidad la da el titulo de la tarjeta. Texto siempre con tokens
 * de tinta, nunca con el color de la serie. Marcas finas, extremos redondeados
 * 4px anclados a la linea base, separacion de 2px. Cada grafico expone una
 * vista de tabla (`<details>`) para lectores de pantalla / impresion / daltonismo.
 *
 * Exportaciones nombradas (convencion de `ui/`).
 */

/* ---- TimeBars: serie temporal de columnas (change-over-time) --------- */

export interface TimeBarPoint {
  /** Etiqueta de eje; el primer token se usa como tick, el resto va al title. */
  readonly label: string;
  readonly value: number;
}

export function TimeBars(props: {
  data: readonly TimeBarPoint[];
  /** Formato del valor para labels/tooltip/tabla. */
  format?: (n: number) => string;
  /** Descripcion accesible del grafico completo. */
  ariaLabel: string;
  /** Texto cuando toda la serie es cero. */
  emptyText?: string;
  /** Titulo de la columna de valores en la tabla. */
  valueHeader?: string;
}): React.ReactElement {
  const fmt = props.format ?? ((n) => String(n));
  const max = Math.max(0, ...props.data.map((d) => d.value));
  const totalNoCero = props.data.filter((d) => d.value > 0).length;

  if (max <= 0 || props.data.length === 0) {
    return (
      <p className="text-[0.82rem]" style={{ color: "var(--color-ink-faint)" }}>
        {props.emptyText ?? "Aun no hay datos para este periodo."}
      </p>
    );
  }

  return (
    <figure className="m-0">
      <div
        className="flex items-end gap-[2px]"
        style={{ height: 132 }}
        role="img"
        aria-label={props.ariaLabel}
      >
        {props.data.map((d, i) => {
          const tick = d.label.split(" ")[0] ?? d.label;
          const hRatio = max > 0 ? d.value / max : 0;
          const destacar = i === props.data.length - 1 || (d.value === max && d.value > 0);
          return (
            <div
              key={`${d.label}-${i}`}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              style={{ height: "100%" }}
              title={`${d.label}: ${fmt(d.value)}`}
            >
              <span
                className="text-[0.62rem] leading-none tabular-nums"
                style={{
                  color: "var(--color-ink-soft)",
                  visibility: destacar && d.value > 0 ? "visible" : "hidden",
                }}
              >
                {fmt(d.value)}
              </span>
              <span
                className="block w-full"
                style={{
                  height: `${Math.max(2, hRatio * 100)}%`,
                  minHeight: d.value > 0 ? 3 : 0,
                  background:
                    d.value > 0 ? "var(--color-brand)" : "var(--color-surface-2)",
                  borderRadius: "4px 4px 0 0",
                }}
              />
              <span
                className="w-full truncate text-center text-[0.62rem] leading-none"
                style={{ color: "var(--color-ink-faint)" }}
              >
                {tick}
              </span>
            </div>
          );
        })}
      </div>

      <details className="mt-2">
        <summary
          className="cursor-pointer text-[0.72rem]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          Ver tabla ({totalNoCero} de {props.data.length} meses con datos)
        </summary>
        <div className="mt-1 overflow-x-auto">
          <table className="text-[0.72rem]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  className="px-2 py-1 text-left font-semibold"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  Mes
                </th>
                <th
                  className="px-2 py-1 text-right font-semibold"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  {props.valueHeader ?? "Valor"}
                </th>
              </tr>
            </thead>
            <tbody>
              {props.data.map((d, i) => (
                <tr key={`row-${d.label}-${i}`}>
                  <td className="px-2 py-1" style={{ color: "var(--color-ink)" }}>
                    {d.label}
                  </td>
                  <td
                    className="px-2 py-1 text-right tabular-nums"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {fmt(d.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/* ---- Gauge: indice 0-100 (un solo titular) -------------------------- */

const ARC_R = 80;
const ARC_LEN = Math.PI * ARC_R; // semicirculo

export function Gauge(props: {
  /** Valor 0-100. */
  value: number;
  /** Texto grande bajo el numero (que mide el indice). */
  label: string;
  caption?: string;
  /** Formato del numero central; por defecto "NN %". */
  format?: (n: number) => string;
}): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(props.value) ? props.value : 0));
  const fmt = props.format ?? ((n) => `${Math.round(n)} %`);
  const dash = (clamped / 100) * ARC_LEN;

  return (
    <figure className="m-0 grid place-items-center gap-1">
      <svg
        viewBox="0 0 200 116"
        width="100%"
        style={{ maxWidth: 260 }}
        role="img"
        aria-label={`${props.label}: ${fmt(clamped)}`}
      >
        <path
          d={`M 20 108 A ${ARC_R} ${ARC_R} 0 0 1 180 108`}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path
          d={`M 20 108 A ${ARC_R} ${ARC_R} 0 0 1 180 108`}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${ARC_LEN}`}
        />
        <text
          x="100"
          y="92"
          textAnchor="middle"
          style={{
            fill: "var(--color-heading)",
            fontSize: 34,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt(clamped)}
        </text>
        <text x="20" y="112" textAnchor="middle" style={{ fill: "var(--color-ink-faint)", fontSize: 11 }}>
          0
        </text>
        <text x="180" y="112" textAnchor="middle" style={{ fill: "var(--color-ink-faint)", fontSize: 11 }}>
          100
        </text>
      </svg>
      <figcaption className="text-center">
        <div className="text-[0.8rem] font-semibold" style={{ color: "var(--color-ink)" }}>
          {props.label}
        </div>
        {props.caption !== undefined && (
          <div className="text-[0.72rem]" style={{ color: "var(--color-ink-soft)" }}>
            {props.caption}
          </div>
        )}
      </figcaption>
    </figure>
  );
}

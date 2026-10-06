/**
 * Línea de tiempo de una solicitud: de la petición al pago, con fecha, responsable y comentario.
 * Cada rol ve solo los hitos de los documentos que le competen (lo filtra el servidor).
 */

import { useEffect, useState } from "react";
import { http } from "../core/HttpClient.js";
import { formatFechaHora } from "../core/format.js";
import Icon, { type IconName } from "../ui/Icon.js";

interface Hito {
  readonly tipo: string;
  readonly fecha: string;
  readonly titulo: string;
  readonly quien: string | null;
  readonly detalle: string | null;
  readonly ref: number;
}

const ESTILO: Record<string, { icono: IconName; color: string }> = {
  SOLICITUD: { icono: "clipboard", color: "var(--color-brand)" },
  APROBACION: { icono: "check", color: "var(--color-success)" },
  RFQ: { icono: "send", color: "var(--color-brand)" },
  COTIZACION: { icono: "coins", color: "var(--color-brand)" },
  ORDEN: { icono: "cart", color: "var(--color-brand)" },
  RECEPCION: { icono: "package", color: "var(--color-success)" },
  DEVOLUCION: { icono: "undo", color: "var(--color-warning)" },
  FACTURA: { icono: "wallet", color: "var(--color-brand)" },
  PAGO: { icono: "check", color: "var(--color-success)" },
};

export function Trazabilidad(props: { idSolicitud: number }): React.ReactElement {
  const [hitos, setHitos] = useState<readonly Hito[] | null>(null);

  useEffect(() => {
    let vivo = true;
    http
      .get<readonly Hito[]>(`/api/com/solicitudes/${props.idSolicitud}/trazabilidad`)
      .then((h) => vivo && setHitos(h))
      .catch(() => vivo && setHitos([]));
    return () => {
      vivo = false;
    };
  }, [props.idSolicitud]);

  if (hitos === null) return <p className="text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>Cargando recorrido…</p>;
  // Un solo hito (solo "creada") no cuenta ninguna historia: ya se ve en los datos de arriba.
  if (hitos.length <= 1) return <></>;

  return (
    <section className="mt-4" aria-label="Recorrido de la solicitud">
      <h3 className="mb-2 text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
        Recorrido · de la petición al pago
      </h3>
      <ol className="relative grid gap-3" style={{ paddingLeft: 21 }}>
        <span aria-hidden style={{ position: "absolute", left: 9, top: 6, bottom: 6, width: 2, background: "var(--color-line)" }} />
        {hitos.map((h, i) => {
          const e = ESTILO[h.tipo] ?? ESTILO["SOLICITUD"]!;
          const rechazo = h.titulo.startsWith("Rechazada");
          const color = rechazo ? "var(--color-danger)" : e.color;
          return (
            <li key={`${h.tipo}-${h.ref}-${i}`} className="relative">
              <span
                className="absolute grid place-items-center rounded-full"
                style={{ left: -21, top: 1, width: 20, height: 20, background: "var(--color-surface)", border: `2px solid ${color}`, color }}
              >
                <Icon name={rechazo ? "x" : e.icono} size={11} />
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[0.85rem] font-semibold" style={{ color: "var(--color-ink)" }}>
                  {h.titulo}
                </span>
                <span className="text-[0.72rem]" style={{ color: "var(--color-ink-faint)" }}>
                  {formatFechaHora(h.fecha)}
                </span>
              </div>
              {(h.quien !== null || h.detalle !== null) && (
                <div className="text-[0.78rem]" style={{ color: "var(--color-ink-soft)" }}>
                  {h.quien !== null && <b style={{ fontWeight: 600 }}>{h.quien}</b>}
                  {h.quien !== null && h.detalle !== null ? " · " : ""}
                  {h.detalle}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

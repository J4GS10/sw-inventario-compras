/**
 * Historial de aprobacion de una solicitud: cada fila de `COM_WORKFLOW_APROBACION`
 * (nivel, quien decidio, transicion de estado, comentario, fecha). El backend
 * ya lo registra (SolicitudCompraService.aprobar/rechazar); esto solo lo
 * muestra — reusa el mismo `catalogService`/`CrudService` que los catalogos.
 */

import { useEffect, useState } from "react";
import { catalogService } from "../core/CompraServices.js";
import { useRefs } from "../core/RefContext.js";
import { estadoLabel } from "../core/estados.js";

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

export function HistorialAprobacion(props: { idSolicitud: number }): React.ReactElement {
  const refs = useRefs();
  const [rows, setRows] = useState<readonly Row[] | null>(null);

  useEffect(() => {
    let vivo = true;
    setRows(null);
    const svc = catalogService("/api/com/workflow-aprobacion", "idWorkflowAprobacion");
    void svc
      .list({ pageSize: 50, filters: { idSolicitud: props.idSolicitud }, sort: "fecha", order: "asc" })
      .then((p) => {
        if (vivo) setRows(p.data);
      })
      .catch(() => {
        if (vivo) setRows([]);
      });
    return () => {
      vivo = false;
    };
  }, [props.idSolicitud]);

  return (
    <div className="grid grid-cols-1 gap-2" style={{ borderTop: "1px solid var(--color-line)", paddingTop: 12 }}>
      <h4 className="text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
        Historial de aprobación
      </h4>
      {rows === null ? (
        <p className="text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
          Cargando...
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
          Sin decisiones registradas todavía.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {rows.map((r) => (
            <li
              key={str(r["idWorkflowAprobacion"])}
              className="rounded-lg px-2.5 py-1.5 text-[0.8rem]"
              style={{ background: "var(--color-surface-2)" }}
            >
              <span className="font-medium" style={{ color: "var(--color-ink)" }}>
                Nivel {str(r["nivelJerarquico"])}
              </span>
              {" — "}
              {refs.label("empleado", r["idEmpleadoRealiza"])}
              {": "}
              {r["estadoAnterior"] !== null && r["estadoAnterior"] !== undefined
                ? `${estadoLabel(str(r["estadoAnterior"]))} → `
                : ""}
              {estadoLabel(str(r["estadoNuevo"]))}
              {str(r["comentario"]) !== "" && <> · "{str(r["comentario"])}"</>}
              <span style={{ color: "var(--color-ink-faint)" }}> · {str(r["fecha"]).slice(0, 16).replace("T", " ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

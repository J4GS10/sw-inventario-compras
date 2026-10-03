/**
 * Modal de detalle de un documento del ciclo de compra: datos clave de la
 * cabecera (con etiquetas legibles de las FK), lineas con importes calculados y
 * el panel de adjuntos. Sirve para revisar y validar el documento sin salir de
 * la pantalla del listado.
 */

import { useCallback, useEffect, useState } from "react";
import { Modal } from "../ui/Modal.js";
import { Button, EstadoChip } from "../ui/primitives.js";
import { useToast } from "../ui/Toast.js";
import { messageOf } from "../core/errors.js";
import { DocumentoAppService, type TipoDocAdjunto } from "../core/CompraServices.js";
import { AdjuntosPanel } from "./AdjuntosPanel.js";

type Row = Record<string, unknown>;

export interface CampoDetalle {
  readonly label: string;
  readonly render: (h: Row) => React.ReactNode;
}
export interface ColumnaLinea {
  readonly header: string;
  readonly num?: boolean;
  readonly render: (l: Row) => React.ReactNode;
}

export function DocumentoDetalle(props: {
  open: boolean;
  basePath: string;
  /** Omitir en documentos sin adjuntos (hoy: RFQ) — oculta el panel de adjuntos. */
  tipoAdjunto?: TipoDocAdjunto;
  id: number;
  titulo: string;
  campos: readonly CampoDetalle[];
  columnasLinea: readonly ColumnaLinea[];
  canWrite: boolean;
  onClose: () => void;
  onEditar?: () => void;
  onEliminar?: () => void;
  extraAcciones?: React.ReactNode;
  /** Seccion adicional bajo las lineas (p. ej. historial de aprobacion). */
  extraContent?: React.ReactNode;
}): React.ReactElement {
  const toast = useToast();
  const [data, setData] = useState<{ header: Row; details: Row[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const svc = new DocumentoAppService(props.basePath);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = (await svc.obtener(props.id)) as { header?: Row; details?: Row[] } | Row;
      const header = (("header" in r ? r.header : r) ?? {}) as Row;
      const details = (("details" in r ? r.details : []) ?? []) as Row[];
      setData({ header, details });
    } catch (e: unknown) {
      toast.error(messageOf(e));
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.basePath, props.id]);

  useEffect(() => {
    if (props.open) void cargar();
  }, [props.open, cargar]);

  const h = data?.header ?? {};

  return (
    <Modal
      open={props.open}
      title={props.titulo}
      onClose={props.onClose}
      width={760}
      footer={
        <>
          {props.extraAcciones}
          {props.canWrite && props.onEditar !== undefined && (
            <Button variant="secondary" icon="edit" onClick={props.onEditar}>
              Editar
            </Button>
          )}
          {props.canWrite && props.onEliminar !== undefined && (
            <Button variant="danger" icon="trash" onClick={props.onEliminar}>
              Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={props.onClose}>
            Cerrar
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-[0.85rem]" style={{ color: "var(--color-ink-faint)" }}>
          Cargando...
        </p>
      ) : data === null ? (
        <p className="text-[0.85rem]" style={{ color: "var(--color-danger)" }}>
          No se pudo cargar el documento.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <dl
            className="grid gap-x-4 gap-y-2"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
          >
            {props.campos.map((c) => (
              <div key={c.label}>
                <dt
                  className="text-[0.68rem] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  {c.label}
                </dt>
                <dd className="text-[0.9rem]" style={{ color: "var(--color-ink)" }}>
                  {c.render(h) ?? "—"}
                </dd>
              </div>
            ))}
            {typeof h["estado"] === "string" && (
              <div>
                <dt
                  className="text-[0.68rem] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  Estado
                </dt>
                <dd>
                  <EstadoChip estado={String(h["estado"])} />
                </dd>
              </div>
            )}
          </dl>

          {props.columnasLinea.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table" style={{ tableLayout: "auto" }}>
                <thead>
                  <tr>
                    {props.columnasLinea.map((c) => (
                      <th key={c.header} className={c.num ? "num" : undefined}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.details.length === 0 ? (
                    <tr>
                      <td colSpan={props.columnasLinea.length} style={{ color: "var(--color-ink-faint)" }}>
                        Sin lineas.
                      </td>
                    </tr>
                  ) : (
                    data.details.map((l, i) => (
                      <tr key={i}>
                        {props.columnasLinea.map((c) => (
                          <td key={c.header} className={c.num ? "num" : undefined}>
                            {c.render(l)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {props.extraContent}

          {props.tipoAdjunto !== undefined && (
            <div style={{ borderTop: "1px solid var(--color-line)", paddingTop: 12 }}>
              <AdjuntosPanel tipo={props.tipoAdjunto} id={props.id} canWrite={props.canWrite} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

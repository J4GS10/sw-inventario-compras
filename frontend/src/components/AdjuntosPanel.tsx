/**
 * Panel de adjuntos de un documento del ciclo de compra (PDF de la oferta,
 * remision, OC firmada, etc.). Los binarios viven en MinIO/FileStorage vias el
 * backend; aqui se listan, suben, previsualizan (inline), descargan y eliminan.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adjuntoService,
  type AdjuntoMeta,
  type TipoDocAdjunto,
} from "../core/CompraServices.js";
import { messageOf } from "../core/errors.js";
import { Modal } from "../ui/Modal.js";
import { Button } from "../ui/primitives.js";
import Icon from "../ui/Icon.js";
import { useToast } from "../ui/Toast.js";

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const ACEPTA = ".pdf,application/pdf,image/png,image/jpeg";

interface Preview {
  meta: AdjuntoMeta;
  url: string;
  revoke: () => void;
}

const SUGERENCIA_ADJUNTO: Record<TipoDocAdjunto, string> = {
  solicitudes: "Puedes adjuntar especificaciones, cotizaciones de referencia o autorizaciones.",
  cotizaciones: "Sube el PDF de la cotización del proveedor.",
  "ordenes-compra": "Sube la orden firmada o la confirmación del proveedor.",
  recepciones: "Adjunta la guía de remisión o fotos de la mercadería recibida.",
  devoluciones: "Adjunta fotos o el acta de la mercadería devuelta.",
};

export function AdjuntosPanel(props: {
  tipo: TipoDocAdjunto;
  id: number;
  canWrite: boolean;
}): React.ReactElement {
  const { tipo, id, canWrite } = props;
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AdjuntoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await adjuntoService.listar(tipo, id));
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [tipo, id, toast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Libera el object URL de la vista previa al desmontar / cambiar.
  useEffect(() => {
    return () => preview?.revoke();
  }, [preview]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file === undefined) return;
    setBusy(true);
    try {
      await adjuntoService.subir(tipo, id, file);
      toast.success(`"${file.name}" adjuntado`);
      await cargar();
    } catch (err: unknown) {
      toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function ver(a: AdjuntoMeta): Promise<void> {
    try {
      const { url, revoke } = await adjuntoService.abrir(tipo, id, a);
      setPreview((prev) => {
        prev?.revoke();
        return { meta: a, url, revoke };
      });
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  function cerrarPreview(): void {
    setPreview((prev) => {
      prev?.revoke();
      return null;
    });
  }

  async function descargar(a: AdjuntoMeta): Promise<void> {
    try {
      await adjuntoService.descargar(tipo, id, a);
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  async function eliminar(a: AdjuntoMeta): Promise<void> {
    if (!window.confirm(`Eliminar el adjunto "${a.nombre}"?`)) return;
    setBusy(true);
    try {
      await adjuntoService.eliminar(tipo, id, a.ref);
      toast.success("Adjunto eliminado");
      await cargar();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[0.85rem] font-semibold" style={{ color: "var(--color-heading)" }}>
          Adjuntos {items.length > 0 && <span style={{ color: "var(--color-ink-faint)" }}>({items.length})</span>}
        </h4>
        {canWrite && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACEPTA}
              hidden
              onChange={(e) => void onFile(e)}
            />
            <Button
              size="sm"
              variant="secondary"
              icon="plus"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Subiendo..." : "Subir PDF / imagen"}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
          Cargando...
        </p>
      ) : items.length === 0 ? (
        <p className="text-[0.8rem]" style={{ color: "var(--color-ink-faint)" }}>
          Sin archivos adjuntos. {canWrite ? SUGERENCIA_ADJUNTO[tipo] : ""}
        </p>
      ) : (
        <ul className="grid gap-1">
          {items.map((a) => (
            <li
              key={a.ref}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{ background: "var(--color-surface-2)" }}
            >
              <Icon name={a.mime === "application/pdf" ? "clipboard" : "tag"} size={15} />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-[0.82rem]"
                style={{ color: "var(--color-brand-ink)" }}
                onClick={() => void ver(a)}
                title="Ver"
              >
                {a.nombre}
              </button>
              <span className="text-[0.7rem] tabular-nums" style={{ color: "var(--color-ink-faint)" }}>
                {humanBytes(a.bytes)} · {a.subidoEn.slice(0, 10)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon="search"
                aria-label="Ver adjunto"
                title="Ver"
                onClick={() => void ver(a)}
              />
              <Button
                variant="ghost"
                size="sm"
                icon="arrow-right"
                aria-label="Descargar adjunto"
                title="Descargar"
                onClick={() => void descargar(a)}
              />
              {canWrite && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  aria-label="Eliminar adjunto"
                  onClick={() => void eliminar(a)}
                  style={{ color: "var(--color-danger)" }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {preview !== null && (
        <Modal
          open
          title={preview.meta.nombre}
          onClose={cerrarPreview}
          width={900}
          footer={
            <>
              <Button
                variant="secondary"
                icon="arrow-right"
                onClick={() => void descargar(preview.meta)}
              >
                Descargar
              </Button>
              <Button variant="ghost" onClick={cerrarPreview}>
                Cerrar
              </Button>
            </>
          }
        >
          {preview.meta.mime === "application/pdf" ? (
            <iframe
              src={preview.url}
              title={preview.meta.nombre}
              style={{ width: "100%", height: "70vh", border: 0, background: "var(--color-surface-2)" }}
            />
          ) : (
            <img
              src={preview.url}
              alt={preview.meta.nombre}
              style={{ display: "block", margin: "0 auto", maxWidth: "100%", maxHeight: "70vh" }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

/**
 * Vista previa en pantalla de la Orden de Compra — el documento oficial tal
 * como se veria antes de emitirlo/enviarlo al proveedor (mismos datos
 * resueltos que el PDF, via `GET /:id/vista-previa`). Reutiliza el membrete
 * de empresa (`useEmpresaConfig`) igual que el PDF.
 */

import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal.js";
import { Button } from "../ui/primitives.js";
import { useToast } from "../ui/Toast.js";
import { http } from "../core/HttpClient.js";
import { useEmpresaConfig } from "../core/useEmpresaConfig.js";
import { downloadService } from "../core/DownloadService.js";
import { messageOf } from "../core/errors.js";

interface Linea {
  readonly idOcDetalle: number;
  readonly articuloCodigo: string | null;
  readonly descripcion: string;
  readonly cantidad: number;
  readonly unidadMedida: string;
  readonly precioUnitario: number;
  readonly porcentajeDescuento: number;
  readonly porcentajeImpuesto: number;
  readonly subtotal: number;
}
interface Header {
  readonly idOrdenCompra: number;
  readonly estado: string;
  readonly fechaEmision: string;
  readonly fechaEntregaEsperada: string;
  readonly numeroReferencia: string | null;
  readonly tasaCambio: number;
  readonly proveedor: string;
  readonly proveedorNit: string;
  readonly proveedorDireccion: string | null;
  readonly proveedorTelefono: string | null;
  readonly proveedorEmail: string | null;
  readonly monedaCodigo: string;
  readonly monedaSimbolo: string | null;
  readonly autoriza: string;
}

const num2 = (n: number): string =>
  n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OrdenCompraPreview(props: { open: boolean; id: number; onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const empresa = useEmpresaConfig();
  const [data, setData] = useState<{ header: Header; lineas: readonly Linea[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!props.open) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const body = await http.raw<{ data: { header: Header; lineas: readonly Linea[] } }>(
          `/api/com/ordenes-compra/${props.id}/vista-previa`,
        );
        if (alive) setData(body.data);
      } catch (e: unknown) {
        if (alive) toast.error(messageOf(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.id]);

  const h = data?.header;
  const lineas = data?.lineas ?? [];
  const sim = h?.monedaSimbolo ?? h?.monedaCodigo ?? "";
  const neto = lineas.reduce((a, l) => a + l.subtotal, 0);
  const impuesto = lineas.reduce((a, l) => a + l.subtotal * (l.porcentajeImpuesto / 100), 0);
  const total = neto + impuesto;

  return (
    <Modal
      open={props.open}
      title="Vista previa de Orden de Compra"
      onClose={props.onClose}
      width={860}
      footer={
        <>
          <Button
            variant="secondary"
            icon="download"
            disabled={h === undefined}
            onClick={() => {
              void downloadService.descargarOrdenCompraPdf(props.id).catch((e: unknown) => toast.error(messageOf(e)));
            }}
          >
            Descargar PDF
          </Button>
          <Button variant="ghost" onClick={props.onClose}>
            Cerrar
          </Button>
        </>
      }
    >
      {loading || h === undefined ? (
        <p className="text-[0.85rem]" style={{ color: "var(--color-ink-faint)" }}>
          {loading ? "Cargando..." : "No se pudo cargar la orden de compra."}
        </p>
      ) : (
        <div className="grid gap-4">
          {/* Membrete: empresa emisora + identificacion del documento */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[1.05rem] font-bold" style={{ color: "var(--color-heading)" }}>
                {empresa.nombre}
              </div>
              {empresa.nit !== "" && (
                <div className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                  NIT: {empresa.nit}
                </div>
              )}
              {empresa.direccion !== "" && (
                <div className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                  {empresa.direccion}
                </div>
              )}
              {empresa.telefono !== "" && (
                <div className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                  Tel: {empresa.telefono}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[1.05rem] font-bold" style={{ color: "var(--color-brand-ink)" }}>
                ORDEN DE COMPRA
              </div>
              <div className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                No. Documento: <b style={{ color: "var(--color-ink)" }}>OC-{h.idOrdenCompra}</b>
              </div>
              <div className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                Fecha de emision: <b style={{ color: "var(--color-ink)" }}>{h.fechaEmision.slice(0, 10)}</b>
              </div>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--color-line)" }} />

          <section>
            <h3 className="mb-2 text-[0.78rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              Datos del proveedor
            </h3>
            <div className="grid gap-x-6 gap-y-1 text-[0.85rem]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <b>Proveedor:</b> {h.proveedor}
              </div>
              <div>
                <b>Dirección:</b> {h.proveedorDireccion ?? "-"}
              </div>
              <div>
                <b>NIT:</b> {h.proveedorNit}
              </div>
              <div>
                <b>Contacto:</b> {h.proveedorEmail ?? h.proveedorTelefono ?? "-"}
              </div>
            </div>
          </section>

          <section className="overflow-x-auto">
            <table className="data-table" style={{ tableLayout: "auto", width: "100%" }}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th className="num">Cantidad</th>
                  <th>Unidad</th>
                  <th className="num">Precio unitario</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={l.idOcDetalle}>
                    <td>{i + 1}</td>
                    <td>{l.articuloCodigo ?? "-"}</td>
                    <td>{l.descripcion}</td>
                    <td className="num">{l.cantidad}</td>
                    <td>{l.unidadMedida}</td>
                    <td className="num">{sim} {num2(l.precioUnitario)}</td>
                    <td className="num">{sim} {num2(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div
              className="rounded-xl p-3 text-[0.82rem]"
              style={{ background: "var(--color-surface-2)", minWidth: 240 }}
            >
              <div className="mb-1 text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                Términos y condiciones
              </div>
              <div>Entrega estimada: {h.fechaEntregaEsperada.slice(0, 10)}</div>
              {h.numeroReferencia !== null && <div>Referencia: {h.numeroReferencia}</div>}
              <div>Autoriza: {h.autoriza}</div>
            </div>
            <div className="grid gap-1 text-right text-[0.85rem]" style={{ minWidth: 220 }}>
              <div>
                Subtotal: <b>{sim} {num2(neto)}</b>
              </div>
              <div>
                Impuesto: <b>{sim} {num2(impuesto)}</b>
              </div>
              <div className="text-[1.05rem] font-bold" style={{ color: "var(--color-brand-ink)" }}>
                Total general: {sim} {num2(total)}
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

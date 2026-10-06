/**
 * Comparativo de cotizaciones de una solicitud. Capa de presentacion: consume
 * `ComparativoAppService` (capa 3, Facade sobre lectura + adjudicacion +
 * exportacion PDF). Cotizaciones lado a lado, mejor precio y adjudicada
 * resaltadas, criterios del director, y descarga / compartir en PDF.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { comparativoService, type ComparativoDTO } from "../../core/CompraServices.js";
import { messageOf } from "../../core/errors.js";
import { Button, Card, Chip, EstadoChip, KpiCard, PageHeader, EmptyState } from "../../ui/primitives.js";
import { Field, FormGrid, type FieldValue } from "../../ui/Field.js";
import { CRITERIO_COMPARATIVO } from "../../core/catalogosEstaticos.js";
import { useToast } from "../../ui/Toast.js";
import { formatMoney as money } from "../../core/format.js";
import { DocumentForm } from "../../components/DocumentForm.js";
import { AdjuntosPanel } from "../../components/AdjuntosPanel.js";
import { DOCUMENT_FORMS } from "./documentForms.js";
import { Modal, ConfirmDialog } from "../../ui/Modal.js";
import { http } from "../../core/HttpClient.js";
import { useAuth } from "../../core/auth/AuthContext.js";
import { Permisos } from "../../core/auth/permisos.js";
import { estadoLabel } from "../../core/estados.js";
import type { SelectOption } from "../../ui/Field.js";
import type { HelpContent } from "../../ui/HelpTip.js";

const AYUDA_COMPARATIVO: HelpContent = {
  title: "Comparativo de cotizaciones — cómo funciona",
  body: (
    <>
      <p>
        Muestra, por cada renglón de la Solicitud, todas las cotizaciones
        recibidas <b>lado a lado</b> (precio neto ya convertido a GTQ para
        comparar entre monedas distintas). El "Mejor precio" se resalta
        solo — no queda adjudicado hasta que alguien lo elige.
      </p>
      <p>
        <b>Adjudicar</b> marca esa cotización como ganadora de ese renglón
        (des-adjudica cualquier otra que tuviera) — requiere el permiso de
        adjudicación (Gerente financiero). Los criterios del director son
        notas/puntuaciones de respaldo, no cambian la adjudicación por sí
        solos.
      </p>
      <p>
        Con todos los renglones adjudicados aparece "Generar orden de
        compra". El botón "PDF" de cada cotización abre el adjunto que subió
        el proveedor (si lo hay) — distinto del "Descargar PDF" del reporte
        comparativo completo.
      </p>
    </>
  ),
};

export default function ComparativoView(props: {
  onNavigateById?: (leafId: string) => void;
}): React.ReactElement {
  const toast = useToast();
  const { hasPerm } = useAuth();
  const [ocOpen, setOcOpen] = useState(false);
  const [solicitudes, setSolicitudes] = useState<SelectOption[]>([]);
  const [idSolicitud, setIdSolicitud] = useState<string>(
    () => new URLSearchParams(window.location.search).get("solicitud") ?? "",
  );
  const [comp, setComp] = useState<ComparativoDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  // Cotizacion cuyo PDF de referencia (adjunto del proveedor) se esta viendo.
  const [verPdfDe, setVerPdfDe] = useState<{ idCotizacion: number; proveedor: string } | null>(null);
  const [form, setForm] = useState<Record<string, FieldValue>>({
    idCotizacionDetalle: "",
    criterio: "",
    puntuacion: "",
    notas: "",
  });

  const cargar = useCallback(async (): Promise<void> => {
    const id = Number.parseInt(idSolicitud, 10);
    if (!Number.isInteger(id) || id <= 0) {
      toast.error("Ingrese un id de solicitud válido");
      return;
    }
    setLoading(true);
    try {
      setComp(await comparativoService.getComparativo(id));
    } catch (e: unknown) {
      setComp(null);
      toast.error(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [idSolicitud, toast]);

  useEffect(() => {
    if (idSolicitud !== "") void cargar();
  }, [idSolicitud, cargar]);

  useEffect(() => {
    http
      .list<Record<string, unknown>>("/api/com/solicitudes", { pageSize: 200 })
      .then((r) =>
        setSolicitudes(
          r.data.map((sc) => ({
            value: String(sc["idSolicitud"]),
            label: `SOL-${sc["idSolicitud"]} · ${estadoLabel(String(sc["estado"] ?? ""))}`,
          })),
        ),
      )
      .catch(() => setSolicitudes([]));
  }, []);

  const [toAdjudicar, setToAdjudicar] = useState<{ id: number; proveedor: string; detalle: string } | null>(null);

  // Sugerencia del SERVIDOR por renglon aun sin adjudicar: pondera precio (60 %), confiabilidad historica del
  // proveedor (25 %) y credito (15 %); nunca sugiere una oferta >15 % mas cara que la mas barata.
  interface SugerenciaDTO {
    renglones: {
      idSolicitudDetalle: number;
      descripcion: string;
      motivo: string;
      sugerida: { idCotizacionDetalle: number; proveedor: string; puntaje: number; precioNetoMoneda: number } | null;
    }[];
  }
  const [sugerencia, setSugerencia] = useState<SugerenciaDTO | null>(null);
  useEffect(() => {
    setSugerencia(null);
    if (comp === null || !hasPerm(Permisos.COTIZACION_ADJUDICAR)) return;
    let vivo = true;
    void http
      .get<SugerenciaDTO>(`/api/com/comparativo/solicitud/${comp.idSolicitud}/sugerencia`)
      .then((r) => vivo && setSugerencia(r))
      .catch(() => vivo && setSugerencia(null));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp]);
  const sugeridas = useMemo(
    () => (sugerencia?.renglones ?? []).flatMap((r) => (r.sugerida === null ? [] : [{ linea: r, cz: r.sugerida }])),
    [sugerencia],
  );
  const [confirmaSugeridas, setConfirmaSugeridas] = useState(false);
  async function adjudicarSugeridas(): Promise<void> {
    let hechas = 0;
    try {
      for (const { cz } of sugeridas) {
        await comparativoService.adjudicar(cz.idCotizacionDetalle);
        hechas++;
      }
      toast.success(`${hechas} renglón${hechas === 1 ? "" : "es"} adjudicado${hechas === 1 ? "" : "s"} según la sugerencia — ya puedes generar la Orden de Compra`);
    } catch (e: unknown) {
      toast.error(`Se adjudicaron ${hechas} de ${sugeridas.length}. ${messageOf(e)}`);
    }
    await cargar();
  }

  async function adjudicar(id: number): Promise<void> {
    try {
      await comparativoService.adjudicar(id);
      toast.success(
        "Cotización adjudicada — cuando termines todas las líneas, le toca al Departamento de Compras generar la Orden de Compra",
      );
      await cargar();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  async function descargarPdf(): Promise<void> {
    if (comp === null) return;
    setPdfBusy(true);
    try {
      await comparativoService.descargarPdf(comp.idSolicitud);
      toast.success("PDF generado");
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setPdfBusy(false);
    }
  }

  async function compartirPdf(): Promise<void> {
    if (comp === null) return;
    setPdfBusy(true);
    try {
      const r = await comparativoService.guardarPdf(comp.idSolicitud);
      const abs = r.url.startsWith("http") ? r.url : `${window.location.origin}${r.url}`;
      try {
        await navigator.clipboard.writeText(abs);
        toast.success(`Enlace copiado (${r.storage})`);
      } catch {
        toast.info(`PDF guardado (${r.storage}): ${abs}`);
      }
    } catch (e: unknown) {
      toast.error(messageOf(e));
    } finally {
      setPdfBusy(false);
    }
  }

  async function guardarCriterio(): Promise<void> {
    if (comp === null) return;
    const idDet = Number(form["idCotizacionDetalle"]);
    if (!Number.isInteger(idDet) || String(form["criterio"]).trim() === "") {
      toast.error("Elija una cotización y escriba el criterio");
      return;
    }
    try {
      await comparativoService.registrarCriterio({
        idSolicitud: comp.idSolicitud,
        idCotizacionDetalle: idDet,
        criterio: String(form["criterio"]).trim(),
        puntuacion: form["puntuacion"] === "" ? null : Number(form["puntuacion"]),
        notas: form["notas"] === "" ? null : String(form["notas"]),
      });
      toast.success("Criterio registrado");
      setForm({ idCotizacionDetalle: "", criterio: "", puntuacion: "", notas: "" });
      await cargar();
    } catch (e: unknown) {
      toast.error(messageOf(e));
    }
  }

  const opcionesCotizacion =
    comp?.lineas.flatMap((l) =>
      l.cotizaciones.map((cz) => ({
        value: String(cz.idCotizacionDetalle),
        label: `Línea ${l.idSolicitudDetalle} · ${cz.proveedor} · ${cz.monedaCodigo} ${money(cz.precioNeto)}`,
      })),
    ) ?? [];

  // Asistente: renglones ya adjudicados, para pre-armar la orden de compra.
  const adjudicadas = useMemo(
    () =>
      (comp?.lineas ?? []).flatMap((l) => {
        const cz = l.cotizaciones.find(
          (x) => x.idCotizacionDetalle === l.adjudicadaIdCotizacionDetalle,
        );
        return cz === undefined ? [] : [{ linea: l, cz }];
      }),
    [comp],
  );

  const proveedoresAdjudicados = useMemo(
    () => new Set(adjudicadas.map((a) => a.cz.idProveedor)),
    [adjudicadas],
  );

  const ocInitial = useMemo(() => {
    if (comp === null || adjudicadas.length === 0) return undefined;
    const header: Record<string, string> = { idSolicitud: String(comp.idSolicitud) };
    // Si todo se adjudico a un unico proveedor, tambien lo pre-seleccionamos.
    if (proveedoresAdjudicados.size === 1) {
      header["idProveedor"] = String(adjudicadas[0]!.cz.idProveedor);
    }
    const lines = adjudicadas.map((a) => ({
      idCotizacionDetalle: String(a.cz.idCotizacionDetalle),
      descripcion: a.linea.descripcion,
      cantidad: String(a.cz.cantidad),
    }));
    return { header, lines };
  }, [comp, adjudicadas, proveedoresAdjudicados]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Comparativo de cotizaciones"
        subtitle="Decisión de compra trazada: ofertas lado a lado, criterios del director y exportación a PDF."
        help={AYUDA_COMPARATIVO}
        actions={
          comp !== null ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {sugeridas.length > 0 && hasPerm(Permisos.COTIZACION_ADJUDICAR) && (
                <Button variant="secondary" icon="zap" onClick={() => setConfirmaSugeridas(true)}>
                  Adjudicar lo sugerido ({sugeridas.length})
                </Button>
              )}
              {adjudicadas.length > 0 && hasPerm(Permisos.OC_GESTIONAR) && (
                <Button icon="cart" onClick={() => setOcOpen(true)}>
                  Generar orden de compra
                </Button>
              )}
              <Button
                variant="secondary"
                icon="clipboard"
                size="sm"
                disabled={pdfBusy}
                onClick={() => void compartirPdf()}
                title="Generar y copiar enlace para compartir"
              >
                <span className="hidden sm:inline">Compartir</span>
              </Button>
              <Button variant="secondary" icon="package" disabled={pdfBusy} onClick={() => void descargarPdf()}>
                {pdfBusy ? "..." : "Descargar PDF"}
              </Button>
            </div>
          ) : undefined
        }
      />

      <Card>
        <FormGrid>
          <Field
            def={{
              name: "sol",
              label: "Solicitud",
              kind: "select",
              required: true,
              options: solicitudes,
            }}
            value={idSolicitud}
            onChange={(v) => setIdSolicitud(String(v))}
          />
          <div className="flex items-end">
            <Button icon="search" disabled={loading || idSolicitud === ""} onClick={() => void cargar()}>
              {loading ? "Cargando..." : "Ver comparativo"}
            </Button>
          </div>
        </FormGrid>
      </Card>

      {comp === null ? (
        <Card>
          <EmptyState icon="chart" title="Ingrese una solicitud" hint="Escriba el ID y pulse Ver comparativo." />
        </Card>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <KpiCard label="Solicitud" value={`#${comp.idSolicitud}`} icon="clipboard" tone="navy" />
            <KpiCard label="Cotizaciones" value={String(comp.totalCotizaciones)} icon="cart" tone="brand" />
            <KpiCard label="Proveedores" value={String(comp.proveedoresParticipantes.length)} icon="truck" tone="brand" />
            <div className="card flex items-center gap-2 px-4 py-3">
              <span className="text-[0.7rem] font-semibold uppercase" style={{ color: "var(--color-ink-soft)" }}>
                Estado
              </span>
              <EstadoChip estado={comp.estadoSolicitud} />
            </div>
          </div>

          <p className="text-[0.78rem]" style={{ color: "var(--color-ink-soft)" }}>
            Cada tabla compara las ofertas de <strong>una línea</strong> de la solicitud.
            <span className="mx-1" style={{ color: "var(--color-brand-ink)" }}>■</span>fondo azul = mejor precio ·
            <span className="mx-1" style={{ color: "var(--color-success)" }}>■</span>fondo verde = adjudicada ·
            <strong> P. neto</strong> = precio unitario × (1 − descuento);
            <strong> (GTQ)</strong> lo convierte con la tasa de cambio.
          </p>

          {comp.lineas.map((linea) => {
            const mejor = linea.cotizaciones.find((c) => c.esMejorPrecio);
            const yaAdjudicada = linea.adjudicadaIdCotizacionDetalle !== null;
            return (
            <Card key={linea.idSolicitudDetalle} pad={false}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <span className="font-semibold" style={{ color: "var(--color-heading)" }}>
                  Línea {linea.idSolicitudDetalle}
                </span>{" "}
                — {linea.descripcion}{" "}
                <span className="text-[0.8rem]" style={{ color: "var(--color-ink-soft)" }}>
                  (solicitado: {linea.cantidadSolicitada})
                </span>
                {!yaAdjudicada && mejor !== undefined && (
                  <div className="mt-0.5 text-[0.78rem]" style={{ color: "var(--color-brand-ink)" }}>
                    Sugerencia: {mejor.proveedor} — mejor precio neto {money(mejor.precioNetoMoneda)} (GTQ)
                  </div>
                )}
              </div>
              <div className="overflow-x-auto p-3">
                <table className="data-table" style={{ tableLayout: "auto", minWidth: 920 }}>
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Moneda</th>
                      <th className="num">P. unit.</th>
                      <th className="num">Desc %</th>
                      <th className="num">Imp %</th>
                      <th className="num" title="Precio unitario x (1 - descuento), en la moneda de la oferta">
                        Neto orig.
                      </th>
                      <th className="num" title="P. neto convertido a quetzales con la tasa de cambio">
                        Neto Q
                      </th>
                      <th className="num">Total</th>
                      <th className="num" title="Días de la condición de pago">
                        Pago
                      </th>
                      <th>Marcas</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {linea.cotizaciones.map((cz) => (
                      <tr
                        key={cz.idCotizacionDetalle}
                        style={{
                          background: cz.adjudicado
                            ? "var(--color-success-050)"
                            : cz.esMejorPrecio
                              ? "var(--color-brand-050)"
                              : undefined,
                        }}
                      >
                        <td>
                          <div className="font-medium">{cz.proveedor}</div>
                          <div className="text-[0.68rem]" style={{ color: "var(--color-ink-faint)" }}>
                            {cz.nitProveedor}
                          </div>
                        </td>
                        <td>{cz.monedaCodigo}</td>
                        <td className="num">{money(cz.precioUnitario)}</td>
                        <td className="num">{cz.porcentajeDescuento}</td>
                        <td className="num">{cz.porcentajeImpuesto}</td>
                        <td className="num">{money(cz.precioNeto)}</td>
                        <td className="num">{money(cz.precioNetoMoneda)}</td>
                        <td className="num">{money(cz.totalLinea)}</td>
                        <td className="num">{cz.condicionPagoDias} d</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {cz.esMejorPrecio && <Chip tone="brand" icon="award">mejor precio</Chip>}
                            {cz.adjudicado && <Chip tone="success" icon="check">adjudicada</Chip>}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              icon="clipboard"
                              title="Ver PDF de referencia de esta cotización"
                              onClick={() => setVerPdfDe({ idCotizacion: cz.idCotizacion, proveedor: cz.proveedor })}
                            >
                              PDF
                            </Button>
                            {!cz.adjudicado && hasPerm(Permisos.COTIZACION_ADJUDICAR) && (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon="check"
                                onClick={() =>
                                  setToAdjudicar({
                                    id: cz.idCotizacionDetalle,
                                    proveedor: cz.proveedor,
                                    detalle: linea.descripcion,
                                  })
                                }
                              >
                                Adjudicar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            );
          })}

          <Card>
            <h3 className="mb-3" style={{ color: "var(--color-heading)" }}>
              Criterios de evaluación del director
            </h3>
            {comp.criterios.length === 0 ? (
              <EmptyState icon="award" title="Aún no se registran criterios" />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table" style={{ tableLayout: "auto" }}>
                  <thead>
                    <tr>
                      <th>Criterio</th>
                      <th>Proveedor</th>
                      <th className="num">Puntuación</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.criterios.map((cr) => (
                      <tr key={cr.idComparativo}>
                        <td className="font-medium">{cr.criterio}</td>
                        <td>{cr.proveedor}</td>
                        <td className="num">{cr.puntuacion ?? "—"}</td>
                        <td>{cr.notas ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {hasPerm(Permisos.COTIZACION_ADJUDICAR) && (
              <div className="mt-4 surface-2 rounded-xl p-3">
                <FormGrid>
                  <Field
                    def={{
                      name: "idCotizacionDetalle",
                      label: "Cotización",
                      kind: "select",
                      required: true,
                      options: opcionesCotizacion,
                    }}
                    value={form["idCotizacionDetalle"] ?? ""}
                    onChange={(v) => setForm((p) => ({ ...p, idCotizacionDetalle: v }))}
                  />
                  <Field
                    def={{
                      name: "criterio",
                      label: "Criterio",
                      kind: "select",
                      required: true,
                      options: CRITERIO_COMPARATIVO,
                    }}
                    value={form["criterio"] ?? ""}
                    onChange={(v) => setForm((p) => ({ ...p, criterio: v }))}
                  />
                  <Field
                    def={{ name: "puntuacion", label: "Puntuación", kind: "percent" }}
                    value={form["puntuacion"] ?? ""}
                    onChange={(v) => setForm((p) => ({ ...p, puntuacion: v }))}
                  />
                  <Field
                    def={{ name: "notas", label: "Notas", kind: "textarea" }}
                    value={form["notas"] ?? ""}
                    onChange={(v) => setForm((p) => ({ ...p, notas: v }))}
                  />
                </FormGrid>
                <div className="mt-2">
                  <Button icon="plus" onClick={() => void guardarCriterio()}>
                    Registrar criterio
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {verPdfDe !== null && (
        <Modal
          open
          title={`Adjuntos de la cotización — ${verPdfDe.proveedor}`}
          onClose={() => setVerPdfDe(null)}
          width={720}
        >
          <AdjuntosPanel
            tipo="cotizaciones"
            id={verPdfDe.idCotizacion}
            canWrite={hasPerm(Permisos.COTIZACION_GESTIONAR)}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={confirmaSugeridas}
        title="Adjudicar lo sugerido"
        confirmLabel="Adjudicar todo"
        message={`Se adjudicará cada renglón pendiente a la oferta con mejor puntaje (precio, confiabilidad del proveedor y crédito): ${sugeridas
          .map(({ linea, cz }) => `${linea.descripcion} → ${cz.proveedor} (${cz.puntaje} pts; ${linea.motivo.toLowerCase()})`)
          .join("; ")}. Puedes cambiar cualquier renglón después. Queda registrado.`}
        onConfirm={() => {
          setConfirmaSugeridas(false);
          void adjudicarSugeridas();
        }}
        onCancel={() => setConfirmaSugeridas(false)}
      />

      <ConfirmDialog
        open={toAdjudicar !== null}
        title="Adjudicar cotización"
        confirmLabel="Adjudicar"
        message={
          toAdjudicar !== null
            ? `Vas a adjudicar "${toAdjudicar.detalle}" a ${toAdjudicar.proveedor}. Si otra cotización de este renglón ya estaba adjudicada, se reemplaza. Esta decisión queda registrada y es la base para generar la Orden de Compra.`
            : ""
        }
        onConfirm={() => {
          const t = toAdjudicar;
          setToAdjudicar(null);
          if (t !== null) void adjudicar(t.id);
        }}
        onCancel={() => setToAdjudicar(null)}
      />

      {comp !== null && DOCUMENT_FORMS["ordenesCompra"] !== undefined && (
        <DocumentForm
          open={ocOpen}
          config={DOCUMENT_FORMS["ordenesCompra"]}
          initial={ocInitial}
          onClose={() => setOcOpen(false)}
          onSuccess={() => {
            toast.success("Orden de compra creada desde el comparativo");
            setOcOpen(false);
            props.onNavigateById?.("com-doc-ordenes");
          }}
        />
      )}
    </div>
  );
}

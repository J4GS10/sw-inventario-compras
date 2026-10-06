/**
 * Capa 3 - Logica de Negocio / compras.
 * PDF de una Solicitud de compra: datos clave, renglones (solicitado vs. autorizado) y las decisiones de
 * aprobacion. Mismo diseno que los demas PDF (`PdfBuilder` + `CompraReadRepository`).
 */

import { NotFoundError } from "../../../common/errors/AppError.js";
import { env } from "../../../common/config/EnvConfig.js";
import { PdfBuilder } from "../../../common/pdf/PdfBuilder.js";
import { estadoLabel } from "../../../common/estadoLabels.js";
import { CompraReadRepository, type HitoTrazabilidad } from "../../../dal/repositories/com/CompraReadRepository.js";

const PRIORIDAD: Record<number, string> = { 1: "Muy baja", 2: "Baja", 3: "Media", 4: "Alta", 5: "Urgente" };
const dinero = (n: number): string => `Q ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export class SolicitudPdfService {
  constructor(private readonly read = new CompraReadRepository()) {}

  /** `decisiones`: hitos de aprobacion que el usuario puede ver (ya filtrados por el servicio de solicitudes). */
  public async generar(idSolicitud: number, decisiones: readonly HitoTrazabilidad[]): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.read.solicitudParaPdf(idSolicitud);
    if (data === null) throw new NotFoundError("COM_SOLICITUD_COMPRA", idSolicitud);
    const { header: h, lineas } = data;
    const empresa = env().empresa;
    const pdf = new PdfBuilder({
      title: `Solicitud de compra SOL-${h.idSolicitud}`,
      footer: `${empresa.nombre} · Solicitud de compra`,
      brand: empresa.nombre,
    });

    pdf.title(`Solicitud de compra — SOL-${h.idSolicitud}`, `Solicitante ${h.solicitante}   ·   Creada ${h.fechaCreacion.slice(0, 10)}`);
    pdf.kpiBand([
      { label: "Estado", value: estadoLabel(h.estado), tone: "brand" },
      { label: "Prioridad", value: PRIORIDAD[h.prioridad] ?? String(h.prioridad) },
      { label: "Monto estimado", value: h.montoEstimado !== null && h.montoEstimado > 0 ? dinero(h.montoEstimado) : "Sin monto" },
    ]);

    pdf.sectionTitle("Datos de la solicitud");
    pdf.keyValues([
      ["Solicitante", h.solicitante],
      ["Sucursal", h.sucursal],
      ["Grupo de compra", h.grupoCompra],
      ["Justificación", h.justificacion],
    ]);

    pdf.sectionTitle("Renglones");
    pdf.table(
      [
        { header: "Artículo", width: 200 },
        { header: "U.M.", width: 50 },
        { header: "Solicitado", width: 70, align: "right" },
        { header: "Autorizado", width: 70, align: "right" },
        { header: "Requerido", width: 70 },
      ],
      lineas.map((l) => [
        l.articulo !== "—" ? l.articulo : l.descripcion,
        l.unidadMedida,
        String(l.cantidadSolicitada),
        l.cantidadAutorizada === null ? "—" : String(l.cantidadAutorizada),
        l.fechaRequerida.slice(0, 10),
      ]),
    );

    const aprobaciones = decisiones.filter((d) => d.tipo === "APROBACION");
    pdf.sectionTitle("Decisiones de aprobación");
    if (aprobaciones.length === 0) pdf.note("Aún no hay decisiones registradas.");
    else {
      pdf.table(
        [
          { header: "Fecha", width: 90 },
          { header: "Decisión", width: 150 },
          { header: "Quién", width: 130 },
          { header: "Comentario", width: 110 },
        ],
        aprobaciones.map((a) => [a.fecha.slice(0, 16).replace("T", " "), a.titulo, a.quien ?? "—", a.detalle ?? ""]),
      );
    }
    return { buffer: await pdf.build(), filename: `solicitud-${idSolicitud}.pdf` };
  }
}

/**
 * Capa 3 - Logica de Negocio / compras.
 * Genera el PDF del comparativo de cotizaciones de una solicitud y, si hay
 * almacenamiento configurado (S3), lo sube y devuelve una URL para compartir.
 *
 * Composicion: usa ComparativoService (datos) + PdfBuilder (formato, patron
 * Builder) + FileStorage (patron Strategy). No hereda de ninguno.
 */

import { PdfBuilder } from "../../../common/pdf/PdfBuilder.js";
import { fileStorage, type StoredFile } from "../../../common/storage/FileStorage.js";
import {
  ComparativoService,
  type ComparativoSolicitud,
} from "./ComparativoService.js";

function money(n: number): string {
  return n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export class ComparativoPdfService {
  constructor(private readonly comparativo = new ComparativoService()) {}

  public async generar(idSolicitud: number): Promise<{
    buffer: Buffer;
    filename: string;
  }> {
    const data = await this.comparativo.comparativoSolicitud(idSolicitud);
    const buffer = await this.render(data);
    return {
      buffer,
      filename: `comparativo-solicitud-${idSolicitud}.pdf`,
    };
  }

  /** Genera y almacena (S3 si esta configurado; si no, en memoria). */
  public async generarYAlmacenar(idSolicitud: number): Promise<{
    stored: StoredFile;
    filename: string;
  }> {
    const { buffer, filename } = await this.generar(idSolicitud);
    const key = `comparativos/solicitud-${idSolicitud}/${Date.now()}-${filename}`;
    const stored = await fileStorage().save(key, buffer, "application/pdf");
    return { stored, filename };
  }

  // ------------------------------------------------------------------------

  private async render(d: ComparativoSolicitud): Promise<Buffer> {
    const pdf = new PdfBuilder({
      title: `Comparativo solicitud ${d.idSolicitud}`,
      footer: "ERP Corporativo · Comparativo de cotizaciones",
    });

    pdf.title(
      `Comparativo de cotizaciones — Solicitud #${d.idSolicitud}`,
      `Estado ${d.estadoSolicitud}   ·   ${d.totalCotizaciones} cotizaciones   ·   ${d.proveedoresParticipantes.length} proveedores`,
    );

    pdf.keyValues([
      ["Proveedores", d.proveedoresParticipantes.map((p) => p.proveedor).join(", ") || "-"],
      ["Lineas comparadas", String(d.lineas.length)],
      ["Emitido", new Date().toLocaleString("es-GT")],
    ]);

    for (const linea of d.lineas) {
      pdf.sectionTitle(
        `Linea ${linea.idSolicitudDetalle}  —  ${linea.descripcion}  (cantidad: ${linea.cantidadSolicitada})`,
      );
      pdf.table(
        [
          { header: "Proveedor", width: 120 },
          { header: "Mon", width: 30 },
          { header: "P.unit", width: 48, align: "right" },
          { header: "Desc", width: 34, align: "right" },
          { header: "Imp", width: 30, align: "right" },
          { header: "Neto", width: 48, align: "right" },
          { header: "Neto Q", width: 52, align: "right" },
          { header: "Total", width: 55, align: "right" },
          { header: "Estado", width: 62 },
        ],
        linea.cotizaciones.map((c) => [
          c.proveedor,
          c.monedaCodigo,
          money(c.precioUnitario),
          String(c.porcentajeDescuento),
          String(c.porcentajeImpuesto),
          money(c.precioNeto),
          money(c.precioNetoMoneda),
          money(c.totalLinea),
          c.adjudicado ? "ADJUDICADA" : c.esMejorPrecio ? "Mejor precio" : "",
        ]),
      );
      const adj = linea.cotizaciones.find((c) => c.adjudicado);
      if (adj !== undefined) {
        pdf.note(
          `Adjudicada a ${adj.proveedor}  —  ${adj.monedaCodigo} ${money(adj.precioNetoMoneda)} neto por unidad.`,
          "ok",
        );
      } else {
        const best = linea.cotizaciones.find((c) => c.esMejorPrecio);
        if (best !== undefined) {
          pdf.note(
            `Sin adjudicar. Mejor oferta: ${best.proveedor} (${best.monedaCodigo} ${money(best.precioNetoMoneda)} neto).`,
          );
        }
      }
    }

    pdf.sectionTitle("Criterios de evaluacion del director");
    if (d.criterios.length === 0) {
      pdf.note("Sin criterios registrados para esta solicitud.");
    } else {
      pdf.table(
        [
          { header: "Criterio", width: 120 },
          { header: "Proveedor", width: 150 },
          { header: "Puntuacion", width: 55, align: "right" },
          { header: "Notas", width: 174 },
        ],
        d.criterios.map((c) => [
          c.criterio,
          c.proveedor,
          c.puntuacion === null ? "-" : String(c.puntuacion),
          c.notas ?? "",
        ]),
      );
    }

    return pdf.build();
  }
}

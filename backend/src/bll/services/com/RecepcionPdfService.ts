/**
 * Capa 3 - Logica de Negocio / compras.
 * Genera la Nota de Ingreso oficial de una Recepcion — el documento que deja
 * constancia de la mercaderia fisicamente recibida (paso 8 del flujo de
 * negocio, despues del conteo ciego en bodega).
 *
 * Mismo diseno que `OrdenCompraPdfService`/`ComparativoPdfService`:
 * `CompraReadRepository` (datos resueltos) + `PdfBuilder` (Builder).
 */

import { NotFoundError } from "../../../common/errors/AppError.js";
import { env } from "../../../common/config/EnvConfig.js";
import { PdfBuilder } from "../../../common/pdf/PdfBuilder.js";
import {
  CompraReadRepository,
  type RecepcionPdfHeaderRow,
  type RecepcionPdfLineaRow,
} from "../../../dal/repositories/com/CompraReadRepository.js";

export class RecepcionPdfService {
  constructor(private readonly read = new CompraReadRepository()) {}

  public async generar(idRecepcion: number): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.read.recepcionParaPdf(idRecepcion);
    if (data === null) throw new NotFoundError("COM_RECEPCION", idRecepcion);
    const buffer = await this.render(data.header, data.lineas);
    return { buffer, filename: `nota-ingreso-${idRecepcion}.pdf` };
  }

  private async render(
    h: RecepcionPdfHeaderRow,
    lineas: readonly RecepcionPdfLineaRow[],
  ): Promise<Buffer> {
    const empresa = env().empresa;
    const pdf = new PdfBuilder({
      title: `Nota de ingreso REC-${h.idRecepcion}`,
      footer: `${empresa.nombre} · Nota de ingreso`,
      brand: empresa.nombre,
    });

    const totalRecibido = lineas.reduce((acc, l) => acc + l.cantidadRecibida, 0);
    const totalRechazado = lineas.reduce((acc, l) => acc + l.cantidadRechazada, 0);

    pdf.title(
      `Nota de ingreso — REC-${h.idRecepcion}`,
      `Orden OC-${h.idOrdenCompra}   ·   Proveedor ${h.proveedor}   ·   Recibida ${h.fechaRecepcion.slice(0, 10)}`,
    );

    pdf.sectionTitle("Empresa");
    pdf.keyValues([
      ["Razon social", empresa.nombre],
      ["NIT", empresa.nit],
    ]);

    pdf.kpiBand([
      { label: "Unidades recibidas", value: String(totalRecibido) },
      { label: "Unidades rechazadas", value: String(totalRechazado), tone: totalRechazado > 0 ? "warning" : undefined },
      { label: "Estado", value: h.estado, tone: "brand" },
    ]);

    pdf.sectionTitle("Datos de la recepcion");
    pdf.keyValues([
      ["Orden de compra", `OC-${h.idOrdenCompra}`],
      ["Proveedor", `${h.proveedor} (NIT ${h.proveedorNit})`],
      ["Bodega", h.bodega],
      ["Recibe", h.recibe],
      ["Fecha", h.fechaRecepcion.slice(0, 10)],
    ]);

    pdf.sectionTitle("Conteo fisico por renglon");
    pdf.table(
      [
        { header: "Descripcion", width: 230 },
        { header: "U.M.", width: 60 },
        { header: "Recibido", width: 90, align: "right" },
        { header: "Rechazado", width: 90, align: "right" },
      ],
      lineas.map((l) => [
        l.descripcion,
        l.unidadMedida,
        String(l.cantidadRecibida),
        String(l.cantidadRechazada),
      ]),
    );

    pdf.note("Conteo registrado a ciegas en bodega (sin cantidad esperada ni costo a la vista); se reconcilia contra la orden de compra en Cuentas por Pagar.", "ok");

    return pdf.build();
  }
}

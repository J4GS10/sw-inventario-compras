/**
 * Capa 3 - Logica de Negocio / compras.
 * Genera el PDF de la Orden de Compra — el documento que se entrega/envia al
 * proveedor (paso 6 del flujo de negocio). Si hay almacenamiento configurado
 * (S3), lo sube y devuelve una URL para compartir.
 *
 * Composicion: `CompraReadRepository` (datos resueltos) + `PdfBuilder`
 * (formato, patron Builder) + `FileStorage` (patron Strategy). Mismo diseno
 * que `ComparativoPdfService`.
 */

import { NotFoundError } from "../../../common/errors/AppError.js";
import { env } from "../../../common/config/EnvConfig.js";
import { PdfBuilder } from "../../../common/pdf/PdfBuilder.js";
import { fileStorage, type StoredFile } from "../../../common/storage/FileStorage.js";
import {
  CompraReadRepository,
  type OrdenCompraPdfHeaderRow,
  type OrdenCompraPdfLineaRow,
} from "../../../dal/repositories/com/CompraReadRepository.js";

function money(n: number): string {
  return n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export class OrdenCompraPdfService {
  constructor(private readonly read = new CompraReadRepository()) {}

  public async generar(idOrdenCompra: number): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.read.ordenCompraParaPdf(idOrdenCompra);
    if (data === null) throw new NotFoundError("COM_ORDEN_COMPRA", idOrdenCompra);
    const buffer = await this.render(data.header, data.lineas);
    return { buffer, filename: `orden-compra-${idOrdenCompra}.pdf` };
  }

  /** Mismos datos resueltos que el PDF, en JSON — para la vista previa en pantalla. */
  public async datosParaVistaPrevia(idOrdenCompra: number): Promise<{
    header: OrdenCompraPdfHeaderRow;
    lineas: readonly OrdenCompraPdfLineaRow[];
  }> {
    const data = await this.read.ordenCompraParaPdf(idOrdenCompra);
    if (data === null) throw new NotFoundError("COM_ORDEN_COMPRA", idOrdenCompra);
    return data;
  }

  /** Genera y almacena (S3 si esta configurado; si no, en memoria). */
  public async generarYAlmacenar(idOrdenCompra: number): Promise<{
    stored: StoredFile;
    filename: string;
  }> {
    const { buffer, filename } = await this.generar(idOrdenCompra);
    const key = `ordenes-compra/orden-${idOrdenCompra}/${Date.now()}-${filename}`;
    const stored = await fileStorage().save(key, buffer, "application/pdf");
    return { stored, filename };
  }

  // ------------------------------------------------------------------------

  private async render(
    h: OrdenCompraPdfHeaderRow,
    lineas: readonly OrdenCompraPdfLineaRow[],
  ): Promise<Buffer> {
    const empresa = env().empresa;
    const pdf = new PdfBuilder({
      title: `Orden de compra OC-${h.idOrdenCompra}`,
      footer: `${empresa.nombre} · Orden de compra`,
      brand: empresa.nombre,
    });

    const sim = h.monedaSimbolo ?? h.monedaCodigo;
    let montoNeto = 0;
    let montoImpuesto = 0;
    for (const l of lineas) {
      montoNeto += l.subtotal;
      montoImpuesto += l.subtotal * (l.porcentajeImpuesto / 100);
    }
    const montoTotal = montoNeto + montoImpuesto;

    pdf.title(
      `Orden de compra — OC-${h.idOrdenCompra}`,
      `Estado ${h.estado}   ·   Proveedor ${h.proveedor}   ·   Emitida ${h.fechaEmision.slice(0, 10)}`,
    );

    // Las dos partes del documento, lado a lado — como en una orden de
    // compra o factura real, no apiladas una tras otra.
    pdf.twoColumn(
      {
        title: "Empresa emisora",
        pairs: [
          ["Razon social", empresa.nombre],
          ["NIT", empresa.nit],
          ["Direccion", empresa.direccion],
          ["Telefono", empresa.telefono],
        ],
      },
      {
        title: "Datos del proveedor",
        pairs: [
          ["Razon social", h.proveedor],
          ["NIT", h.proveedorNit],
          ["Direccion", h.proveedorDireccion ?? "-"],
          ["Telefono", h.proveedorTelefono ?? "-"],
          ["Correo", h.proveedorEmail ?? "-"],
        ],
      },
    );

    pdf.sectionTitle("Datos de la orden");
    pdf.keyValues([
      ["Fecha de emision", h.fechaEmision.slice(0, 10)],
      ["Entrega esperada", h.fechaEntregaEsperada.slice(0, 10)],
      ["Moneda", `${h.monedaCodigo} (tasa ${h.tasaCambio.toFixed(5)})`],
      ["Referencia", h.numeroReferencia ?? "-"],
    ]);

    pdf.sectionTitle("Detalle de articulos");
    pdf.table(
      [
        { header: "Codigo", width: 55 },
        { header: "Descripcion", width: 150 },
        { header: "Cant.", width: 40, align: "right" },
        { header: "U.M.", width: 40 },
        { header: "P. unit.", width: 55, align: "right" },
        { header: "Desc%", width: 42, align: "right" },
        { header: "Imp%", width: 40, align: "right" },
        { header: "Subtotal", width: 77, align: "right" },
      ],
      lineas.map((l) => [
        l.articuloCodigo ?? "-",
        l.descripcion,
        String(l.cantidad),
        l.unidadMedida,
        money(l.precioUnitario),
        String(l.porcentajeDescuento),
        String(l.porcentajeImpuesto),
        `${sim} ${money(l.subtotal)}`,
      ]),
    );

    // Los totales van DESPUES del detalle (convencion de factura/orden de
    // compra: se leen de arriba hacia abajo y se suman al final), no antes.
    pdf.kpiBand([
      { label: `Monto neto (${h.monedaCodigo})`, value: `${sim} ${money(montoNeto)}` },
      { label: "Impuesto", value: `${sim} ${money(montoImpuesto)}` },
      { label: "Total a pagar", value: `${sim} ${money(montoTotal)}`, tone: "brand" },
    ]);

    if (h.monedaCodigo !== "GTQ") {
      pdf.note(`Referencial en GTQ: Q ${money(montoTotal * h.tasaCambio)} (tasa ${h.tasaCambio.toFixed(5)}).`);
    }
    pdf.note("Documento generado por el sistema para entrega al proveedor.", "ok");

    pdf.signatureBlock([{ label: "Autoriza la orden", name: h.autoriza }]);

    return pdf.build();
  }
}

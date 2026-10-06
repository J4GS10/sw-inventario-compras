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
import { aDia } from "../../../common/util/fechas.js";
import { importeALetras } from "../../../common/util/numeroALetras.js";
import { fileStorage, type StoredFile } from "../../../common/storage/FileStorage.js";
import {
  CompraReadRepository,
  type OrdenCompraPdfHeaderRow,
  type OrdenCompraPdfLineaRow,
} from "../../../dal/repositories/com/CompraReadRepository.js";

function money(n: number): string {
  return n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Cantidad sin ceros de relleno (12 -> "12", 2.5 -> "2.5"). */
function qty(n: number): string {
  return n.toLocaleString("es-GT", { maximumFractionDigits: 4 });
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "05 oct 2026" a partir de un ISO (dia de calendario, sin correr de dia por zona horaria). */
function fechaLarga(iso: string): string {
  const d = aDia(iso);
  if (d === null) return "—";
  return `${d.slice(8, 10)} ${MESES[Number(d.slice(5, 7)) - 1] ?? ""} ${d.slice(0, 4)}`;
}

function estadoVisual(estado: string): { texto: string; tono: "ok" | "warn" | "bad" | "neutral" } {
  const texto = estado.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  if (estado === "RECIBIDA_COMPLETA") return { texto, tono: "ok" };
  if (estado === "CANCELADA" || estado === "RECHAZADA") return { texto, tono: "bad" };
  if (estado === "EMITIDA" || estado === "RECIBIDA_PARCIAL") return { texto, tono: "warn" };
  return { texto, tono: "neutral" };
}

function nombreMoneda(codigo: string): [string, string] {
  switch (codigo) {
    case "GTQ":
      return ["QUETZALES", "QUETZAL"];
    case "USD":
      return ["DOLARES", "DOLAR"];
    case "EUR":
      return ["EUROS", "EURO"];
    default:
      return [codigo, codigo];
  }
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
    const numero = `OC-${String(h.idOrdenCompra).padStart(6, "0")}`;
    const pdf = new PdfBuilder({
      title: `Orden de compra ${numero}`,
      footer: `${empresa.nombre} · Orden de compra ${numero}`,
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

    pdf.letterhead({
      empresa: {
        nombre: empresa.nombre,
        lineas: [`NIT ${empresa.nit}`, empresa.direccion, `Tel. ${empresa.telefono}`],
      },
      documento: "ORDEN DE COMPRA",
      numero,
      meta: [
        ["Fecha de emisión", fechaLarga(h.fechaEmision)],
        ["Entrega esperada", fechaLarga(h.fechaEntregaEsperada)],
        ["Referencia", h.numeroReferencia ?? "—"],
      ],
      estado: estadoVisual(h.estado),
    });

    // Las dos partes, lado a lado: a quien se le compra y bajo que condiciones.
    pdf.twoColumn(
      {
        title: "Proveedor",
        pairs: [
          ["Razón social", h.proveedor],
          ["NIT", h.proveedorNit],
          ["Dirección", h.proveedorDireccion ?? "—"],
          ["Teléfono", h.proveedorTelefono ?? "—"],
          ["Correo", h.proveedorEmail ?? "—"],
        ],
      },
      {
        title: "Condiciones",
        pairs: [
          ["Moneda", `${h.monedaCodigo}${h.monedaSimbolo !== null ? ` (${h.monedaSimbolo})` : ""}`],
          ["Tasa de cambio", h.tasaCambio.toFixed(5)],
          ["Entrega esperada", fechaLarga(h.fechaEntregaEsperada)],
          ["Autoriza", h.autoriza],
        ],
      },
    );

    pdf.sectionTitle("Detalle de artículos");
    pdf.table(
      [
        { header: "#", width: 22, align: "center" },
        { header: "Código", width: 58 },
        { header: "Descripción", width: 139 },
        { header: "Cant.", width: 40, align: "right" },
        { header: "U.M.", width: 38 },
        { header: "P. unit.", width: 58, align: "right" },
        { header: "Desc.", width: 36, align: "right" },
        { header: "IVA", width: 32, align: "right" },
        { header: "Subtotal", width: 76, align: "right" },
      ],
      lineas.map((l, i) => [
        String(i + 1),
        l.articuloCodigo ?? "—",
        l.descripcion,
        qty(l.cantidad),
        l.unidadMedida,
        money(l.precioUnitario),
        l.porcentajeDescuento > 0 ? `${qty(l.porcentajeDescuento)}%` : "—",
        l.porcentajeImpuesto > 0 ? `${qty(l.porcentajeImpuesto)}%` : "—",
        money(l.subtotal),
      ]),
    );

    // Totales al final (se leen de arriba hacia abajo y se suman al cierre).
    const [plural, singular] = nombreMoneda(h.monedaCodigo);
    pdf.totalsBox(
      [
        { label: `Subtotal (${h.monedaCodigo})`, value: `${sim} ${money(montoNeto)}` },
        { label: "Impuesto (IVA)", value: `${sim} ${money(montoImpuesto)}` },
      ],
      { label: "Total a pagar", value: `${sim} ${money(montoTotal)}` },
      importeALetras(montoTotal, plural, singular),
    );

    if (h.monedaCodigo !== "GTQ") {
      pdf.note(`Referencial en quetzales: Q ${money(montoTotal * h.tasaCambio)} (tasa ${h.tasaCambio.toFixed(5)}).`);
    }

    pdf.callout("Condiciones de la orden", [
      `Esta orden debe acompañarse del número ${numero} en la factura y en la guía de entrega.`,
      "La mercadería se recibe contra esta orden; cantidades distintas a las aquí indicadas requieren autorización escrita.",
      "Precios y condiciones sujetos a la cotización adjudicada. Cualquier cambio debe notificarse antes de despachar.",
    ]);

    pdf.signatureBlock([
      { label: "Autoriza la orden", name: h.autoriza },
      { label: "Aceptada por el proveedor", name: " " },
    ]);

    return pdf.build();
  }
}

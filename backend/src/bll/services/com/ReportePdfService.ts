/**
 * Capa 3 - Logica de Negocio / compras.
 * Genera los PDF de reporteria del modulo: gasto por proveedor, ordenes de
 * compra pendientes de recibir y desempeno de proveedores.
 *
 * Composicion: usa `ReporteService` (datos) + `PdfBuilder` (formato, patron
 * Builder). Mismo estilo visual que `ComparativoPdfService` — banda de titulo,
 * KPIs de apertura y tablas con zebra — mas un grafico de barras para el
 * primer vistazo de cada reporte.
 */

import { PdfBuilder } from "../../../common/pdf/PdfBuilder.js";
import { ReporteService } from "./ReporteService.js";

function money(n: number): string {
  return `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function moneyCompact(n: number): string {
  return `Q ${n.toLocaleString("es-GT", { notation: "compact", maximumFractionDigits: 1 })}`;
}
function pct(n: number): string {
  return `${n.toLocaleString("es-GT", { maximumFractionDigits: 1 })} %`;
}
function rango(desde: string | null, hasta: string | null): string {
  if (desde === null && hasta === null) return "Todo el historico";
  return `Del ${desde ?? "inicio"} al ${hasta ?? "hoy"}`;
}

export class ReportePdfService {
  constructor(private readonly reportes = new ReporteService()) {}

  public async gastoPorProveedor(desde?: string, hasta?: string): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.reportes.gastoPorProveedor(desde, hasta);
    const pdf = new PdfBuilder({
      title: "Gasto por proveedor",
      footer: "ERP Corporativo · Reporte de gasto por proveedor",
    });

    pdf.title("Gasto por proveedor", rango(d.desde, d.hasta));
    pdf.kpiBand([
      { label: "Monto total (GTQ)", value: money(d.montoTotal), tone: "brand" },
      { label: "Ordenes de compra", value: String(d.ordenesTotal) },
      { label: "Proveedores", value: String(d.proveedores.length) },
    ]);

    if (d.proveedores.length === 0) {
      pdf.note("No hay ordenes de compra emitidas en el periodo seleccionado.");
      return { buffer: await pdf.build(), filename: this.filename("gasto-proveedor", desde, hasta) };
    }

    pdf.sectionTitle("Distribucion del gasto (top 12)");
    pdf.barChart(
      d.proveedores.slice(0, 12).map((p) => ({ label: p.proveedor, value: p.monto })),
      moneyCompact,
    );

    pdf.sectionTitle("Detalle por proveedor");
    pdf.table(
      [
        { header: "Proveedor", width: 190 },
        { header: "NIT", width: 80 },
        { header: "OC", width: 40, align: "right" },
        { header: "Monto (GTQ)", width: 100, align: "right" },
        { header: "% del total", width: 89, align: "right" },
      ],
      d.proveedores.map((p) => [p.proveedor, p.nit, String(p.ordenes), money(p.monto), pct(p.porcentaje)]),
    );

    return { buffer: await pdf.build(), filename: this.filename("gasto-proveedor", desde, hasta) };
  }

  public async ocPendientesRecibir(): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.reportes.ocPendientesRecibir();
    const pdf = new PdfBuilder({
      title: "Ordenes pendientes de recibir",
      footer: "ERP Corporativo · Ordenes de compra pendientes de recibir",
    });

    pdf.title("Ordenes de compra pendientes de recibir", `Corte al ${new Date().toLocaleDateString("es-GT")}`);
    pdf.kpiBand([
      { label: "Ordenes pendientes", value: String(d.totalOrdenes), tone: "brand" },
      { label: "Vencidas", value: String(d.totalVencidas), tone: d.totalVencidas > 0 ? "warning" : "success" },
      { label: "Monto en transito (GTQ)", value: money(d.montoTotal) },
    ]);

    if (d.ordenes.length === 0) {
      pdf.note("No hay ordenes de compra pendientes de recibir.", "ok");
      return { buffer: await pdf.build(), filename: this.filename("oc-pendientes") };
    }

    pdf.sectionTitle("Ordenes por dias de atraso (top 12)");
    pdf.barChart(
      d.ordenes.slice(0, 12).map((o) => ({ label: `OC-${o.idOrdenCompra} · ${o.proveedor}`, value: o.diasVencida })),
      (n) => `${n} d`,
    );

    pdf.sectionTitle("Detalle de ordenes pendientes");
    pdf.table(
      [
        { header: "OC", width: 40, align: "right" },
        { header: "Proveedor", width: 140 },
        { header: "Estado", width: 90 },
        { header: "Emision", width: 62 },
        { header: "Entrega esp.", width: 62 },
        { header: "Dias trans.", width: 55, align: "right" },
        { header: "Dias venc.", width: 50, align: "right" },
      ],
      d.ordenes.map((o) => [
        String(o.idOrdenCompra),
        o.proveedor,
        o.estado,
        o.fechaEmision.slice(0, 10),
        o.fechaEntregaEsperada.slice(0, 10),
        String(o.diasTranscurridos),
        o.diasVencida > 0 ? String(o.diasVencida) : "-",
      ]),
    );

    return { buffer: await pdf.build(), filename: this.filename("oc-pendientes") };
  }

  public async desempenoProveedores(desde?: string, hasta?: string): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.reportes.desempenoProveedores(desde, hasta);
    const pdf = new PdfBuilder({
      title: "Desempeno de proveedores",
      footer: "ERP Corporativo · Desempeno de proveedores",
    });

    pdf.title("Desempeno de proveedores", rango(d.desde, d.hasta));
    pdf.kpiBand([
      {
        label: "Dias promedio de entrega",
        value: d.diasPromedioGeneral === null ? "-" : `${d.diasPromedioGeneral} d`,
        tone: "brand",
      },
      { label: "Proveedores evaluados", value: String(d.proveedores.length) },
    ]);

    if (d.proveedores.length === 0) {
      pdf.note("No hay recepciones registradas en el periodo seleccionado.");
      return { buffer: await pdf.build(), filename: this.filename("desempeno-proveedores", desde, hasta) };
    }

    pdf.sectionTitle("Tiempo de entrega por proveedor (dias, menor es mejor)");
    pdf.barChart(
      d.proveedores
        .filter((p) => p.diasPromedioEntrega !== null)
        .slice(0, 12)
        .map((p) => ({ label: p.proveedor, value: p.diasPromedioEntrega ?? 0 })),
      (n) => `${n.toFixed(1)} d`,
    );

    pdf.sectionTitle("Detalle por proveedor");
    pdf.table(
      [
        { header: "Proveedor", width: 190 },
        { header: "OC recibidas", width: 70, align: "right" },
        { header: "Dias prom. entrega", width: 90, align: "right" },
        { header: "Recibido", width: 70, align: "right" },
        { header: "% Rechazo", width: 79, align: "right" },
      ],
      d.proveedores.map((p) => [
        p.proveedor,
        String(p.ordenesRecibidas),
        p.diasPromedioEntrega === null ? "-" : `${p.diasPromedioEntrega} d`,
        String(p.cantidadRecibida),
        pct(p.porcentajeRechazo),
      ]),
    );

    return { buffer: await pdf.build(), filename: this.filename("desempeno-proveedores", desde, hasta) };
  }

  public async riesgoProveedores(): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.reportes.riesgoProveedores();
    const pdf = new PdfBuilder({
      title: "Riesgo de proveedores",
      footer: "ERP Corporativo · Riesgo de proveedores",
    });

    pdf.title("Riesgo de proveedores", "Historico completo (no admite rango de fechas)");
    pdf.kpiBand([
      {
        label: "Dias promedio de entrega (general)",
        value: d.diasPromedioGeneral === null ? "-" : `${d.diasPromedioGeneral} d`,
      },
      { label: "Proveedores evaluados", value: String(d.proveedores.length) },
      {
        label: "En riesgo alto",
        value: String(d.proveedores.filter((p) => p.nivel === "alto").length),
        tone: "warning",
      },
    ]);

    if (d.proveedores.length === 0) {
      pdf.note("Aun no hay proveedores con ordenes recibidas para evaluar.");
      return { buffer: await pdf.build(), filename: "riesgo-proveedores.pdf" };
    }

    pdf.sectionTitle("Score de confiabilidad (0-100, mas alto es mejor)");
    pdf.barChart(
      d.proveedores.slice(0, 12).map((p) => ({ label: p.proveedor, value: p.score })),
      (n) => String(n),
    );

    pdf.sectionTitle("Detalle por proveedor");
    pdf.table(
      [
        { header: "Proveedor", width: 150 },
        { header: "Calificacion", width: 70 },
        { header: "OC recibidas", width: 65, align: "right" },
        { header: "Dias prom.", width: 55, align: "right" },
        { header: "% Rechazo", width: 60, align: "right" },
        { header: "Escasez", width: 55, align: "right" },
        { header: "Score", width: 44, align: "right" },
        { header: "Riesgo", width: 60 },
      ],
      d.proveedores.map((p) => [
        p.proveedor,
        p.calificacion ?? "-",
        String(p.ordenesRecibidas),
        p.diasPromedioEntrega === null ? "-" : `${p.diasPromedioEntrega} d`,
        pct(p.porcentajeRechazo),
        p.tieneArticulosEnEscasez ? "Si" : "No",
        String(p.score),
        p.nivel === "alto" ? "Alto" : p.nivel === "medio" ? "Medio" : "Bajo",
      ]),
    );

    pdf.note(
      "Score: parte de 100, resta por tardanza relativa al promedio y por % de rechazo, ajusta por calificacion declarada. 'Escasez' es informativo (no penaliza el score): el proveedor suministra articulos con alerta activa.",
    );

    return { buffer: await pdf.build(), filename: "riesgo-proveedores.pdf" };
  }

  private filename(base: string, desde?: string, hasta?: string): string {
    const sufijo = desde !== undefined || hasta !== undefined ? `-${desde ?? "inicio"}_${hasta ?? "hoy"}` : "";
    return `${base}${sufijo}.pdf`;
  }
}

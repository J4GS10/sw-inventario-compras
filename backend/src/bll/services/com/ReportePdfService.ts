/**
 * Capa 3 - Logica de Negocio / compras.
 * Genera los PDF de reporteria del modulo.
 *
 * Composicion: usa `ReporteService` (datos) + `PdfBuilder` (formato, patron
 * Builder). Cada PDF llama al MISMO metodo de `ReporteService` que la pantalla,
 * con los MISMOS filtros: trae solo las filas que el usuario esta viendo. La
 * linea "Filtros aplicados" deja constancia de con que se genero.
 */

import { PdfBuilder } from "../../../common/pdf/PdfBuilder.js";
import {
  ReporteService,
  TITULO_HALLAZGO,
  type AccionDisponibilidad,
  type EvaluacionProveedoresInput,
  type FiltroAuditoria,
  type FiltroDisponibilidad,
  type FiltroGastoArea,
  type FiltroPendientes,
  type FiltroReporte,
  type FiltroRiesgo,
} from "./ReporteService.js";
import type { AuditContext } from "../../../common/types/AuditContext.js";

type PdfOut = { buffer: Buffer; filename: string };

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
  if (desde === null && hasta === null) return "Todo el histórico";
  return `Del ${desde ?? "inicio"} al ${hasta ?? "hoy"}`;
}

const ACCION_LABEL: Record<AccionDisponibilidad, string> = {
  PEDIR: "Pedir",
  EN_CURSO: "Ya solicitado",
  EN_TRANSITO: "En camino",
  SUFICIENTE: "Suficiente",
  EXCEDIDO: "Sobre el máximo",
};

export class ReportePdfService {
  constructor(private readonly reportes = new ReporteService()) {}

  /**
   * Deja en el PDF con que filtros se genero. `descripcion` es el texto que
   * arma la pantalla con las etiquetas que el usuario eligio (proveedor,
   * categoria...); se muestra tal cual, solo informativo.
   */
  private filtros(pdf: PdfBuilder, descripcion: string | undefined): void {
    pdf.note(`Filtros aplicados: ${descripcion === undefined || descripcion.trim() === "" ? "ninguno (todos los registros)" : descripcion.trim()}`);
  }

  public async gastoPorProveedor(f: FiltroReporte, descripcion?: string): Promise<PdfOut> {
    const d = await this.reportes.gastoPorProveedor(f);
    const pdf = new PdfBuilder({
      title: "Gasto por proveedor",
      footer: "ERP Corporativo · Reporte de gasto por proveedor",
    });

    pdf.title("Gasto por proveedor", rango(d.desde, d.hasta));
    this.filtros(pdf, descripcion);
    pdf.kpiBand([
      { label: "Monto total (GTQ)", value: money(d.montoTotal), tone: "brand" },
      { label: "Órdenes de compra", value: String(d.ordenesTotal) },
      { label: "Proveedores", value: String(d.proveedores.length) },
    ]);

    if (d.proveedores.length === 0) {
      pdf.note("No hay órdenes de compra con estos filtros.");
      return { buffer: await pdf.build(), filename: this.filename("gasto-proveedor", f.desde, f.hasta) };
    }

    pdf.sectionTitle("Distribución del gasto (top 12)");
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

    return { buffer: await pdf.build(), filename: this.filename("gasto-proveedor", f.desde, f.hasta) };
  }

  public async ocPendientesRecibir(f: FiltroPendientes, descripcion?: string): Promise<PdfOut> {
    const d = await this.reportes.ocPendientesRecibir(f);
    const pdf = new PdfBuilder({
      title: "Órdenes pendientes de recibir",
      footer: "ERP Corporativo · Órdenes de compra pendientes de recibir",
    });

    pdf.title("Órdenes de compra pendientes de recibir", `Corte al ${new Date().toLocaleDateString("es-GT")}`);
    this.filtros(pdf, descripcion);
    pdf.kpiBand([
      { label: "Órdenes pendientes", value: String(d.totalOrdenes), tone: "brand" },
      { label: "Vencidas", value: String(d.totalVencidas), tone: d.totalVencidas > 0 ? "warning" : "success" },
      { label: "Llegan en 7 días", value: String(d.proximas7Dias) },
      { label: "Monto en tránsito (GTQ)", value: money(d.montoTotal) },
    ]);

    if (d.ordenes.length === 0) {
      pdf.note("No hay órdenes de compra pendientes con estos filtros.", "ok");
      return { buffer: await pdf.build(), filename: this.filename("oc-pendientes") };
    }

    if (d.totalVencidas > 0) {
      pdf.sectionTitle("Órdenes por días de atraso (top 12)");
      pdf.barChart(
        d.ordenes
          .filter((o) => o.diasVencida > 0)
          .slice(0, 12)
          .map((o) => ({ label: `OC-${o.idOrdenCompra} · ${o.proveedor}`, value: o.diasVencida })),
        (n) => `${n} d`,
      );
    }

    pdf.sectionTitle("Detalle de órdenes pendientes");
    pdf.table(
      [
        { header: "OC", width: 40, align: "right" },
        { header: "Proveedor", width: 130 },
        { header: "Estado", width: 85 },
        { header: "Emisión", width: 58 },
        { header: "Entrega esp.", width: 58 },
        { header: "Días venc.", width: 45, align: "right" },
        { header: "Monto (GTQ)", width: 83, align: "right" },
      ],
      d.ordenes.map((o) => [
        String(o.idOrdenCompra),
        o.proveedor,
        o.estado,
        o.fechaEmision.slice(0, 10),
        o.fechaEntregaEsperada.slice(0, 10),
        o.diasVencida > 0 ? String(o.diasVencida) : "-",
        money(o.monto),
      ]),
    );

    return { buffer: await pdf.build(), filename: this.filename("oc-pendientes") };
  }

  public async desempenoProveedores(f: FiltroReporte, descripcion?: string): Promise<PdfOut> {
    const d = await this.reportes.desempenoProveedores(f);
    const pdf = new PdfBuilder({
      title: "Desempeño de proveedores",
      footer: "ERP Corporativo · Desempeño de proveedores",
    });

    pdf.title("Desempeño de proveedores", rango(d.desde, d.hasta));
    this.filtros(pdf, descripcion);
    pdf.kpiBand([
      {
        label: "Días promedio de entrega",
        value: d.diasPromedioGeneral === null ? "-" : `${d.diasPromedioGeneral} d`,
        tone: "brand",
      },
      { label: "Proveedores evaluados", value: String(d.proveedores.length) },
    ]);

    if (d.proveedores.length === 0) {
      pdf.note("No hay recepciones registradas con estos filtros.");
      return { buffer: await pdf.build(), filename: this.filename("desempeno-proveedores", f.desde, f.hasta) };
    }

    pdf.sectionTitle("Tiempo de entrega por proveedor (días, menor es mejor)");
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
        { header: "Días prom. entrega", width: 90, align: "right" },
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

    return { buffer: await pdf.build(), filename: this.filename("desempeno-proveedores", f.desde, f.hasta) };
  }

  public async riesgoProveedores(f: FiltroRiesgo, descripcion?: string): Promise<PdfOut> {
    const d = await this.reportes.riesgoProveedores(f);
    const pdf = new PdfBuilder({
      title: "Riesgo de proveedores",
      footer: "ERP Corporativo · Riesgo de proveedores",
    });

    pdf.title("Riesgo de proveedores", "Histórico completo de entregas");
    this.filtros(pdf, descripcion);
    const restringir = d.proveedores.filter((p) => p.recomendacion === "RESTRINGIR" && p.estado === "A").length;
    pdf.kpiBand([
      {
        label: "Días promedio de entrega (general)",
        value: d.diasPromedioGeneral === null ? "-" : `${d.diasPromedioGeneral} d`,
      },
      { label: "Proveedores listados", value: String(d.proveedores.length) },
      { label: "Recomendado restringir", value: String(restringir), tone: restringir > 0 ? "warning" : "success" },
    ]);

    if (d.proveedores.length === 0) {
      pdf.note("No hay proveedores con estos filtros.");
      return { buffer: await pdf.build(), filename: "riesgo-proveedores.pdf" };
    }

    pdf.sectionTitle("Score de confiabilidad (0-100, más alto es mejor)");
    pdf.barChart(
      d.proveedores.slice(0, 12).map((p) => ({ label: p.proveedor, value: p.score })),
      (n) => String(n),
    );

    pdf.sectionTitle("Detalle por proveedor");
    pdf.table(
      [
        { header: "Proveedor", width: 130 },
        { header: "Calif.", width: 40 },
        { header: "OC rec.", width: 42, align: "right" },
        { header: "Días prom.", width: 50, align: "right" },
        { header: "% Rechazo", width: 55, align: "right" },
        { header: "Score", width: 38, align: "right" },
        { header: "Recomendación", width: 80 },
        { header: "Estado", width: 64 },
      ],
      d.proveedores.map((p) => [
        p.proveedor,
        p.calificacion ?? "-",
        String(p.ordenesRecibidas),
        p.diasPromedioEntrega === null ? "-" : `${p.diasPromedioEntrega} d`,
        pct(p.porcentajeRechazo),
        String(p.score),
        p.recomendacion === "RESTRINGIR" ? "Restringir" : p.recomendacion === "VIGILAR" ? "Vigilar" : "Mantener",
        p.estado === "A" ? "Activo" : "Restringido",
      ]),
    );

    const conMotivo = d.proveedores.filter((p) => p.recomendacion !== "MANTENER").slice(0, 15);
    if (conMotivo.length > 0) {
      pdf.sectionTitle("Por qué (proveedores a vigilar o restringir)");
      pdf.table(
        [
          { header: "Proveedor", width: 150 },
          { header: "Motivos", width: 349 },
        ],
        conMotivo.map((p) => [p.proveedor, p.motivos.join("; ")]),
      );
    }

    pdf.note(
      "Score: parte de 100, resta por tardanza relativa al promedio y por % de rechazo, ajusta por calificación declarada. Restringir = no emitirle nuevas órdenes hasta revisar su desempeño.",
    );

    return { buffer: await pdf.build(), filename: "riesgo-proveedores.pdf" };
  }

  public async inventarioPorCategoria(f: FiltroReporte, descripcion?: string): Promise<PdfOut> {
    const d = await this.reportes.inventarioPorCategoria(f);
    const pdf = new PdfBuilder({
      title: "Inventario por categoría",
      footer: "ERP Corporativo · Inventario valorizado por categoría",
    });
    pdf.title("Inventario por categoría", `Corte al ${new Date().toLocaleDateString("es-GT")}`);
    this.filtros(pdf, descripcion);
    pdf.kpiBand([
      { label: "Valor del inventario", value: money(d.valorTotal), tone: "brand" },
      { label: "Unidades", value: String(d.unidadesTotal) },
      { label: "Artículos", value: String(d.articulosTotal) },
    ]);
    if (d.categorias.length === 0) {
      pdf.note("No hay existencias con estos filtros.");
      return { buffer: await pdf.build(), filename: "inventario-categoria.pdf" };
    }
    pdf.sectionTitle("Valor por categoría");
    pdf.barChart(d.categorias.slice(0, 12).map((c) => ({ label: c.categoria, value: c.valor })), moneyCompact);
    pdf.sectionTitle("Detalle");
    pdf.table(
      [
        { header: "Categoría", width: 190 },
        { header: "Artículos", width: 70, align: "right" },
        { header: "Unidades", width: 80, align: "right" },
        { header: "Valor (GTQ)", width: 90, align: "right" },
        { header: "% del valor", width: 69, align: "right" },
      ],
      d.categorias.map((c) => [c.categoria, String(c.articulos), String(c.unidades), money(c.valor), pct(c.porcentaje)]),
    );
    return { buffer: await pdf.build(), filename: "inventario-categoria.pdf" };
  }

  public async disponibilidadArticulos(f: FiltroDisponibilidad, descripcion?: string): Promise<PdfOut> {
    const d = await this.reportes.disponibilidadArticulos(f);
    const pdf = new PdfBuilder({
      title: "Disponibilidad de artículos",
      footer: "ERP Corporativo · Disponibilidad de artículos (¿conviene pedir?)",
    });
    pdf.title("Disponibilidad de artículos", `Corte al ${new Date().toLocaleDateString("es-GT")}`);
    this.filtros(pdf, descripcion);
    pdf.kpiBand([
      { label: "Conviene pedir", value: String(d.resumen.PEDIR), tone: d.resumen.PEDIR > 0 ? "warning" : "success" },
      { label: "Ya solicitados", value: String(d.resumen.EN_CURSO) },
      { label: "En camino", value: String(d.resumen.EN_TRANSITO) },
      { label: "Suficientes", value: String(d.resumen.SUFICIENTE + d.resumen.EXCEDIDO), tone: "success" },
    ]);
    if (d.articulos.length === 0) {
      pdf.note("No hay artículos con estos filtros.");
      return { buffer: await pdf.build(), filename: "disponibilidad-articulos.pdf" };
    }
    pdf.sectionTitle("Artículos");
    pdf.table(
      [
        { header: "Artículo", width: 120 },
        { header: "Exist.", width: 42, align: "right" },
        { header: "En camino", width: 48, align: "right" },
        { header: "Solicitado", width: 50, align: "right" },
        { header: "Mín/Máx", width: 50, align: "right" },
        { header: "Acción", width: 62 },
        { header: "Sugerido", width: 45, align: "right" },
        { header: "Último precio", width: 82, align: "right" },
      ],
      d.articulos.map((a) => [
        `${a.codigo} ${a.articulo}`,
        String(a.existencia),
        String(a.enTransito),
        String(a.solicitado),
        `${a.stockMinimo}/${a.stockMaximo}`,
        ACCION_LABEL[a.accion],
        a.sugeridoPedir === null ? "-" : String(a.sugeridoPedir),
        a.ultimoPrecio === null ? "-" : money(a.ultimoPrecio),
      ]),
    );
    pdf.note(
      "En camino: lo pendiente de recibir de órdenes de compra vigentes. Solicitado: lo pedido en solicitudes aún sin orden. Sugerido: lo que falta para llegar al máximo (o al mínimo) descontando lo ya solicitado.",
    );
    return { buffer: await pdf.build(), filename: "disponibilidad-articulos.pdf" };
  }

  public async gastoPorArea(f: FiltroGastoArea, ctx: AuditContext | undefined, descripcion?: string): Promise<PdfOut> {
    const d = await this.reportes.gastoPorArea(f, ctx);
    const pdf = new PdfBuilder({
      title: "Gasto por área",
      footer: "ERP Corporativo · Gasto y aprobaciones por área",
    });
    pdf.title("Gasto por área", `${rango(d.desde, d.hasta)}${d.acotado ? " · Solo tu área / equipo" : ""}`);
    this.filtros(pdf, descripcion);
    pdf.kpiBand([
      { label: "Comprometido en OC", value: money(d.montoTotal), tone: "brand" },
      { label: "Solicitudes", value: String(d.solicitudesTotal) },
      { label: "Por aprobar", value: String(d.porAprobarTotal), tone: d.porAprobarTotal > 0 ? "warning" : "success" },
    ]);
    if (d.areas.length === 0) {
      pdf.note("No hay solicitudes ni órdenes con estos filtros.");
      return { buffer: await pdf.build(), filename: this.filename("gasto-area", f.desde, f.hasta) };
    }
    pdf.sectionTitle("Gasto comprometido por área");
    pdf.barChart(d.areas.slice(0, 12).map((a) => ({ label: a.departamento, value: a.montoComprometido })), moneyCompact);
    pdf.sectionTitle("Detalle por área");
    pdf.table(
      [
        { header: "Área", width: 110 },
        { header: "Solic.", width: 38, align: "right" },
        { header: "Por aprobar", width: 52, align: "right" },
        { header: "% Rech.", width: 42, align: "right" },
        { header: "Días aprob.", width: 52, align: "right" },
        { header: "OC", width: 32, align: "right" },
        { header: "Comprometido", width: 85, align: "right" },
        { header: "% gasto", width: 88, align: "right" },
      ],
      d.areas.map((a) => [
        a.departamento,
        String(a.solicitudes),
        String(a.porAprobar),
        a.porcentajeRechazo === null ? "-" : pct(a.porcentajeRechazo),
        a.diasPromedioAprobacion === null ? "-" : `${a.diasPromedioAprobacion} d`,
        String(a.ordenes),
        money(a.montoComprometido),
        pct(a.porcentajeGasto),
      ]),
    );
    if (d.articulosTop.length > 0) {
      pdf.sectionTitle("En qué se gasta (top 10)");
      pdf.table(
        [
          { header: "Artículo", width: 250 },
          { header: "Cantidad", width: 70, align: "right" },
          { header: "OC", width: 50, align: "right" },
          { header: "Monto (GTQ)", width: 129, align: "right" },
        ],
        d.articulosTop.map((a) => [a.articulo, String(a.cantidad), String(a.ordenes), money(a.monto)]),
      );
    }
    pdf.note("El gasto se atribuye al área de quien hizo la solicitud; las órdenes sin solicitud de origen no se incluyen.");
    return { buffer: await pdf.build(), filename: this.filename("gasto-area", f.desde, f.hasta) };
  }

  public async auditoriaCompras(f: FiltroAuditoria, descripcion?: string): Promise<PdfOut> {
    const d = await this.reportes.auditoriaCompras(f);
    const pdf = new PdfBuilder({
      title: "Hallazgos de auditoría",
      footer: "ERP Corporativo · Hallazgos de control interno en compras",
    });
    pdf.title("Hallazgos de auditoría de compras", rango(d.desde, d.hasta));
    this.filtros(pdf, descripcion);
    pdf.kpiBand([
      { label: "Severidad alta", value: String(d.porSeveridad.alta), tone: d.porSeveridad.alta > 0 ? "warning" : "success" },
      { label: "Severidad media", value: String(d.porSeveridad.media) },
      { label: "Severidad baja", value: String(d.porSeveridad.baja) },
      { label: "Sobrecosto / valor en riesgo", value: money(d.montoEnRiesgo), tone: "brand" },
    ]);
    if (d.hallazgos.length === 0) {
      pdf.note("Sin hallazgos con estos filtros.", "ok");
      return { buffer: await pdf.build(), filename: this.filename("auditoria-compras", f.desde, f.hasta) };
    }
    pdf.sectionTitle("Hallazgos por tipo");
    pdf.barChart(
      Object.entries(d.porTipo).map(([t, n]) => ({ label: TITULO_HALLAZGO[t as keyof typeof TITULO_HALLAZGO] ?? t, value: n })),
      (n) => String(n),
    );
    pdf.sectionTitle("Detalle");
    pdf.table(
      [
        { header: "Sev.", width: 34 },
        { header: "Tipo", width: 90 },
        { header: "Doc.", width: 50 },
        { header: "Fecha", width: 50 },
        { header: "Proveedor", width: 90 },
        { header: "Detalle", width: 185 },
      ],
      d.hallazgos.map((h) => [
        h.severidad === "alta" ? "Alta" : h.severidad === "media" ? "Media" : "Baja",
        TITULO_HALLAZGO[h.tipo],
        h.codigo,
        h.fecha.slice(0, 10),
        h.proveedor ?? "-",
        h.detalle,
      ]),
    );
    return { buffer: await pdf.build(), filename: this.filename("auditoria-compras", f.desde, f.hasta) };
  }

  public async evaluacionProveedores(
    input: EvaluacionProveedoresInput = {},
    descripcion?: string,
  ): Promise<PdfOut> {
    const d = await this.reportes.evaluacionProveedores(input);
    const pdf = new PdfBuilder({
      title: "Evaluación de proveedores",
      footer: "ERP Corporativo · Evaluación de proveedores",
    });

    const enfoque: Record<string, string> = {
      equilibrado: "Equilibrado",
      ahorro: "Priorizar ahorro",
      rapidez: "Priorizar rapidez",
      calidad: "Priorizar calidad",
      personalizado: "Personalizado",
    };
    pdf.title(
      "Evaluación de proveedores",
      `${rango(d.desde, d.hasta)} · Enfoque: ${enfoque[d.prioridad] ?? d.prioridad} · Mínimo ${d.minOrdenes} OC`,
    );
    this.filtros(pdf, descripcion);
    const w = d.pesos;
    pdf.note(
      `Peso de cada criterio: descuento ${pct(w.descuento * 100)}, rapidez ${pct(w.entrega * 100)}, cumplimiento ${pct(w.cumplimiento * 100)}, calidad ${pct(w.calidad * 100)}, envío ${pct(w.envio * 100)}.` +
        (d.descartados > 0 ? ` ${d.descartados} proveedor(es) descartado(s) por no cumplir los requisitos mínimos.` : ""),
    );
    pdf.kpiBand([
      { label: "Monto neto (GTQ)", value: money(d.resumen.montoNeto), tone: "brand" },
      { label: "Ahorro por descuentos", value: money(d.resumen.ahorroDescuento), tone: "success" },
      { label: "Descuento promedio", value: pct(d.resumen.descuentoPromedioPct) },
      {
        label: "Días de entrega (prom.)",
        value: d.resumen.diasEntregaPromedio === null ? "-" : `${d.resumen.diasEntregaPromedio} d`,
      },
    ]);

    if (d.proveedores.length === 0) {
      pdf.note("No hay proveedores que cumplan estos filtros.");
      return { buffer: await pdf.build(), filename: "evaluacion-proveedores.pdf" };
    }

    const m = d.mejores;
    const lineaMejor = (etiqueta: string, x: { proveedor: string } | null, valor: string): string =>
      `${etiqueta}: ${x === null ? "sin diferencias o datos suficientes" : `${x.proveedor} (${valor})`}`;
    pdf.sectionTitle("Quién destaca en cada criterio");
    pdf.note(
      [
        lineaMejor("Mayor descuento", m.descuento, m.descuento === null ? "" : pct(m.descuento.valor)),
        lineaMejor("Entrega más rápida", m.entrega, m.entrega === null ? "" : `${m.entrega.valor} d`),
        lineaMejor("Mejor cumplimiento de fecha", m.cumplimiento, m.cumplimiento === null ? "" : pct(m.cumplimiento.valor)),
        lineaMejor("Menor rechazo", m.calidad, m.calidad === null ? "" : pct(m.calidad.valor)),
        lineaMejor("Envío gratuito", m.envio, m.envio === null ? "" : `${pct(m.envio.valor)} de sus OC`),
        lineaMejor("Más conveniente", m.conveniencia, m.conveniencia === null ? "" : `score ${m.conveniencia.valor}`),
      ].join("  |  "),
    );

    pdf.sectionTitle("Índice de conveniencia (0-100, top 12)");
    pdf.barChart(
      d.proveedores.filter((p) => p.elegible).slice(0, 12).map((p) => ({ label: p.proveedor, value: p.score })),
      (n) => String(n),
    );

    pdf.sectionTitle("Detalle por proveedor");
    pdf.table(
      [
        { header: "Proveedor", width: 130 },
        { header: "OC", width: 28, align: "right" },
        { header: "Monto (GTQ)", width: 72, align: "right" },
        { header: "Desc.", width: 40, align: "right" },
        { header: "Días ent.", width: 44, align: "right" },
        { header: "A tiempo", width: 46, align: "right" },
        { header: "Rechazo", width: 46, align: "right" },
        { header: "Envío grat.", width: 50, align: "right" },
        { header: "Score", width: 33, align: "right" },
      ],
      d.proveedores.map((p) => [
        p.proveedor,
        String(p.ordenes),
        money(p.montoNeto),
        pct(p.descuentoPct),
        p.diasEntrega === null ? "-" : `${p.diasEntrega}${p.diasEntregaEsPrometido ? "*" : ""}`,
        p.porcentajeATiempo === null ? "-" : pct(p.porcentajeATiempo),
        p.porcentajeRechazo === null ? "-" : pct(p.porcentajeRechazo),
        p.porcentajeEnvioGratis === null ? "s/d" : pct(p.porcentajeEnvioGratis),
        p.elegible ? String(p.score) : "n/c",
      ]),
    );
    pdf.note(
      "Descuento: ponderado por monto. Días de entrega: reales (emisión a última recepción); * = plazo prometido, aún sin OC completas. Envío grat.: % de las OC con flete registrado que fueron gratuitas (s/d = sin dato registrado). n/c: no compite (menos OC que el mínimo). El score compara solo entre los proveedores listados y pondera cada criterio según el enfoque elegido.",
    );

    return { buffer: await pdf.build(), filename: "evaluacion-proveedores.pdf" };
  }

  private filename(base: string, desde?: string, hasta?: string): string {
    const sufijo = desde !== undefined || hasta !== undefined ? `-${desde ?? "inicio"}_${hasta ?? "hoy"}` : "";
    return `${base}${sufijo}.pdf`;
  }
}

/**
 * Capa 6 - Componentes Comunes.
 * Patron Builder sobre PDFKit: API fluida con estilo consistente (banda de
 * titulo, tablas con zebra y bordes, encabezado/pie por pagina estampados al
 * final con `bufferPages`). Sin dependencia del negocio.
 */

import PDFDocument from "pdfkit";

const NAVY = "#0b1a38";
const BRAND = "#1857b8";
const INK = "#1f2a44";
const INK_SOFT = "#5b6478";
const LINE = "#dfe4ef";
const ZEBRA = "#f7f8fb";
const SUCCESS = "#16a34a";
const WARNING = "#b45309";

export interface PdfColumn {
  readonly header: string;
  /** Ancho en puntos; la suma deberia caber en el area util (~499pt en A4). */
  readonly width: number;
  readonly align?: "left" | "right" | "center";
}

type Doc = InstanceType<typeof PDFDocument>;

const MARGIN = { top: 60, bottom: 58, left: 48, right: 48 };

export class PdfBuilder {
  private readonly doc: Doc;
  private readonly chunks: Buffer[] = [];
  private readonly done: Promise<Buffer>;
  private readonly footerText: string;
  private readonly brandText: string;

  constructor(options?: { title?: string; footer?: string; brand?: string }) {
    this.doc = new PDFDocument({
      size: "A4",
      margins: MARGIN,
      bufferPages: true,
      info: { Title: options?.title ?? "Documento", Producer: options?.brand ?? "ERP Corporativo" },
    });
    this.brandText = options?.brand ?? "ERP Corporativo";
    this.footerText = options?.footer ?? "ERP Corporativo · Gestion de Compras";
    const stream = this.doc as unknown as NodeJS.EventEmitter;
    stream.on("data", (c: Buffer) => this.chunks.push(c));
    this.done = new Promise<Buffer>((resolve) => {
      stream.on("end", () => resolve(Buffer.concat(this.chunks)));
    });
    this.doc.font("Helvetica").fillColor(INK);
  }

  /**
   * Encabezado del documento: titulo en texto plano (sin caja de color de
   * fondo) con una regla de acento debajo — registro formal, no una tarjeta.
   */
  public title(main: string, subtitle?: string): this {
    const { left } = MARGIN;
    const w = this.usableWidth();
    const y = this.doc.y;
    this.doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(main, left, y, { width: w, lineBreak: false });
    if (subtitle !== undefined) {
      this.doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(INK_SOFT)
        .text(subtitle, left, this.doc.y + 3, { width: w, lineBreak: false });
    }
    const ruleY = this.doc.y + 10;
    this.doc.strokeColor(BRAND).lineWidth(1.5).moveTo(left, ruleY).lineTo(left + w, ruleY).stroke();
    this.doc.y = ruleY + 16;
    this.doc.fillColor(INK);
    return this;
  }

  /**
   * Encabezado de seccion: versalitas en tinta oscura con un filete fino
   * debajo (como el apartado de un contrato o estado de cuenta) — sin la
   * marca de color solida al margen, que se veia a "tarjeta de dashboard".
   */
  public sectionTitle(text: string, opts?: { x?: number; width?: number }): this {
    const x = opts?.x ?? MARGIN.left;
    const w = opts?.width ?? this.usableWidth();
    this.breakIfNeeded(26);
    this.doc.moveDown(0.25);
    const y = this.doc.y;
    this.doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(text.toUpperCase(), x, y, { width: w, characterSpacing: 0.5, lineBreak: false });
    const ruleY = this.doc.y + 4;
    this.doc.strokeColor(LINE).lineWidth(0.75).moveTo(x, ruleY).lineTo(x + w, ruleY).stroke();
    this.doc.y = ruleY + 10;
    this.doc.fillColor(INK);
    return this;
  }

  /**
   * Pares etiqueta/valor en dos columnas internas. La altura de cada fila se
   * MIDE (en vez de un `moveDown` fijo) para que un valor largo que envuelve
   * a dos lineas no se encime con la fila siguiente — eso rompia el layout
   * de dos columnas (`twoColumn`), con columnas mas angostas que el ancho
   * completo de pagina.
   */
  public keyValues(
    pairs: readonly [string, string][],
    opts?: { x?: number; width?: number; labelWidth?: number },
  ): this {
    const x = opts?.x ?? MARGIN.left;
    const width = opts?.width ?? this.usableWidth();
    const labelWidth = opts?.labelWidth ?? 130;
    const gap = 8;
    const valueWidth = width - labelWidth - gap;
    this.doc.fontSize(9);
    for (const [k, v] of pairs) {
      const h = Math.max(13, this.doc.heightOfString(v || "-", { width: valueWidth }));
      this.breakIfNeeded(h + 5);
      const y = this.doc.y;
      this.doc.font("Helvetica-Bold").fillColor(INK_SOFT).text(k, x, y, { width: labelWidth });
      this.doc
        .font("Helvetica")
        .fillColor(INK)
        .text(v || "-", x + labelWidth + gap, y, { width: valueWidth });
      this.doc.y = y + h + 5;
    }
    this.doc.moveDown(0.1);
    return this;
  }

  /**
   * Dos bloques de datos lado a lado (p. ej. "Empresa emisora" | "Datos del
   * proveedor") — evita que un documento con varias secciones cortas se vea
   * como una lista interminable de una sola columna, que es el sintoma mas
   * obvio de "formato generico": en un documento formal real (una orden de
   * compra, una factura) los datos de las dos partes van uno junto al otro.
   */
  public twoColumn(
    left: { title: string; pairs: readonly [string, string][] },
    right: { title: string; pairs: readonly [string, string][] },
  ): this {
    const w = this.usableWidth();
    const gutter = 28;
    const colW = (w - gutter) / 2;
    const rightX = MARGIN.left + colW + gutter;
    const startY = this.doc.y;

    this.sectionTitle(left.title, { x: MARGIN.left, width: colW });
    this.keyValues(left.pairs, { x: MARGIN.left, width: colW, labelWidth: 78 });
    const leftEndY = this.doc.y;

    this.doc.y = startY;
    this.sectionTitle(right.title, { x: rightX, width: colW });
    this.keyValues(right.pairs, { x: rightX, width: colW, labelWidth: 78 });
    const rightEndY = this.doc.y;

    this.doc.y = Math.max(leftEndY, rightEndY);
    this.doc.fillColor(INK);
    return this;
  }

  /**
   * Bloque de firma al cierre del documento: una linea para firmar con el
   * nombre y el cargo debajo — el dato de "quien autoriza" merece cerrar el
   * documento, no perderse como un campo mas en una lista.
   */
  public signatureBlock(entries: readonly { label: string; name: string }[]): this {
    if (entries.length === 0) return this;
    this.breakIfNeeded(46);
    this.doc.moveDown(1.4);
    const w = this.usableWidth();
    const colW = w / entries.length;
    const y = this.doc.y;
    entries.forEach((e, i) => {
      const x = MARGIN.left + i * colW;
      const lineW = Math.min(190, colW - 20);
      this.doc.strokeColor(INK_SOFT).lineWidth(0.75).moveTo(x, y).lineTo(x + lineW, y).stroke();
      this.doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(INK)
        .text(e.name, x, y + 6, { width: lineW, lineBreak: false });
      this.doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(INK_SOFT)
        .text(e.label.toUpperCase(), x, y + 19, { width: lineW, lineBreak: false, characterSpacing: 0.3 });
    });
    this.doc.y = y + 34;
    this.doc.fillColor(INK);
    return this;
  }

  public table(columns: readonly PdfColumn[], rows: readonly (readonly string[])[]): this {
    const left = MARGIN.left;
    const padX = 6;
    const padY = 5;

    // Encabezado tipo libro mayor: texto en tinta oscura sobre blanco con un
    // filete doble (fino + grueso) debajo — no una banda solida de color,
    // que es el recurso tipico de un export generico de dashboard.
    const drawHead = (): void => {
      const y = this.doc.y;
      this.doc.font("Helvetica-Bold").fontSize(7.5).fillColor(NAVY);
      let x = left;
      for (const col of columns) {
        this.doc.text(col.header.toUpperCase(), x + padX, y + 7, {
          width: col.width - padX * 2,
          align: col.align ?? "left",
          lineBreak: false,
          characterSpacing: 0.2,
        });
        x += col.width;
      }
      const headBottom = y + 22;
      this.doc.strokeColor(LINE).lineWidth(0.5).moveTo(left, headBottom - 3).lineTo(left + this.usableWidth(), headBottom - 3).stroke();
      this.doc.strokeColor(NAVY).lineWidth(1).moveTo(left, headBottom).lineTo(left + this.usableWidth(), headBottom).stroke();
      this.doc.y = headBottom + 2;
      this.doc.fillColor(INK);
    };

    this.breakIfNeeded(46);
    drawHead();
    this.doc.font("Helvetica").fontSize(8);

    rows.forEach((row, idx) => {
      let cellH = 0;
      row.forEach((cell, i) => {
        const col = columns[i];
        if (col === undefined) return;
        cellH = Math.max(cellH, this.doc.heightOfString(cell || "-", { width: col.width - padX * 2 }));
      });
      const rowH = Math.ceil(cellH) + padY * 2;

      if (this.doc.y + rowH > this.contentBottom()) {
        this.doc.addPage();
        drawHead();
        this.doc.font("Helvetica").fontSize(8);
      }

      const y = this.doc.y;
      if (idx % 2 === 1) this.doc.rect(left, y, this.usableWidth(), rowH).fill(ZEBRA);
      this.doc.fillColor(INK);
      let x = left;
      row.forEach((cell, i) => {
        const col = columns[i];
        if (col === undefined) return;
        this.doc.text(cell || "-", x + padX, y + padY, {
          width: col.width - padX * 2,
          align: col.align ?? "left",
        });
        x += col.width;
      });
      this.doc
        .strokeColor(LINE)
        .lineWidth(0.5)
        .moveTo(left, y + rowH)
        .lineTo(left + this.usableWidth(), y + rowH)
        .stroke();
      this.doc.y = y + rowH;
    });
    this.doc.moveDown(0.6);
    return this;
  }

  /**
   * Franja de cifras clave: etiqueta pequena + valor grande, separadas por
   * filetes finos (no tarjetas de color) — mismo lenguaje que el resumen de
   * un estado de cuenta formal. El color va en el VALOR (texto), nunca en un
   * fondo solido, para que la pagina no se vea como un dashboard impreso.
   */
  public kpiBand(items: readonly { label: string; value: string; tone?: "brand" | "success" | "warning" }[]): this {
    if (items.length === 0) return this;
    this.breakIfNeeded(48);
    const w = this.usableWidth();
    const colW = w / items.length;
    const h = 42;
    const y = this.doc.y;
    const toneColor = (t?: "brand" | "success" | "warning"): string =>
      t === "success" ? SUCCESS : t === "warning" ? WARNING : NAVY;

    this.doc.strokeColor(LINE).lineWidth(0.75).moveTo(MARGIN.left, y).lineTo(MARGIN.left + w, y).stroke();
    items.forEach((item, i) => {
      const x = MARGIN.left + i * colW;
      if (i > 0) {
        this.doc.strokeColor(LINE).lineWidth(0.5).moveTo(x, y + 7).lineTo(x, y + h - 7).stroke();
      }
      const padX = i === 0 ? 0 : 14;
      this.doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(INK_SOFT)
        .text(item.label.toUpperCase(), x + padX, y + 9, { width: colW - padX - 6, lineBreak: false, characterSpacing: 0.3 });
      this.doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor(toneColor(item.tone))
        .text(item.value, x + padX, y + 21, { width: colW - padX - 6, lineBreak: false });
    });
    this.doc.strokeColor(LINE).lineWidth(0.75).moveTo(MARGIN.left, y + h).lineTo(MARGIN.left + w, y + h).stroke();
    this.doc.y = y + h + 16;
    this.doc.fillColor(INK);
    return this;
  }

  /**
   * Grafico de barras horizontales: filetes rectos (sin esquinas redondeadas
   * ni "pista" de fondo rellena — eso se ve a widget de dashboard) con una
   * linea base fina marcando la escala completa, estilo tabla de un informe
   * impreso. Etiqueta a la izquierda, valor formateado a la derecha.
   */
  public barChart(
    rows: readonly { label: string; value: number }[],
    format: (n: number) => string,
  ): this {
    if (rows.length === 0) {
      this.note("Sin datos para graficar.");
      return this;
    }
    const max = Math.max(1, ...rows.map((r) => r.value));
    const labelW = 150;
    const valueW = 70;
    const barW = this.usableWidth() - labelW - valueW - 12;
    const rowH = 18;
    this.breakIfNeeded(rowH * rows.length + 8);
    rows.forEach((r) => {
      this.breakIfNeeded(rowH + 2);
      const y = this.doc.y;
      this.doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(INK)
        .text(r.label, MARGIN.left, y + 4, { width: labelW - 8, lineBreak: false });
      const bw = Math.max(1.5, (r.value / max) * barW);
      this.doc
        .strokeColor(LINE)
        .lineWidth(0.75)
        .moveTo(MARGIN.left + labelW, y + 11.5)
        .lineTo(MARGIN.left + labelW + barW, y + 11.5)
        .stroke();
      this.doc.rect(MARGIN.left + labelW, y + 3, bw, 7).fill(BRAND);
      this.doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(NAVY)
        .text(format(r.value), MARGIN.left + labelW + barW + 8, y + 4, {
          width: valueW,
          align: "right",
          lineBreak: false,
        });
      this.doc.y = y + rowH;
    });
    this.doc.moveDown(0.4);
    this.doc.fillColor(INK);
    return this;
  }

  public note(text: string, tone: "info" | "ok" = "info"): this {
    this.breakIfNeeded(18);
    this.doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(tone === "ok" ? SUCCESS : INK_SOFT)
      .text(text, MARGIN.left, this.doc.y, { width: this.usableWidth() });
    this.doc.moveDown(0.4);
    this.doc.fillColor(INK);
    return this;
  }

  public async build(): Promise<Buffer> {
    this.stampChrome();
    this.doc.end();
    return this.done;
  }

  // -- encabezado/pie por pagina (al final, sin disparar paginacion) --------

  private stampChrome(): void {
    const range = this.doc.bufferedPageRange();
    const w = this.usableWidth();
    const { left, top } = MARGIN;
    const stamp = new Date().toLocaleString("es-GT");

    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      // Anular temporalmente los margenes para poder dibujar en las bandas
      // sin que PDFKit inserte una pagina por "overflow".
      const saved = { ...this.doc.page.margins };
      this.doc.page.margins.top = 0;
      this.doc.page.margins.bottom = 0;

      // encabezado
      this.doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(BRAND)
        .text(this.brandText.toUpperCase(), left, top - 30, { width: w / 2, lineBreak: false });
      this.doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(INK_SOFT)
        .text("Modulo de Gestion de Compras", left, top - 30, { width: w, align: "right", lineBreak: false });
      this.doc.strokeColor(LINE).lineWidth(0.7).moveTo(left, top - 16).lineTo(left + w, top - 16).stroke();

      // pie
      const by = this.doc.page.height - saved.bottom + 16;
      this.doc.strokeColor(LINE).lineWidth(0.7).moveTo(left, by - 6).lineTo(left + w, by - 6).stroke();
      this.doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(INK_SOFT)
        .text(this.footerText, left, by, { width: w / 2, lineBreak: false });
      this.doc.text(
        `Pagina ${i - range.start + 1} de ${range.count}   ·   ${stamp}`,
        left,
        by,
        { width: w, align: "right", lineBreak: false },
      );

      this.doc.page.margins.top = saved.top;
      this.doc.page.margins.bottom = saved.bottom;
    }
  }

  private breakIfNeeded(needed: number): void {
    if (this.doc.y + needed > this.contentBottom()) this.doc.addPage();
  }
  private contentBottom(): number {
    return this.doc.page.height - MARGIN.bottom - 4;
  }
  private usableWidth(): number {
    return this.doc.page.width - MARGIN.left - MARGIN.right;
  }
}

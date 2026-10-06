/**
 * Capa 6 - Componentes Comunes.
 * Patron Builder sobre PDFKit: API fluida con un estilo consistente tomado de la factura de
 * referencia (`pdf/factura.pdf`): monocromo, Helvetica, titulo centrado, bloque "Emisor" a la
 * izquierda y datos del documento a la derecha, filetes finos grises, tablas con cuadricula y
 * pie con regla, "Pagina N de M" al centro y la empresa a la derecha. Sin rellenos de color.
 * Encabezado/pie por pagina estampados al final con `bufferPages`. Sin dependencia del negocio.
 */

import PDFDocument from "pdfkit";

const BLACK = "#000000";
const INK = "#111111";
const INK_SOFT = "#555555";
/** Filetes finos y cuadricula de tabla. */
const LINE = "#b5b5b5";
const SUCCESS = "#166534";
const WARNING = "#92400e";
const DANGER = "#991b1b";

export interface LetterheadOptions {
  /** Datos de la empresa emisora (izquierda). */
  readonly empresa: { nombre: string; lineas: readonly string[] };
  /** Nombre del documento (p. ej. "ORDEN DE COMPRA"), centrado arriba. */
  readonly documento: string;
  /** Numero del documento (p. ej. "OC-000123"), a la derecha. */
  readonly numero: string;
  /** Pares etiqueta/valor bajo el numero (fechas, referencia). */
  readonly meta: readonly [string, string][];
  /** Estado como texto de color. */
  readonly estado?: { texto: string; tono: "ok" | "warn" | "bad" | "neutral" };
}

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
  /** La primera pagina lleva membrete propio: no se le estampa el encabezado generico. */
  private hasLetterhead = false;

  constructor(options?: { title?: string; footer?: string; brand?: string }) {
    this.doc = new PDFDocument({
      size: "A4",
      margins: MARGIN,
      bufferPages: true,
      info: { Title: options?.title ?? "Documento", Producer: options?.brand ?? "ERP Corporativo" },
    });
    this.brandText = options?.brand ?? "ERP Corporativo";
    this.footerText = options?.footer ?? "ERP Corporativo · Gestión de Compras";
    const stream = this.doc as unknown as NodeJS.EventEmitter;
    stream.on("data", (c: Buffer) => this.chunks.push(c));
    this.done = new Promise<Buffer>((resolve) => {
      stream.on("end", () => resolve(Buffer.concat(this.chunks)));
    });
    this.doc.font("Helvetica").fillColor(INK);
  }

  /**
   * Titulo del documento: centrado y en negrita; el subtitulo va a la derecha sobre una regla
   * negra (como "FACTURA" / "Regimen FEL ..." de la factura de referencia).
   */
  public title(main: string, subtitle?: string): this {
    const { left } = MARGIN;
    const w = this.usableWidth();
    const y = this.doc.y;
    this.doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(15).text(main, left, y, { width: w, align: "center", lineBreak: false });
    let ruleY = this.doc.y + 8;
    if (subtitle !== undefined) {
      this.doc.font("Helvetica-Bold").fontSize(11).text(subtitle, left, this.doc.y + 14, { width: w, align: "right", lineBreak: false });
      ruleY = this.doc.y + 4;
    }
    this.doc.strokeColor(BLACK).lineWidth(1).moveTo(left, ruleY).lineTo(left + w, ruleY).stroke();
    this.doc.y = ruleY + 12;
    this.doc.fillColor(INK);
    return this;
  }

  /**
   * Membrete de la primera pagina: titulo del documento centrado, "Emisor:" con los datos de la
   * empresa a la izquierda y, a la derecha y alineados a ella, numero, fechas y estado. Una regla
   * negra cierra el bloque.
   */
  public letterhead(o: LetterheadOptions): this {
    const { left } = MARGIN;
    const w = this.usableWidth();
    const rightW = 220;
    const leftW = w - rightW - 16;
    const top = this.doc.y;

    this.doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(15).text(o.documento, left, top, { width: w, align: "center", lineBreak: false });
    const y0 = this.doc.y + 14;

    // Emisor (izquierda)
    this.doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text("Emisor:", left, y0, { width: leftW, lineBreak: false });
    this.doc.font("Helvetica-Bold").fontSize(9).text(o.empresa.nombre, left, this.doc.y + 3, { width: leftW });
    this.doc.font("Helvetica").fontSize(9).fillColor(INK);
    for (const l of o.empresa.lineas) this.doc.text(l, left, this.doc.y + 0.5, { width: leftW });
    const leftBottom = this.doc.y;

    // Numero, fechas y estado (derecha)
    const rx = left + w - rightW;
    let ry = y0;
    this.doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(o.numero, rx, ry, { width: rightW, align: "right", lineBreak: false });
    ry = this.doc.y + 4;
    for (const [k, v] of o.meta) {
      this.doc.font("Helvetica").fontSize(9).fillColor(INK).text(`${k}: ${v}`, rx, ry, { width: rightW, align: "right", lineBreak: false });
      ry = this.doc.y + 0.5;
    }
    if (o.estado !== undefined) {
      const col = o.estado.tono === "ok" ? SUCCESS : o.estado.tono === "warn" ? WARNING : o.estado.tono === "bad" ? DANGER : INK_SOFT;
      this.doc.font("Helvetica-Bold").fontSize(9).fillColor(col).text(`Estado: ${o.estado.texto}`, rx, ry + 3, { width: rightW, align: "right", lineBreak: false });
      ry = this.doc.y;
    }

    const bottom = Math.max(leftBottom, ry) + 10;
    this.doc.strokeColor(BLACK).lineWidth(1).moveTo(left, bottom).lineTo(left + w, bottom).stroke();
    this.doc.y = bottom + 14;
    this.doc.fillColor(INK);
    this.hasLetterhead = true;
    return this;
  }

  /**
   * Totales a la derecha, como la fila "Totales" de la factura: filas con filete fino, TOTAL en
   * negrita entre dos filetes negros y, debajo, el importe en letras.
   */
  public totalsBox(
    rows: readonly { label: string; value: string }[],
    total: { label: string; value: string },
    enLetras?: string,
  ): this {
    const w = this.usableWidth();
    const boxW = 240;
    const x = MARGIN.left + w - boxW;
    const rowH = 17;
    this.breakIfNeeded(rows.length * rowH + 36 + (enLetras !== undefined ? 34 : 0));
    let y = this.doc.y + 4;
    for (const r of rows) {
      this.doc.font("Helvetica").fontSize(9).fillColor(INK).text(r.label, x + 6, y + 4, { width: 110, lineBreak: false });
      this.doc.text(r.value, x + 110, y + 4, { width: boxW - 110 - 6, align: "right", lineBreak: false });
      y += rowH;
      this.doc.strokeColor(LINE).lineWidth(0.5).moveTo(x, y).lineTo(x + boxW, y).stroke();
    }
    this.doc.strokeColor(BLACK).lineWidth(1).moveTo(x, y + 1).lineTo(x + boxW, y + 1).stroke();
    this.doc.font("Helvetica-Bold").fontSize(10.5).fillColor(BLACK).text(total.label, x + 6, y + 7, { width: 100, lineBreak: false });
    this.doc.text(total.value, x + 110, y + 7, { width: boxW - 110 - 6, align: "right", lineBreak: false });
    y += 26;
    this.doc.strokeColor(BLACK).lineWidth(1).moveTo(x, y).lineTo(x + boxW, y).stroke();
    y += 8;
    if (enLetras !== undefined) {
      this.doc.font("Helvetica").fontSize(8.5).fillColor(INK_SOFT).text("Son: ", MARGIN.left, y, { continued: true, lineBreak: false });
      this.doc.font("Helvetica-Bold").fillColor(INK).text(enLetras, { width: w, lineBreak: true });
      y = this.doc.y + 6;
    }
    this.doc.y = y;
    this.doc.fillColor(INK);
    return this;
  }

  /** Notas del cuerpo (terminos, observaciones): titulo en negrita y texto simple, sin fondo de color. */
  public callout(titulo: string, lineas: readonly string[]): this {
    const w = this.usableWidth();
    this.doc.font("Helvetica").fontSize(8.5);
    const hText = lineas.reduce((a, l) => a + this.doc.heightOfString(l, { width: w }) + 2, 0);
    this.breakIfNeeded(hText + 30);
    this.doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(`${titulo}:`, MARGIN.left, this.doc.y + 2, { width: w, lineBreak: false });
    this.doc.font("Helvetica").fontSize(8.5).fillColor(INK);
    for (const l of lineas) this.doc.text(l, MARGIN.left, this.doc.y + 2, { width: w });
    this.doc.y += 10;
    return this;
  }

  /** Encabezado de seccion: etiqueta en negrita con dos puntos ("Receptor:") y filete fino debajo. */
  public sectionTitle(text: string, opts?: { x?: number; width?: number }): this {
    const x = opts?.x ?? MARGIN.left;
    const w = opts?.width ?? this.usableWidth();
    this.breakIfNeeded(26);
    this.doc.moveDown(0.25);
    const y = this.doc.y;
    this.doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(`${text}:`, x, y, { width: w, lineBreak: false });
    const ruleY = this.doc.y + 3;
    this.doc.strokeColor(LINE).lineWidth(0.5).moveTo(x, ruleY).lineTo(x + w, ruleY).stroke();
    this.doc.y = ruleY + 7;
    this.doc.fillColor(INK);
    return this;
  }

  /**
   * Pares etiqueta/valor. La altura de cada fila se MIDE (en vez de un `moveDown` fijo) para que
   * un valor largo que envuelve a dos lineas no se encime con la fila siguiente.
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
      this.doc.font("Helvetica-Bold").fillColor(INK).text(`${k}:`, x, y, { width: labelWidth });
      this.doc.font("Helvetica").fillColor(INK).text(v || "-", x + labelWidth + gap, y, { width: valueWidth });
      this.doc.y = y + h + 5;
    }
    this.doc.moveDown(0.1);
    return this;
  }

  /** Dos bloques de datos lado a lado ("Emisor" | "Receptor"), como en una factura real. */
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

    this.doc.y = Math.max(leftEndY, rightEndY) + 12;
    this.doc.fillColor(INK);
    return this;
  }

  /** Bloque de firma al cierre: una linea para firmar con el nombre y el cargo debajo. */
  public signatureBlock(entries: readonly { label: string; name: string }[]): this {
    if (entries.length === 0) return this;
    this.breakIfNeeded(70);
    this.doc.moveDown(2.6);
    const w = this.usableWidth();
    const colW = w / entries.length;
    const y = this.doc.y;
    entries.forEach((e, i) => {
      const x = MARGIN.left + i * colW;
      const lineW = Math.min(190, colW - 20);
      this.doc.strokeColor(BLACK).lineWidth(0.75).moveTo(x, y).lineTo(x + lineW, y).stroke();
      this.doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(e.name, x, y + 6, { width: lineW, lineBreak: false });
      this.doc.font("Helvetica").fontSize(8).fillColor(INK_SOFT).text(e.label, x, y + 19, { width: lineW, lineBreak: false });
    });
    this.doc.y = y + 34;
    this.doc.fillColor(INK);
    return this;
  }

  /** Tabla con cuadricula de filetes grises, encabezado en negrita y sin rellenos (como la de la factura). */
  public table(columns: readonly PdfColumn[], rows: readonly (readonly string[])[]): this {
    const left = MARGIN.left;
    const w = this.usableWidth();
    const padX = 5;
    const padY = 4;
    const grid = (y: number, h: number): void => {
      this.doc.strokeColor(LINE).lineWidth(0.5).rect(left, y, w, h).stroke();
      let x = left;
      for (const col of columns.slice(0, -1)) {
        x += col.width;
        this.doc.moveTo(x, y).lineTo(x, y + h).stroke();
      }
    };

    const drawHead = (): void => {
      this.doc.font("Helvetica-Bold").fontSize(8.5);
      let hh = 0;
      for (const col of columns) hh = Math.max(hh, this.doc.heightOfString(col.header, { width: col.width - padX * 2 }));
      const h = Math.ceil(hh) + padY * 2 + 2;
      const y = this.doc.y;
      grid(y, h);
      this.doc.fillColor(BLACK);
      let x = left;
      for (const col of columns) {
        this.doc.text(col.header, x + padX, y + padY + 1, { width: col.width - padX * 2, align: col.align ?? "left" });
        x += col.width;
      }
      this.doc.y = y + h;
      this.doc.fillColor(INK);
    };

    this.breakIfNeeded(46);
    drawHead();
    this.doc.font("Helvetica").fontSize(8);

    rows.forEach((row) => {
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
      grid(y, rowH);
      this.doc.fillColor(INK).font("Helvetica").fontSize(8);
      let x = left;
      row.forEach((cell, i) => {
        const col = columns[i];
        if (col === undefined) return;
        this.doc.text(cell || "-", x + padX, y + padY, { width: col.width - padX * 2, align: col.align ?? "left" });
        x += col.width;
      });
      this.doc.y = y + rowH;
    });
    this.doc.moveDown(0.8);
    return this;
  }

  /**
   * Franja de cifras clave: etiqueta pequena + valor grande, separadas por filetes finos. El color
   * (solo de texto) va en el VALOR, nunca en un fondo.
   */
  public kpiBand(items: readonly { label: string; value: string; tone?: "brand" | "success" | "warning" }[]): this {
    if (items.length === 0) return this;
    this.breakIfNeeded(48);
    const w = this.usableWidth();
    const colW = w / items.length;
    const h = 42;
    const y = this.doc.y;
    const toneColor = (t?: "brand" | "success" | "warning"): string =>
      t === "success" ? SUCCESS : t === "warning" ? WARNING : BLACK;

    this.doc.strokeColor(LINE).lineWidth(0.75).moveTo(MARGIN.left, y).lineTo(MARGIN.left + w, y).stroke();
    items.forEach((item, i) => {
      const x = MARGIN.left + i * colW;
      if (i > 0) {
        this.doc.strokeColor(LINE).lineWidth(0.5).moveTo(x, y + 7).lineTo(x, y + h - 7).stroke();
      }
      const padX = i === 0 ? 0 : 14;
      this.doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(INK_SOFT)
        .text(item.label, x + padX, y + 9, { width: colW - padX - 6, lineBreak: false });
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

  /** Grafico de barras horizontales: barras grises rectas sobre una linea base fina; etiqueta a la izquierda y valor a la derecha. */
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
      this.doc.font("Helvetica").fontSize(8).fillColor(INK).text(r.label, MARGIN.left, y + 4, { width: labelW - 8, lineBreak: false });
      const bw = Math.max(1.5, (r.value / max) * barW);
      this.doc
        .strokeColor(LINE)
        .lineWidth(0.75)
        .moveTo(MARGIN.left + labelW, y + 11.5)
        .lineTo(MARGIN.left + labelW + barW, y + 11.5)
        .stroke();
      this.doc.rect(MARGIN.left + labelW, y + 3, bw, 7).fill("#444444");
      this.doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(BLACK)
        .text(format(r.value), MARGIN.left + labelW + barW + 8, y + 4, { width: valueW, align: "right", lineBreak: false });
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

      // encabezado de las paginas siguientes (la 1a ya trae el membrete)
      if (!(this.hasLetterhead && i === range.start)) {
        this.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text(this.brandText, left, top - 30, { width: w / 2, lineBreak: false });
        this.doc.font("Helvetica").fontSize(8.5).fillColor(INK_SOFT).text(this.footerText, left, top - 30, { width: w, align: "right", lineBreak: false });
        this.doc.strokeColor(LINE).lineWidth(0.5).moveTo(left, top - 16).lineTo(left + w, top - 16).stroke();
      }

      // pie: regla negra, fecha a la izquierda, "Pagina N de M" al centro, empresa a la derecha
      const by = this.doc.page.height - saved.bottom + 16;
      this.doc.strokeColor(BLACK).lineWidth(1).moveTo(left, by - 8).lineTo(left + w, by - 8).stroke();
      this.doc.font("Helvetica").fontSize(8).fillColor(INK_SOFT);
      this.doc.text(`Generado el ${stamp}`, left, by, { width: w / 3, lineBreak: false });
      this.doc.text(`Página ${i - range.start + 1} de ${range.count}`, left, by, { width: w, align: "center", lineBreak: false });
      this.doc.text(this.brandText, left, by, { width: w, align: "right", lineBreak: false });

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

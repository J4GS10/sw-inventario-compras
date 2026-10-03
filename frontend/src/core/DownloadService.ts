/**
 * Capa 3 (frontend) - Logica de Aplicacion.
 * Descarga / compartición de documentos. Composicion sobre HttpClient.
 */

import { HttpClient } from "./HttpClient.js";
import { messageOf } from "./errors.js";

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export class DocumentDownloadService {
  private static instance: DocumentDownloadService | undefined;

  private constructor(private readonly http = HttpClient.getInstance()) {}

  public static getInstance(): DocumentDownloadService {
    if (DocumentDownloadService.instance === undefined) {
      DocumentDownloadService.instance = new DocumentDownloadService();
    }
    return DocumentDownloadService.instance;
  }

  /** Descarga el PDF del comparativo de una solicitud. */
  public async descargarComparativoPdf(idSolicitud: number): Promise<void> {
    const blob = await this.http.blob(
      `/api/com/comparativo/solicitud/${idSolicitud}/pdf`,
    );
    triggerDownload(blob, `comparativo-solicitud-${idSolicitud}.pdf`);
  }

  /**
   * Genera y ALMACENA el PDF (S3 si esta configurado; si no, en memoria) y
   * devuelve la URL para compartir.
   */
  public async guardarComparativoPdf(idSolicitud: number): Promise<{
    url: string;
    storage: string;
    filename: string;
  }> {
    return this.http.post<{ url: string; storage: string; filename: string }>(
      `/api/com/comparativo/solicitud/${idSolicitud}/pdf`,
    );
  }

  /** Descarga el PDF de una orden de compra (documento para el proveedor). */
  public async descargarOrdenCompraPdf(idOrdenCompra: number): Promise<void> {
    const blob = await this.http.blob(`/api/com/ordenes-compra/${idOrdenCompra}/pdf`);
    triggerDownload(blob, `orden-compra-${idOrdenCompra}.pdf`);
  }

  /** Descarga la Nota de Ingreso oficial de una Recepcion. */
  public async descargarNotaIngresoPdf(idRecepcion: number): Promise<void> {
    const blob = await this.http.blob(`/api/com/recepciones/${idRecepcion}/pdf`);
    triggerDownload(blob, `nota-ingreso-${idRecepcion}.pdf`);
  }

  /** Descarga el PDF de un reporte (`/api/com/reportes/{reporte}/pdf`). */
  public async descargarReportePdf(
    reporte: "gasto-proveedor" | "oc-pendientes" | "desempeno-proveedores" | "riesgo-proveedores",
    query: Record<string, string>,
  ): Promise<void> {
    const blob = await this.http.blob(`/api/com/reportes/${reporte}/pdf`, query);
    triggerDownload(blob, `${reporte}.pdf`);
  }
}

export const downloadService = DocumentDownloadService.getInstance();
export { messageOf };

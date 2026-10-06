/**
 * Capa 3 - Logica de Negocio / compras.
 *
 * Caso de uso: adjuntar archivos (PDF de la oferta, remision, OC firmada, etc.)
 * a un documento del ciclo de compra. El esquema Oracle esta congelado y no
 * tiene tabla de adjuntos, asi que los binarios viven en el `FileStorage`
 * (Strategy: MinIO/S3 o memoria) y un manifiesto JSON en el mismo storage hace
 * de indice con los metadatos (nombre, tipo, tamano, quien y cuando).
 *
 *   clave binario   : adjuntos/<tipo>/<id>/<uuid>-<nombre-saneado>
 *   clave manifiesto : adjuntos/<tipo>/<id>/_manifest.json
 */

import { randomUUID } from "node:crypto";
import type { AuditContext } from "../../../common/types/AuditContext.js";
import {
  NotFoundError,
  ValidationError,
} from "../../../common/errors/AppError.js";
import {
  fileStorage,
  type FileStorage,
} from "../../../common/storage/FileStorage.js";
import {
  cotizacionRepository,
  devolucionRepository,
  ordenCompraRepository,
  recepcionRepository,
  solicitudRepository,
} from "../../../dal/repositories/com/index.js";

export type TipoDocumentoAdjunto =
  | "solicitud"
  | "cotizacion"
  | "orden"
  | "recepcion"
  | "devolucion";

export interface AdjuntoMeta {
  /** Identificador dentro del documento (ultimo segmento de la clave). */
  readonly ref: string;
  readonly nombre: string;
  readonly mime: string;
  readonly bytes: number;
  readonly subidoPor: number;
  readonly subidoEn: string;
}

interface Manifiesto {
  items: AdjuntoMeta[];
}

const MIME_PERMITIDOS = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

function maxBytes(): number {
  const raw = Number.parseInt(process.env["ADJUNTO_MAX_BYTES"] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 15 * 1024 * 1024;
}

const REPOS: Record<TipoDocumentoAdjunto, () => { findById(id: number): Promise<unknown> }> = {
  solicitud: solicitudRepository,
  cotizacion: cotizacionRepository,
  orden: ordenCompraRepository,
  recepcion: recepcionRepository,
  devolucion: devolucionRepository,
};

const TABLA: Record<TipoDocumentoAdjunto, string> = {
  solicitud: "COM_SOLICITUD_COMPRA",
  cotizacion: "COM_COTIZACION_PROVEEDOR",
  orden: "COM_ORDEN_COMPRA",
  recepcion: "COM_RECEPCION",
  devolucion: "COM_DEVOLUCION_PROVEEDOR",
};

/** Firmas (magic bytes) de los tipos aceptados: el MIME declarado por el cliente no basta. */
const FIRMAS: Record<string, (b: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 1024).toString("latin1").includes("%PDF-"),
  "image/png": (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
};
const EXTENSIONES: Record<string, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
};
/** Extensiones peligrosas: aunque el MIME sea valido, un nombre "factura.pdf.exe" confunde al usuario. */
const EXT_PELIGROSAS = /\.(exe|bat|cmd|com|scr|msi|js|jse|vbs|ps1|sh|jar|html?|svg|php|dll|lnk)(\.|$)/i;

/** Serializa las escrituras del manifiesto de un mismo documento (evita perder subidas simultaneas). */
const COLAS = new Map<string, Promise<unknown>>();
async function enCola<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const previa = COLAS.get(clave) ?? Promise.resolve();
  const sig = previa.catch(() => undefined).then(fn);
  COLAS.set(clave, sig);
  try {
    return await sig;
  } finally {
    if (COLAS.get(clave) === sig) COLAS.delete(clave);
  }
}

function saneNombre(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? "archivo";
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "archivo";
}

function assertRef(ref: string): void {
  if (ref === "" || ref.includes("/") || ref.includes("\\") || ref.includes("..")) {
    throw new ValidationError("Referencia de adjunto inválida");
  }
}

export class AdjuntoService {
  /** Perezoso: el `.env` puede no estar cargado cuando se instancia el servicio. */
  private get storage(): FileStorage {
    return fileStorage();
  }

  private prefijo(tipo: TipoDocumentoAdjunto, id: number): string {
    return `adjuntos/${tipo}/${id}`;
  }

  private claveManifiesto(tipo: TipoDocumentoAdjunto, id: number): string {
    return `${this.prefijo(tipo, id)}/_manifest.json`;
  }

  private async assertDocumento(
    tipo: TipoDocumentoAdjunto,
    id: number,
  ): Promise<void> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("Id de documento inválido");
    }
    const row = await REPOS[tipo]().findById(id);
    if (row === null || row === undefined) {
      throw new NotFoundError(TABLA[tipo], id);
    }
  }

  private async leerManifiesto(
    tipo: TipoDocumentoAdjunto,
    id: number,
  ): Promise<Manifiesto> {
    const buf = await this.storage.get(this.claveManifiesto(tipo, id));
    if (buf === null) return { items: [] };
    try {
      const parsed = JSON.parse(buf.toString("utf8")) as Manifiesto;
      return Array.isArray(parsed.items) ? parsed : { items: [] };
    } catch {
      return { items: [] };
    }
  }

  private async guardarManifiesto(
    tipo: TipoDocumentoAdjunto,
    id: number,
    m: Manifiesto,
  ): Promise<void> {
    await this.storage.save(
      this.claveManifiesto(tipo, id),
      Buffer.from(JSON.stringify(m), "utf8"),
      "application/json",
    );
  }

  public async listar(
    tipo: TipoDocumentoAdjunto,
    id: number,
  ): Promise<readonly AdjuntoMeta[]> {
    await this.assertDocumento(tipo, id);
    const m = await this.leerManifiesto(tipo, id);
    return [...m.items].sort((a, b) => b.subidoEn.localeCompare(a.subidoEn));
  }

  public async subir(
    tipo: TipoDocumentoAdjunto,
    id: number,
    archivo: { nombre: string; mime: string; buffer: Buffer },
    ctx: AuditContext,
  ): Promise<AdjuntoMeta> {
    await this.assertDocumento(tipo, id);

    const mime = archivo.mime.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!MIME_PERMITIDOS.has(mime)) {
      throw new ValidationError(
        `Tipo de archivo no permitido (${mime || "desconocido"}). Se aceptan PDF, PNG o JPG.`,
      );
    }
    if (archivo.buffer.length === 0) {
      throw new ValidationError("El archivo está vacío");
    }
    const max = maxBytes();
    if (archivo.buffer.length > max) {
      throw new ValidationError(
        `El archivo supera el máximo permitido (${Math.round(max / 1024 / 1024)} MB)`,
      );
    }

    if (!(FIRMAS[mime]?.(archivo.buffer) ?? false)) {
      throw new ValidationError("El contenido del archivo no corresponde a su tipo (se esperaba un PDF, PNG o JPG real).");
    }
    const ext = (archivo.nombre.split(".").pop() ?? "").toLowerCase();
    if (!(EXTENSIONES[mime] ?? []).includes(ext) || EXT_PELIGROSAS.test(archivo.nombre)) {
      throw new ValidationError("La extensión del archivo no coincide con su tipo o no está permitida.");
    }

    const nombre = saneNombre(archivo.nombre);
    const ref = `${randomUUID()}-${nombre}`;
    const key = `${this.prefijo(tipo, id)}/${ref}`;
    await this.storage.save(key, archivo.buffer, mime);

    const meta: AdjuntoMeta = {
      ref,
      nombre,
      mime,
      bytes: archivo.buffer.length,
      subidoPor: ctx.userId,
      subidoEn: new Date().toISOString(),
    };
    await enCola(this.claveManifiesto(tipo, id), async () => {
      const m = await this.leerManifiesto(tipo, id);
      m.items.push(meta);
      await this.guardarManifiesto(tipo, id, m);
    });
    return meta;
  }

  public async descargar(
    tipo: TipoDocumentoAdjunto,
    id: number,
    ref: string,
  ): Promise<{ nombre: string; mime: string; buffer: Buffer }> {
    assertRef(ref);
    await this.assertDocumento(tipo, id);
    const m = await this.leerManifiesto(tipo, id);
    const meta = m.items.find((x) => x.ref === ref);
    if (meta === undefined) {
      throw new NotFoundError("ADJUNTO", ref);
    }
    const buffer = await this.storage.get(`${this.prefijo(tipo, id)}/${ref}`);
    if (buffer === null) {
      throw new NotFoundError("ADJUNTO", ref);
    }
    return { nombre: meta.nombre, mime: meta.mime, buffer };
  }

  public async eliminar(
    tipo: TipoDocumentoAdjunto,
    id: number,
    ref: string,
  ): Promise<void> {
    assertRef(ref);
    await this.assertDocumento(tipo, id);
    const m = await this.leerManifiesto(tipo, id);
    const idx = m.items.findIndex((x) => x.ref === ref);
    if (idx < 0) {
      throw new NotFoundError("ADJUNTO", ref);
    }
    m.items.splice(idx, 1);
    await this.storage.remove(`${this.prefijo(tipo, id)}/${ref}`);
    await this.guardarManifiesto(tipo, id, m);
  }
}

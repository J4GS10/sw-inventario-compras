/**
 * Capa 6 - Componentes Comunes.
 * Almacenamiento de archivos. Patron Strategy: la implementacion (S3 o memoria)
 * se elige por configuracion sin que el llamador la conozca. Patron Factory
 * para instanciar la estrategia adecuada. Sin dependencia del negocio.
 */

import { env } from "../config/EnvConfig.js";
import { logger } from "../logging/Logger.js";
import { ServiceUnavailableError } from "../errors/AppError.js";

/**
 * Traduce un fallo del SDK de S3/MinIO a un error semantico. "No hay conexion",
 * credenciales o bucket inexistente NO son un bug del sistema: el usuario debe
 * leer que el ALMACENAMIENTO esta caido (503 reintentable), no "error interno".
 */
export function traducirErrorAlmacenamiento(error: unknown): Error {
  const e = error as { name?: string; code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const texto = `${e.name ?? ""} ${e.code ?? ""} ${e.message ?? ""}`;
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|TimeoutError|socket hang up|getaddrinfo|ERR_SOCKET|NetworkingError|Unable to connect/i.test(texto)) {
    return new ServiceUnavailableError(
      "El almacenamiento de archivos (MinIO) no está disponible. Inícialo con 'pnpm minio' (o iniciar-sistema.bat) y reintenta; el resto del sistema sigue funcionando.",
      { cause: error },
    );
  }
  if (/InvalidAccessKeyId|SignatureDoesNotMatch|AccessDenied|InvalidSecurity/i.test(texto)) {
    return new ServiceUnavailableError(
      "El almacenamiento de archivos rechazo las credenciales configuradas (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).",
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

export interface StoredFile {
  /** URL para descargar/compartir el archivo (presignada en S3). */
  readonly url: string;
  readonly key: string;
  readonly storage: "s3" | "memoria";
}

export interface FileStorage {
  readonly kind: "s3" | "memoria";
  save(key: string, body: Buffer, contentType: string): Promise<StoredFile>;
  /** Recupera el contenido de un archivo (memoria o S3). `null` si no existe. */
  get(key: string): Promise<Buffer | null>;
  /** Borra un archivo. Idempotente: no falla si la clave no existe. */
  remove(key: string): Promise<void>;
  /** Comprueba que el almacenamiento responde (lanza si no). Opcional: memoria siempre responde. */
  ping?(): Promise<void>;
}

/** Fallback en memoria: guarda el ultimo archivo por clave (para dev/pruebas). */
class InMemoryFileStorage implements FileStorage {
  public readonly kind = "memoria" as const;
  private readonly bucket = new Map<string, Buffer>();

  public async save(key: string, body: Buffer): Promise<StoredFile> {
    this.bucket.set(key, body);
    return { url: `/api/files/${encodeURIComponent(key)}`, key, storage: "memoria" };
  }

  public async get(key: string): Promise<Buffer | null> {
    return this.bucket.get(key) ?? null;
  }

  public async remove(key: string): Promise<void> {
    this.bucket.delete(key);
  }
}

/** Estrategia S3 (o compatible: MinIO, LocalStack) via AWS SDK v3. */
class S3FileStorage implements FileStorage {
  public readonly kind = "s3" as const;

  constructor(
    private readonly bucket: string,
    private readonly region: string,
    private readonly endpoint: string | undefined,
    private readonly publicBaseUrl: string | undefined,
  ) {}

  private cached: import("@aws-sdk/client-s3").S3Client | undefined;

  private bucketListo = false;

  /**
   * Un solo cliente por proceso, con TIMEOUTS: sin ellos, con MinIO apagado el SDK
   * reintentaba ~30 s y la pantalla se quedaba "cargando" sin decir nada.
   */
  private async client(): Promise<import("@aws-sdk/client-s3").S3Client> {
    if (this.cached !== undefined) return this.cached;
    const { S3Client } = await import("@aws-sdk/client-s3");
    const { NodeHttpHandler } = await import("@smithy/node-http-handler");
    this.cached = new S3Client({
      region: this.region,
      maxAttempts: 2,
      requestHandler: new NodeHttpHandler({ connectionTimeout: 2500, socketTimeout: 20000 }),
      ...(this.endpoint !== undefined
        ? { endpoint: this.endpoint, forcePathStyle: true }
        : {}),
    });
    return this.cached;
  }

  /** Crea el bucket si no existe (primer arranque con MinIO recien instalado). */
  private async asegurarBucket(): Promise<void> {
    if (this.bucketListo) return;
    const { HeadBucketCommand, CreateBucketCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    try {
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      const st = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (st === 404 || (error as { name?: string }).name === "NotFound") {
        await client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        logger().info("Bucket de adjuntos creado", { bucket: this.bucket });
      } else {
        throw error;
      }
    }
    this.bucketListo = true;
  }

  /** Round-trip real al almacenamiento (readiness). */
  public async ping(): Promise<void> {
    try {
      this.bucketListo = false; // readiness: siempre un round-trip real, no el resultado en cache
      await this.asegurarBucket();
    } catch (error) {
      throw traducirErrorAlmacenamiento(error);
    }
  }

  public async save(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredFile> {
    const { PutObjectCommand, GetObjectCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    let client: import("@aws-sdk/client-s3").S3Client;
    try {
      await this.asegurarBucket();
      client = await this.client();
    } catch (error) {
      throw traducirErrorAlmacenamiento(error);
    }
    try {
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    } catch (error) {
      throw traducirErrorAlmacenamiento(error);
    }

    const url =
      this.publicBaseUrl !== undefined
        ? `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`
        : await getSignedUrl(
            client,
            new GetObjectCommand({ Bucket: this.bucket, Key: key }),
            { expiresIn: 60 * 60 * 24 * 7 },
          );

    return { url, key, storage: "s3" };
  }

  public async get(key: string): Promise<Buffer | null> {
    const { GetObjectCommand, NoSuchKey } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await res.Body?.transformToByteArray();
      return bytes === undefined ? null : Buffer.from(bytes);
    } catch (error) {
      if (
        error instanceof NoSuchKey ||
        (error as { name?: string }).name === "NoSuchKey" ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      ) {
        return null;
      }
      throw traducirErrorAlmacenamiento(error);
    }
  }

  public async remove(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const client = await this.client();
      await client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      throw traducirErrorAlmacenamiento(error);
    }
  }
}

/** Factory: S3 si esta configurado; si no, memoria. Singleton por proceso. */
export class StorageFactory {
  private static instance: FileStorage | undefined;

  public static get(): FileStorage {
    if (StorageFactory.instance !== undefined) return StorageFactory.instance;

    const bucket = process.env["S3_BUCKET"]?.trim();
    if (bucket !== undefined && bucket !== "") {
      const region = process.env["S3_REGION"]?.trim() ?? "us-east-1";
      const endpoint = process.env["S3_ENDPOINT"]?.trim() || undefined;
      const publicBase = process.env["S3_PUBLIC_URL"]?.trim() || undefined;
      logger().info("Almacenamiento de archivos: S3", { bucket, region, endpoint });
      StorageFactory.instance = new S3FileStorage(bucket, region, endpoint, publicBase);
    } else {
      logger().info("Almacenamiento de archivos: en memoria (S3 no configurado)");
      StorageFactory.instance = new InMemoryFileStorage();
    }
    return StorageFactory.instance;
  }

  public static reset(): void {
    StorageFactory.instance = undefined;
  }
}

export function fileStorage(): FileStorage {
  // Toca env() para forzar la validacion temprana de configuracion.
  void env().nodeEnv;
  return StorageFactory.get();
}

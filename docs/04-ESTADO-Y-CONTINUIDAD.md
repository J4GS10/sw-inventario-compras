# Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo

> Reporte del avance sobre `docs/01-ESTADO-Y-CONTINUIDAD.md` (documento vivo).
> Responde a: *"en cotizaciones no se entiende qué se ve; necesito adjuntar PDFs
> y ver los datos clave; que todo se pueda actualizar, editar y eliminar
> lógicamente — un CRUD completo"*.
> Fecha: **2026-09-10**. Verificado contra Oracle 21c + MinIO locales.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| MinIO local instalado y funcionando (S3 para adjuntos) | ✅ |
| Adjuntos de documentos (subir / listar / descargar / eliminar) — Solicitud, Cotización, OC, Recepción | ✅ |
| Pantalla de Cotizaciones: **modal de detalle** (datos clave + líneas con importes + adjuntos) | ✅ |
| Comparativo: encabezados corregidos + leyenda + sugerencia por línea | ✅ |
| **CRUD de documentos del ciclo**: `PUT` + `DELETE` (borrado lógico) con cerrojo por estado | ✅ |
| Catálogos: el CRUD (crear/editar/eliminar lógico) ya existía — se documenta el gating por rol | ✅ (sin cambios) |

**Pruebas:** 8 unitarias + **136 de integración** (128 + 8 nuevas en
`adjuntosYCrud.int.test.ts`), todas verdes. `tsc` estricto limpio (be+fe);
`vite build` OK (72 módulos). `graphify update` (1711 nodos).

> `pnpm --filter backend test:int` ahora necesita, además de Oracle, un
> almacenamiento S3 arriba: `pnpm minio` (o un S3 real). Si S3 no está
> configurado el backend cae a memoria y los tests igual pasan.

---

## 1. Aclaración de dudas del negocio

- **La cotización NO viene de otro módulo.** Se registra en este mismo módulo
  (Compras), pantalla *Cotizaciones → Nuevo*, como respuesta de un proveedor a
  un **RFQ** abierto. Flujo: Solicitud → aprobación ×2 → RFQ (≥3 proveedores) →
  **se registran las cotizaciones** → Comparativo → adjudicar → OC.
- **Quién puede ingresarlas:** el botón *Nuevo* de Cotizaciones exige el permiso
  `COMPRAS_COTIZACION_GESTIONAR`, que entre los usuarios demo solo tienen
  `comprador` y `admin`. Igual para editar catálogos (`COMPRAS_CATALOGO_EDITAR`).
  Los demás roles ven todo en **solo lectura** (es el diseño RBAC; se puede
  aflojar cambiando `database/dml/02_seg_rbac.sql`).
- **Catálogos:** `components/CrudPage.tsx` ya trae Nuevo / Editar / Eliminar
  (borrado lógico "marcado como eliminado") + borrado múltiple, gated por
  `writePerm`. No hacía falta código nuevo; sí faltaba dejarlo claro.

---

## 2. MinIO (almacenamiento de objetos S3)

El DDL está congelado y no tiene tabla de adjuntos ni columna de archivo. Los
binarios van al **`FileStorage`** (patrón Strategy, ya existía) apuntando a
**MinIO**; un **manifiesto JSON** por documento hace de índice con los metadatos.

- **Local sin Docker** — `scripts/minio.ps1` + `pnpm minio`: descarga (una vez)
  el binario oficial de MinIO para Windows a `tools/`, arranca el server
  (`.minio-data/`, API :9000, consola :9001, `minioadmin`/`minioadmin`) y crea el
  bucket `com-adjuntos`. `tools/` y `.minio-data/` están en `.gitignore`.
- **Con Docker** — `docker-compose.yml` gana los servicios `minio` +
  `minio-setup` (crea el bucket y termina); `backend` recibe `S3_ENDPOINT=http://minio:9000`
  y espera a `minio-setup`.
- **`.env`** — nuevas claves: `S3_BUCKET=com-adjuntos`, `S3_REGION=us-east-1`,
  `S3_ENDPOINT=http://localhost:9000`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
  `=minioadmin`, `ADJUNTO_MAX_BYTES=15728640`.
- **`common/storage/FileStorage.ts`** — `S3FileStorage` ya forzaba `forcePathStyle`
  con endpoint (MinIO-ready). Añadido: `get(key)` real para S3 (descarga el objeto
  a Buffer, `null` si no existe) y `remove(key)` en la interfaz y las dos
  estrategias. `AdjuntoService` y `FileStorage` leen `env()` de forma **perezosa**
  (el `.env` puede no estar cargado al evaluar los módulos).

---

## 3. Adjuntos de documentos

| Ruta | Efecto |
|---|---|
| `GET  {base}/:id/adjuntos` | lista los metadatos (`ref`, `nombre`, `mime`, `bytes`, `subidoPor`, `subidoEn`) |
| `POST {base}/:id/adjuntos` | sube un archivo (`multipart/form-data`, campo `file`) → 201 con el metadato |
| `GET  {base}/:id/adjuntos/:ref` | descarga el binario (`Content-Disposition: attachment`) |
| `DELETE {base}/:id/adjuntos/:ref` | elimina el adjunto (storage + manifiesto) → 204 |

`{base}` ∈ `/api/com/{solicitudes, cotizaciones, ordenes-compra, recepciones}`.
**Lectura**: cualquier permiso del flujo. **Escritura**: el permiso de gestión
del documento (`SOLICITUD_CREAR` / `COTIZACION_GESTIONAR` / `OC_GESTIONAR` /
`RECEPCION_GESTIONAR`).

- **`@fastify/multipart`** (dep nueva, plugin oficial) registrado en `app.ts`
  con `limits.fileSize = ADJUNTO_MAX_BYTES` y `files: 1`.
- **`bll/services/com/AdjuntoService.ts`** (nuevo) — genérico sobre el tipo de
  documento. Valida que el documento exista, el `mime` (PDF / PNG / JPG) y el
  tamaño. Claves: binario `adjuntos/<tipo>/<id>/<uuid>-<nombre>`, índice
  `adjuntos/<tipo>/<id>/_manifest.json`. Saneo del nombre y validación de `ref`
  (sin `/` ni `..`) contra path traversal.
- **`presentation/routes/com/adjuntos.ts`** (nuevo) — registra las 4 rutas ×4
  documentos; envuelto en `withTelemetry`.
- **Frontend**:
  - `core/HttpClient.ts` — `upload<T>(path, file)` (FormData, sin fijar
    Content-Type para que el navegador ponga el boundary).
  - `core/CompraServices.ts` — `AdjuntoAppService` (Singleton) + `adjuntoService`;
    `descargar` arma un `<a download>` desde el Blob. `DocumentoAppService` gana
    `obtener` / `actualizar` / `eliminar`.
  - `components/AdjuntosPanel.tsx` (nuevo) — lista + subir (`<input type=file>`) +
    descargar + eliminar, con toasts. Reutilizable.

---

## 4. Pantalla de Cotizaciones más entendible

- **`components/DocumentoDetalle.tsx`** (nuevo) — modal que carga
  `GET {base}/:id` (`{ header, details }`) y muestra: **datos clave de la
  cabecera** con etiquetas legibles de las FK (proveedor, condición de pago,
  moneda, tasa, fechas, estado como chip), la **tabla de líneas con importes
  calculados** (P. neto = precio·(1−desc); Total línea con impuesto; marca de
  adjudicada) y el **`AdjuntosPanel`**. Footer con Editar / Eliminar / Cerrar.
- **`modules/compras/DocumentoList.tsx`** — nuevas acciones de fila:
  - **Detalle** (Solicitud, Cotización, OC, Recepción) → abre `DocumentoDetalle`.
  - **Comparar** (Cotización) → resuelve la solicitud vía `GET /api/com/rfq/:idRfq`
    y salta al Comparativo.
  - **Editar** (Cotización: cabecera; OC: solo en `EMITIDA`) → `DocumentForm` en
    modo edición con el subconjunto de campos permitido.
  - **Eliminar** (todos) → `ConfirmDialog` → `DELETE`; se oculta según el cerrojo
    de estado (`LOCK_ELIMINAR`).
- **`modules/compras/ComparativoView.tsx`** — se corrigieron las **dos columnas
  tituladas "P. neto"** → *P. neto (orig.)* y *P. neto (GTQ)* con `title`
  explicativo; leyenda arriba de las tablas (qué significan los fondos azul /
  verde y la fórmula del neto); por línea sin adjudicar, una **sugerencia**
  ("Sugerencia: <proveedor> — mejor precio neto …").

---

## 5. CRUD de los documentos del ciclo (con cerrojo por estado)

Antes: los documentos del flujo solo tenían **crear** + acciones. Ahora:

| Documento | Editar (`PUT /:id`) | Eliminar lógico (`DELETE /:id`) | Cerrojo |
|---|---|---|---|
| Solicitud | ya existía (cabecera) | **nuevo** | solo `PENDIENTE_JEFE` + alcance del usuario |
| RFQ | ya existía (`fechaLimite`) | **nuevo** | solo `ABIERTO` y sin cotizaciones |
| **Cotización** | **nuevo** (cabecera + reemplazo de líneas opcional) | **nuevo** (cabecera + líneas) | RFQ `ABIERTO` y ninguna línea adjudicada |
| **Orden de compra** | **nuevo** (cabecera: entrega, referencia, moneda, tasa) | **nuevo** | editar solo `EMITIDA`; eliminar `EMITIDA`/`CANCELADA`/`RECHAZADA` |
| Recepción | — (mueve kardex/CxP) | **nuevo** | solo `RECIBIDO` (aún no alimentó CxP) |
| Devolución | — | **nuevo** | solo el mismo día en que se registró |

- `BaseHeaderDetailRepository.softDeleteWithDetails(id, ctx, conn?)` (nuevo) —
  borrado lógico de cabecera + todas sus líneas en una transacción.
- Servicios: `CotizacionService.{actualizar,eliminar}` +
  `assertEditable` (privado); `OrdenCompraService.{actualizar,eliminar}`;
  `RecepcionService.eliminar`; `DevolucionProveedorService.eliminar`;
  `SolicitudCompraService.eliminar`; `RfqService.eliminar`.
- Los cerrojos lanzan `BusinessRuleError` (**HTTP 409**); el frontend lo muestra
  como conflicto con el mensaje.
- Rutas en `presentation/routes/com/transaccional.ts`.

---

## 6. Verificación

```bash
pnpm minio                                  # MinIO local :9000 + bucket com-adjuntos
pnpm db:deploy                              # sin cambios de DDL/DML
pnpm -r typecheck                           # limpio (be + fe)
pnpm --filter backend test                  # 8/8
pnpm --filter backend test:int              # 136/136  (necesita Oracle + MinIO)
pnpm --filter frontend build               # tsc -b + vite build OK (72 módulos)
graphify update .                           # 1711 nodos
```

`tests/adjuntosYCrud.int.test.ts` (8): sube un PDF a una cotización y lo lista /
descarga / elimina contra **MinIO real**; rechaza `text/plain` (422); 404 en
cotización inexistente; `PUT` de cabecera con RFQ `ABIERTO` (200); `DELETE` sin
adjudicar (200 → luego `GET` 404); tras adjudicar, `PUT` y `DELETE` → **409**.

Sistema levantado y verificado por HTTP: backend `:3000`, frontend `:8443`,
`GET /api/com/cotizaciones/:id/adjuntos` responde por el proxy; objetos
`adjuntos/cotizacion/<id>/_manifest.json` visibles en la consola de MinIO
(`:9001`).

Fix colateral: `@fastify/multipart` estrechó un overload de `.on` en
`PdfBuilder` (PDFKit) — resuelto casteando el doc a `NodeJS.EventEmitter` para
registrar los listeners `data`/`end`.

---

## 7. Puntos de entrada nuevos

| Necesito… | Archivo |
|---|---|
| MinIO local | `scripts/minio.ps1`, `pnpm minio`, `docker-compose.yml` (servicios `minio` / `minio-setup`) |
| Config de storage | `.env` (`S3_*`, `AWS_*`, `ADJUNTO_MAX_BYTES`), `common/storage/FileStorage.ts` |
| Adjuntos (lógica) | `backend/src/bll/services/com/AdjuntoService.ts` |
| Adjuntos (rutas) | `backend/src/presentation/routes/com/adjuntos.ts` |
| Adjuntos (frontend) | `frontend/src/components/AdjuntosPanel.tsx`, `core/CompraServices.ts::AdjuntoAppService`, `core/HttpClient.ts::upload` |
| Detalle de documento | `frontend/src/components/DocumentoDetalle.tsx` |
| CRUD de documentos | `*Service.ts::{actualizar,eliminar}`, `BaseHeaderDetailRepository.softDeleteWithDetails`, `routes/com/transaccional.ts` |

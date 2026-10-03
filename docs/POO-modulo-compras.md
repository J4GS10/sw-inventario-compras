# Validación POO — Módulo de Gestión de Compras (COM_)

Este documento verifica, uno a uno, que **todos** los conceptos de POO y patrones
GoF exigidos por `skills/patron-arquitectura.md` están aplicados de forma
profesional en el módulo de compras, y señala el archivo/clase donde vive cada uno.

Rutas relativas a `backend/src/`.

---

## 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)

### Abstracción

- **De datos**: cada tabla se modela una sola vez como `EntityDescriptor`
  (`entities/support/EntityDescriptor.ts`) — atributos esenciales, tipos, nulabilidad,
  enums. Las 26 tablas COM_ en `entities/com/descriptors.ts`.
- **De procedimientos**: contratos por interfaz que ocultan la implementación:
  - `dal/contracts/IRepository.ts` — el CRUD como interfaz pura; la BLL nunca ve SQL.
  - `dal/contracts/IHeaderDetailRepository.ts` — operaciones cabecera/detalle.
  - `bll/pricing/PriceStrategy.ts` — resolver un precio sin saber cómo.
- La capa de presentación llama métodos de dominio (`ordenes.crear(...)`), no
  fragmentos de SQL ni `req/res` filtrándose hacia abajo.

### Generalización (extracción a clases base e interfaces)

| Clase base genérica | Archivo | Elimina duplicación de |
|---|---|---|
| `BaseOracleRepository<TEntity,TCreate,TUpdate>` | `dal/repositories/BaseOracleRepository.ts` | todo el CRUD + SQL + binds + mapeo de filas + OCC + soft-delete |
| `BaseHeaderDetailRepository<...>` | `dal/repositories/BaseHeaderDetailRepository.ts` | alta/lectura/reemplazo cabecera+detalle en una transacción |
| `CrudRepository` / `HeaderDetailRepository` | mismos directorios | concreción sin escribir una clase por tabla |
| `BaseCrudService<TEntity>` | `bll/services/BaseCrudService.ts` | validar → hooks → repo, para 14 recursos |
| `TransactionalService` | `bll/support/TransactionalService.ts` | el esqueleto de transacción + publicación diferida de eventos |
| `BaseCrudController<TEntity>` | `presentation/controllers/BaseCrudController.ts` | los 5 handlers REST y el sobre de respuesta |
| `StateMachine<TState>` | `bll/support/StateMachine.ts` | validación de transiciones (4 documentos la reutilizan) |

Resultado medible: un catálogo nuevo = **1 descriptor + 1 fila de ruta + 1 config
de UI**, ~15 líneas, sin CRUD ni SQL.

### División de problemas y modularidad

- Un archivo = una responsabilidad. Servicios de flujo separados por documento:
  `SolicitudCompraService`, `RfqService`, `CotizacionService`, `OrdenCompraService`,
  `RecepcionService`, `DevolucionProveedorService` (`bll/services/com/`).
- Suscriptores de efectos colaterales aislados y sustituibles:
  `bll/compras/subscribers/kardexSubscriber.ts`, `cxpSubscriber.ts`.

### Alta cohesión y bajo acoplamiento

- El módulo de compras **no importa** código de INV_ ni CXP_. Publica el evento
  `RecepcionRegistrada` (`bll/events/domainEvents.ts`) y quien reaccione es
  problema de otro módulo → acoplamiento cero hacia inventario y cuentas por pagar.
- `oracledb` se importa **solo** en `dal/` (verificable con
  `grep -R "oracledb" src/bll src/presentation` → sin resultados).

### Encapsulación

- Estado y reglas encapsulados: las transiciones válidas viven dentro de
  `StateMachine` (mapa privado `transitions`); nadie las duplica.
- `BaseOracleRepository` mantiene privados los constructores de SQL; expone solo
  el contrato `IRepository` + primitivas `insertRow`/`pkProp` para composición.
- `EnvConfig`, `Logger`, `OraclePool`, `DomainEventBus` tienen constructor privado
  (Singleton) — no se pueden instanciar por fuera.

### Herencia vs. composición (ambas, donde corresponde)

- **Herencia** (relación "es-un", esqueleto invariable):
  `OrdenCompraService extends TransactionalService`,
  `CrudRepository extends BaseOracleRepository`,
  `HeaderDetailRepository extends BaseHeaderDetailRepository`.
- **Composición** (relación "usa-un", intercambiable):
  `OrdenCompraService` recibe un `PriceResolver` por constructor;
  `PriceResolver` recibe su lista de `PriceStrategy`;
  los servicios **componen** repositorios (`this.repo = ordenCompraRepository()`),
  no heredan de ellos.

### Polimorfismo

- `PriceStrategy` con 3 implementaciones intercambiables
  (`CotizacionAdjudicadaStrategy`, `AcuerdoMarcoStrategy`, `UltimaCompraStrategy`)
  — `PriceResolver` las trata de forma uniforme.
- `IRepository` implementado por `BaseOracleRepository` y sus subclases; la BLL
  depende del tipo del contrato, no de la clase concreta.

---

## 2. Patrones GoF (`skills/patron-arquitectura.md` §4)

### Creacionales

| Patrón | Dónde | Evidencia |
|---|---|---|
| **Singleton** | `dal/OraclePool.ts`, `common/config/EnvConfig.ts`, `common/logging/Logger.ts`, `common/events/DomainEventBus.ts` | constructor `private`, `getInstance()` con instancia única |
| **Factory Method** | `dal/repositories/RepositoryFactory.ts` | `get(key)` devuelve/instancia el repo según la clave lógica; permite `register(key, builder)` para especializaciones |
| **Object Pool** | `dal/OraclePool.ts` | `oracledb.createPool()` con `poolMin/poolMax/poolIncrement/poolTimeout`; `getConnection()` / `close()` reciclan conexiones |

### Estructurales

| Patrón | Dónde | Evidencia |
|---|---|---|
| **Adapter** | `common/errors/OracleErrorAdapter.ts` | traduce `ORA-00001/02291/02290/...` a `ConflictError/ForeignKeyError/ValidationError`; ninguna capa superior conoce códigos ORA |
| **Facade** | `bll/services/com/OrdenCompraService.ts` (`crear`), `RecepcionService.ts` (`registrar`) | una llamada coordina Strategy de precio + cabecera/detalle + avance de estado de la solicitud/OC + evento |
| **Decorator** | `bll/support/decorators/withTelemetry.ts` | `Proxy` que mide y registra la duración de cada método async sin tocar el servicio; aplicado en `presentation/routes/com/transaccional.ts` |

### De comportamiento

| Patrón | Dónde | Evidencia |
|---|---|---|
| **Strategy** | `bll/pricing/PriceResolver.ts` + `bll/pricing/strategies/*` | resolución de precio por acuerdo marco / cotización adjudicada / última compra, intercambiable en runtime — análogo a FIFO/Promedio del inventario |
| **Template Method** | `dal/OraclePool.ts` (`withTransaction`), `bll/support/TransactionalService.ts` (`runInTransaction`), `bll/services/BaseCrudService.ts` (`create/update` con hooks `beforeX/afterX`) | esqueleto fijo abrir→ejecutar→commit/rollback→cerrar; la subclase solo aporta el algoritmo interno |
| **Observer** | `common/events/DomainEventBus.ts` + `bll/compras/subscribers/{kardex,cxp}Subscriber.ts` | `RecepcionRegistrada` dispara alta en `INV_KARDEX_MOVIMIENTO` y generación de `CXP_FACTURA_PROVEEDOR`, desacoplados; los eventos se publican **solo tras commit** |

### Refuerzos de diseño presentes además del catálogo mínimo

- **Repository + Inyección de dependencias** (`skills/patron-diseno.md` §6): contratos en
  `dal/contracts/`, implementación inyectable vía `RepositoryFactory` y por constructor
  en los servicios.
- **DTO / validación de esquema en Presentación**: `common/validation/descriptorValidation.ts`
  (validación dirigida por descriptor) y `common/validation/validators.ts`
  (`validateDto` con class-validator para reglas ricas).
- **Bloqueo optimista (OCC)**: columna `VERSION` respetada por
  `BaseOracleRepository.updateRow` → `OptimisticLockError` (HTTP 409) en
  `COM_SOLICITUD_COMPRA`, `COM_ORDEN_COMPRA`, `COM_COTIZACION_DETALLE`, etc.
- **Manejo de la FK circular** `COM_RECEPCION ↔ CXP_FACTURA_PROVEEDOR` en dos pasos
  dentro de una transacción (`cxpSubscriber.ts`).
- **Columna VIRTUAL de Oracle** `SUBTOTAL_CALCULADO` marcada solo-lectura en el
  descriptor y nunca enviada en INSERT/UPDATE.

---

## 3. Modelo de lectura / trazabilidad (Fase 5)

Separación lectura/escritura (CQRS-lite) para respuesta rápida:

- `dal/repositories/com/CompraReadRepository.ts` — SQL parametrizado con joins
  sobre columnas FK indexadas (fase 3 del DDL). No pasa por `BaseOracleRepository`
  porque su responsabilidad es distinta (agregados de lectura, no CRUD).
  - `cotizacionesComparadas(idSolicitud)` — las N cotizaciones de cada línea con
    precio neto en moneda origen y en GTQ, total de línea con impuesto.
  - `criteriosComparativos(idSolicitud)` — los criterios que registró el director,
    con nombre de proveedor (trazabilidad completa de la decisión).
  - `historialPrecios(query)` — lee `VW_COM_PRECIO_HISTORIAL` + join a
    `INV_ARTICULO`/`COM_PROVEEDOR`, paginado (`OFFSET/FETCH`) y con un `resumen`
    agregado (min/max/promedio/cantidad) en una segunda consulta.
  - `comprasPorMesOc` / `valorEntradasPorMes` / `existenciaValorizada` /
    `ahorroAdjudicacion` — agregados del dashboard (series por
    `TRUNC(fecha,'MM')`, CTE para el ahorro). Los orquesta
    `bll/services/com/DashboardService.ts` (solo lectura, rellena la rejilla de
    meses); ruta `GET /api/com/dashboard/resumen`. Ver `docs/03-ESTADO-Y-CONTINUIDAD.md`.
- `bll/services/com/ComparativoService.ts` — agrupa por línea, marca el mejor
  precio y la adjudicada, valida y persiste criterios
  (`COM_COMPARATIVO_COTIZACIONES`).
- `presentation/routes/com/analitica.ts` — `GET /api/com/comparativo/solicitud/:id`,
  `.../criterios`, `POST /api/com/comparativo/criterios`, `GET /api/com/historial-precios`.
- Frontend: `modules/compras/ComparativoView.tsx` (3 cotizaciones lado a lado,
  mejor precio y adjudicada resaltadas, alta de criterios, botón Adjudicar),
  `modules/compras/HistorialProveedorView.tsx` (filtros + KPIs + tabla paginada).

## 3-bis. POO en el FRONTEND (`frontend/src/`)

El frontend replica las 6 capas y los mismos conceptos, en TypeScript estricto.

### Principios POO

| Concepto | Dónde |
|---|---|
| **Abstracción por contrato** | `core/Repository.ts` → `IRepository<T>`; la UI depende de él, nunca de `fetch`. |
| **Generalización / clases base** | `HttpRepository<T>` (CRUD completo), `RestRepository<T>` (concreción), `CrudService<T>` (caso de uso genérico), `DataTable<T>`, `Field` por `FieldKind`. |
| **Encapsulación** | `HttpClient` (constructor privado, Singleton), `EventBus` (mapa de handlers privado), `RepositoryFactory` (caché privada). |
| **Herencia** | `RestRepository extends HttpRepository`. |
| **Composición** | `CrudService` recibe un `IRepository` por constructor; `ComparativoAppService` compone `HttpClient` + `DocumentDownloadService`. |
| **Polimorfismo** | Cualquier `IRepository<T>` es intercambiable; `AppError` y subclases tratadas de forma uniforme por `messageOf`/`isAppError`. |
| **Bajo acoplamiento** | Las pantallas usan hooks (`useResource`) que hablan con servicios; no conocen rutas ni `fetch`. |

### Patrones GoF

| Patrón | Dónde |
|---|---|
| **Singleton** | `HttpClient`, `EventBus`, `RepositoryFactory`, `DocumentDownloadService`, `ComparativoAppService`, `HistorialAppService`. |
| **Factory Method** | `RepositoryFactory.for(basePath)` (una instancia por recurso, cacheada); `catalogService(...)`. |
| **Template Method** | `HttpClient.request()` (construir → fetch → mapear → desempaquetar); `CrudService.create/update/remove` (hook → repo → evento). |
| **Adapter** | `HttpClient.mapError(status, body)` traduce respuestas HTTP a la jerarquía `AppError`. |
| **Facade** | `ComparativoAppService` (lectura + adjudicación + criterios + PDF en una sola API); `apiClient.ts` es fachada de compatibilidad sobre `HttpClient`. |
| **Observer** | `EventBus` — `CrudService` emite `EntityCreated/Updated/Removed`; `useResource` se resuscribe y recarga la lista al vuelo. |
| **Builder** (backend) | `common/pdf/PdfBuilder.ts` — API fluida sobre PDFKit para componer el PDF del comparativo. |
| **Strategy** (backend) | `common/storage/FileStorage.ts` — `S3FileStorage` / `InMemoryFileStorage` elegidas por `StorageFactory` según `.env`. |

> **Por qué `modules/`/`components/`/`ui/` son funciones y no clases**: React
> exige componentes función (o al menos los hooks lo exigen); las CLASES de la
> app viven exactamente donde SÍ deben estar — `core/` (Capa 2+3, servicios,
> repos, `EventBus`, `HttpClient`) — y los componentes las **componen** por
> constructor/import, nunca reimplementan su lógica. Ejemplo reciente:
> `AsistenteCotizacion.tsx` (asistente guiado RFQ→cotización, 2026-09-11) es
> una función (como exige `patron-arquitectura.md` "un `export default
> function` por archivo"), pero orquesta objetos ya existentes de la capa POO
> (`DocumentForm`/`DOCUMENT_FORMS`, `http` como fachada sobre `HttpClient`) sin
> añadir SQL, rutas nuevas ni una sola clase — la generalización ya hecha en
> `core/`+`components/` es precisamente lo que evita que un caso de uso nuevo
> necesite "programación mayor".

### Capas del frontend

```
src/core/         Capa 2+3: HttpClient, errors, EventBus, Repository, CrudService, servicios de app
src/hooks/        Capa 4: adaptadores React ↔ servicios (useResource)
src/ui/           Capa 4: sistema de diseño (Button, DataTable, Field, Modal, FilterBar, AppShell…)
src/components/   Capa 4: piezas compuestas (CrudPage, DocumentForm)
src/modules/      Capa 4: pantallas por área funcional
src/nav.ts        modelo de navegación del sistema
```

### Exportación PDF + S3

- `GET  /api/com/comparativo/solicitud/:id/pdf` → descarga directa (`application/pdf`).
- `POST /api/com/comparativo/solicitud/:id/pdf` → genera, **almacena** (S3 si
  `S3_BUCKET` está configurado; si no, en memoria) y devuelve `{ url, storage }`.
- Frontend: botones **Descargar PDF** / **Compartir PDF** en `ComparativoView`
  (`DocumentDownloadService`).
- Config S3 en `.env` (`S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` opcional para
  MinIO/LocalStack, `S3_PUBLIC_URL` opcional, `AWS_ACCESS_KEY_ID/SECRET`). Sin
  configurar → fallback a memoria con descarga por `/api/files/:key`.

## 4. Cobertura del flujo completo

`Solicitud → Aprobación (n niveles) → RFQ → Cotización → Adjudicación →
Orden de Compra (precio por Strategy) → cambios de estado (StateMachine) →
Recepción → (Observer) Kardex + CxP → Devolución`, más el comparativo y el
historial, verificados extremo a extremo contra Oracle 21c:

> Nota (2026-09-11): la tabla de abajo quedó desactualizada en cifras (creció
> a **168 casos de integración** en 14 archivos — reconciliación del bus de
> eventos, alcance por departamento, adjuntos, PDF, regresiones, RBAC — y a
> **más de 9 catálogos** con la incorporación de Seguimiento/Excepciones de OC
> y Artículo-Proveedor). La estructura y los patrones que describe siguen
> vigentes; ver `docs/01-ESTADO-Y-CONTINUIDAD.md` para el detalle cronológico
> completo de cada bloque.

| Suite | Casos | Cubre |
|---|---|---|
| `tests/catalogsCrud.int.test.ts` | 55 | catálogos × (crear, leer/filtrar, actualizar, borrar+404, 422) |
| `tests/com.int.test.ts` | 7 | CRUD genérico + OCC + auth sobre `COM_PROVEEDOR` |
| `tests/comFlujo.int.test.ts` | 11 | flujo transaccional completo + Observer |
| `tests/comparativo.int.test.ts` | 11 | 3 cotizaciones, criterios, adjudicación, historial con fechas |
| `tests/regresiones.int.test.ts` | 4 | POST de acción sin cuerpo; auditoría con usuario real; cotización contra RFQ cerrado (409) |
| `tests/referencias.int.test.ts` | 7 | endpoints de referencia para selects |
| `tests/pdf.int.test.ts` | 3 | PDF del comparativo: descarga directa + almacenamiento |
| `tests/auth.int.test.ts` | 24 | RBAC por rol, alcance por departamento en lectura/acción |
| `tests/reconciliacion.int.test.ts` | 6 | detección y reparación del bus de eventos sin outbox |
| (+5 archivos más: adjuntos, alcance de depto, devolución/reversa, dashboard, actualización de documentos) | 40 | ver `docs/01` §5 por bloque |
| **Total integración** | **168** | `pnpm --filter backend test:int` |
| `tests/*.test.ts` (unitarios) | 8 | `StateMachine`, validación por descriptor |

---

## 4. Cómo se sostiene "limpio, ordenado y profesional"

- TypeScript estricto, `any` prohibido (`tsconfig` con `strict`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`); `tsc --noEmit` limpio.
- Una clase / una responsabilidad; nombres de dominio en español consistentes con
  el DDL; comentarios de cabecera que declaran capa y patrón.
- Errores siempre semánticos (`AppError`) resueltos por un único middleware
  (`presentation/middlewares/errorHandler.ts`); nunca se filtra un stack o un ORA-.
- Sin dependencias circulares entre capas; el flujo es unidireccional
  Presentación → BLL → DAL → BD, con Entidades y Comunes transversales.

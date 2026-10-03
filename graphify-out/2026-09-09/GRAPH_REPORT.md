# Graph Report - sw-inventario  (2026-09-09)

## Corpus Check
- 128 files · ~67,113 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1253 nodes · 2835 edges · 67 communities (52 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- SEG_USUARIO
- descriptorHelpers.ts
- authGuard.ts
- Repository.ts
- HttpClient
- backend/package.json
- AuditContext
- frontend/package.json
- com/descriptors.ts
- Compras e Inventario · Módulo ERP
- compilerOptions
- Descripción de las 6 Capas
- compilerOptions
- scripts
- BaseOracleRepository
- StateMachine
- deploy.ts
- Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)
- primitives.tsx
- catalogPages.tsx
- OrdenCompraService.ts
- CLAUDE.md
- GEMINI.md
- repositoryFactory
- HttpClient.ts
- transaccional.ts
- analitica.ts
- mapOracleError
- WithDetails
- 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)
- SolicitudCompraService
- authGuard
- app.ts
- AppShell.tsx
- oraclePool
- stateMachines.ts
- BusinessRuleError
- CrudPage.tsx
- fastify
- messageOf
- useResource.ts
- sw-inventario · Módulo de Compras (COM_)
- Toast.tsx
- routes/com/index.ts
- nav.ts
- OrdenCompraService
- ValidationError
- referencias.ts
- parseListQuery.ts
- documentForms.ts
- CompraServices.ts
- logger
- Icon.tsx
- react
- descriptorValidation.test.ts
- CompraReadRepository.ts
- CrudService
- DataTable.tsx
- ComparativoAppService
- BaseOracleRepository.ts
- DocumentDownloadService
- Dashboard.tsx

## God Nodes (most connected - your core abstractions)
1. `SEG_USUARIO` - 104 edges
2. `AuditContext` - 56 edges
3. `ValidationError` - 43 edges
4. `NotFoundError` - 37 edges
5. `logger` - 32 edges
6. `oraclePool` - 32 edges
7. `NOM_EMPLEADO` - 32 edges
8. `BaseOracleRepository` - 30 edges
9. `HttpClient` - 29 edges
10. `PageQuery` - 24 edges

## Surprising Connections (you probably didn't know these)
- `confirmDelete()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/core/errors.ts
- `buildApp()` --indirect_call--> `errorHandler()`  [INFERRED]
  backend/src/app.ts → backend/src/presentation/middlewares/errorHandler.ts
- `buildApp()` --calls--> `registerComAnaliticaRoutes()`  [EXTRACTED]
  backend/src/app.ts → backend/src/presentation/routes/com/analitica.ts
- `buildApp()` --calls--> `registerComRoutes()`  [EXTRACTED]
  backend/src/app.ts → backend/src/presentation/routes/com/index.ts
- `buildApp()` --calls--> `registerComFlujoRoutes()`  [EXTRACTED]
  backend/src/app.ts → backend/src/presentation/routes/com/transaccional.ts

## Import Cycles
- None detected.

## Communities (67 total, 10 thin omitted)

### Community 0 - "SEG_USUARIO"
Cohesion: 0.07
Nodes (103): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+95 more)

### Community 1 - "descriptorHelpers.ts"
Cohesion: 0.20
Nodes (11): AuditMode, buildDescriptor(), camelPk(), col(), ColOpts, CREATED_AUDIT_COLUMNS, MODIFIED_AUDIT_COLUMNS, pkCol() (+3 more)

### Community 2 - "authGuard.ts"
Cohesion: 0.30
Nodes (9): base64url(), fromBase64url(), JwtPayload, signJwt(), verifyJwt(), UnauthorizedError, fastify, FastifyRequest (+1 more)

### Community 3 - "Repository.ts"
Cohesion: 0.11
Nodes (7): Page, QueryParams, HttpRepository, IRepository, ListQuery, repositoryFactory, RestRepository

### Community 5 - "backend/package.json"
Cohesion: 0.05
Nodes (41): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-transformer, class-validator, fastify, oracledb, pdfkit (+33 more)

### Community 6 - "AuditContext"
Cohesion: 0.13
Nodes (5): BaseCrudService, AuditContext, validateDto(), IHeaderDetailRepository, IRepository

### Community 7 - "frontend/package.json"
Cohesion: 0.06
Nodes (31): dependencies, react, react-dom, devDependencies, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom (+23 more)

### Community 8 - "com/descriptors.ts"
Cohesion: 0.07
Nodes (25): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+17 more)

### Community 9 - "Compras e Inventario · Módulo ERP"
Cohesion: 0.07
Nodes (29): 10. Pantalla — Formularios de producto, 10 pestañas, 11. Experiencia interactiva y accesibilidad (UX Intuitivo), 1. Agenda, 2. Objetivo y principios de diseño, 3. Sistema de diseño — Paleta de color, 4. Tipografía e iconografía, 5. Arquitectura de la interfaz (+21 more)

### Community 10 - "compilerOptions"
Cohesion: 0.08
Nodes (23): compilerOptions, declaration, emitDecoratorMetadata, esModuleInterop, exactOptionalPropertyTypes, experimentalDecorators, forceConsistentCasingInFileNames, lib (+15 more)

### Community 11 - "Descripción de las 6 Capas"
Cohesion: 0.10
Nodes (20): 1.1 Diseño Lógico frente a Diseño Físico, 1.2 Principios Fundamentales de POO, 1. Fundamentos de Análisis y Diseño de Sistemas, 2. Calidades Sistémicas (QoS) y Rol Arquitectónico, 3. Modelo de Arquitectura de 6 Capas, 4.1 Patrones Creacionales (Abstracción de Creación), 4.2 Patrones Estructurales (Composición de Clases), 4.3 Patrones de Comportamiento (Algoritmos y Asignación) (+12 more)

### Community 12 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+11 more)

### Community 13 - "scripts"
Cohesion: 0.12
Nodes (16): description, engines, node, name, packageManager, private, scripts, build (+8 more)

### Community 14 - "BaseOracleRepository"
Cohesion: 0.15
Nodes (6): FilterCondition, asBinds(), auditUser(), BaseOracleRepository, ColumnDescriptor, findColumn()

### Community 15 - "StateMachine"
Cohesion: 0.24
Nodes (4): StateMachine, ORDEN_COMPRA_ESTADOS, OcEstado, ocMachine

### Community 16 - "deploy.ts"
Cohesion: 0.31
Nodes (10): countAllTables(), countComTables(), EnvVars, HERE, loadEnv(), main(), REPO_ROOT, runFullDdl() (+2 more)

### Community 17 - "Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)"
Cohesion: 0.29
Nodes (6): 1. División Estructural del Repositorio, 2. Definición del Stack Tecnológico, 3. Especificaciones de la Base de Datos (Oracle 21c), 4. Arquitectura y Escalabilidad con Docker, 5. Reglas Técnicas de Frontend (React + Vite + Tailwind v4), Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)

### Community 18 - "primitives.tsx"
Cohesion: 0.14
Nodes (8): ButtonVariant, Chip, ChipTone, EstadoChip(), Tone, TONE_BG, TONE_FG, toneForEstado()

### Community 19 - "catalogPages.tsx"
Cohesion: 0.33
Nodes (3): CATALOG_CONFIGS, estadoAI, Row

### Community 21 - "OrdenCompraService.ts"
Cohesion: 0.11
Nodes (30): ordenCompraStateMachine, solicitudStateMachine, ComEventName, ComEvents, OrdenCompraEstadoPayload, RecepcionRegistradaPayload, SolicitudAprobacionPayload, CotizacionHeader (+22 more)

### Community 27 - "repositoryFactory"
Cohesion: 0.18
Nodes (15): defaultPriceResolver, PriceResolver, PriceQuery, PriceResult, PriceStrategy, Acuerdo, AcuerdoDetalle, AcuerdoMarcoStrategy (+7 more)

### Community 28 - "HttpClient.ts"
Cohesion: 0.20
Nodes (10): downloadService, AppError, ConflictError, ErrorDetail, NetworkError, NotFoundError, ServerError, UnauthorizedError (+2 more)

### Community 29 - "transaccional.ts"
Cohesion: 0.12
Nodes (16): DevolucionDetalle, LineaInput, SYSTEM_AUDIT_CONTEXT, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PageQuery, Paginated, SortOrder (+8 more)

### Community 30 - "analitica.ts"
Cohesion: 0.05
Nodes (26): ComparativoPdfService, money(), ComparativoService, ComparativoSolicitud, PdfBuilder, PdfColumn, fileStorage, InMemoryFileStorage (+18 more)

### Community 31 - "mapOracleError"
Cohesion: 0.17
Nodes (8): AppError, ConflictError, ForeignKeyError, InternalError, OptimisticLockError, asOracleError(), mapOracleError(), OracleErrorShape

### Community 32 - "WithDetails"
Cohesion: 0.18
Nodes (6): CotizacionService, DevolucionProveedorService, TransactionScope, WithDetails, CotizacionDetalle, DevolucionProveedor

### Community 33 - "1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)"
Cohesion: 0.09
Nodes (22): 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2), 2. Patrones GoF (`skills/patron-arquitectura.md` §4), 3-bis. POO en el FRONTEND (`frontend/src/`), 3. Modelo de lectura / trazabilidad (Fase 5), 4. Cobertura del flujo completo, 4. Cómo se sostiene "limpio, ordenado y profesional", Abstracción, Alta cohesión y bajo acoplamiento (+14 more)

### Community 34 - "SolicitudCompraService"
Cohesion: 0.33
Nodes (4): SolicitudCompraService, SoftDelete, SolicitudCompra, SolicitudDetalle

### Community 35 - "authGuard"
Cohesion: 0.28
Nodes (7): ForbiddenError, authGuard(), DocumentoService, envelope(), idParam(), registerComFlujoRoutes(), registrarLecturas()

### Community 36 - "app.ts"
Cohesion: 0.19
Nodes (9): buildApp(), isAppError(), errorHandler(), registerComReferenciaRoutes(), envRaw, H, envRaw, H (+1 more)

### Community 37 - "AppShell.tsx"
Cohesion: 0.23
Nodes (9): container, MODULES, SystemModule, AppShell(), cycleTheme(), applyTheme(), getTheme(), initTheme() (+1 more)

### Community 39 - "stateMachines.ts"
Cohesion: 0.20
Nodes (9): OrdenCompraEstado, RecepcionEstado, RfqEstado, rfqStateMachine, SOLICITUD_NIVEL, SolicitudEstado, RECEPCION_ESTADOS, RFQ_ESTADOS (+1 more)

### Community 40 - "BusinessRuleError"
Cohesion: 0.31
Nodes (4): RecepcionService, BusinessRuleError, Recepcion, RecepcionDetalle

### Community 41 - "CrudPage.tsx"
Cohesion: 0.07
Nodes (32): api, CrudFieldDef, CrudPage(), confirmDelete(), openCreate(), openEdit(), save(), CrudPageConfig (+24 more)

### Community 42 - "fastify"
Cohesion: 0.15
Nodes (19): cases, CrudCase, ids, RefIds, ensureBodega(), Ids, inTwoWeeks, PRECIOS (+11 more)

### Community 43 - "messageOf"
Cohesion: 0.21
Nodes (14): ApiRequestError, client, guard(), toApiRequestError(), isAppError(), messageOf(), ComparativoView(), adjudicar() (+6 more)

### Community 44 - "useResource.ts"
Cohesion: 0.17
Nodes (10): CrudServiceOptions, AppEventName, AppEvents, EntityChangedPayload, eventBus, Handler, ToastPayload, PageMeta (+2 more)

### Community 45 - "sw-inventario · Módulo de Compras (COM_)"
Cohesion: 0.40
Nodes (4): La tesis POO: configurar, no programar, Pruebas, Puesta en marcha, sw-inventario · Módulo de Compras (COM_)

### Community 46 - "Toast.tsx"
Cohesion: 0.18
Nodes (5): Ctx, ToastApi, ToastItem, ToastTone, TONE

### Community 47 - "routes/com/index.ts"
Cohesion: 0.18
Nodes (8): buildCrudService(), ComEntityKey, CrudService, CRUD_RESOURCES, CrudResource, registerComRoutes(), CrudRouteConfig, registerCrudRoutes()

### Community 48 - "nav.ts"
Cohesion: 0.19
Nodes (7): App(), ALL_LEAVES, COMPRAS_MODULE, COMPRAS_SECTIONS, NavLeaf, NavSection, ViewKind

### Community 49 - "OrdenCompraService"
Cohesion: 0.29
Nodes (4): OrdenCompraService, OrdenCompra, OrdenCompraDetalle, OrdenCompraEstado

### Community 50 - "ValidationError"
Cohesion: 0.18
Nodes (11): CotizacionEnComparativo, LineaComparativo, RfqService, ErrorCode, ErrorDetail, NotFoundError, ValidationError, checkValue() (+3 more)

### Community 51 - "referencias.ts"
Cohesion: 0.23
Nodes (11): CrudRepository, articuloRepository(), CXP_FACTURA_PROVEEDOR, INV_ARTICULO, INV_BODEGA, INV_EXISTENCIA_BODEGA, INV_KARDEX_MOVIMIENTO, INV_UNIDAD_MEDIDA (+3 more)

### Community 52 - "parseListQuery.ts"
Cohesion: 0.25
Nodes (8): FilterOperator, readOnlyList(), listQuery(), first(), OPERATORS, parseListQuery(), RawQuery, RESERVED

### Community 53 - "documentForms.ts"
Cohesion: 0.07
Nodes (22): DocumentoAppService, ARTICULOS, BODEGAS, CENTROS, COND_PAGO, DOCUMENT_FORMS, EMPLEADOS, GRUPOS (+14 more)

### Community 54 - "CompraServices.ts"
Cohesion: 0.14
Nodes (11): catalogCache, ComparativoDTO, comparativoService, HistorialAppService, HistorialResp, HistorialResumen, historialService, columns (+3 more)

### Community 55 - "logger"
Cohesion: 0.05
Nodes (36): recepcionStateMachine, hoyIsoDate(), onRecepcionRegistrada(), registerCxpSubscriber(), registerComprasSubscribers(), ExistenciaRow, KardexRow, onRecepcionRegistrada() (+28 more)

### Community 59 - "CompraReadRepository.ts"
Cohesion: 0.21
Nodes (9): HistorialProveedorResult, asBinds(), CompraReadRepository, HistorialPrecioRow, HistorialQuery, HistorialResumen, iso(), num() (+1 more)

### Community 61 - "DataTable.tsx"
Cohesion: 0.25
Nodes (6): BulkAction, cellText(), Column, ColumnType, DataTable(), RowAction

### Community 63 - "BaseOracleRepository.ts"
Cohesion: 0.16
Nodes (10): CrudServiceOptions, buildPaginated(), BindMap, SQL_OPERATOR, BuildOpts, AuditDescriptor, ColumnType, DetailRelationDescriptor (+2 more)

### Community 65 - "Dashboard.tsx"
Cohesion: 0.50
Nodes (4): http, Counts, Dashboard(), total()

## Knowledge Gaps
- **368 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+363 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 517 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `submit()` connect `CrudPage.tsx` to `analitica.ts`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _368 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SEG_USUARIO` be split into smaller, more focused modules?**
  _Cohesion score 0.06833457804331591 - nodes in this community are weakly interconnected._
- **Should `Repository.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11231884057971014 - nodes in this community are weakly interconnected._
- **Should `backend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0463768115942029 - nodes in this community are weakly interconnected._
- **Should `AuditContext` be split into smaller, more focused modules?**
  _Cohesion score 0.12561576354679804 - nodes in this community are weakly interconnected._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06439393939393939 - nodes in this community are weakly interconnected._
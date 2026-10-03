# Graph Report - sw-inventario  (2026-09-10)

## Corpus Check
- 182 files · ~137,393 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1904 nodes · 4168 edges · 118 communities (99 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- SEG_USUARIO
- PdfBuilder
- referencias.ts
- primitives.tsx
- HttpClient
- backend/package.json
- AuditContext
- frontend/package.json
- com/descriptors.ts
- 6. Arquitectura de software
- compilerOptions
- Descripción de las 6 Capas
- compilerOptions
- scripts
- Compras e Inventario · Módulo ERP
- mapOracleError
- NotFoundError
- Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)
- DataTable.tsx
- BaseOracleRepository
- stateMachines.ts
- CLAUDE.md
- GEMINI.md
- oracledb
- HttpClient.ts
- CrudService.ts
- DataTable.test.tsx
- 11. Experiencia interactiva y accesibilidad (UX Intuitivo)
- Dashboard.tsx
- 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)
- CotizacionService.ts
- 2. Roles: quién ve y hace qué
- 8. Pantallas clave — Gestión de Compras
- seedFlujoDemo.ts
- 5. Lo realizado en detalle (bloques, orden cronológico inverso)
- RecepcionService.ts
- messageOf
- formSupport.ts
- fastify
- Avance 03 — Analítica del dashboard: series temporales + índice de ahorro
- useResource.ts
- sw-inventario · Módulo de Compras (COM_)
- documentForms.ts
- RefContext.tsx
- SolicitudCompraService.ts
- Catálogos y campos de referencia — Módulo de Gestión de Compras
- DocumentoList.tsx
- AuthService.ts
- Toast.tsx
- CompraServices.ts
- AsistenteCotizacion
- Icon.tsx
- Avance 06 — Roles endurecidos + inferencia de datos en los formularios
- descriptorHelpers.ts
- catalogPages.tsx
- analitica.ts
- AppShell.tsx
- Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras
- BaseHeaderDetailRepository
- AuthContext.tsx
- EnvConfig.ts
- OraclePool.ts
- 7. Componentes reutilizables
- authGuard.ts
- 10. Pantallas de formularios
- 2. Objetivo y principios de diseño
- EntityDescriptor
- DashboardService.ts
- 5. Arquitectura de la interfaz
- 4. Tipografía e iconografía
- 9. Pantallas de Catálogos y Productos
- cxpSubscriber.ts
- CrudService
- DocumentoAppService
- oraclePool
- react
- Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP
- CompraReadRepository.ts
- com/NotificacionService.ts
- Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo
- Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales
- transaccional.ts
- devDependencies
- StateMachine
- logger
- AdjuntoAppService
- DownloadService.ts
- adjuntos.ts
- useNotificaciones.ts
- app.ts
- Charts.tsx
- kardexSubscriber.ts
- Logger.ts
- BaseOracleRepository.ts
- Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)
- nav.ts
- BaseCrudController
- ValidationError
- App.tsx
- empleadosEnAlcance
- EntityDescriptor.ts
- AppError.ts
- parseListQuery.ts
- ComparativoAppService
- eventBus
- scripts
- FakeResizeObserver
- comFlujo.int.test.ts
- dependencies

## God Nodes (most connected - your core abstractions)
1. `SEG_USUARIO` - 104 edges
2. `AuditContext` - 91 edges
3. `ValidationError` - 61 edges
4. `NotFoundError` - 56 edges
5. `oraclePool` - 56 edges
6. `mapOracleError()` - 40 edges
7. `messageOf()` - 38 edges
8. `logger` - 34 edges
9. `CompraReadRepository` - 34 edges
10. `NOM_EMPLEADO` - 32 edges

## Surprising Connections (you probably didn't know these)
- `buildApp()` --indirect_call--> `errorHandler()`  [INFERRED]
  backend/src/app.ts → backend/src/presentation/middlewares/errorHandler.ts
- `confirmDelete()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/core/errors.ts
- `alCrearRfq()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/modules/compras/AsistenteCotizacion.tsx → frontend/src/core/errors.ts
- `HistorialProveedorView()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/modules/compras/HistorialProveedorView.tsx → frontend/src/core/errors.ts
- `buildApp()` --calls--> `registerComAdjuntoRoutes()`  [EXTRACTED]
  backend/src/app.ts → backend/src/presentation/routes/com/adjuntos.ts

## Import Cycles
- None detected.

## Communities (118 total, 10 thin omitted)

### Community 0 - "SEG_USUARIO"
Cohesion: 0.07
Nodes (103): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+95 more)

### Community 1 - "PdfBuilder"
Cohesion: 0.05
Nodes (22): AdjuntoService, assertRef(), maxBytes(), saneNombre(), ComparativoPdfService, money(), ComparativoService, ComparativoSolicitud (+14 more)

### Community 2 - "referencias.ts"
Cohesion: 0.21
Nodes (14): CrudRepository, articuloRepository(), CXP_FACTURA_PROVEEDOR, INV_ARTICULO, INV_BODEGA, INV_EXISTENCIA_BODEGA, INV_KARDEX_MOVIMIENTO, INV_UNIDAD_MEDIDA (+6 more)

### Community 3 - "primitives.tsx"
Cohesion: 0.10
Nodes (14): estadoLabel(), estadoTono, LABEL, PRIORIDAD_LABEL, PRIORIDAD_TONO, TONO, OrdenesPorEstado(), ButtonVariant (+6 more)

### Community 4 - "HttpClient"
Cohesion: 0.13
Nodes (4): HttpClient, safeStorageGet(), safeStorageRemove(), safeStorageSet()

### Community 5 - "backend/package.json"
Cohesion: 0.05
Nodes (41): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-transformer, class-validator, fastify, @fastify/multipart, oracledb (+33 more)

### Community 6 - "AuditContext"
Cohesion: 0.13
Nodes (8): BaseCrudService, SolicitudCompraService, ForbiddenError, AuditContext, validateDto(), SolicitudCompra, SolicitudDetalle, SolicitudEstado

### Community 7 - "frontend/package.json"
Cohesion: 0.13
Nodes (15): typescript, vitest, name, private, type, version, jsdom, react-dom (+7 more)

### Community 8 - "com/descriptors.ts"
Cohesion: 0.07
Nodes (27): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+19 more)

### Community 9 - "6. Arquitectura de software"
Cohesion: 0.25
Nodes (8): 6. Arquitectura de software, Aplicación — Backend, Base de datos, Dominio, Lógica de negocio, Persistencia, Presentación — Frontend, Servicios

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
Cohesion: 0.11
Nodes (18): description, engines, node, name, packageManager, private, scripts, build (+10 more)

### Community 14 - "Compras e Inventario · Módulo ERP"
Cohesion: 0.20
Nodes (9): 12. Reglas generales de consistencia visual, 13. Principios de interacción aplicados, 14. Flujo visual y respuesta del sistema, 15. Criterio final de diseño, 1. Agenda, 3. Sistema de diseño — Paleta de color, Colores oficiales, Compras e Inventario · Módulo ERP (+1 more)

### Community 15 - "mapOracleError"
Cohesion: 0.18
Nodes (7): asOracleError(), mapOracleError(), asBinds(), CompraReadRepository, iso(), num(), registerComReferenciaRoutes()

### Community 16 - "NotFoundError"
Cohesion: 0.16
Nodes (5): RecepcionService, ReconciliacionService, RfqService, NotFoundError, normalizePageQuery()

### Community 17 - "Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)"
Cohesion: 0.29
Nodes (6): 1. División Estructural del Repositorio, 2. Definición del Stack Tecnológico, 3. Especificaciones de la Base de Datos (Oracle 21c), 4. Arquitectura y Escalabilidad con Docker, 5. Reglas Técnicas de Frontend (React + Vite + Tailwind v4), Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)

### Community 18 - "DataTable.tsx"
Cohesion: 0.11
Nodes (23): prioridadLabel(), prioridadTono(), formatMoney(), formatQty(), formatRate(), MONEY, PERCENT, QTY (+15 more)

### Community 19 - "BaseOracleRepository"
Cohesion: 0.18
Nodes (5): asBinds(), auditUser(), BaseOracleRepository, ColumnDescriptor, findColumn()

### Community 21 - "stateMachines.ts"
Cohesion: 0.18
Nodes (10): OrdenCompraEstado, RecepcionEstado, recepcionStateMachine, RfqEstado, rfqStateMachine, SOLICITUD_NIVEL, SolicitudEstado, RECEPCION_ESTADOS (+2 more)

### Community 27 - "oracledb"
Cohesion: 0.10
Nodes (26): countAllTables(), countComTables(), EnvVars, HERE, loadEnv(), main(), REPO_ROOT, runFullDdl() (+18 more)

### Community 28 - "HttpClient.ts"
Cohesion: 0.13
Nodes (17): api, ApiRequestError, client, guard(), toApiRequestError(), AppError, ConflictError, ErrorDetail (+9 more)

### Community 29 - "CrudService.ts"
Cohesion: 0.11
Nodes (8): CrudServiceOptions, Page, QueryParams, HttpRepository, IRepository, ListQuery, repositoryFactory, RestRepository

### Community 30 - "DataTable.test.tsx"
Cohesion: 0.20
Nodes (8): toggleAll(), BASE_COLUMNS, Row, rowKey(), ROWS, { PERM_RFQ, hasAnyPerm }, @testing-library/react, @testing-library/user-event

### Community 31 - "11. Experiencia interactiva y accesibilidad (UX Intuitivo)"
Cohesion: 0.22
Nodes (9): 11. Experiencia interactiva y accesibilidad (UX Intuitivo), Asistente y guiado, Atajos rápidos, Confirmación explícita, Contraste y accesibilidad, Hints y Tooltips, Loading skeletons, Navegación por teclado (+1 more)

### Community 32 - "Dashboard.tsx"
Cohesion: 0.13
Nodes (14): DashboardResumen, dashboardService, Counts, Dashboard(), OC_ORDEN, Q_COMPACT, total(), veces() (+6 more)

### Community 33 - "1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)"
Cohesion: 0.09
Nodes (22): 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2), 2. Patrones GoF (`skills/patron-arquitectura.md` §4), 3-bis. POO en el FRONTEND (`frontend/src/`), 3. Modelo de lectura / trazabilidad (Fase 5), 4. Cobertura del flujo completo, 4. Cómo se sostiene "limpio, ordenado y profesional", Abstracción, Alta cohesión y bajo acoplamiento (+14 more)

### Community 34 - "CotizacionService.ts"
Cohesion: 0.21
Nodes (7): ROLES_SIN_ALCANCE, rfqIdsEnAlcance(), solicitudIdsEnAlcance(), CotizacionHeader, CotizacionService, WithDetails, CotizacionDetalle

### Community 35 - "2. Roles: quién ve y hace qué"
Cohesion: 0.20
Nodes (9): 1. El flujo, paso a paso, y qué lo cubre en el sistema, 2. Roles: quién ve y hace qué, Catálogo de permisos (módulo `COMPRAS`), Diagrama del ciclo, Flujo del sistema y modelo de roles — Gestión de Compras, Jerarquía de aprobación y autorización, Qué ve cada rol en el menú, Roles y sus permisos (+1 more)

### Community 36 - "8. Pantallas clave — Gestión de Compras"
Cohesion: 0.25
Nodes (8): 8. Pantallas clave — Gestión de Compras, Catálogo, Cotizaciones, Facturación / CxP, Proveedores, Recepción, Solicitudes, Órdenes de Compra

### Community 37 - "seedFlujoDemo.ts"
Cohesion: 0.21
Nodes (14): CICLOS, CicloSpec, crearCiclo(), daysFromNow(), envRaw, H, idsTop(), inj() (+6 more)

### Community 38 - "5. Lo realizado en detalle (bloques, orden cronológico inverso)"
Cohesion: 0.04
Nodes (44): 1. Qué es el proyecto, 2. Stack y comandos, 3. Arquitectura (6 capas, flujo unidireccional hacia abajo), 4. Estado por fases, 5.0 Endurecimiento de autenticación (subfase 6.1) — 2026-09-10, 5.-10 Roles endurecidos + inferencia de datos en formularios — 2026-09-10, 5.-11 Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales — 2026-09-10, 5.-12 Primera suite de tests del frontend (infra + cobertura inicial) — 2026-09-10 (+36 more)

### Community 39 - "RecepcionService.ts"
Cohesion: 0.13
Nodes (17): ordenCompraStateMachine, ComEvents, CrearOrdenInput, LineaInput, OrdenCompraService, LineaRecepcionInput, RegistrarRecepcionInput, ConsistenciaReport (+9 more)

### Community 40 - "messageOf"
Cohesion: 0.18
Nodes (18): AdjuntosPanel(), descargar(), eliminar(), onFile(), ver(), messageOf(), ComparativoView(), adjudicar() (+10 more)

### Community 41 - "formSupport.ts"
Cohesion: 0.08
Nodes (38): CrudFieldDef, CrudPage(), confirmDelete(), openCreate(), openEdit(), save(), CrudPageConfig, Row (+30 more)

### Community 42 - "fastify"
Cohesion: 0.06
Nodes (43): Ids, inTwoWeeks, state, bearer(), crearSolicitud(), Fk, idsVisibles(), token() (+35 more)

### Community 43 - "Avance 03 — Analítica del dashboard: series temporales + índice de ahorro"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Decisiones de métrica (respuestas del usuario), 2.1 `dal/repositories/com/CompraReadRepository.ts` — 3 consultas nuevas, 2.2 `bll/services/com/DashboardService.ts` (nuevo), 2.3 `presentation/routes/com/analitica.ts`, 2. Backend, 3.1 `core/CompraServices.ts`, 3.2 `ui/Charts.tsx` (nuevo, exports nombrados — convención de `ui/`) (+6 more)

### Community 44 - "useResource.ts"
Cohesion: 0.11
Nodes (9): AppEventName, EntityChangedPayload, eventBus, Handler, ToastPayload, PageMeta, EMPTY_META, ResourceState (+1 more)

### Community 45 - "sw-inventario · Módulo de Compras (COM_)"
Cohesion: 0.33
Nodes (5): Docker, La tesis POO: configurar, no programar, Pruebas, Puesta en marcha, sw-inventario · Módulo de Compras (COM_)

### Community 46 - "documentForms.ts"
Cohesion: 0.11
Nodes (18): Paso, Proveedor, ARTICULOS, BODEGAS, CENTROS, COND_PAGO, DOCUMENT_FORMS, EMPLEADOS (+10 more)

### Community 47 - "RefContext.tsx"
Cohesion: 0.15
Nodes (10): ALL_KINDS, DOC_PREFIX, DocRef, FALLBACK, RefContext, RefKind, RefProvider(), Refs (+2 more)

### Community 49 - "SolicitudCompraService.ts"
Cohesion: 0.10
Nodes (26): solicitudStateMachine, AdjuntoMeta, Manifiesto, MIME_PERMITIDOS, REPOS, TABLA, CotizacionEnComparativo, LineaComparativo (+18 more)

### Community 50 - "Catálogos y campos de referencia — Módulo de Gestión de Compras"
Cohesion: 0.20
Nodes (9): 1. Tipos de "catálogo" en el módulo, 2. Datos semilla cargados (`database/dml/`), 3. Campos corregidos (eran texto/ID libre, ahora son catálogo), 4. Campos que quedan como texto libre (correcto), 5. Pendiente (catálogos estáticos ya definidos, faltan sus pantallas), Catálogos (`frontend/src/modules/compras/catalogPages.tsx`), Catálogos y campos de referencia — Módulo de Gestión de Compras, Comparativo de cotizaciones (`ComparativoView.tsx`) (+1 more)

### Community 51 - "DocumentoList.tsx"
Cohesion: 0.12
Nodes (16): ActionModalState, CREAR_PERM, DETALLE_KEYS, DocConfig, DOCUMENTO_CONFIGS, EDIT_FIELDS, EMPTY_HINT, FLOW_STEP (+8 more)

### Community 52 - "AuthService.ts"
Cohesion: 0.14
Nodes (9): AuthRequestInfo, authService, MAX_INTENTOS_FALLIDOS, SesionUsuario, VENTANA_BLOQUEO_MIN, derive(), hashPassword(), verifyPassword() (+1 more)

### Community 53 - "Toast.tsx"
Cohesion: 0.18
Nodes (5): Ctx, ToastApi, ToastItem, ToastTone, TONE

### Community 54 - "CompraServices.ts"
Cohesion: 0.09
Nodes (18): humanBytes(), Preview, CRITERIO_COMPARATIVO, AdjuntoMeta, adjuntoService, catalogCache, ComparativoDTO, comparativoService (+10 more)

### Community 55 - "AsistenteCotizacion"
Cohesion: 0.50
Nodes (4): AsistenteCotizacion(), alCrearRfq(), avanzar(), cerrarPasoCotizacion()

### Community 57 - "Avance 06 — Roles endurecidos + inferencia de datos en los formularios"
Cohesion: 0.12
Nodes (16): 0. Resumen ejecutivo, 1. La jerarquía de roles (respuesta a "no entiendo la lógica"), 2. Por qué "el bodeguero veía todo" — diagnóstico, 3.1 Atajo `X-Dev-User` cerrado por defecto, 3.2 Lectura por documento (segregación de funciones), 3.3 Alcance por departamento en RFQ y Cotización, 3.4 Verificado en vivo (login real, sin atajo), 3. Roles endurecidos (backend) (+8 more)

### Community 58 - "descriptorHelpers.ts"
Cohesion: 0.20
Nodes (11): AuditMode, buildDescriptor(), camelPk(), col(), ColOpts, CREATED_AUDIT_COLUMNS, MODIFIED_AUDIT_COLUMNS, pkCol() (+3 more)

### Community 59 - "catalogPages.tsx"
Cohesion: 0.15
Nodes (12): CALIFICACION_PROVEEDOR, ESTADO_AI, ESTADO_SEGUIMIENTO_ORDEN, MOTIVO_DEVOLUCION, PRIORIDAD_SOLICITUD, TIPO_EXCEPCION_ORDEN, CATALOG_CONFIGS, REF_ARTICULOS (+4 more)

### Community 60 - "analitica.ts"
Cohesion: 0.19
Nodes (12): buildCrudService(), AnyMethod, withTelemetry(), comparativo, comparativoPdf, dashboard, idParam(), intQuery() (+4 more)

### Community 61 - "AppShell.tsx"
Cohesion: 0.20
Nodes (11): container, MODULES, SystemModule, visibleSections(), AppShell(), cycleTheme(), ROL_LABEL, applyTheme() (+3 more)

### Community 62 - "Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras"
Cohesion: 0.12
Nodes (15): 0. Resumen ejecutivo, 1. Autenticación endurecida (6.1), 2. Alcance por departamento/equipo (6.2 + endurecimiento), 3.1 Catálogo de permisos (14, módulo `COMPRAS`), 3.2 Matriz de roles (qué puede hacer cada uno), 3.3 Gating en el frontend, 3. Modelo de roles — jerarquía correcta, 4. Bandeja de pendientes (notificaciones) (+7 more)

### Community 64 - "AuthContext.tsx"
Cohesion: 0.16
Nodes (9): AuthContext, AuthProvider(), boot(), AuthState, jwtExp(), Sesion, tokenVigente(), grants() (+1 more)

### Community 65 - "EnvConfig.ts"
Cohesion: 0.26
Nodes (9): AppEnvironment, AuthConfig, buildConnectString(), EnvConfig, HttpConfig, OracleConfig, readFirst(), required() (+1 more)

### Community 66 - "OraclePool.ts"
Cohesion: 0.43
Nodes (4): registerComprasSubscribers(), env(), loadDotenv(), main()

### Community 68 - "7. Componentes reutilizables"
Cohesion: 0.33
Nodes (6): 7. Componentes reutilizables, Botones, Chips y badges, Inputs, Moneda, Tablas

### Community 70 - "authGuard.ts"
Cohesion: 0.16
Nodes (13): base64url(), fromBase64url(), JwtPayload, signJwt(), verifyJwt(), UnauthorizedError, CrudService, authGuard() (+5 more)

### Community 71 - "10. Pantallas de formularios"
Cohesion: 0.50
Nodes (4): 10. Pantallas de formularios, Campos automáticos, Organización, Validación

### Community 72 - "2. Objetivo y principios de diseño"
Cohesion: 0.50
Nodes (4): 2. Objetivo y principios de diseño, Apple Human Interface Guidelines, Fluent Design, Material Design 3

### Community 73 - "EntityDescriptor"
Cohesion: 0.25
Nodes (3): CrudServiceOptions, BuildOpts, EntityDescriptor

### Community 74 - "DashboardService.ts"
Cohesion: 0.22
Nodes (9): AhorroAdjudicacionResumen, clampMeses(), DashboardResumen, DashboardService, MES_LABEL, PuntoCompraMes, PuntoRotacionMes, rejillaMeses() (+1 more)

### Community 75 - "5. Arquitectura de la interfaz"
Cohesion: 0.50
Nodes (4): 5. Arquitectura de la interfaz, Barra superior, Contenido, Sidebar

### Community 76 - "4. Tipografía e iconografía"
Cohesion: 0.67
Nodes (3): 4. Tipografía e iconografía, Iconografía, Tipografía

### Community 77 - "9. Pantallas de Catálogos y Productos"
Cohesion: 0.67
Nodes (3): 9. Pantallas de Catálogos y Productos, Catálogo, Nuevo Producto en el Catálogo Permanente

### Community 78 - "cxpSubscriber.ts"
Cohesion: 0.26
Nodes (10): hoyIsoDate(), onRecepcionRegistrada(), onRecepcionReversada(), registerCxpSubscriber(), ComEventName, OrdenCompraEstadoPayload, RecepcionRegistradaPayload, RecepcionReversadaPayload (+2 more)

### Community 80 - "DocumentoAppService"
Cohesion: 0.16
Nodes (6): CampoDetalle, ColumnaLinea, DocumentoDetalle(), Row, DocumentoAppService, TipoDocAdjunto

### Community 81 - "oraclePool"
Cohesion: 0.13
Nodes (9): oraclePool, Accesos, asBinds(), AuthUserRow, EventoAcceso, Row, segAuthRepository, SesionRow (+1 more)

### Community 82 - "react"
Cohesion: 0.18
Nodes (4): http, ROL_LABEL, UsuarioDemo, react

### Community 83 - "Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Adjuntos en Devolución a proveedor, 2. Vista previa inline de adjuntos, 3. Editar líneas de cotización desde el frontend, 4-bis. Acciones de fila uniformes (todas las tablas del sistema), 4. Reversa de recepción que ya alimentó CxP, 5. Verificación, 6. Puntos de entrada nuevos / tocados (+6 more)

### Community 84 - "CompraReadRepository.ts"
Cohesion: 0.22
Nodes (8): HistorialProveedorResult, AhorroAdjudicacionRow, CompraMesRow, EntradaMesRow, HistorialPrecioRow, HistorialQuery, HistorialResumen, Row

### Community 85 - "com/NotificacionService.ts"
Cohesion: 0.24
Nodes (7): BandejaPendientes, NADA, Notificacion, notificacionService, NotiTipo, hasPermiso(), requirePermiso()

### Community 87 - "Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo"
Cohesion: 0.20
Nodes (9): 0. Resumen ejecutivo, 1. Aclaración de dudas del negocio, 2. MinIO (almacenamiento de objetos S3), 3. Adjuntos de documentos, 4. Pantalla de Cotizaciones más entendible, 5. CRUD de los documentos del ciclo (con cerrojo por estado), 6. Verificación, 7. Puntos de entrada nuevos (+1 more)

### Community 88 - "Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Análisis del módulo (resumen — detalle con cita en el plan), 2. WS1 — Sistema de columnas de `DataTable` (UI de listas), 3. WS2 — Gating de acciones por permiso, 4. WS3 — Rollback del estado de la OC en reversa/borrado de recepción, 5. WS4 — Resiliencia del bus de eventos, 6. WS5 — Pantallas de Seguimiento / Excepciones de OC, 7. Verificación (+2 more)

### Community 89 - "transaccional.ts"
Cohesion: 0.12
Nodes (21): authGuardAny(), auditContextOf(), cotizaciones, devoluciones, DocumentoService, envelope(), idParam(), ordenes (+13 more)

### Community 90 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, jsdom, tailwindcss, @tailwindcss/vite, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react (+5 more)

### Community 91 - "StateMachine"
Cohesion: 0.25
Nodes (4): StateMachine, ORDEN_COMPRA_ESTADOS, OcEstado, ocMachine

### Community 92 - "logger"
Cohesion: 0.26
Nodes (3): isAppError(), logger, errorHandler()

### Community 94 - "DownloadService.ts"
Cohesion: 0.29
Nodes (3): DocumentDownloadService, downloadService, triggerDownload()

### Community 95 - "adjuntos.ts"
Cohesion: 0.19
Nodes (12): TipoDocumentoAdjunto, adjuntos, DocDef, DOCS, idParam(), R_COTIZACION, R_DEVOLUCION, R_OC (+4 more)

### Community 96 - "useNotificaciones.ts"
Cohesion: 0.24
Nodes (10): AppEvents, BandejaPendientes, fetchPendientes(), Notificacion, NotiTipo, VACIA, useNotificaciones(), VACIA (+2 more)

### Community 97 - "app.ts"
Cohesion: 0.23
Nodes (11): adjuntoMaxBytes(), buildApp(), PERMISO_META, PermisoCodigo, Permisos, ROLES, clientIp(), registerAuthRoutes() (+3 more)

### Community 99 - "kardexSubscriber.ts"
Cohesion: 0.40
Nodes (10): ExistenciaRow, KardexRow, onRecepcionRegistrada(), onRecepcionReversada(), registerKardexSubscriber(), ultimoSaldo(), upsertExistencia(), yaProcesado() (+2 more)

### Community 100 - "Logger.ts"
Cohesion: 0.18
Nodes (4): LEVEL_WEIGHT, LogFields, LogLevel, ScopedLogger

### Community 101 - "BaseOracleRepository.ts"
Cohesion: 0.09
Nodes (12): SYSTEM_AUDIT_CONTEXT, buildPaginated(), DEFAULT_PAGE_SIZE, FilterCondition, MAX_PAGE_SIZE, PageQuery, Paginated, SortOrder (+4 more)

### Community 102 - "Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Por qué este alcance y no otro, 2. Infraestructura nueva, 3. Tests de lógica pura, 4. `ui/DataTable.test.tsx` (13 casos), 5. `ui/FlowStepper.test.tsx` (2 casos), 6. Verificación, 7. Puntos de entrada nuevos / tocados (+2 more)

### Community 103 - "nav.ts"
Cohesion: 0.16
Nodes (17): PermisoCodigo, Permisos, READ_COTIZACIONES, READ_DEVOLUCIONES, READ_FLUJO, READ_OC, READ_RECEPCIONES, READ_RFQ (+9 more)

### Community 104 - "BaseCrudController"
Cohesion: 0.28
Nodes (3): BaseCrudController, extractVersion(), parseId()

### Community 106 - "ValidationError"
Cohesion: 0.20
Nodes (9): DevolucionDetalle, DevolucionProveedorService, LineaInput, ValidationError, checkValue(), isSystemColumn(), Mode, validateAgainstDescriptor() (+1 more)

### Community 107 - "App.tsx"
Cohesion: 0.25
Nodes (3): Suite(), NavLeaf, visibleLeaves()

### Community 109 - "EntityDescriptor.ts"
Cohesion: 0.33
Nodes (4): AuditDescriptor, ColumnType, DetailRelationDescriptor, SoftDeleteDescriptor

### Community 110 - "AppError.ts"
Cohesion: 0.16
Nodes (8): AppError, BusinessRuleError, ConflictError, ErrorCode, ForeignKeyError, InternalError, OptimisticLockError, OracleErrorShape

### Community 113 - "parseListQuery.ts"
Cohesion: 0.29
Nodes (7): FilterOperator, listQuery(), first(), OPERATORS, parseListQuery(), RawQuery, RESERVED

### Community 116 - "eventBus"
Cohesion: 0.22
Nodes (3): DomainEventBus, DomainEventHandler, eventBus()

### Community 117 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 119 - "comFlujo.int.test.ts"
Cohesion: 0.40
Nodes (3): envRaw, H, Ids

### Community 120 - "dependencies"
Cohesion: 0.67
Nodes (3): dependencies, react, react-dom

## Knowledge Gaps
- **664 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+659 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 880 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastify` connect `fastify` to `app.ts`, `referencias.ts`, `BaseOracleRepository.ts`, `seedFlujoDemo.ts`, `backend/package.json`, `authGuard.ts`, `analitica.ts`, `comFlujo.int.test.ts`, `transaccional.ts`, `logger`, `adjuntos.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `AuthContext.tsx`, `useNotificaciones.ts`, `Dashboard.tsx`, `frontend/package.json`, `formSupport.ts`, `App.tsx`, `useResource.ts`, `documentForms.ts`, `RefContext.tsx`, `DocumentoAppService`, `DataTable.tsx`, `DocumentoList.tsx`, `Toast.tsx`, `CompraServices.ts`, `AppShell.tsx`, `DataTable.test.tsx`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `AuditContext` connect `AuditContext` to `PdfBuilder`, `CotizacionService.ts`, `app.ts`, `BaseOracleRepository.ts`, `authGuard.ts`, `RecepcionService.ts`, `ValidationError`, `AppError.ts`, `NotFoundError`, `SolicitudCompraService.ts`, `BaseOracleRepository`, `com/NotificacionService.ts`, `transaccional.ts`, `BaseHeaderDetailRepository`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _664 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SEG_USUARIO` be split into smaller, more focused modules?**
  _Cohesion score 0.06833457804331591 - nodes in this community are weakly interconnected._
- **Should `PdfBuilder` be split into smaller, more focused modules?**
  _Cohesion score 0.053830227743271224 - nodes in this community are weakly interconnected._
- **Should `primitives.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10276679841897234 - nodes in this community are weakly interconnected._
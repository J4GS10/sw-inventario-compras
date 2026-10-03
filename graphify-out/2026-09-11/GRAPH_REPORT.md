# Graph Report - sw-inventario  (2026-09-11)

## Corpus Check
- 194 files · ~166,580 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2056 nodes · 4496 edges · 125 communities (101 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- SEG_USUARIO
- PdfBuilder
- referencias.ts
- DataTable.tsx
- HttpClient
- backend/package.json
- NotFoundError
- frontend/package.json
- com/descriptors.ts
- 6. Arquitectura de software
- compilerOptions
- Descripción de las 6 Capas
- compilerOptions
- scripts
- Compras e Inventario · Módulo ERP
- oraclePool
- authGuard
- Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)
- CompraServices.ts
- format.ts
- AdjuntoService
- CLAUDE.md
- GEMINI.md
- repositoryFactory
- HttpClient.ts
- CrudService
- DataTable.test.tsx
- 11. Experiencia interactiva y accesibilidad (UX Intuitivo)
- AuditContext
- 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)
- com/NotificacionService.ts
- 2. Roles: quién ve y hace qué
- 8. Pantallas clave — Gestión de Compras
- seedFlujoDemo.ts
- 5. Lo realizado en detalle (bloques, orden cronológico inverso)
- Toast.tsx
- messageOf
- formSupport.ts
- testApp.ts
- Avance 03 — Analítica del dashboard: series temporales + índice de ahorro
- useResource.ts
- sw-inventario · Módulo de Compras (COM_)
- documentForms.ts
- RefContext.tsx
- Query.ts
- Catálogos y campos de referencia — Módulo de Gestión de Compras
- DocumentoList.tsx
- deploy.ts
- Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras
- RecepcionService.ts
- BaseOracleRepository
- Icon.tsx
- Avance 06 — Roles endurecidos + inferencia de datos en los formularios
- app.ts
- AppShell.tsx
- cxpSubscriber.ts
- Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras
- AppError.ts
- AuthContext.tsx
- ReporteAppService
- buildCrudService.ts
- 7. Componentes reutilizables
- authGuard.ts
- 10. Pantallas de formularios
- 2. Objetivo y principios de diseño
- fastify
- leafVisible
- 5. Arquitectura de la interfaz
- 4. Tipografía e iconografía
- 9. Pantallas de Catálogos y Productos
- useNotificaciones.ts
- devDependencies
- DocumentoAppService
- primitives.tsx
- 6. Fase actual y qué sigue (backlog priorizado)
- Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP
- apiClient.ts
- transaccional.ts
- Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo
- Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales
- nav.test.ts
- descriptorHelpers.ts
- analitica.ts
- Dashboard.tsx
- normalizePageQuery
- BaseHeaderDetailRepository
- adjuntos.ts
- Logger.ts
- StateMachine
- Charts.tsx
- ValidationError
- http
- react
- Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)
- nav.ts
- DownloadService.ts
- SolicitudCompraService.ts
- ComparativoAppService
- CompraReadRepository.ts
- scripts
- FakeResizeObserver
- logger
- parseListQuery.ts
- SegAuthRepository.ts
- dependencies
- BaseCrudController
- DashboardAppService
- AdjuntoAppService
- e2e-negocio-real.mjs
- Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo
- CrudService.ts
- alcanceDepartamento.int.test.ts
- catalogsCrud.int.test.ts
- documentoUpdate.int.test.ts
- HistorialAppService

## God Nodes (most connected - your core abstractions)
1. `SEG_USUARIO` - 104 edges
2. `AuditContext` - 91 edges
3. `oraclePool` - 64 edges
4. `ValidationError` - 61 edges
5. `NotFoundError` - 59 edges
6. `mapOracleError()` - 48 edges
7. `CompraReadRepository` - 44 edges
8. `messageOf()` - 44 edges
9. `5. Lo realizado en detalle (bloques, orden cronológico inverso)` - 41 edges
10. `logger` - 34 edges

## Surprising Connections (you probably didn't know these)
- `CrudServiceOptions` --references--> `EntityDescriptor`  [EXTRACTED]
  backend/src/bll/services/BaseCrudService.ts → backend/src/entities/support/EntityDescriptor.ts
- `articuloRepository()` --calls--> `CrudRepository`  [EXTRACTED]
  backend/src/dal/repositories/shared/index.ts → backend/src/dal/repositories/CrudRepository.ts
- `confirmDelete()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/core/errors.ts
- `alCrearRfq()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/modules/compras/AsistenteCotizacion.tsx → frontend/src/core/errors.ts
- `entrar()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/modules/LoginScreen.tsx → frontend/src/core/errors.ts

## Import Cycles
- None detected.

## Communities (125 total, 14 thin omitted)

### Community 0 - "SEG_USUARIO"
Cohesion: 0.07
Nodes (103): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+95 more)

### Community 1 - "PdfBuilder"
Cohesion: 0.06
Nodes (27): ComparativoPdfService, money(), ComparativoService, ComparativoSolicitud, money(), OrdenCompraPdfService, money(), moneyCompact() (+19 more)

### Community 2 - "referencias.ts"
Cohesion: 0.23
Nodes (12): articuloRepository(), CXP_FACTURA_PROVEEDOR, INV_ARTICULO, INV_BODEGA, INV_EXISTENCIA_BODEGA, INV_KARDEX_MOVIMIENTO, INV_UNIDAD_MEDIDA, NOM_DEPARTAMENTO (+4 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.14
Nodes (17): prioridadLabel(), prioridadTono(), formatRate(), BulkAction, cellNode(), cellText(), cellTitle(), Column (+9 more)

### Community 4 - "HttpClient"
Cohesion: 0.14
Nodes (3): NetworkError, HttpClient, safeStorageGet()

### Community 5 - "backend/package.json"
Cohesion: 0.05
Nodes (41): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-transformer, class-validator, fastify, @fastify/multipart, oracledb (+33 more)

### Community 6 - "NotFoundError"
Cohesion: 0.13
Nodes (13): CotizacionService, DevolucionDetalle, DevolucionProveedorService, LineaInput, RecepcionService, BusinessRuleError, NotFoundError, WithDetails (+5 more)

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
Cohesion: 0.05
Nodes (38): description, devDependencies, playwright, engines, node, name, packageManager, private (+30 more)

### Community 14 - "Compras e Inventario · Módulo ERP"
Cohesion: 0.20
Nodes (9): 12. Reglas generales de consistencia visual, 13. Principios de interacción aplicados, 14. Flujo visual y respuesta del sistema, 15. Criterio final de diseño, 1. Agenda, 3. Sistema de diseño — Paleta de color, Colores oficiales, Compras e Inventario · Módulo ERP (+1 more)

### Community 15 - "oraclePool"
Cohesion: 0.18
Nodes (7): asOracleError(), mapOracleError(), oraclePool, CompraReadRepository, iso(), num(), registerComReferenciaRoutes()

### Community 16 - "authGuard"
Cohesion: 0.20
Nodes (9): CrudService, authGuard(), CRUD_OPERATIVOS, CRUD_SENSIBLES, CRUD_SOLO_LECTURA, CrudRouteConfig, registerCrudRoutes(), registerReadOnlyCrudRoutes() (+1 more)

### Community 17 - "Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)"
Cohesion: 0.29
Nodes (6): 1. División Estructural del Repositorio, 2. Definición del Stack Tecnológico, 3. Especificaciones de la Base de Datos (Oracle 21c), 4. Arquitectura y Escalabilidad con Docker, 5. Reglas Técnicas de Frontend (React + Vite + Tailwind v4), Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)

### Community 18 - "CompraServices.ts"
Cohesion: 0.10
Nodes (24): humanBytes(), Preview, AdjuntoMeta, adjuntoService, catalogCache, ComparativoDTO, comparativoService, DesempenoProveedorItem (+16 more)

### Community 19 - "format.ts"
Cohesion: 0.16
Nodes (12): HistorialResp, historialService, formatPercent(), formatQty(), MONEY, PERCENT, QTY, RATE (+4 more)

### Community 21 - "AdjuntoService"
Cohesion: 0.37
Nodes (4): AdjuntoService, assertRef(), maxBytes(), saneNombre()

### Community 27 - "repositoryFactory"
Cohesion: 0.19
Nodes (13): defaultPriceResolver, PriceResolver, PriceQuery, PriceResult, PriceStrategy, Acuerdo, AcuerdoDetalle, AcuerdoMarcoStrategy (+5 more)

### Community 28 - "HttpClient.ts"
Cohesion: 0.17
Nodes (12): AppError, ConflictError, ErrorDetail, ForbiddenError, LockedError, NotFoundError, ServerError, UnauthorizedError (+4 more)

### Community 30 - "DataTable.test.tsx"
Cohesion: 0.20
Nodes (8): toggleAll(), BASE_COLUMNS, Row, rowKey(), ROWS, { PERM_RFQ, hasAnyPerm }, @testing-library/react, @testing-library/user-event

### Community 31 - "11. Experiencia interactiva y accesibilidad (UX Intuitivo)"
Cohesion: 0.22
Nodes (9): 11. Experiencia interactiva y accesibilidad (UX Intuitivo), Asistente y guiado, Atajos rápidos, Confirmación explícita, Contraste y accesibilidad, Hints y Tooltips, Loading skeletons, Navegación por teclado (+1 more)

### Community 32 - "AuditContext"
Cohesion: 0.10
Nodes (6): BaseCrudService, RfqService, AuditContext, FilterCondition, IHeaderDetailRepository, IRepository

### Community 33 - "1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)"
Cohesion: 0.09
Nodes (22): 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2), 2. Patrones GoF (`skills/patron-arquitectura.md` §4), 3-bis. POO en el FRONTEND (`frontend/src/`), 3. Modelo de lectura / trazabilidad (Fase 5), 4. Cobertura del flujo completo, 4. Cómo se sostiene "limpio, ordenado y profesional", Abstracción, Alta cohesión y bajo acoplamiento (+14 more)

### Community 34 - "com/NotificacionService.ts"
Cohesion: 0.13
Nodes (12): empleadosEnAlcance(), ROLES_SIN_ALCANCE, rfqIdsEnAlcance(), solicitudIdsEnAlcance(), BandejaPendientes, NADA, Notificacion, notificacionService (+4 more)

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
Cohesion: 0.05
Nodes (41): 5.0 Endurecimiento de autenticación (subfase 6.1) — 2026-09-10, 5.-10 Roles endurecidos + inferencia de datos en formularios — 2026-09-10, 5.-11 Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales — 2026-09-10, 5.-12 Primera suite de tests del frontend (infra + cobertura inicial) — 2026-09-10, 5.-13 Acceso al PDF de la cotización desde el Comparativo — 2026-09-10/11, 5.-14 Asistente guiado RFQ→Cotización→Comparativo→OC + fusión Comprador/Financiero — 2026-09-11, 5.-15 Fixes tras probar el asistente en vivo: select ilegible ("#187") + "Autoriza la orden" sin filtrar — 2026-09-11, 5.-16 Revertida la fusión Comprador/Financiero — 2026-09-11 (+33 more)

### Community 39 - "Toast.tsx"
Cohesion: 0.18
Nodes (5): Ctx, ToastApi, ToastItem, ToastTone, TONE

### Community 40 - "messageOf"
Cohesion: 0.16
Nodes (21): AdjuntosPanel(), descargar(), eliminar(), onFile(), ver(), messageOf(), ComparativoView(), adjudicar() (+13 more)

### Community 41 - "formSupport.ts"
Cohesion: 0.08
Nodes (37): CrudFieldDef, CrudPage(), confirmDelete(), openCreate(), openEdit(), save(), CrudPageConfig, Row (+29 more)

### Community 42 - "testApp.ts"
Cohesion: 0.09
Nodes (29): Ids, inTwoWeeks, state, ensureBodega(), Ids, inTwoWeeks, PRECIOS, state (+21 more)

### Community 43 - "Avance 03 — Analítica del dashboard: series temporales + índice de ahorro"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Decisiones de métrica (respuestas del usuario), 2.1 `dal/repositories/com/CompraReadRepository.ts` — 3 consultas nuevas, 2.2 `bll/services/com/DashboardService.ts` (nuevo), 2.3 `presentation/routes/com/analitica.ts`, 2. Backend, 3.1 `core/CompraServices.ts`, 3.2 `ui/Charts.tsx` (nuevo, exports nombrados — convención de `ui/`) (+6 more)

### Community 44 - "useResource.ts"
Cohesion: 0.11
Nodes (10): AppEventName, AppEvents, EntityChangedPayload, eventBus, Handler, ToastPayload, PageMeta, EMPTY_META (+2 more)

### Community 45 - "sw-inventario · Módulo de Compras (COM_)"
Cohesion: 0.33
Nodes (5): Docker, La tesis POO: configurar, no programar, Pruebas, Puesta en marcha, sw-inventario · Módulo de Compras (COM_)

### Community 46 - "documentForms.ts"
Cohesion: 0.07
Nodes (27): CALIFICACION_PROVEEDOR, CRITERIO_COMPARATIVO, ESTADO_AI, ESTADO_SEGUIMIENTO_ORDEN, MOTIVO_DEVOLUCION, PRIORIDAD_SOLICITUD, TIPO_EXCEPCION_ORDEN, CATALOG_CONFIGS (+19 more)

### Community 47 - "RefContext.tsx"
Cohesion: 0.15
Nodes (10): ALL_KINDS, DOC_PREFIX, DocRef, FALLBACK, RefContext, RefKind, RefProvider(), Refs (+2 more)

### Community 49 - "Query.ts"
Cohesion: 0.20
Nodes (6): buildPaginated(), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PageQuery, Paginated, SortOrder

### Community 50 - "Catálogos y campos de referencia — Módulo de Gestión de Compras"
Cohesion: 0.20
Nodes (9): 1. Tipos de "catálogo" en el módulo, 2. Datos semilla cargados (`database/dml/`), 3. Campos corregidos (eran texto/ID libre, ahora son catálogo), 4. Campos que quedan como texto libre (correcto), 5. Pendiente (catálogos estáticos ya definidos, faltan sus pantallas), Catálogos (`frontend/src/modules/compras/catalogPages.tsx`), Catálogos y campos de referencia — Módulo de Gestión de Compras, Comparativo de cotizaciones (`ComparativoView.tsx`) (+1 more)

### Community 51 - "DocumentoList.tsx"
Cohesion: 0.12
Nodes (17): ActionModalState, CREAR_PERM, DETALLE_KEYS, DocConfig, DOCUMENTO_CONFIGS, EDIT_FIELDS, EMPTY_HINT, FLOW_STEP (+9 more)

### Community 52 - "deploy.ts"
Cohesion: 0.31
Nodes (10): countAllTables(), countComTables(), EnvVars, HERE, loadEnv(), main(), REPO_ROOT, runFullDdl() (+2 more)

### Community 53 - "Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras"
Cohesion: 0.18
Nodes (10): 1. Qué es el proyecto, 2. Stack y comandos, 3. Arquitectura (6 capas, flujo unidireccional hacia abajo), 4. Estado por fases, 7. Cómo levantar y verificar, 8. Mapa de archivos de referencia, 9. Convenciones al retomar, Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras (+2 more)

### Community 54 - "RecepcionService.ts"
Cohesion: 0.08
Nodes (37): recepcionStateMachine, rfqStateMachine, ComEventName, ComEvents, OrdenCompraEstadoPayload, RecepcionRegistradaPayload, SolicitudAprobacionPayload, AdjuntoMeta (+29 more)

### Community 55 - "BaseOracleRepository"
Cohesion: 0.16
Nodes (4): asBinds(), auditUser(), BaseOracleRepository, findColumn()

### Community 57 - "Avance 06 — Roles endurecidos + inferencia de datos en los formularios"
Cohesion: 0.12
Nodes (16): 0. Resumen ejecutivo, 1. La jerarquía de roles (respuesta a "no entiendo la lógica"), 2. Por qué "el bodeguero veía todo" — diagnóstico, 3.1 Atajo `X-Dev-User` cerrado por defecto, 3.2 Lectura por documento (segregación de funciones), 3.3 Alcance por departamento en RFQ y Cotización, 3.4 Verificado en vivo (login real, sin atajo), 3. Roles endurecidos (backend) (+8 more)

### Community 58 - "app.ts"
Cohesion: 0.16
Nodes (16): adjuntoMaxBytes(), buildApp(), PERMISO_META, PermisoCodigo, ROLES, isAppError(), errorHandler(), clientIp() (+8 more)

### Community 59 - "AppShell.tsx"
Cohesion: 0.20
Nodes (11): container, MODULES, SystemModule, visibleSections(), AppShell(), cycleTheme(), ROL_LABEL, applyTheme() (+3 more)

### Community 61 - "cxpSubscriber.ts"
Cohesion: 0.18
Nodes (9): hoyIsoDate(), onRecepcionRegistrada(), onRecepcionReversada(), registerCxpSubscriber(), RecepcionReversadaPayload, DomainEventBus, DomainEventHandler, eventBus() (+1 more)

### Community 62 - "Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras"
Cohesion: 0.12
Nodes (15): 0. Resumen ejecutivo, 1. Autenticación endurecida (6.1), 2. Alcance por departamento/equipo (6.2 + endurecimiento), 3.1 Catálogo de permisos (14, módulo `COMPRAS`), 3.2 Matriz de roles (qué puede hacer cada uno), 3.3 Gating en el frontend, 3. Modelo de roles — jerarquía correcta, 4. Bandeja de pendientes (notificaciones) (+7 more)

### Community 63 - "AppError.ts"
Cohesion: 0.10
Nodes (19): AppError, ConflictError, ErrorCode, ForeignKeyError, InternalError, OptimisticLockError, UnauthorizedError, OracleErrorShape (+11 more)

### Community 64 - "AuthContext.tsx"
Cohesion: 0.17
Nodes (6): AuthContext, boot(), AuthState, jwtExp(), Sesion, tokenVigente()

### Community 66 - "buildCrudService.ts"
Cohesion: 0.27
Nodes (5): buildCrudService(), AnyMethod, withTelemetry(), ComEntityKey, CrudResource

### Community 68 - "7. Componentes reutilizables"
Cohesion: 0.33
Nodes (6): 7. Componentes reutilizables, Botones, Chips y badges, Inputs, Moneda, Tablas

### Community 70 - "authGuard.ts"
Cohesion: 0.07
Nodes (26): AuthRequestInfo, authService, MAX_INTENTOS_FALLIDOS, SesionUsuario, VENTANA_BLOQUEO_MIN, base64url(), fromBase64url(), JwtPayload (+18 more)

### Community 71 - "10. Pantallas de formularios"
Cohesion: 0.50
Nodes (4): 10. Pantallas de formularios, Campos automáticos, Organización, Validación

### Community 72 - "2. Objetivo y principios de diseño"
Cohesion: 0.50
Nodes (4): 2. Objetivo y principios de diseño, Apple Human Interface Guidelines, Fluent Design, Material Design 3

### Community 73 - "fastify"
Cohesion: 0.15
Nodes (6): envRaw, H, envRaw, H, Ids, fastify

### Community 74 - "leafVisible"
Cohesion: 0.22
Nodes (6): ALL_LEAVES, leafVisible(), FlowStep, FlowStepper(), StepDef, STEPS

### Community 75 - "5. Arquitectura de la interfaz"
Cohesion: 0.50
Nodes (4): 5. Arquitectura de la interfaz, Barra superior, Contenido, Sidebar

### Community 76 - "4. Tipografía e iconografía"
Cohesion: 0.67
Nodes (3): 4. Tipografía e iconografía, Iconografía, Tipografía

### Community 77 - "9. Pantallas de Catálogos y Productos"
Cohesion: 0.67
Nodes (3): 9. Pantallas de Catálogos y Productos, Catálogo, Nuevo Producto en el Catálogo Permanente

### Community 78 - "useNotificaciones.ts"
Cohesion: 0.27
Nodes (9): BandejaPendientes, fetchPendientes(), Notificacion, NotiTipo, VACIA, useNotificaciones(), VACIA, ICONO (+1 more)

### Community 79 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, jsdom, tailwindcss, @tailwindcss/vite, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react (+5 more)

### Community 80 - "DocumentoAppService"
Cohesion: 0.16
Nodes (6): CampoDetalle, ColumnaLinea, DocumentoDetalle(), Row, DocumentoAppService, TipoDocAdjunto

### Community 81 - "primitives.tsx"
Cohesion: 0.09
Nodes (16): HistorialAprobacion(), Row, catalogService(), estadoLabel(), estadoTono, LABEL, PRIORIDAD_LABEL, PRIORIDAD_TONO (+8 more)

### Community 82 - "6. Fase actual y qué sigue (backlog priorizado)"
Cohesion: 0.22
Nodes (9): 6.1 Endurecer autenticación — ✅ HECHO (2026-09-10, ver §5.0), 6.2 Alcance por departamento / equipo — ✅ HECHO (2026-09-10, ver §5.-1), 6.3 `withTelemetry` (Decorator) en los CRUD genéricos — ✅ HECHO (2026-09-10), 6.4 Empaquetado Docker — ✅ HECHO (2026-09-10, ver §5.-1), 6.5 Pulido / intuitividad de frontend — ✅ HECHO (2026-09-10, ver §5.-2), 6.6 Analítica del dashboard — ✅ HECHO (2026-09-10, ver §5.-5 y `docs/03-...`), 6.7 Backlog opcional post‑Fase 6 — ✅ HECHO (2026-09-10, ver §5.-8 y `docs/05-...`), 6.8 Opcional / backlog residual (no bloqueante) (+1 more)

### Community 83 - "Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Adjuntos en Devolución a proveedor, 2. Vista previa inline de adjuntos, 3. Editar líneas de cotización desde el frontend, 4-bis. Acciones de fila uniformes (todas las tablas del sistema), 4. Reversa de recepción que ya alimentó CxP, 5. Verificación, 6. Puntos de entrada nuevos / tocados (+6 more)

### Community 84 - "apiClient.ts"
Cohesion: 0.36
Nodes (6): api, ApiRequestError, client, guard(), toApiRequestError(), isAppError()

### Community 85 - "transaccional.ts"
Cohesion: 0.11
Nodes (23): ReconciliacionService, authGuardAny(), auditContextOf(), cotizaciones, devoluciones, DocumentoService, envelope(), idParam() (+15 more)

### Community 87 - "Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo"
Cohesion: 0.20
Nodes (9): 0. Resumen ejecutivo, 1. Aclaración de dudas del negocio, 2. MinIO (almacenamiento de objetos S3), 3. Adjuntos de documentos, 4. Pantalla de Cotizaciones más entendible, 5. CRUD de los documentos del ciclo (con cerrojo por estado), 6. Verificación, 7. Puntos de entrada nuevos (+1 more)

### Community 88 - "Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Análisis del módulo (resumen — detalle con cita en el plan), 2. WS1 — Sistema de columnas de `DataTable` (UI de listas), 3. WS2 — Gating de acciones por permiso, 4. WS3 — Rollback del estado de la OC en reversa/borrado de recepción, 5. WS4 — Resiliencia del bus de eventos, 6. WS5 — Pantallas de Seguimiento / Excepciones de OC, 7. Verificación (+2 more)

### Community 89 - "nav.test.ts"
Cohesion: 0.18
Nodes (6): Suite(), NavLeaf, NavSection, leafConPermiso, leafSinPermiso, visibleLeaves()

### Community 90 - "descriptorHelpers.ts"
Cohesion: 0.18
Nodes (12): AuditMode, buildDescriptor(), camelPk(), col(), ColOpts, CREATED_AUDIT_COLUMNS, MODIFIED_AUDIT_COLUMNS, pkCol() (+4 more)

### Community 91 - "analitica.ts"
Cohesion: 0.12
Nodes (18): AhorroAdjudicacionResumen, clampMeses(), DashboardResumen, DashboardService, MES_LABEL, PuntoCompraMes, PuntoRotacionMes, rejillaMeses() (+10 more)

### Community 92 - "Dashboard.tsx"
Cohesion: 0.19
Nodes (11): DashboardResumen, dashboardService, formatMoney(), AYUDA_DASHBOARD, Counts, Dashboard(), OC_ORDEN, OrdenesPorEstado() (+3 more)

### Community 93 - "normalizePageQuery"
Cohesion: 0.36
Nodes (11): ExistenciaRow, KardexRow, onRecepcionRegistrada(), onRecepcionReversada(), registerKardexSubscriber(), ultimoSaldo(), upsertExistencia(), yaProcesado() (+3 more)

### Community 95 - "adjuntos.ts"
Cohesion: 0.19
Nodes (12): TipoDocumentoAdjunto, adjuntos, DocDef, DOCS, idParam(), R_COTIZACION, R_DEVOLUCION, R_OC (+4 more)

### Community 96 - "Logger.ts"
Cohesion: 0.18
Nodes (4): LEVEL_WEIGHT, LogFields, LogLevel, ScopedLogger

### Community 97 - "StateMachine"
Cohesion: 0.24
Nodes (4): StateMachine, ORDEN_COMPRA_ESTADOS, OcEstado, ocMachine

### Community 99 - "ValidationError"
Cohesion: 0.13
Nodes (15): ordenCompraStateMachine, CrudServiceOptions, CrearOrdenInput, LineaInput, OrdenCompraService, ErrorDetail, ValidationError, checkValue() (+7 more)

### Community 100 - "http"
Cohesion: 0.14
Nodes (12): http, AsistenteCotizacion(), alCrearRfq(), avanzar(), cerrarPasoCotizacion(), Paso, Proveedor, DOCUMENT_FORMS (+4 more)

### Community 102 - "Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Por qué este alcance y no otro, 2. Infraestructura nueva, 3. Tests de lógica pura, 4. `ui/DataTable.test.tsx` (13 casos), 5. `ui/FlowStepper.test.tsx` (2 casos), 6. Verificación, 7. Puntos de entrada nuevos / tocados (+2 more)

### Community 103 - "nav.ts"
Cohesion: 0.16
Nodes (17): AuthProvider(), grants(), grantsAny(), PermisoCodigo, Permisos, READ_COTIZACIONES, READ_DEVOLUCIONES, READ_FLUJO (+9 more)

### Community 104 - "DownloadService.ts"
Cohesion: 0.27
Nodes (3): DocumentDownloadService, downloadService, triggerDownload()

### Community 106 - "SolicitudCompraService.ts"
Cohesion: 0.11
Nodes (18): OrdenCompraEstado, RecepcionEstado, RfqEstado, SOLICITUD_NIVEL, SolicitudEstado, solicitudStateMachine, AjusteRenglon, CrearSolicitudInput (+10 more)

### Community 108 - "CompraReadRepository.ts"
Cohesion: 0.13
Nodes (16): GastoProveedorItem, normFecha(), ReporteDesempenoProveedores, ReporteGastoProveedor, ReporteOcPendientes, ReporteService, AhorroAdjudicacionRow, asBinds() (+8 more)

### Community 109 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 111 - "logger"
Cohesion: 0.21
Nodes (5): registerComprasSubscribers(), env(), loadDotenv(), logger, main()

### Community 112 - "parseListQuery.ts"
Cohesion: 0.25
Nodes (8): FilterOperator, readOnlyList(), listQuery(), first(), OPERATORS, parseListQuery(), RawQuery, RESERVED

### Community 113 - "SegAuthRepository.ts"
Cohesion: 0.13
Nodes (8): Accesos, asBinds(), AuthUserRow, EventoAcceso, Row, segAuthRepository, SesionRow, UsuarioDemoRow

### Community 114 - "dependencies"
Cohesion: 0.67
Nodes (3): dependencies, react, react-dom

### Community 115 - "BaseCrudController"
Cohesion: 0.28
Nodes (3): BaseCrudController, extractVersion(), parseId()

### Community 118 - "e2e-negocio-real.mjs"
Cohesion: 0.42
Nodes (8): api(), check(), expectStatus(), login(), main(), record(), results, section()

### Community 119 - "Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo"
Cohesion: 0.29
Nodes (6): 0. Resumen ejecutivo, 1. Cómo se llegó aquí (cronología de la sesión), 2. Estado final verificado, 3. Qué NO cambió (deliberadamente, y sigue vigente), 4. Sin pendientes de alcance, Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo

### Community 120 - "CrudService.ts"
Cohesion: 0.11
Nodes (8): CrudServiceOptions, Page, QueryParams, HttpRepository, IRepository, ListQuery, repositoryFactory, RestRepository

### Community 121 - "alcanceDepartamento.int.test.ts"
Cohesion: 0.53
Nodes (5): bearer(), crearSolicitud(), Fk, idsVisibles(), token()

### Community 122 - "catalogsCrud.int.test.ts"
Cohesion: 0.33
Nodes (4): cases, CrudCase, ids, RefIds

## Knowledge Gaps
- **721 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+716 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 948 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `DataTable.tsx`, `frontend/package.json`, `CompraServices.ts`, `format.ts`, `DataTable.test.tsx`, `Toast.tsx`, `formSupport.ts`, `useResource.ts`, `RefContext.tsx`, `DocumentoList.tsx`, `AppShell.tsx`, `AuthContext.tsx`, `leafVisible`, `useNotificaciones.ts`, `DocumentoAppService`, `primitives.tsx`, `nav.test.ts`, `Dashboard.tsx`, `http`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `fastify` connect `fastify` to `referencias.ts`, `seedFlujoDemo.ts`, `backend/package.json`, `authGuard.ts`, `catalogsCrud.int.test.ts`, `testApp.ts`, `documentoUpdate.int.test.ts`, `authGuard`, `Query.ts`, `transaccional.ts`, `alcanceDepartamento.int.test.ts`, `app.ts`, `analitica.ts`, `adjuntos.ts`, `AppError.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `oracledb` connect `AppError.ts` to `ValidationError`, `seedFlujoDemo.ts`, `backend/package.json`, `fastify`, `SolicitudCompraService.ts`, `testApp.ts`, `CompraReadRepository.ts`, `SegAuthRepository.ts`, `deploy.ts`, `RecepcionService.ts`, `repositoryFactory`, `normalizePageQuery`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _721 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SEG_USUARIO` be split into smaller, more focused modules?**
  _Cohesion score 0.06833457804331591 - nodes in this community are weakly interconnected._
- **Should `PdfBuilder` be split into smaller, more focused modules?**
  _Cohesion score 0.058747160012982795 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
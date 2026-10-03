# Graph Report - sw-inventario  (2026-09-12)

## Corpus Check
- 200 files · ~263,660 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2114 nodes · 4608 edges · 108 communities (88 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.81)
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
- RfqService.ts
- Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)
- CompraServices.ts
- BaseOracleRepository
- adjuntos.ts
- CLAUDE.md
- GEMINI.md
- oracledb
- HttpClient.ts
- CrudService
- DataTable.test.tsx
- 11. Experiencia interactiva y accesibilidad (UX Intuitivo)
- rbac-crud-matrix.mjs
- 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)
- permissions.ts
- 2. Roles: quién ve y hace qué
- 8. Pantallas clave — Gestión de Compras
- mapOracleError
- 5. Lo realizado en detalle (bloques, orden cronológico inverso)
- Toast.tsx
- messageOf
- CrudPage.tsx
- fastify
- Avance 03 — Analítica del dashboard: series temporales + índice de ahorro
- useResource.ts
- sw-inventario · Módulo de Compras (COM_)
- authGuard.ts
- RefContext.tsx
- AuditContext
- Catálogos y campos de referencia — Módulo de Gestión de Compras
- seedFlujoDemo.ts
- OrdenCompraService.ts
- Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras
- AppError.ts
- CrudRepository
- documentForms.ts
- Avance 06 — Roles endurecidos + inferencia de datos en los formularios
- DocumentoList.tsx
- react
- Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras
- ValidationError
- AuthState
- ReporteAppService
- BaseOracleRepository.ts
- 7. Componentes reutilizables
- AuthService.ts
- 10. Pantallas de formularios
- 2. Objetivo y principios de diseño
- 5. Arquitectura de la interfaz
- 4. Tipografía e iconografía
- 9. Pantallas de Catálogos y Productos
- OrdenCompraPreview.tsx
- AdjuntoAppService
- DocumentoAppService
- primitives.tsx
- 6. Fase actual y qué sigue (backlog priorizado)
- Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP
- apiClient.ts
- transaccional.ts
- Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo
- Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales
- descriptorHelpers.ts
- DashboardService.ts
- Dashboard.tsx
- RecepcionService.ts
- BaseHeaderDetailRepository
- AppError
- logger
- analitica.ts
- Charts.tsx
- AsistenteCotizacion
- Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)
- nav.ts
- EnvConfig.ts
- ComparativoAppService
- CompraReadRepository.ts
- authGuard
- app.ts
- e2e-negocio-real.mjs
- Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo
- Repository.ts
- e2e-ciclos-faltantes.mjs

## God Nodes (most connected - your core abstractions)
1. `SEG_USUARIO` - 104 edges
2. `AuditContext` - 91 edges
3. `oraclePool` - 65 edges
4. `ValidationError` - 61 edges
5. `NotFoundError` - 60 edges
6. `mapOracleError()` - 49 edges
7. `messageOf()` - 46 edges
8. `CompraReadRepository` - 45 edges
9. `5. Lo realizado en detalle (bloques, orden cronológico inverso)` - 41 edges
10. `logger` - 34 edges

## Surprising Connections (you probably didn't know these)
- `buildApp()` --indirect_call--> `errorHandler()`  [INFERRED]
  backend/src/app.ts → backend/src/presentation/middlewares/errorHandler.ts
- `confirmDelete()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/core/errors.ts
- `alCrearRfq()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/modules/compras/AsistenteCotizacion.tsx → frontend/src/core/errors.ts
- `entrar()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/modules/LoginScreen.tsx → frontend/src/core/errors.ts
- `buildApp()` --calls--> `registerAuthRoutes()`  [EXTRACTED]
  backend/src/app.ts → backend/src/presentation/routes/auth.ts

## Import Cycles
- None detected.

## Communities (108 total, 10 thin omitted)

### Community 0 - "SEG_USUARIO"
Cohesion: 0.07
Nodes (103): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+95 more)

### Community 1 - "PdfBuilder"
Cohesion: 0.05
Nodes (31): AdjuntoService, assertRef(), maxBytes(), saneNombre(), ComparativoPdfService, money(), ComparativoService, ComparativoSolicitud (+23 more)

### Community 2 - "referencias.ts"
Cohesion: 0.25
Nodes (11): CXP_FACTURA_PROVEEDOR, INV_ARTICULO, INV_BODEGA, INV_EXISTENCIA_BODEGA, INV_KARDEX_MOVIMIENTO, INV_UNIDAD_MEDIDA, NOM_DEPARTAMENTO, NOM_EMPLEADO (+3 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.08
Nodes (30): HistorialResp, historialService, prioridadLabel(), prioridadTono(), formatMoney(), formatPercent(), formatQty(), formatRate() (+22 more)

### Community 4 - "HttpClient"
Cohesion: 0.13
Nodes (3): NetworkError, HttpClient, safeStorageGet()

### Community 5 - "backend/package.json"
Cohesion: 0.05
Nodes (41): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-transformer, class-validator, fastify, @fastify/multipart, oracledb (+33 more)

### Community 6 - "NotFoundError"
Cohesion: 0.14
Nodes (9): CotizacionService, DevolucionProveedorService, RecepcionService, ReconciliacionService, BusinessRuleError, NotFoundError, normalizePageQuery(), CotizacionDetalle (+1 more)

### Community 7 - "frontend/package.json"
Cohesion: 0.05
Nodes (37): dependencies, react, react-dom, devDependencies, jsdom, tailwindcss, @tailwindcss/vite, @testing-library/jest-dom (+29 more)

### Community 8 - "com/descriptors.ts"
Cohesion: 0.05
Nodes (33): StateMachine, ESTADO_LABEL, estadoLabel(), COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO (+25 more)

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
Cohesion: 0.13
Nodes (6): oraclePool, asBinds(), CompraReadRepository, iso(), num(), registerComReferenciaRoutes()

### Community 16 - "RfqService.ts"
Cohesion: 0.13
Nodes (14): rfqStateMachine, rfqIdsEnAlcance(), solicitudIdsEnAlcance(), CotizacionHeader, RfqHeader, RfqProveedor, SYSTEM_AUDIT_CONTEXT, DEFAULT_PAGE_SIZE (+6 more)

### Community 17 - "Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)"
Cohesion: 0.29
Nodes (6): 1. División Estructural del Repositorio, 2. Definición del Stack Tecnológico, 3. Especificaciones de la Base de Datos (Oracle 21c), 4. Arquitectura y Escalabilidad con Docker, 5. Reglas Técnicas de Frontend (React + Vite + Tailwind v4), Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)

### Community 18 - "CompraServices.ts"
Cohesion: 0.08
Nodes (23): humanBytes(), Preview, AdjuntoMeta, adjuntoService, catalogCache, DashboardAppService, DesempenoProveedorItem, GastoProveedorItem (+15 more)

### Community 19 - "BaseOracleRepository"
Cohesion: 0.18
Nodes (5): asBinds(), auditUser(), BaseOracleRepository, ColumnDescriptor, findColumn()

### Community 21 - "adjuntos.ts"
Cohesion: 0.19
Nodes (12): TipoDocumentoAdjunto, adjuntos, DocDef, DOCS, idParam(), R_COTIZACION, R_DEVOLUCION, R_OC (+4 more)

### Community 27 - "oracledb"
Cohesion: 0.10
Nodes (26): countAllTables(), countComTables(), EnvVars, HERE, loadEnv(), main(), REPO_ROOT, runFullDdl() (+18 more)

### Community 28 - "HttpClient.ts"
Cohesion: 0.17
Nodes (12): AppError, ConflictError, ErrorDetail, ForbiddenError, LockedError, NotFoundError, ServerError, UnauthorizedError (+4 more)

### Community 30 - "DataTable.test.tsx"
Cohesion: 0.12
Nodes (9): toggleAll(), BASE_COLUMNS, FakeResizeObserver, Row, rowKey(), ROWS, { PERM_RFQ, hasAnyPerm }, @testing-library/react (+1 more)

### Community 31 - "11. Experiencia interactiva y accesibilidad (UX Intuitivo)"
Cohesion: 0.22
Nodes (9): 11. Experiencia interactiva y accesibilidad (UX Intuitivo), Asistente y guiado, Atajos rápidos, Confirmación explícita, Contraste y accesibilidad, Hints y Tooltips, Loading skeletons, Navegación por teclado (+1 more)

### Community 32 - "rbac-crud-matrix.mjs"
Cohesion: 0.11
Nodes (21): ACCIONES_ESPECIALES, APROBAR, assertExpected(), assertNo5xx(), call(), CATALOGOS, CATALOGOS_READ, DOCUMENTOS (+13 more)

### Community 33 - "1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)"
Cohesion: 0.09
Nodes (22): 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2), 2. Patrones GoF (`skills/patron-arquitectura.md` §4), 3-bis. POO en el FRONTEND (`frontend/src/`), 3. Modelo de lectura / trazabilidad (Fase 5), 4. Cobertura del flujo completo, 4. Cómo se sostiene "limpio, ordenado y profesional", Abstracción, Alta cohesión y bajo acoplamiento (+14 more)

### Community 34 - "permissions.ts"
Cohesion: 0.15
Nodes (15): empleadosEnAlcance(), ROLES_SIN_ALCANCE, BandejaPendientes, NADA, Notificacion, notificacionService, NotiTipo, hasPermiso() (+7 more)

### Community 35 - "2. Roles: quién ve y hace qué"
Cohesion: 0.20
Nodes (9): 1. El flujo, paso a paso, y qué lo cubre en el sistema, 2. Roles: quién ve y hace qué, Catálogo de permisos (módulo `COMPRAS`), Diagrama del ciclo, Flujo del sistema y modelo de roles — Gestión de Compras, Jerarquía de aprobación y autorización, Qué ve cada rol en el menú, Roles y sus permisos (+1 more)

### Community 36 - "8. Pantallas clave — Gestión de Compras"
Cohesion: 0.25
Nodes (8): 8. Pantallas clave — Gestión de Compras, Catálogo, Cotizaciones, Facturación / CxP, Proveedores, Recepción, Solicitudes, Órdenes de Compra

### Community 38 - "5. Lo realizado en detalle (bloques, orden cronológico inverso)"
Cohesion: 0.05
Nodes (41): 5.0 Endurecimiento de autenticación (subfase 6.1) — 2026-09-10, 5.-10 Roles endurecidos + inferencia de datos en formularios — 2026-09-10, 5.-11 Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales — 2026-09-10, 5.-12 Primera suite de tests del frontend (infra + cobertura inicial) — 2026-09-10, 5.-13 Acceso al PDF de la cotización desde el Comparativo — 2026-09-10/11, 5.-14 Asistente guiado RFQ→Cotización→Comparativo→OC + fusión Comprador/Financiero — 2026-09-11, 5.-15 Fixes tras probar el asistente en vivo: select ilegible ("#187") + "Autoriza la orden" sin filtrar — 2026-09-11, 5.-16 Revertida la fusión Comprador/Financiero — 2026-09-11 (+33 more)

### Community 39 - "Toast.tsx"
Cohesion: 0.18
Nodes (5): Ctx, ToastApi, ToastItem, ToastTone, TONE

### Community 40 - "messageOf"
Cohesion: 0.14
Nodes (24): AdjuntosPanel(), descargar(), eliminar(), onFile(), ver(), messageOf(), ComparativoView(), adjudicar() (+16 more)

### Community 41 - "CrudPage.tsx"
Cohesion: 0.06
Nodes (40): CrudFieldDef, CrudPage(), confirmDelete(), openCreate(), openEdit(), save(), CrudPageConfig, Row (+32 more)

### Community 42 - "fastify"
Cohesion: 0.06
Nodes (43): Ids, inTwoWeeks, state, bearer(), crearSolicitud(), Fk, idsVisibles(), token() (+35 more)

### Community 43 - "Avance 03 — Analítica del dashboard: series temporales + índice de ahorro"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Decisiones de métrica (respuestas del usuario), 2.1 `dal/repositories/com/CompraReadRepository.ts` — 3 consultas nuevas, 2.2 `bll/services/com/DashboardService.ts` (nuevo), 2.3 `presentation/routes/com/analitica.ts`, 2. Backend, 3.1 `core/CompraServices.ts`, 3.2 `ui/Charts.tsx` (nuevo, exports nombrados — convención de `ui/`) (+6 more)

### Community 44 - "useResource.ts"
Cohesion: 0.11
Nodes (19): CrudServiceOptions, AppEventName, AppEvents, EntityChangedPayload, eventBus, Handler, ToastPayload, PageMeta (+11 more)

### Community 45 - "sw-inventario · Módulo de Compras (COM_)"
Cohesion: 0.33
Nodes (5): Docker, La tesis POO: configurar, no programar, Pruebas, Puesta en marcha, sw-inventario · Módulo de Compras (COM_)

### Community 46 - "authGuard.ts"
Cohesion: 0.25
Nodes (10): base64url(), fromBase64url(), JwtPayload, signJwt(), verifyJwt(), UnauthorizedError, fastify, FastifyRequest (+2 more)

### Community 47 - "RefContext.tsx"
Cohesion: 0.15
Nodes (10): ALL_KINDS, DOC_PREFIX, DocRef, FALLBACK, RefContext, RefKind, RefProvider(), Refs (+2 more)

### Community 49 - "AuditContext"
Cohesion: 0.11
Nodes (9): BaseCrudService, SolicitudCompraService, ForbiddenError, AuditContext, validateDto(), IRepository, SolicitudCompra, SolicitudDetalle (+1 more)

### Community 50 - "Catálogos y campos de referencia — Módulo de Gestión de Compras"
Cohesion: 0.20
Nodes (9): 1. Tipos de "catálogo" en el módulo, 2. Datos semilla cargados (`database/dml/`), 3. Campos corregidos (eran texto/ID libre, ahora son catálogo), 4. Campos que quedan como texto libre (correcto), 5. Pendiente (catálogos estáticos ya definidos, faltan sus pantallas), Catálogos (`frontend/src/modules/compras/catalogPages.tsx`), Catálogos y campos de referencia — Módulo de Gestión de Compras, Comparativo de cotizaciones (`ComparativoView.tsx`) (+1 more)

### Community 51 - "seedFlujoDemo.ts"
Cohesion: 0.21
Nodes (14): CICLOS, CicloSpec, crearCiclo(), daysFromNow(), envRaw, H, idsTop(), inj() (+6 more)

### Community 52 - "OrdenCompraService.ts"
Cohesion: 0.11
Nodes (21): OrdenCompraEstado, ordenCompraStateMachine, RecepcionEstado, RfqEstado, SolicitudEstado, solicitudStateMachine, CrearOrdenInput, LineaInput (+13 more)

### Community 53 - "Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras"
Cohesion: 0.18
Nodes (10): 1. Qué es el proyecto, 2. Stack y comandos, 3. Arquitectura (6 capas, flujo unidireccional hacia abajo), 4. Estado por fases, 7. Cómo levantar y verificar, 8. Mapa de archivos de referencia, 9. Convenciones al retomar, Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras (+2 more)

### Community 54 - "AppError.ts"
Cohesion: 0.11
Nodes (26): SOLICITUD_NIVEL, AdjuntoMeta, Manifiesto, MIME_PERMITIDOS, REPOS, TABLA, CotizacionEnComparativo, LineaComparativo (+18 more)

### Community 55 - "CrudRepository"
Cohesion: 0.29
Nodes (3): InternalError, CrudRepository, articuloRepository()

### Community 56 - "documentForms.ts"
Cohesion: 0.06
Nodes (33): CALIFICACION_PROVEEDOR, CRITERIO_COMPARATIVO, ESTADO_AI, ESTADO_SEGUIMIENTO_ORDEN, MOTIVO_DEVOLUCION, PRIORIDAD_SOLICITUD, TIPO_EXCEPCION_ORDEN, ComparativoDTO (+25 more)

### Community 57 - "Avance 06 — Roles endurecidos + inferencia de datos en los formularios"
Cohesion: 0.12
Nodes (16): 0. Resumen ejecutivo, 1. La jerarquía de roles (respuesta a "no entiendo la lógica"), 2. Por qué "el bodeguero veía todo" — diagnóstico, 3.1 Atajo `X-Dev-User` cerrado por defecto, 3.2 Lectura por documento (segregación de funciones), 3.3 Alcance por departamento en RFQ y Cotización, 3.4 Verificado en vivo (login real, sin atajo), 3. Roles endurecidos (backend) (+8 more)

### Community 58 - "DocumentoList.tsx"
Cohesion: 0.07
Nodes (27): HistorialAprobacion(), Row, catalogService(), CALIFICACION_ESTRELLAS, calificacionProveedorEstrellas(), estadoLabel(), LABEL, PRIORIDAD_LABEL (+19 more)

### Community 59 - "react"
Cohesion: 0.08
Nodes (20): http, EmpresaConfig, FALLBACK, useEmpresaConfig(), container, LoginScreen(), entrar(), ROL_LABEL (+12 more)

### Community 62 - "Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras"
Cohesion: 0.12
Nodes (15): 0. Resumen ejecutivo, 1. Autenticación endurecida (6.1), 2. Alcance por departamento/equipo (6.2 + endurecimiento), 3.1 Catálogo de permisos (14, módulo `COMPRAS`), 3.2 Matriz de roles (qué puede hacer cada uno), 3.3 Gating en el frontend, 3. Modelo de roles — jerarquía correcta, 4. Bandeja de pendientes (notificaciones) (+7 more)

### Community 63 - "ValidationError"
Cohesion: 0.19
Nodes (7): RfqService, ValidationError, checkValue(), isSystemColumn(), Mode, validateAgainstDescriptor(), WithDetails

### Community 66 - "BaseOracleRepository.ts"
Cohesion: 0.13
Nodes (11): CrudServiceOptions, OptimisticLockError, buildPaginated(), BindMap, SQL_OPERATOR, BuildOpts, AuditDescriptor, ColumnType (+3 more)

### Community 68 - "7. Componentes reutilizables"
Cohesion: 0.33
Nodes (6): 7. Componentes reutilizables, Botones, Chips y badges, Inputs, Moneda, Tablas

### Community 70 - "AuthService.ts"
Cohesion: 0.14
Nodes (9): AuthRequestInfo, authService, MAX_INTENTOS_FALLIDOS, SesionUsuario, VENTANA_BLOQUEO_MIN, derive(), hashPassword(), verifyPassword() (+1 more)

### Community 71 - "10. Pantallas de formularios"
Cohesion: 0.50
Nodes (4): 10. Pantallas de formularios, Campos automáticos, Organización, Validación

### Community 72 - "2. Objetivo y principios de diseño"
Cohesion: 0.50
Nodes (4): 2. Objetivo y principios de diseño, Apple Human Interface Guidelines, Fluent Design, Material Design 3

### Community 75 - "5. Arquitectura de la interfaz"
Cohesion: 0.50
Nodes (4): 5. Arquitectura de la interfaz, Barra superior, Contenido, Sidebar

### Community 76 - "4. Tipografía e iconografía"
Cohesion: 0.67
Nodes (3): 4. Tipografía e iconografía, Iconografía, Tipografía

### Community 77 - "9. Pantallas de Catálogos y Productos"
Cohesion: 0.67
Nodes (3): 9. Pantallas de Catálogos y Productos, Catálogo, Nuevo Producto en el Catálogo Permanente

### Community 78 - "OrdenCompraPreview.tsx"
Cohesion: 0.18
Nodes (7): Header, Linea, num2(), OrdenCompraPreview(), DocumentDownloadService, downloadService, triggerDownload()

### Community 80 - "DocumentoAppService"
Cohesion: 0.16
Nodes (6): CampoDetalle, ColumnaLinea, DocumentoDetalle(), Row, DocumentoAppService, TipoDocAdjunto

### Community 81 - "primitives.tsx"
Cohesion: 0.11
Nodes (8): estadoTono, ButtonVariant, Chip, ChipTone, EstadoChip(), Tone, TONE_BG, TONE_FG

### Community 82 - "6. Fase actual y qué sigue (backlog priorizado)"
Cohesion: 0.22
Nodes (9): 6.1 Endurecer autenticación — ✅ HECHO (2026-09-10, ver §5.0), 6.2 Alcance por departamento / equipo — ✅ HECHO (2026-09-10, ver §5.-1), 6.3 `withTelemetry` (Decorator) en los CRUD genéricos — ✅ HECHO (2026-09-10), 6.4 Empaquetado Docker — ✅ HECHO (2026-09-10, ver §5.-1), 6.5 Pulido / intuitividad de frontend — ✅ HECHO (2026-09-10, ver §5.-2), 6.6 Analítica del dashboard — ✅ HECHO (2026-09-10, ver §5.-5 y `docs/03-...`), 6.7 Backlog opcional post‑Fase 6 — ✅ HECHO (2026-09-10, ver §5.-8 y `docs/05-...`), 6.8 Opcional / backlog residual (no bloqueante) (+1 more)

### Community 83 - "Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Adjuntos en Devolución a proveedor, 2. Vista previa inline de adjuntos, 3. Editar líneas de cotización desde el frontend, 4-bis. Acciones de fila uniformes (todas las tablas del sistema), 4. Reversa de recepción que ya alimentó CxP, 5. Verificación, 6. Puntos de entrada nuevos / tocados (+6 more)

### Community 84 - "apiClient.ts"
Cohesion: 0.21
Nodes (8): api, ApiRequestError, client, guard(), toApiRequestError(), isAppError(), Page, ListQuery

### Community 85 - "transaccional.ts"
Cohesion: 0.11
Nodes (22): authGuardAny(), cotizaciones, devoluciones, DocumentoService, envelope(), idParam(), listQuery(), ordenes (+14 more)

### Community 87 - "Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo"
Cohesion: 0.20
Nodes (9): 0. Resumen ejecutivo, 1. Aclaración de dudas del negocio, 2. MinIO (almacenamiento de objetos S3), 3. Adjuntos de documentos, 4. Pantalla de Cotizaciones más entendible, 5. CRUD de los documentos del ciclo (con cerrojo por estado), 6. Verificación, 7. Puntos de entrada nuevos (+1 more)

### Community 88 - "Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Análisis del módulo (resumen — detalle con cita en el plan), 2. WS1 — Sistema de columnas de `DataTable` (UI de listas), 3. WS2 — Gating de acciones por permiso, 4. WS3 — Rollback del estado de la OC en reversa/borrado de recepción, 5. WS4 — Resiliencia del bus de eventos, 6. WS5 — Pantallas de Seguimiento / Excepciones de OC, 7. Verificación (+2 more)

### Community 90 - "descriptorHelpers.ts"
Cohesion: 0.20
Nodes (11): AuditMode, buildDescriptor(), camelPk(), col(), ColOpts, CREATED_AUDIT_COLUMNS, MODIFIED_AUDIT_COLUMNS, pkCol() (+3 more)

### Community 91 - "DashboardService.ts"
Cohesion: 0.22
Nodes (9): AhorroAdjudicacionResumen, clampMeses(), DashboardResumen, DashboardService, MES_LABEL, PuntoCompraMes, PuntoRotacionMes, rejillaMeses() (+1 more)

### Community 92 - "Dashboard.tsx"
Cohesion: 0.22
Nodes (9): DashboardResumen, dashboardService, AYUDA_DASHBOARD, Counts, Dashboard(), OC_ORDEN, Q_COMPACT, total() (+1 more)

### Community 93 - "RecepcionService.ts"
Cohesion: 0.16
Nodes (15): recepcionStateMachine, hoyIsoDate(), onRecepcionRegistrada(), onRecepcionReversada(), ComEventName, ComEvents, OrdenCompraEstadoPayload, RecepcionRegistradaPayload (+7 more)

### Community 95 - "AppError"
Cohesion: 0.12
Nodes (12): AppError, ConflictError, ForeignKeyError, asOracleError(), OracleErrorShape, Accesos, asBinds(), AuthUserRow (+4 more)

### Community 96 - "logger"
Cohesion: 0.07
Nodes (24): registerCxpSubscriber(), registerComprasSubscribers(), ExistenciaRow, KardexRow, onRecepcionRegistrada(), onRecepcionReversada(), registerKardexSubscriber(), ultimoSaldo() (+16 more)

### Community 97 - "analitica.ts"
Cohesion: 0.27
Nodes (9): comparativo, comparativoPdf, dashboard, idParam(), intQuery(), READ, registerComAnaliticaRoutes(), strQuery() (+1 more)

### Community 100 - "AsistenteCotizacion"
Cohesion: 0.50
Nodes (4): AsistenteCotizacion(), alCrearRfq(), avanzar(), cerrarPasoCotizacion()

### Community 102 - "Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Por qué este alcance y no otro, 2. Infraestructura nueva, 3. Tests de lógica pura, 4. `ui/DataTable.test.tsx` (13 casos), 5. `ui/FlowStepper.test.tsx` (2 casos), 6. Verificación, 7. Puntos de entrada nuevos / tocados (+2 more)

### Community 103 - "nav.ts"
Cohesion: 0.07
Nodes (35): Suite(), AuthContext, AuthProvider(), boot(), jwtExp(), Sesion, tokenVigente(), grants() (+27 more)

### Community 104 - "EnvConfig.ts"
Cohesion: 0.18
Nodes (12): AppEnvironment, AuthConfig, buildConnectString(), EmpresaConfig, env(), EnvConfig, HttpConfig, OracleConfig (+4 more)

### Community 108 - "CompraReadRepository.ts"
Cohesion: 0.12
Nodes (18): HistorialProveedorResult, GastoProveedorItem, normFecha(), ReporteDesempenoProveedores, ReporteGastoProveedor, ReporteOcPendientes, ReporteService, AhorroAdjudicacionRow (+10 more)

### Community 115 - "authGuard"
Cohesion: 0.11
Nodes (16): FilterOperator, BaseCrudController, CrudService, extractVersion(), parseId(), authGuard(), readOnlyList(), CrudRouteConfig (+8 more)

### Community 116 - "app.ts"
Cohesion: 0.14
Nodes (17): adjuntoMaxBytes(), buildApp(), buildCrudService(), AnyMethod, withTelemetry(), ComEntityKey, CRUD_OPERATIVOS, CRUD_SENSIBLES (+9 more)

### Community 118 - "e2e-negocio-real.mjs"
Cohesion: 0.42
Nodes (8): api(), check(), expectStatus(), login(), main(), record(), results, section()

### Community 119 - "Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo"
Cohesion: 0.29
Nodes (6): 0. Resumen ejecutivo, 1. Cómo se llegó aquí (cronología de la sesión), 2. Estado final verificado, 3. Qué NO cambió (deliberadamente, y sigue vigente), 4. Sin pendientes de alcance, Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo

### Community 120 - "Repository.ts"
Cohesion: 0.21
Nodes (4): QueryParams, HttpRepository, repositoryFactory, RestRepository

### Community 122 - "e2e-ciclos-faltantes.mjs"
Cohesion: 0.52
Nodes (6): api(), check(), expectStatus(), login(), main(), results

## Knowledge Gaps
- **745 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+740 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 980 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastify` connect `fastify` to `logger`, `analitica.ts`, `permissions.ts`, `referencias.ts`, `backend/package.json`, `EnvConfig.ts`, `authGuard.ts`, `authGuard`, `seedFlujoDemo.ts`, `app.ts`, `adjuntos.ts`, `transaccional.ts`, `oracledb`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `DataTable.tsx`, `nav.ts`, `frontend/package.json`, `CrudPage.tsx`, `Toast.tsx`, `useResource.ts`, `OrdenCompraPreview.tsx`, `RefContext.tsx`, `DocumentoAppService`, `CompraServices.ts`, `documentForms.ts`, `DocumentoList.tsx`, `Dashboard.tsx`, `DataTable.test.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `oracledb` connect `oracledb` to `logger`, `BaseOracleRepository.ts`, `backend/package.json`, `fastify`, `CompraReadRepository.ts`, `RfqService.ts`, `seedFlujoDemo.ts`, `OrdenCompraService.ts`, `AppError.ts`, `RecepcionService.ts`, `AppError`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _745 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SEG_USUARIO` be split into smaller, more focused modules?**
  _Cohesion score 0.06833457804331591 - nodes in this community are weakly interconnected._
- **Should `PdfBuilder` be split into smaller, more focused modules?**
  _Cohesion score 0.05002337540906966 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07827260458839407 - nodes in this community are weakly interconnected._
# Graph Report - sw-inventario  (2026-10-05)

## Corpus Check
- 267 files · ~339,790 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2804 nodes · 6245 edges · 162 communities (139 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 173 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `48a7f5a4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SEG_USUARIO
- PdfBuilder
- referencias.ts
- DataTable.tsx
- HttpClient
- backend/package.json
- ValidationError
- frontend/package.json
- com/descriptors.ts
- 6. Arquitectura de software
- compilerOptions
- Descripción de las 6 Capas
- compilerOptions
- scripts
- Compras e Inventario · Módulo ERP
- oraclePool
- concurrencia.mjs
- Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)
- CompraServices.ts
- ortografia.test.ts
- adjuntos.ts
- CLAUDE.md
- GEMINI.md
- oracledb
- HttpClient.ts
- routes/com/index.ts
- package.json
- 11. Experiencia interactiva y accesibilidad (UX Intuitivo)
- rbac-crud-matrix.mjs
- 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)
- listaUx.tsx
- 2. Roles: quién ve y hace qué
- 8. Pantallas clave — Gestión de Compras
- FileStorage.ts
- 5. Lo realizado en detalle (bloques, orden cronológico inverso)
- ComCrudService.ts
- messageOf
- CrudPage.tsx
- fastify
- Avance 03 — Analítica del dashboard: series temporales + índice de ahorro
- Repository.ts
- sw-inventario · Módulo de Compras (COM_)
- Dashboard.tsx
- AppError.ts
- AuditContext
- Catálogos y campos de referencia — Módulo de Gestión de Compras
- OrdenCompraPdfService.ts
- ComparativoService
- Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras
- Validacion
- mapearTextos
- documentForms.ts
- Avance 06 — Roles endurecidos + inferencia de datos en los formularios
- DocumentoList.tsx
- BaseOracleRepository.ts
- BaseOracleRepository
- tildes-frontend.mjs
- Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras
- ReporteService.ts
- dependencies
- ReporteAppService
- descriptorHelpers.ts
- 7. Componentes reutilizables
- AuthService.ts
- 10. Pantallas de formularios
- 2. Objetivo y principios de diseño
- logger
- useNotificaciones.ts
- 5. Arquitectura de la interfaz
- 4. Tipografía e iconografía
- 9. Pantallas de Catálogos y Productos
- scripts
- AdjuntoAppService
- aprobacionEnVivo.int.test.ts
- primitives.tsx
- 6. Fase actual y qué sigue (backlog priorizado)
- Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP
- OracleErrorAdapter.ts
- transaccional.ts
- Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo
- Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales
- Field.tsx
- react
- DashboardService.ts
- apiClient.ts
- qa-roles-smoke.mjs
- CrudService
- ReconciliacionService.ts
- S3FileStorage
- qa-notificaciones-en-vivo.mjs
- Charts.tsx
- RefContext.tsx
- RecepcionGuiada.tsx
- SegAuthRepository.ts
- Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)
- nav.ts
- EnvConfig.ts
- idempotency.ts
- qa-crud-open.mjs
- reglasNegocio.int.test.ts
- app.ts
- RfqService.ts
- devDependencies
- CompraReadRepository.ts
- DataTable.test.tsx
- cxp.ts
- Avance 11 — Coherencia de documentos, buscador real, orden "lo último primero" y resistencia del sistema
- http
- authGuard.ts
- e2e-negocio-real.mjs
- Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo
- dependencies
- useResource.ts
- e2e-ciclos-faltantes.mjs
- Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06)
- ComparativoPdfService.ts
- Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos
- format.ts
- permissions.ts
- DocumentoAppService
- qa-busqueda-orden.mjs
- searchSql.ts
- scalar
- validators.ts
- documentoUpdate.int.test.ts
- alcanceDepartamento.int.test.ts
- stateMachines.ts
- qa-listas-con-buscador.mjs
- AdjuntoService
- catalogsCrud.int.test.ts
- Toast.tsx
- LiveConnection
- gen-ddl-limits.ts
- LiquidacionService.ts
- formSupport.ts
- DocumentForm
- ComparativoAppService
- Auditoría del frontend (UX/UI, responsive, proporción áurea) y resiliencia de almacenamiento — 2026-10-06
- ErrorBoundary.tsx
- dev.mjs
- EntityDescriptor.ts
- analitica.ts
- useResource
- StateMachine.ts
- DocumentForm.tsx
- qa-recepcion-conforme.mjs
- ScopedLogger
- DomainEventBus
- adjuntosYCrud.int.test.ts
- devolucionAdjuntosYReversa.int.test.ts
- stateMachine.test.ts
- descriptorValidation.test.ts

## God Nodes (most connected - your core abstractions)
1. `SEG_USUARIO` - 104 edges
2. `AuditContext` - 98 edges
3. `oraclePool` - 83 edges
4. `ValidationError` - 70 edges
5. `NotFoundError` - 67 edges
6. `mapOracleError()` - 66 edges
7. `CompraReadRepository` - 61 edges
8. `messageOf()` - 54 edges
9. `5. Lo realizado en detalle (bloques, orden cronológico inverso)` - 45 edges
10. `react` - 42 edges

## Surprising Connections (you probably didn't know these)
- `scanCode()` --indirect_call--> `n()`  [INFERRED]
  scripts/tildes-lib.mjs → frontend/src/modules/compras/DocumentoList.tsx
- `buildApp()` --indirect_call--> `errorHandler()`  [INFERRED]
  backend/src/app.ts → backend/src/presentation/middlewares/errorHandler.ts
- `ensureBodega()` --calls--> `scalar()`  [EXTRACTED]
  backend/tests/dashboard.int.test.ts → backend/tests/helpers/testApp.ts
- `confirmDelete()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/core/errors.ts
- `entrar()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/modules/LoginScreen.tsx → frontend/src/core/errors.ts

## Import Cycles
- None detected.

## Communities (162 total, 13 thin omitted)

### Community 0 - "SEG_USUARIO"
Cohesion: 0.07
Nodes (103): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+95 more)

### Community 1 - "PdfBuilder"
Cohesion: 0.23
Nodes (6): money(), moneyCompact(), pct(), rango(), ReportePdfService, PdfBuilder

### Community 2 - "referencias.ts"
Cohesion: 0.20
Nodes (15): CXP_CHEQUE, CXP_CONTRASENA_PAGO, CXP_FACTURA_PROVEEDOR, INV_ALERTA_ESCASEZ, INV_ARTICULO, INV_BODEGA, INV_CATEGORIA, INV_EXISTENCIA_BODEGA (+7 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.08
Nodes (28): prioridadLabel(), prioridadTono(), formatDia(), coincide(), filtrarFilas(), normalizarTexto(), textoDeFila(), registrar() (+20 more)

### Community 4 - "HttpClient"
Cohesion: 0.10
Nodes (6): esperar(), HttpClient, nuevaClave(), safeStorageGet(), safeStorageRemove(), safeStorageSet()

### Community 5 - "backend/package.json"
Cohesion: 0.13
Nodes (14): typescript, vitest, main, name, private, type, version, @aws-sdk/s3-request-presigner (+6 more)

### Community 6 - "ValidationError"
Cohesion: 0.10
Nodes (15): validarTasaCambio(), CotizacionService, DevolucionProveedorService, RecepcionService, ReconciliacionService, RfqService, TransactionScope, BusinessRuleError (+7 more)

### Community 7 - "frontend/package.json"
Cohesion: 0.06
Nodes (36): dependencies, react, react-dom, devDependencies, jsdom, tailwindcss, @tailwindcss/vite, @testing-library/jest-dom (+28 more)

### Community 8 - "com/descriptors.ts"
Cohesion: 0.07
Nodes (25): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+17 more)

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
Cohesion: 0.15
Nodes (13): scripts, build, db:deploy, db:deploy:full, db:seed, db:seed:flujo, dev, dev:apps (+5 more)

### Community 14 - "Compras e Inventario · Módulo ERP"
Cohesion: 0.20
Nodes (9): 12. Reglas generales de consistencia visual, 13. Principios de interacción aplicados, 14. Flujo visual y respuesta del sistema, 15. Criterio final de diseño, 1. Agenda, 3. Sistema de diseño — Paleta de color, Colores oficiales, Compras e Inventario · Módulo ERP (+1 more)

### Community 15 - "oraclePool"
Cohesion: 0.11
Nodes (8): empleadosEnAlcance(), mapOracleError(), oraclePool, asBinds(), CompraReadRepository, iso(), num(), registerComReferenciaRoutes()

### Community 16 - "concurrencia.mjs"
Cohesion: 0.12
Nodes (29): aprobada(), conOc(), conRfq(), cot(), get(), post(), ref, solicitud() (+21 more)

### Community 17 - "Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)"
Cohesion: 0.29
Nodes (6): 1. División Estructural del Repositorio, 2. Definición del Stack Tecnológico, 3. Especificaciones de la Base de Datos (Oracle 21c), 4. Arquitectura y Escalabilidad con Docker, 5. Reglas Técnicas de Frontend (React + Vite + Tailwind v4), Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)

### Community 18 - "CompraServices.ts"
Cohesion: 0.06
Nodes (29): catalogCache, ComparativoDTO, comparativoService, DashboardAppService, DesempenoProveedorItem, GastoProveedorItem, HistorialAppService, HistorialResumen (+21 more)

### Community 19 - "ortografia.test.ts"
Cohesion: 0.25
Nodes (6): acentuar(), ACENTOS, checkNumero(), checkValue(), etiquetaDe(), RAIZ

### Community 21 - "adjuntos.ts"
Cohesion: 0.17
Nodes (14): TipoDocumentoAdjunto, authGuardAny(), adjuntos, DocDef, DOCS, idParam(), R_COTIZACION, R_DEVOLUCION (+6 more)

### Community 27 - "oracledb"
Cohesion: 0.08
Nodes (37): countAllTables(), countComTables(), EnvVars, HERE, loadEnv(), main(), REPO_ROOT, runFullDdl() (+29 more)

### Community 28 - "HttpClient.ts"
Cohesion: 0.13
Nodes (16): AppError, ConflictError, ErrorDetail, ForbiddenError, LockedError, NetworkError, NotFoundError, RateLimitedError (+8 more)

### Community 29 - "routes/com/index.ts"
Cohesion: 0.11
Nodes (20): buildCrudService(), AnyMethod, withTelemetry(), BaseCrudController, CrudService, authGuard(), CRUD_OPERATIVOS, CRUD_SENSIBLES (+12 more)

### Community 30 - "package.json"
Cohesion: 0.11
Nodes (18): allowScripts, canvas@3.2.3, description, devDependencies, playwright, engines, node, name (+10 more)

### Community 31 - "11. Experiencia interactiva y accesibilidad (UX Intuitivo)"
Cohesion: 0.22
Nodes (9): 11. Experiencia interactiva y accesibilidad (UX Intuitivo), Asistente y guiado, Atajos rápidos, Confirmación explícita, Contraste y accesibilidad, Hints y Tooltips, Loading skeletons, Navegación por teclado (+1 more)

### Community 32 - "rbac-crud-matrix.mjs"
Cohesion: 0.11
Nodes (21): ACCIONES_ESPECIALES, APROBAR, assertExpected(), assertNo5xx(), call(), CATALOGOS, CATALOGOS_READ, DOCUMENTOS (+13 more)

### Community 33 - "1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)"
Cohesion: 0.09
Nodes (22): 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2), 2. Patrones GoF (`skills/patron-arquitectura.md` §4), 3-bis. POO en el FRONTEND (`frontend/src/`), 3. Modelo de lectura / trazabilidad (Fase 5), 4. Cobertura del flujo completo, 4. Cómo se sostiene "limpio, ordenado y profesional", Abstracción, Alta cohesión y bajo acoplamiento (+14 more)

### Community 34 - "listaUx.tsx"
Cohesion: 0.22
Nodes (18): chip(), clave(), columnaUrgencia(), dia(), diasEntre(), entregaOrden(), esperaSolicitud(), FiltroRapido (+10 more)

### Community 35 - "2. Roles: quién ve y hace qué"
Cohesion: 0.20
Nodes (9): 1. El flujo, paso a paso, y qué lo cubre en el sistema, 2. Roles: quién ve y hace qué, Catálogo de permisos (módulo `COMPRAS`), Diagrama del ciclo, Flujo del sistema y modelo de roles — Gestión de Compras, Jerarquía de aprobación y autorización, Qué ve cada rol en el menú, Roles y sus permisos (+1 more)

### Community 36 - "8. Pantallas clave — Gestión de Compras"
Cohesion: 0.25
Nodes (8): 8. Pantallas clave — Gestión de Compras, Catálogo, Cotizaciones, Facturación / CxP, Proveedores, Recepción, Solicitudes, Órdenes de Compra

### Community 37 - "FileStorage.ts"
Cohesion: 0.14
Nodes (3): fileStorage, InMemoryFileStorage, StorageFactory

### Community 38 - "5. Lo realizado en detalle (bloques, orden cronológico inverso)"
Cohesion: 0.04
Nodes (45): 5.0 Endurecimiento de autenticación (subfase 6.1) — 2026-09-10, 5.-10 Roles endurecidos + inferencia de datos en formularios — 2026-09-10, 5.-11 Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales — 2026-09-10, 5.-12 Primera suite de tests del frontend (infra + cobertura inicial) — 2026-09-10, 5.-13 Acceso al PDF de la cotización desde el Comparativo — 2026-09-10/11, 5.-14 Asistente guiado RFQ→Cotización→Comparativo→OC + fusión Comprador/Financiero — 2026-09-11, 5.-15 Fixes tras probar el asistente en vivo: select ilegible ("#187") + "Autoriza la orden" sin filtrar — 2026-09-11, 5.-16 Revertida la fusión Comprador/Financiero — 2026-09-11 (+37 more)

### Community 39 - "ComCrudService.ts"
Cohesion: 0.14
Nodes (9): CrudServiceOptions, ComCrudService, Datos, ReglaCampos, REGLAS, vacio(), repositoryFactory, ComEntityKey (+1 more)

### Community 40 - "messageOf"
Cohesion: 0.06
Nodes (42): AdjuntosPanel(), descargar(), eliminar(), onFile(), ver(), humanBytes(), Preview, ResumenLateral() (+34 more)

### Community 41 - "CrudPage.tsx"
Cohesion: 0.19
Nodes (13): CrudFieldDef, CrudPage(), confirmDelete(), openCreate(), openEdit(), save(), CrudPageConfig, Row (+5 more)

### Community 42 - "fastify"
Cohesion: 0.16
Nodes (14): ensureBodega(), Ids, inTwoWeeks, mesActual, PRECIOS, envRaw, startTestApp(), stopTestApp() (+6 more)

### Community 43 - "Avance 03 — Analítica del dashboard: series temporales + índice de ahorro"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Decisiones de métrica (respuestas del usuario), 2.1 `dal/repositories/com/CompraReadRepository.ts` — 3 consultas nuevas, 2.2 `bll/services/com/DashboardService.ts` (nuevo), 2.3 `presentation/routes/com/analitica.ts`, 2. Backend, 3.1 `core/CompraServices.ts`, 3.2 `ui/Charts.tsx` (nuevo, exports nombrados — convención de `ui/`) (+6 more)

### Community 44 - "Repository.ts"
Cohesion: 0.15
Nodes (5): QueryParams, HttpRepository, IRepository, repositoryFactory, RestRepository

### Community 45 - "sw-inventario · Módulo de Compras (COM_)"
Cohesion: 0.33
Nodes (5): Docker, La tesis POO: configurar, no programar, Pruebas, Puesta en marcha, sw-inventario · Módulo de Compras (COM_)

### Community 46 - "Dashboard.tsx"
Cohesion: 0.19
Nodes (11): DashboardResumen, dashboardService, AYUDA_DASHBOARD, Dashboard(), Q_COMPACT, Responsable, Row, tendencia() (+3 more)

### Community 47 - "AppError.ts"
Cohesion: 0.08
Nodes (45): devolvibleDeLinea(), MAX_LINEAS, ordenCompraStateMachine, solicitudStateMachine, ComEventName, ComEvents, OrdenCompraEstadoPayload, RecepcionRegistradaPayload (+37 more)

### Community 49 - "AuditContext"
Cohesion: 0.10
Nodes (9): BaseCrudService, SolicitudCompraService, ForbiddenError, AuditContext, validateDto(), IRepository, SolicitudCompra, SolicitudDetalle (+1 more)

### Community 50 - "Catálogos y campos de referencia — Módulo de Gestión de Compras"
Cohesion: 0.20
Nodes (9): 1. Tipos de "catálogo" en el módulo, 2. Datos semilla cargados (`database/dml/`), 3. Campos corregidos (eran texto/ID libre, ahora son catálogo), 4. Campos que quedan como texto libre (correcto), 5. Pendiente (catálogos estáticos ya definidos, faltan sus pantallas), Catálogos (`frontend/src/modules/compras/catalogPages.tsx`), Catálogos y campos de referencia — Módulo de Gestión de Compras, Comparativo de cotizaciones (`ComparativoView.tsx`) (+1 more)

### Community 51 - "OrdenCompraPdfService.ts"
Cohesion: 0.15
Nodes (14): estadoVisual(), fechaLarga(), MESES, money(), nombreMoneda(), OrdenCompraPdfService, qty(), CENTENAS (+6 more)

### Community 52 - "ComparativoService"
Cohesion: 0.31
Nodes (4): ComparativoService, ComparativoSolicitud, CotizacionComparada, CriterioComparativo

### Community 53 - "Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras"
Cohesion: 0.18
Nodes (10): 1. Qué es el proyecto, 2. Stack y comandos, 3. Arquitectura (6 capas, flujo unidireccional hacia abajo), 4. Estado por fases, 7. Cómo levantar y verificar, 8. Mapa de archivos de referencia, 9. Convenciones al retomar, Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras (+2 more)

### Community 54 - "Validacion"
Cohesion: 0.12
Nodes (34): CabeceraSolicitudDatos, HORIZONTE_DIAS, limiteFuturo(), LineaCotizacionDatos, LineaOrdenDatos, LineaSolicitudDatos, MAX_DESCRIPCION_LINEA, MAX_JUSTIFICACION (+26 more)

### Community 55 - "mapearTextos"
Cohesion: 0.06
Nodes (35): filas, acentuar(), lista, re, recorrer(), args, cuenta, dirs (+27 more)

### Community 56 - "documentForms.ts"
Cohesion: 0.07
Nodes (30): CALIFICACION_PROVEEDOR, CRITERIO_COMPARATIVO, ESTADO_AI, ESTADO_SEGUIMIENTO_ORDEN, MOTIVO_DEVOLUCION, PRIORIDAD_SOLICITUD, TIPO_EXCEPCION_ORDEN, CATALOG_CONFIGS (+22 more)

### Community 57 - "Avance 06 — Roles endurecidos + inferencia de datos en los formularios"
Cohesion: 0.12
Nodes (16): 0. Resumen ejecutivo, 1. La jerarquía de roles (respuesta a "no entiendo la lógica"), 2. Por qué "el bodeguero veía todo" — diagnóstico, 3.1 Atajo `X-Dev-User` cerrado por defecto, 3.2 Lectura por documento (segregación de funciones), 3.3 Alcance por departamento en RFQ y Cotización, 3.4 Verificado en vivo (login real, sin atajo), 3. Roles endurecidos (backend) (+8 more)

### Community 58 - "DocumentoList.tsx"
Cohesion: 0.09
Nodes (21): ActionModalState, CREAR_PERM, DETALLE_KEYS, DocConfig, DOCUMENTO_CONFIGS, EDIT_FIELDS, EMPTY_HINT, FLOW_STEP (+13 more)

### Community 59 - "BaseOracleRepository.ts"
Cohesion: 0.12
Nodes (8): OptimisticLockError, IHeaderDetailRepository, BaseHeaderDetailRepository, BindMap, SQL_OPERATOR, CrudRepository, AnyRepo, EntityDescriptor

### Community 60 - "BaseOracleRepository"
Cohesion: 0.17
Nodes (4): asBinds(), auditUser(), BaseOracleRepository, findColumn()

### Community 61 - "tildes-frontend.mjs"
Cohesion: 0.21
Nodes (12): acentuar(), AMBIGUAS, conMayus(), DRY, esTextoUsuario(), PALABRAS, procesar(), raiz (+4 more)

### Community 62 - "Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras"
Cohesion: 0.12
Nodes (15): 0. Resumen ejecutivo, 1. Autenticación endurecida (6.1), 2. Alcance por departamento/equipo (6.2 + endurecimiento), 3.1 Catálogo de permisos (14, módulo `COMPRAS`), 3.2 Matriz de roles (qué puede hacer cada uno), 3.3 Gating en el frontend, 3. Modelo de roles — jerarquía correcta, 4. Bandeja de pendientes (notificaciones) (+7 more)

### Community 63 - "ReporteService.ts"
Cohesion: 0.13
Nodes (16): calcularScore(), CALIFICACION_SCORE, GastoProveedorItem, nivelDe(), NivelRiesgo, normRango(), ReporteDesempenoProveedores, ReporteGastoProveedor (+8 more)

### Community 64 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-transformer, class-validator, fastify, @fastify/multipart, oracledb (+3 more)

### Community 66 - "descriptorHelpers.ts"
Cohesion: 0.16
Nodes (14): DDL_LIMITES, LimiteDdl, AuditMode, buildDescriptor(), camelPk(), col(), ColOpts, conLimitesDdl() (+6 more)

### Community 68 - "7. Componentes reutilizables"
Cohesion: 0.33
Nodes (6): 7. Componentes reutilizables, Botones, Chips y badges, Inputs, Moneda, Tablas

### Community 70 - "AuthService.ts"
Cohesion: 0.13
Nodes (10): AuthRequestInfo, authService, MAX_INTENTOS_FALLIDOS, SesionUsuario, VENTANA_BLOQUEO_MIN, derive(), hashPassword(), verifyPassword() (+2 more)

### Community 71 - "10. Pantallas de formularios"
Cohesion: 0.50
Nodes (4): 10. Pantallas de formularios, Campos automáticos, Organización, Validación

### Community 72 - "2. Objetivo y principios de diseño"
Cohesion: 0.50
Nodes (4): 2. Objetivo y principios de diseño, Apple Human Interface Guidelines, Fluent Design, Material Design 3

### Community 73 - "logger"
Cohesion: 0.09
Nodes (34): hoyIsoDate(), onRecepcionRegistrada(), onRecepcionReversada(), registerCxpSubscriber(), sumarDias(), AlertaRow, ArticuloRow, onExistenciaActualizada() (+26 more)

### Community 74 - "useNotificaciones.ts"
Cohesion: 0.17
Nodes (16): BandejaPendientes, DecisionRecibida, fetchDecisiones(), fetchPendientes(), Notificacion, NotiTipo, VACIA, leerVisto() (+8 more)

### Community 75 - "5. Arquitectura de la interfaz"
Cohesion: 0.50
Nodes (4): 5. Arquitectura de la interfaz, Barra superior, Contenido, Sidebar

### Community 76 - "4. Tipografía e iconografía"
Cohesion: 0.67
Nodes (3): 4. Tipografía e iconografía, Iconografía, Tipografía

### Community 77 - "9. Pantallas de Catálogos y Productos"
Cohesion: 0.67
Nodes (3): 9. Pantallas de Catálogos y Productos, Catálogo, Nuevo Producto en el Catálogo Permanente

### Community 78 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, gen:entities, gen:limits, start, test, test:int (+2 more)

### Community 80 - "aprobacionEnVivo.int.test.ts"
Cohesion: 0.11
Nodes (12): liveHub, LiveMessage, Sender, call(), dia(), escuchar(), Evento, fk (+4 more)

### Community 81 - "primitives.tsx"
Cohesion: 0.07
Nodes (22): HistorialAprobacion(), Row, catalogService(), CALIFICACION_ESTRELLAS, calificacionProveedorEstrellas(), estadoIcono(), estadoLabel(), estadoTono (+14 more)

### Community 82 - "6. Fase actual y qué sigue (backlog priorizado)"
Cohesion: 0.22
Nodes (9): 6.1 Endurecer autenticación — ✅ HECHO (2026-09-10, ver §5.0), 6.2 Alcance por departamento / equipo — ✅ HECHO (2026-09-10, ver §5.-1), 6.3 `withTelemetry` (Decorator) en los CRUD genéricos — ✅ HECHO (2026-09-10), 6.4 Empaquetado Docker — ✅ HECHO (2026-09-10, ver §5.-1), 6.5 Pulido / intuitividad de frontend — ✅ HECHO (2026-09-10, ver §5.-2), 6.6 Analítica del dashboard — ✅ HECHO (2026-09-10, ver §5.-5 y `docs/03-...`), 6.7 Backlog opcional post‑Fase 6 — ✅ HECHO (2026-09-10, ver §5.-8 y `docs/05-...`), 6.8 Opcional / backlog residual (no bloqueante) (+1 more)

### Community 83 - "Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Adjuntos en Devolución a proveedor, 2. Vista previa inline de adjuntos, 3. Editar líneas de cotización desde el frontend, 4-bis. Acciones de fila uniformes (todas las tablas del sistema), 4. Reversa de recepción que ya alimentó CxP, 5. Verificación, 6. Puntos de entrada nuevos / tocados (+6 more)

### Community 84 - "OracleErrorAdapter.ts"
Cohesion: 0.15
Nodes (11): AppError, ConflictError, ForeignKeyError, InternalError, isAppError(), ServiceUnavailableError, asOracleError(), ORA_NO_DISPONIBLE (+3 more)

### Community 85 - "transaccional.ts"
Cohesion: 0.08
Nodes (29): FilterOperator, readOnlyList(), cotizaciones, devoluciones, DocumentoService, envelope(), idParam(), listQuery() (+21 more)

### Community 87 - "Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo"
Cohesion: 0.20
Nodes (9): 0. Resumen ejecutivo, 1. Aclaración de dudas del negocio, 2. MinIO (almacenamiento de objetos S3), 3. Adjuntos de documentos, 4. Pantalla de Cotizaciones más entendible, 5. CRUD de los documentos del ciclo (con cerrojo por estado), 6. Verificación, 7. Puntos de entrada nuevos (+1 more)

### Community 88 - "Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Análisis del módulo (resumen — detalle con cita en el plan), 2. WS1 — Sistema de columnas de `DataTable` (UI de listas), 3. WS2 — Gating de acciones por permiso, 4. WS3 — Rollback del estado de la OC en reversa/borrado de recepción, 5. WS4 — Resiliencia del bus de eventos, 6. WS5 — Pantallas de Seguimiento / Excepciones de OC, 7. Verificación (+2 more)

### Community 89 - "Field.tsx"
Cohesion: 0.16
Nodes (13): dateBounds, Field(), FieldDef, fieldError(), FieldValue, fmtDia(), hoyLocal(), SelectOption (+5 more)

### Community 90 - "react"
Cohesion: 0.10
Nodes (17): container, MODULES, SystemModule, AppShell(), cycleTheme(), ROL_LABEL, aplicar(), Densidad (+9 more)

### Community 91 - "DashboardService.ts"
Cohesion: 0.19
Nodes (12): AhorroAdjudicacionResumen, clampMeses(), DashboardResumen, DashboardService, MES_LABEL, ProyeccionGastoMensual, proyectarGasto(), PuntoCompraMes (+4 more)

### Community 92 - "apiClient.ts"
Cohesion: 0.21
Nodes (8): api, ApiRequestError, client, guard(), toApiRequestError(), isAppError(), Page, ListQuery

### Community 93 - "qa-roles-smoke.mjs"
Cohesion: 0.20
Nodes (9): byRole, __dirname, errores, HEADED, header, LEAVES, outFile, report (+1 more)

### Community 95 - "ReconciliacionService.ts"
Cohesion: 0.18
Nodes (11): OrdenCompraService, ConsistenciaReport, RECEPCION_ACTIVA, DevolucionProveedor, OrdenCompra, OrdenCompraDetalle, OrdenCompraEstado, Recepcion (+3 more)

### Community 96 - "S3FileStorage"
Cohesion: 0.49
Nodes (3): S3FileStorage, traducirErrorAlmacenamiento(), @aws-sdk/client-s3

### Community 97 - "qa-notificaciones-en-vivo.mjs"
Cohesion: 0.15
Nodes (11): abrirSolicitudes(), apiA, crear(), decidirEnUI(), dia, HEADED, ref(), results (+3 more)

### Community 99 - "RefContext.tsx"
Cohesion: 0.15
Nodes (10): ALL_KINDS, DOC_PREFIX, DocRef, FALLBACK, RefContext, RefKind, RefProvider(), Refs (+2 more)

### Community 100 - "RecepcionGuiada.tsx"
Cohesion: 0.14
Nodes (17): useWizardStep(), avanzar(), cerrarSiNoAvanzo(), AsistenteCotizacion(), alCrearRfq(), saltarProveedor(), siguienteCotizacion(), Paso (+9 more)

### Community 101 - "SegAuthRepository.ts"
Cohesion: 0.13
Nodes (8): Accesos, asBinds(), AuthUserRow, EventoAcceso, Row, segAuthRepository, SesionRow, UsuarioDemoRow

### Community 102 - "Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Por qué este alcance y no otro, 2. Infraestructura nueva, 3. Tests de lógica pura, 4. `ui/DataTable.test.tsx` (13 casos), 5. `ui/FlowStepper.test.tsx` (2 casos), 6. Verificación, 7. Puntos de entrada nuevos / tocados (+2 more)

### Community 103 - "nav.ts"
Cohesion: 0.06
Nodes (36): Suite(), AuthContext, AuthProvider(), boot(), AuthState, jwtExp(), Sesion, tokenVigente() (+28 more)

### Community 104 - "EnvConfig.ts"
Cohesion: 0.23
Nodes (10): AppEnvironment, AuthConfig, buildConnectString(), EmpresaConfig, EnvConfig, HttpConfig, OracleConfig, readFirst() (+2 more)

### Community 106 - "idempotency.ts"
Cohesion: 0.19
Nodes (10): Entrada, enviar(), fastify, FastifyRequest, huellaDe(), limpiar(), METODOS, registerIdempotency() (+2 more)

### Community 107 - "qa-crud-open.mjs"
Cohesion: 0.25
Nodes (7): __dirname, errores, HEADED, outFile, report, rolesArg, SCREENS

### Community 108 - "reglasNegocio.int.test.ts"
Cohesion: 0.24
Nodes (9): cotizacionBody(), dia(), H, Ids, mensaje(), post(), rfqAbierto(), solicitudAprobada() (+1 more)

### Community 109 - "app.ts"
Cohesion: 0.11
Nodes (17): envRaw, dml, envRaw, pares, tablas, adjuntoMaxBytes(), buildApp(), env() (+9 more)

### Community 110 - "RfqService.ts"
Cohesion: 0.10
Nodes (17): ROLES_SIN_ALCANCE, rfqIdsEnAlcance(), solicitudIdsEnAlcance(), LineaFecha, ProveedorFila, RfqHeader, RfqProveedor, SYSTEM_AUDIT_CONTEXT (+9 more)

### Community 111 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, tsx, @types/node, @types/oracledb, @types/pdfkit, typescript, vitest

### Community 112 - "CompraReadRepository.ts"
Cohesion: 0.12
Nodes (15): HistorialProveedorResult, RecepcionPdfService, AhorroAdjudicacionRow, AlertaEscasezRow, CompraMesRow, DecisionSolicitudRow, EntradaMesRow, HistorialPrecioRow (+7 more)

### Community 113 - "DataTable.test.tsx"
Cohesion: 0.11
Nodes (10): toggleAll(), BASE_COLUMNS, FakeResizeObserver, Row, rowKey(), ROWS, { PERM_RFQ, hasAnyPerm }, OPCIONES (+2 more)

### Community 114 - "cxp.ts"
Cohesion: 0.19
Nodes (9): FormaPago, extractVersion(), parseId(), auditContextOf(), CXP, idParam(), liquidacion, liquidarBody() (+1 more)

### Community 115 - "Avance 11 — Coherencia de documentos, buscador real, orden "lo último primero" y resistencia del sistema"
Cohesion: 0.13
Nodes (14): 0. Qué pidió el usuario y qué se encontró, 1. Orden: lo último primero, 2. Buscador global (`?q=`), 3. Coherencia de fechas y cantidades (`bll/compras/reglasDocumentos.ts`), 4. Resistencia, 5. Verificación (real, contra Oracle y navegador), 6. Descubierto al levantar el sistema, 7. Qué NO cambió (+6 more)

### Community 116 - "http"
Cohesion: 0.11
Nodes (15): Header, Linea, num2(), OrdenCompraPreview(), DocumentDownloadService, downloadService, triggerDownload(), http (+7 more)

### Community 117 - "authGuard.ts"
Cohesion: 0.11
Nodes (21): base64url(), fromBase64url(), JwtPayload, REVOCADOS, revocarToken(), signJwt(), verifyJwt(), PERMISO_META (+13 more)

### Community 118 - "e2e-negocio-real.mjs"
Cohesion: 0.42
Nodes (8): api(), check(), expectStatus(), login(), main(), record(), results, section()

### Community 119 - "Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo"
Cohesion: 0.29
Nodes (6): 0. Resumen ejecutivo, 1. Cómo se llegó aquí (cronología de la sesión), 2. Estado final verificado, 3. Qué NO cambió (deliberadamente, y sigue vigente), 4. Sin pendientes de alcance, Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo

### Community 120 - "dependencies"
Cohesion: 0.40
Nodes (5): dependencies, canvas, mupdf, @napi-rs/canvas, pdfjs-dist

### Community 121 - "useResource.ts"
Cohesion: 0.12
Nodes (15): CrudServiceOptions, AppEventName, AppEvents, EntityChangedPayload, eventBus, Handler, ToastPayload, PageMeta (+7 more)

### Community 122 - "e2e-ciclos-faltantes.mjs"
Cohesion: 0.52
Nodes (6): api(), check(), expectStatus(), login(), main(), results

### Community 123 - "Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06)"
Cohesion: 0.29
Nodes (6): 1. Hallazgos corregidos, 2. Lo que se probó y NO es vulnerable, 3. XSS, 4. Riesgo residual (decisiones / entorno), Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06), Resultado final

### Community 124 - "ComparativoPdfService.ts"
Cohesion: 0.18
Nodes (8): ComparativoPdfService, money(), Doc, LetterheadOptions, MARGIN, PdfColumn, StoredFile, pdfkit

### Community 125 - "Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos"
Cohesion: 0.29
Nodes (6): 0. Resumen ejecutivo, 1. Cómo se llegó aquí (cronología de la sesión), 2. Estado final verificado, 3. Qué NO cambió (deliberadamente), 4. Sin pendientes de alcance, Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos

### Community 126 - "format.ts"
Cohesion: 0.13
Nodes (16): ESTILO, Hito, Trazabilidad(), HistorialResp, historialService, formatFechaHora(), formatPercent(), formatQty() (+8 more)

### Community 127 - "permissions.ts"
Cohesion: 0.16
Nodes (11): BandejaPendientes, DecisionRecibida, DIAS_DECISIONES, NADA, Notificacion, notificacionService, NotiTipo, hasPermiso() (+3 more)

### Community 128 - "DocumentoAppService"
Cohesion: 0.16
Nodes (6): CampoDetalle, ColumnaLinea, DocumentoDetalle(), Row, DocumentoAppService, TipoDocAdjunto

### Community 129 - "qa-busqueda-orden.mjs"
Cohesion: 0.15
Nodes (8): badResponses, fallos, HEADED, nuevo, results, roleArg, SCREENS, shotsArg

### Community 130 - "searchSql.ts"
Cohesion: 0.32
Nodes (11): buildSearchClause(), condicionEtiquetaActivo(), condicionRef(), escaparLike(), esColumnaFecha(), esColumnaTexto(), norm(), normalizar() (+3 more)

### Community 131 - "scalar"
Cohesion: 0.18
Nodes (10): ensureBodega(), Ids, inTwoWeeks, PRECIOS, state, scalar(), Ids, inTwoWeeks (+2 more)

### Community 132 - "validators.ts"
Cohesion: 0.33
Nodes (3): class-transformer, class-validator, reflect-metadata

### Community 134 - "alcanceDepartamento.int.test.ts"
Cohesion: 0.53
Nodes (5): bearer(), crearSolicitud(), Fk, idsVisibles(), token()

### Community 135 - "stateMachines.ts"
Cohesion: 0.18
Nodes (10): OrdenCompraEstado, RecepcionEstado, recepcionStateMachine, RfqEstado, rfqStateMachine, SOLICITUD_NIVEL, SolicitudEstado, RECEPCION_ESTADOS (+2 more)

### Community 136 - "qa-listas-con-buscador.mjs"
Cohesion: 0.20
Nodes (7): caja, combos, filtroCombo, grupo, page, res, shotsArg

### Community 137 - "AdjuntoService"
Cohesion: 0.34
Nodes (5): AdjuntoService, assertRef(), enCola(), maxBytes(), saneNombre()

### Community 138 - "catalogsCrud.int.test.ts"
Cohesion: 0.33
Nodes (4): cases, CrudCase, ids, RefIds

### Community 139 - "Toast.tsx"
Cohesion: 0.17
Nodes (6): Ctx, ToastAction, ToastApi, ToastItem, ToastTone, TONE

### Community 140 - "LiveConnection"
Cohesion: 0.22
Nodes (5): LiveConnection, LiveHandlers, LiveMessage, parseSse(), LiveNotifier()

### Community 141 - "gen-ddl-limits.ts"
Cohesion: 0.29
Nodes (6): ddl, destino, Limite, nCols, raiz, tablas

### Community 142 - "LiquidacionService.ts"
Cohesion: 0.15
Nodes (12): BucketPagoProyectado, DIAS_MAX_PAGO_FUTURO, FacturaRow, LiquidacionService, LiquidarInput, ORDEN_BUCKETS, ProyeccionPagosResumen, TresWayMatchReport (+4 more)

### Community 143 - "formSupport.ts"
Cohesion: 0.23
Nodes (12): buildLabel(), DEPENDS_LABEL, diaLocal(), fillPlaceholders(), getByPath(), RemoteOptions, Row, s() (+4 more)

### Community 144 - "DocumentForm"
Cohesion: 0.29
Nodes (10): DocumentForm(), descartarBorrador(), enfocarPrimerError(), enfocarPrimerErrorServidor(), onPrimaryClick(), submit(), validar(), claveRecordada() (+2 more)

### Community 146 - "Auditoría del frontend (UX/UI, responsive, proporción áurea) y resiliencia de almacenamiento — 2026-10-06"
Cohesion: 0.25
Nodes (7): 1. MinIO ("sin conexión, no deja cargar"), 2. Idempotencia, 3. Evaluación del frontend (antes → ahora), 4. Autocompletado — el usuario no reescribe lo que el sistema ya tiene, 5. Pendiente / recomendaciones, Adenda — Lote UI/UX completo y ortografía (2026-10), Auditoría del frontend (UX/UI, responsive, proporción áurea) y resiliencia de almacenamiento — 2026-10-06

### Community 147 - "ErrorBoundary.tsx"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 149 - "EntityDescriptor.ts"
Cohesion: 0.22
Nodes (8): BuildOpts, AuditDescriptor, ColumnDescriptor, ColumnType, DetailRelationDescriptor, SearchDescriptor, SearchRef, SoftDeleteDescriptor

### Community 150 - "analitica.ts"
Cohesion: 0.27
Nodes (9): comparativo, comparativoPdf, dashboard, idParam(), intQuery(), READ, registerComAnaliticaRoutes(), strQuery() (+1 more)

### Community 152 - "StateMachine.ts"
Cohesion: 0.31
Nodes (3): StateMachine, ESTADO_LABEL, estadoLabel()

### Community 153 - "DocumentForm.tsx"
Cohesion: 0.36
Nodes (8): displayValue(), DocumentFormConfig, PanelDerivado(), Values, AutoFillSpec, FormFieldDef, LineSeedSpec, formatRate()

### Community 154 - "qa-recepcion-conforme.mjs"
Cohesion: 0.22
Nodes (4): playwright, REGISTRAR, res, shotsArg

### Community 158 - "adjuntosYCrud.int.test.ts"
Cohesion: 0.40
Nodes (3): Ids, inTwoWeeks, state

### Community 159 - "devolucionAdjuntosYReversa.int.test.ts"
Cohesion: 0.40
Nodes (3): Ids, inTwoWeeks, s

### Community 160 - "stateMachine.test.ts"
Cohesion: 0.50
Nodes (3): ORDEN_COMPRA_ESTADOS, OcEstado, ocMachine

## Knowledge Gaps
- **974 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+969 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1278 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ValidationError` connect `ValidationError` to `referencias.ts`, `validators.ts`, `AdjuntoService`, `LiquidacionService.ts`, `oraclePool`, `adjuntos.ts`, `analitica.ts`, `AppError.ts`, `AuditContext`, `Validacion`, `BaseOracleRepository.ts`, `BaseOracleRepository`, `AuthService.ts`, `OracleErrorAdapter.ts`, `transaccional.ts`, `ReconciliacionService.ts`, `RfqService.ts`, `cxp.ts`, `authGuard.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `fastify` connect `fastify` to `referencias.ts`, `scalar`, `backend/package.json`, `alcanceDepartamento.int.test.ts`, `documentoUpdate.int.test.ts`, `catalogsCrud.int.test.ts`, `adjuntos.ts`, `analitica.ts`, `oracledb`, `routes/com/index.ts`, `adjuntosYCrud.int.test.ts`, `devolucionAdjuntosYReversa.int.test.ts`, `aprobacionEnVivo.int.test.ts`, `OracleErrorAdapter.ts`, `transaccional.ts`, `idempotency.ts`, `reglasNegocio.int.test.ts`, `app.ts`, `RfqService.ts`, `cxp.ts`, `authGuard.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `DocumentoAppService`, `DataTable.tsx`, `frontend/package.json`, `Toast.tsx`, `formSupport.ts`, `CompraServices.ts`, `ErrorBoundary.tsx`, `DocumentForm.tsx`, `messageOf`, `CrudPage.tsx`, `Dashboard.tsx`, `DocumentoList.tsx`, `useNotificaciones.ts`, `primitives.tsx`, `Field.tsx`, `RefContext.tsx`, `RecepcionGuiada.tsx`, `nav.ts`, `DataTable.test.tsx`, `http`, `useResource.ts`, `format.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _974 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SEG_USUARIO` be split into smaller, more focused modules?**
  _Cohesion score 0.06833457804331591 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07948717948717948 - nodes in this community are weakly interconnected._
- **Should `HttpClient` be split into smaller, more focused modules?**
  _Cohesion score 0.10252100840336134 - nodes in this community are weakly interconnected._
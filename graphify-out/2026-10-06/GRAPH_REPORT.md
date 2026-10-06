# Graph Report - sw-inventario  (2026-10-06)

## Corpus Check
- 291 files · ~360,593 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3004 nodes · 6777 edges · 179 communities (155 shown, 14 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 193 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `48a7f5a4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SCRIPT_DDL.sql
- PdfBuilder
- referencias.ts
- DataTable.tsx
- HttpClient
- backend/package.json
- HttpClient.ts
- frontend/package.json
- com/descriptors.ts
- 6. Arquitectura de software
- compilerOptions
- Descripción de las 6 Capas
- compilerOptions
- core/borradores.ts
- Compras e Inventario · Módulo ERP
- oraclePool
- concurrencia.mjs
- Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)
- CompraServices.ts
- NotFoundError
- adjuntos.ts
- CLAUDE.md
- GEMINI.md
- repositoryFactory
- kardexSubscriber.ts
- routes/com/index.ts
- package.json
- 11. Experiencia interactiva y accesibilidad (UX Intuitivo)
- rbac-crud-matrix.mjs
- 1. Principios fundamentales de POO (`skills/patron-arquitectura.md` §1.2)
- listaUx.tsx
- 2. Roles: quién ve y hace qué
- 8. Pantallas clave — Gestión de Compras
- analitica.ts
- 5. Lo realizado en detalle (bloques, orden cronológico inverso)
- models.ts
- messageOf
- DocumentForm
- testApp.ts
- Avance 03 — Analítica del dashboard: series temporales + índice de ahorro
- BaseOracleRepository.ts
- sw-inventario · Módulo de Compras (COM_)
- Dashboard.tsx
- OrdenCompraService.ts
- app.ts
- Catálogos y campos de referencia — Módulo de Gestión de Compras
- OrdenCompraPdfService.ts
- ComparativoPdfService.ts
- Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras
- Validacion
- mapearTextos
- catalogPages.tsx
- Avance 06 — Roles endurecidos + inferencia de datos en los formularios
- DocumentoList.tsx
- formSupport.ts
- AuditContext
- tildes-frontend.mjs
- Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras
- ReporteService.ts
- dependencies
- ReporteAppService
- descriptorHelpers.ts
- 7. Componentes reutilizables
- authService
- 10. Pantallas de formularios
- 2. Objetivo y principios de diseño
- CrudPage.tsx
- outbox.ts
- 5. Arquitectura de la interfaz
- 4. Tipografía e iconografía
- 9. Pantallas de Catálogos y Productos
- scripts
- AdjuntoAppService
- liveHub
- primitives.tsx
- 6. Fase actual y qué sigue (backlog priorizado)
- Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP
- stateMachines.ts
- transaccional.ts
- Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo
- Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales
- Field.tsx
- AppShell.tsx
- DashboardService.ts
- CrudService
- qa-roles-smoke.mjs
- useNotificaciones.ts
- seedFlujoDemo.ts
- S3FileStorage
- qa-notificaciones-en-vivo.mjs
- Charts.tsx
- SegAuthRepository.ts
- RecepcionGuiada.tsx
- DocumentoAppService
- Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)
- nav.ts
- EnvConfig.ts
- idempotency.ts
- qa-crud-open.mjs
- reglasNegocio.int.test.ts
- OraclePool.ts
- RefContext.tsx
- devDependencies
- CompraReadRepository.ts
- DataTable.test.tsx
- scripts
- Avance 11 — Coherencia de documentos, buscador real, orden "lo último primero" y resistencia del sistema
- http
- AppError.ts
- e2e-negocio-real.mjs
- Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo
- deploy.ts
- useResource
- e2e-ciclos-faltantes.mjs
- Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06)
- OracleErrorAdapter.ts
- Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos
- LiquidacionCxP.tsx
- scalar
- ortografia.test.ts
- qa-busqueda-orden.mjs
- searchSql.ts
- comparativo.int.test.ts
- documentForms.ts
- documentoUpdate.int.test.ts
- alcanceDepartamento.int.test.ts
- search.ts
- qa-listas-con-buscador.mjs
- AdjuntoService.ts
- catalogsCrud.int.test.ts
- ValidationError
- LiveNotifier.tsx
- gen-ddl-limits.ts
- DocumentDownloadService
- qa-panel-detalle.mjs
- BaseCrudController.ts
- apiClient.ts
- Auditoría del frontend (UX/UI, responsive, proporción áurea) y resiliencia de almacenamiento — 2026-10-06
- LiquidacionService.ts
- dev.mjs
- ComparativoAppService
- DelegacionRepository.ts
- escasezSubscriber.ts
- SolicitudPdfService.ts
- react
- qa-recepcion-conforme.mjs
- Logger.ts
- DomainEventBus.ts
- notificacionesSubscriber.ts
- Toast.tsx
- PdfBuilder.ts
- logger
- fastify
- AuthContext.tsx
- parseListQuery.ts
- aprobacionEnVivo.int.test.ts
- DocumentForm.tsx
- playwright
- qa-tablas-sin-solapes.mjs
- delegacion.int.test.ts
- App.tsx
- estados.ts
- qa-agilidad.mjs
- cxpSubscriber.ts
- validators.ts
- density.ts
- alcanceDe
- Trazabilidad.tsx
- borradores.int.test.ts

## God Nodes (most connected - your core abstractions)
1. `SEG_USUARIO` - 105 edges
2. `AuditContext` - 103 edges
3. `oraclePool` - 98 edges
4. `mapOracleError()` - 80 edges
5. `ValidationError` - 75 edges
6. `NotFoundError` - 72 edges
7. `CompraReadRepository` - 64 edges
8. `messageOf()` - 62 edges
9. `react` - 45 edges
10. `5. Lo realizado en detalle (bloques, orden cronológico inverso)` - 45 edges

## Surprising Connections (you probably didn't know these)
- `scanCode()` --indirect_call--> `n()`  [INFERRED]
  scripts/tildes-lib.mjs → frontend/src/modules/compras/DocumentoList.tsx
- `ensureBodega()` --calls--> `scalar()`  [EXTRACTED]
  backend/tests/comparativo.int.test.ts → backend/tests/helpers/testApp.ts
- `guardarBorradorActual()` --calls--> `guardarBorrador()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/core/borradores.ts
- `openEdit()` --calls--> `blankValues()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/components/formSupport.ts
- `entrar()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/modules/LoginScreen.tsx → frontend/src/core/errors.ts

## Import Cycles
- None detected.

## Communities (179 total, 14 thin omitted)

### Community 0 - "SCRIPT_DDL.sql"
Cohesion: 0.07
Nodes (105): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+97 more)

### Community 1 - "PdfBuilder"
Cohesion: 0.27
Nodes (3): pct(), ReportePdfService, PdfBuilder

### Community 2 - "referencias.ts"
Cohesion: 0.13
Nodes (19): CrudRepository, chequeRepository(), contrasenaPagoRepository(), CXP_CHEQUE, CXP_CONTRASENA_PAGO, CXP_FACTURA_PROVEEDOR, INV_ALERTA_ESCASEZ, INV_ARTICULO (+11 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.09
Nodes (23): prioridadLabel(), prioridadTono(), formatDia(), BulkAction, cellNode(), cellText(), cellTitle(), Column (+15 more)

### Community 4 - "HttpClient"
Cohesion: 0.13
Nodes (4): HttpClient, nuevaClave(), safeStorageGet(), HttpRepository

### Community 5 - "backend/package.json"
Cohesion: 0.13
Nodes (14): typescript, vitest, main, name, private, type, version, @aws-sdk/s3-request-presigner (+6 more)

### Community 6 - "HttpClient.ts"
Cohesion: 0.09
Nodes (20): AppError, ConflictError, ErrorDetail, ForbiddenError, LockedError, NetworkError, NotFoundError, RateLimitedError (+12 more)

### Community 7 - "frontend/package.json"
Cohesion: 0.06
Nodes (36): dependencies, react, react-dom, devDependencies, jsdom, tailwindcss, @tailwindcss/vite, @testing-library/jest-dom (+28 more)

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

### Community 13 - "core/borradores.ts"
Cohesion: 0.23
Nodes (18): borrar(), claveConfirmados(), confirmados(), enviar(), escribir(), FilaServidor, guardarBorrador(), guardarConfirmados() (+10 more)

### Community 14 - "Compras e Inventario · Módulo ERP"
Cohesion: 0.20
Nodes (9): 12. Reglas generales de consistencia visual, 13. Principios de interacción aplicados, 14. Flujo visual y respuesta del sistema, 15. Criterio final de diseño, 1. Agenda, 3. Sistema de diseño — Paleta de color, Colores oficiales, Compras e Inventario · Módulo ERP (+1 more)

### Community 15 - "oraclePool"
Cohesion: 0.13
Nodes (7): mapOracleError(), oraclePool, asBinds(), CompraReadRepository, iso(), num(), registerComReferenciaRoutes()

### Community 16 - "concurrencia.mjs"
Cohesion: 0.12
Nodes (29): aprobada(), conOc(), conRfq(), cot(), get(), post(), ref, solicitud() (+21 more)

### Community 17 - "Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)"
Cohesion: 0.29
Nodes (6): 1. División Estructural del Repositorio, 2. Definición del Stack Tecnológico, 3. Especificaciones de la Base de Datos (Oracle 21c), 4. Arquitectura y Escalabilidad con Docker, 5. Reglas Técnicas de Frontend (React + Vite + Tailwind v4), Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)

### Community 18 - "CompraServices.ts"
Cohesion: 0.05
Nodes (42): CRITERIO_COMPARATIVO, catalogCache, ComparativoDTO, comparativoService, DashboardAppService, DesempenoProveedorItem, GastoProveedorItem, HistorialAppService (+34 more)

### Community 19 - "NotFoundError"
Cohesion: 0.11
Nodes (11): CotizacionService, DevolucionProveedorService, RecepcionService, ReconciliacionService, BusinessRuleError, NotFoundError, normalizePageQuery(), WithDetails (+3 more)

### Community 21 - "adjuntos.ts"
Cohesion: 0.18
Nodes (13): TipoDocumentoAdjunto, adjuntos, DocDef, DOCS, idParam(), R_COTIZACION, R_DEVOLUCION, R_OC (+5 more)

### Community 27 - "repositoryFactory"
Cohesion: 0.18
Nodes (13): defaultPriceResolver, PriceResolver, PriceQuery, PriceResult, PriceStrategy, Acuerdo, AcuerdoDetalle, AcuerdoMarcoStrategy (+5 more)

### Community 28 - "kardexSubscriber.ts"
Cohesion: 0.35
Nodes (11): ExistenciaRow, KardexRow, onRecepcionRegistrada(), onRecepcionReversada(), registerKardexSubscriber(), ultimoSaldo(), upsertExistencia(), yaProcesado() (+3 more)

### Community 29 - "routes/com/index.ts"
Cohesion: 0.09
Nodes (22): CrudServiceOptions, buildCrudService(), AnyMethod, withTelemetry(), ComEntityKey, CrudService, authGuard(), CRUD_OPERATIVOS (+14 more)

### Community 30 - "package.json"
Cohesion: 0.08
Nodes (23): allowScripts, canvas@3.2.3, dependencies, canvas, mupdf, @napi-rs/canvas, pdfjs-dist, description (+15 more)

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

### Community 37 - "analitica.ts"
Cohesion: 0.10
Nodes (12): fileStorage, InMemoryFileStorage, StorageFactory, comparativo, comparativoPdf, dashboard, idParam(), intQuery() (+4 more)

### Community 38 - "5. Lo realizado en detalle (bloques, orden cronológico inverso)"
Cohesion: 0.04
Nodes (45): 5.0 Endurecimiento de autenticación (subfase 6.1) — 2026-09-10, 5.-10 Roles endurecidos + inferencia de datos en formularios — 2026-09-10, 5.-11 Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales — 2026-09-10, 5.-12 Primera suite de tests del frontend (infra + cobertura inicial) — 2026-09-10, 5.-13 Acceso al PDF de la cotización desde el Comparativo — 2026-09-10/11, 5.-14 Asistente guiado RFQ→Cotización→Comparativo→OC + fusión Comprador/Financiero — 2026-09-11, 5.-15 Fixes tras probar el asistente en vivo: select ilegible ("#187") + "Autoriza la orden" sin filtrar — 2026-09-11, 5.-16 Revertida la fusión Comprador/Financiero — 2026-09-11 (+37 more)

### Community 39 - "models.ts"
Cohesion: 0.17
Nodes (11): OrdenCompraService, RfqHeader, DevolucionProveedor, OrdenCompra, OrdenCompraDetalle, OrdenCompraEstado, Recepcion, RecepcionDetalle (+3 more)

### Community 40 - "messageOf"
Cohesion: 0.07
Nodes (43): AdjuntosPanel(), descargar(), eliminar(), onFile(), ver(), humanBytes(), Preview, SUGERENCIA_ADJUNTO (+35 more)

### Community 41 - "DocumentForm"
Cohesion: 0.20
Nodes (13): DocumentForm(), descartarBorrador(), enfocarPrimerError(), enfocarPrimerErrorServidor(), onPrimaryClick(), submit(), validar(), claveRecordada() (+5 more)

### Community 42 - "testApp.ts"
Cohesion: 0.16
Nodes (11): Ids, inTwoWeeks, state, envRaw, startTestApp(), stopTestApp(), SYS_HEADERS, Ids (+3 more)

### Community 43 - "Avance 03 — Analítica del dashboard: series temporales + índice de ahorro"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Decisiones de métrica (respuestas del usuario), 2.1 `dal/repositories/com/CompraReadRepository.ts` — 3 consultas nuevas, 2.2 `bll/services/com/DashboardService.ts` (nuevo), 2.3 `presentation/routes/com/analitica.ts`, 2. Backend, 3.1 `core/CompraServices.ts`, 3.2 `ui/Charts.tsx` (nuevo, exports nombrados — convención de `ui/`) (+6 more)

### Community 44 - "BaseOracleRepository.ts"
Cohesion: 0.15
Nodes (7): buildPaginated(), asBinds(), auditUser(), BaseOracleRepository, BindMap, SQL_OPERATOR, findColumn()

### Community 45 - "sw-inventario · Módulo de Compras (COM_)"
Cohesion: 0.33
Nodes (5): Docker, La tesis POO: configurar, no programar, Pruebas, Puesta en marcha, sw-inventario · Módulo de Compras (COM_)

### Community 46 - "Dashboard.tsx"
Cohesion: 0.13
Nodes (16): DashboardResumen, dashboardService, AYUDA_DASHBOARD, Dashboard(), Q_COMPACT, Responsable, Row, tendencia() (+8 more)

### Community 47 - "OrdenCompraService.ts"
Cohesion: 0.06
Nodes (51): MAX_LINEAS, ordenCompraStateMachine, solicitudStateMachine, ComEventName, ComEvents, OrdenCompraEstadoPayload, RecepcionRegistradaPayload, RecepcionReversadaPayload (+43 more)

### Community 49 - "app.ts"
Cohesion: 0.13
Nodes (18): adjuntoMaxBytes(), buildApp(), FormaPago, isAppError(), TooManyRequestsError, errorHandler(), MENSAJES_FASTIFY, CXP (+10 more)

### Community 50 - "Catálogos y campos de referencia — Módulo de Gestión de Compras"
Cohesion: 0.20
Nodes (9): 1. Tipos de "catálogo" en el módulo, 2. Datos semilla cargados (`database/dml/`), 3. Campos corregidos (eran texto/ID libre, ahora son catálogo), 4. Campos que quedan como texto libre (correcto), 5. Pendiente (catálogos estáticos ya definidos, faltan sus pantallas), Catálogos (`frontend/src/modules/compras/catalogPages.tsx`), Catálogos y campos de referencia — Módulo de Gestión de Compras, Comparativo de cotizaciones (`ComparativoView.tsx`) (+1 more)

### Community 51 - "OrdenCompraPdfService.ts"
Cohesion: 0.15
Nodes (14): estadoVisual(), fechaLarga(), MESES, money(), nombreMoneda(), OrdenCompraPdfService, qty(), CENTENAS (+6 more)

### Community 52 - "ComparativoPdfService.ts"
Cohesion: 0.17
Nodes (7): ComparativoPdfService, money(), ComparativoService, ComparativoSolicitud, StoredFile, CotizacionComparada, CriterioComparativo

### Community 53 - "Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras"
Cohesion: 0.18
Nodes (10): 1. Qué es el proyecto, 2. Stack y comandos, 3. Arquitectura (6 capas, flujo unidireccional hacia abajo), 4. Estado por fases, 7. Cómo levantar y verificar, 8. Mapa de archivos de referencia, 9. Convenciones al retomar, Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras (+2 more)

### Community 54 - "Validacion"
Cohesion: 0.12
Nodes (36): CabeceraSolicitudDatos, devolvibleDeLinea(), HORIZONTE_DIAS, limiteFuturo(), LineaCotizacionDatos, LineaOrdenDatos, LineaSolicitudDatos, MAX_DESCRIPCION_LINEA (+28 more)

### Community 55 - "mapearTextos"
Cohesion: 0.06
Nodes (35): filas, acentuar(), lista, re, recorrer(), args, cuenta, dirs (+27 more)

### Community 56 - "catalogPages.tsx"
Cohesion: 0.12
Nodes (15): CALIFICACION_PROVEEDOR, ESTADO_AI, ESTADO_SEGUIMIENTO_ORDEN, MOTIVO_DEVOLUCION, PRIORIDAD_SOLICITUD, TIPO_EXCEPCION_ORDEN, CATALOG_CONFIGS, REF_ARTICULOS (+7 more)

### Community 57 - "Avance 06 — Roles endurecidos + inferencia de datos en los formularios"
Cohesion: 0.12
Nodes (16): 0. Resumen ejecutivo, 1. La jerarquía de roles (respuesta a "no entiendo la lógica"), 2. Por qué "el bodeguero veía todo" — diagnóstico, 3.1 Atajo `X-Dev-User` cerrado por defecto, 3.2 Lectura por documento (segregación de funciones), 3.3 Alcance por departamento en RFQ y Cotización, 3.4 Verificado en vivo (login real, sin atajo), 3. Roles endurecidos (backend) (+8 more)

### Community 58 - "DocumentoList.tsx"
Cohesion: 0.07
Nodes (24): HistorialAprobacion(), Row, catalogService(), estadoLabel(), ActionModalState, CREAR_PERM, DETALLE_KEYS, DocConfig (+16 more)

### Community 59 - "formSupport.ts"
Cohesion: 0.13
Nodes (23): aplicarPegado(), aNumero(), blankValues(), buildLabel(), DEPENDS_LABEL, diaLocal(), esNumero(), fillPlaceholders() (+15 more)

### Community 60 - "AuditContext"
Cohesion: 0.07
Nodes (12): BaseCrudService, ComCrudService, vacio(), SolicitudCompraService, AuditContext, validateDto(), IHeaderDetailRepository, IRepository (+4 more)

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
Cohesion: 0.10
Nodes (22): DDL_LIMITES, LimiteDdl, AuditMode, buildDescriptor(), BuildOpts, camelPk(), col(), ColOpts (+14 more)

### Community 68 - "7. Componentes reutilizables"
Cohesion: 0.33
Nodes (6): 7. Componentes reutilizables, Botones, Chips y badges, Inputs, Moneda, Tablas

### Community 70 - "authService"
Cohesion: 0.18
Nodes (5): authService, derive(), hashPassword(), verifyPassword(), LockedError

### Community 71 - "10. Pantallas de formularios"
Cohesion: 0.50
Nodes (4): 10. Pantallas de formularios, Campos automáticos, Organización, Validación

### Community 72 - "2. Objetivo y principios de diseño"
Cohesion: 0.50
Nodes (4): 2. Objetivo y principios de diseño, Apple Human Interface Guidelines, Fluent Design, Material Design 3

### Community 73 - "CrudPage.tsx"
Cohesion: 0.17
Nodes (14): CrudFieldDef, CrudPage(), descartarBorrador(), guardarBorradorActual(), openCreate(), openEdit(), save(), CrudPageConfig (+6 more)

### Community 74 - "outbox.ts"
Cohesion: 0.12
Nodes (19): AppEventName, EntityChangedPayload, eventBus, Handler, ToastPayload, PageMeta, clave(), encolarEnvio() (+11 more)

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

### Community 80 - "liveHub"
Cohesion: 0.17
Nodes (4): liveHub, LiveMessage, Sender, escuchar()

### Community 81 - "primitives.tsx"
Cohesion: 0.10
Nodes (9): estadoIcono(), estadoTono, ButtonVariant, Chip, ChipTone, EstadoChip(), Tone, TONE_BG (+1 more)

### Community 82 - "6. Fase actual y qué sigue (backlog priorizado)"
Cohesion: 0.22
Nodes (9): 6.1 Endurecer autenticación — ✅ HECHO (2026-09-10, ver §5.0), 6.2 Alcance por departamento / equipo — ✅ HECHO (2026-09-10, ver §5.-1), 6.3 `withTelemetry` (Decorator) en los CRUD genéricos — ✅ HECHO (2026-09-10), 6.4 Empaquetado Docker — ✅ HECHO (2026-09-10, ver §5.-1), 6.5 Pulido / intuitividad de frontend — ✅ HECHO (2026-09-10, ver §5.-2), 6.6 Analítica del dashboard — ✅ HECHO (2026-09-10, ver §5.-5 y `docs/03-...`), 6.7 Backlog opcional post‑Fase 6 — ✅ HECHO (2026-09-10, ver §5.-8 y `docs/05-...`), 6.8 Opcional / backlog residual (no bloqueante) (+1 more)

### Community 83 - "Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Adjuntos en Devolución a proveedor, 2. Vista previa inline de adjuntos, 3. Editar líneas de cotización desde el frontend, 4-bis. Acciones de fila uniformes (todas las tablas del sistema), 4. Reversa de recepción que ya alimentó CxP, 5. Verificación, 6. Puntos de entrada nuevos / tocados (+6 more)

### Community 84 - "stateMachines.ts"
Cohesion: 0.11
Nodes (14): OrdenCompraEstado, RecepcionEstado, recepcionStateMachine, RfqEstado, rfqStateMachine, SOLICITUD_NIVEL, SolicitudEstado, StateMachine (+6 more)

### Community 85 - "transaccional.ts"
Cohesion: 0.06
Nodes (39): empleadosEnAlcance(), ROLES_SIN_ALCANCE, DelegacionEfectiva, delegacionService, MAX_DIAS_DELEGACION, PERMISOS_APROBACION, BandejaPendientes, DecisionRecibida (+31 more)

### Community 87 - "Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo"
Cohesion: 0.20
Nodes (9): 0. Resumen ejecutivo, 1. Aclaración de dudas del negocio, 2. MinIO (almacenamiento de objetos S3), 3. Adjuntos de documentos, 4. Pantalla de Cotizaciones más entendible, 5. CRUD de los documentos del ciclo (con cerrojo por estado), 6. Verificación, 7. Puntos de entrada nuevos (+1 more)

### Community 88 - "Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Análisis del módulo (resumen — detalle con cita en el plan), 2. WS1 — Sistema de columnas de `DataTable` (UI de listas), 3. WS2 — Gating de acciones por permiso, 4. WS3 — Rollback del estado de la OC en reversa/borrado de recepción, 5. WS4 — Resiliencia del bus de eventos, 6. WS5 — Pantallas de Seguimiento / Excepciones de OC, 7. Verificación (+2 more)

### Community 89 - "Field.tsx"
Cohesion: 0.16
Nodes (13): dateBounds, Field(), FieldDef, fieldError(), FieldValue, fmtDia(), hoyLocal(), SelectOption (+5 more)

### Community 90 - "AppShell.tsx"
Cohesion: 0.20
Nodes (11): container, MODULES, SystemModule, visibleSections(), AppShell(), cycleTheme(), ROL_LABEL, applyTheme() (+3 more)

### Community 91 - "DashboardService.ts"
Cohesion: 0.19
Nodes (12): AhorroAdjudicacionResumen, clampMeses(), DashboardResumen, DashboardService, MES_LABEL, ProyeccionGastoMensual, proyectarGasto(), PuntoCompraMes (+4 more)

### Community 92 - "CrudService"
Cohesion: 0.11
Nodes (9): CrudService, CrudServiceOptions, AppEvents, Page, QueryParams, IRepository, ListQuery, repositoryFactory (+1 more)

### Community 93 - "qa-roles-smoke.mjs"
Cohesion: 0.20
Nodes (9): byRole, __dirname, errores, HEADED, header, LEAVES, outFile, report (+1 more)

### Community 94 - "useNotificaciones.ts"
Cohesion: 0.17
Nodes (16): BandejaPendientes, DecisionRecibida, fetchDecisiones(), fetchPendientes(), Notificacion, NotiTipo, VACIA, leerVisto() (+8 more)

### Community 95 - "seedFlujoDemo.ts"
Cohesion: 0.21
Nodes (14): CICLOS, CicloSpec, crearCiclo(), daysFromNow(), envRaw, H, idsTop(), inj() (+6 more)

### Community 96 - "S3FileStorage"
Cohesion: 0.49
Nodes (3): S3FileStorage, traducirErrorAlmacenamiento(), @aws-sdk/client-s3

### Community 97 - "qa-notificaciones-en-vivo.mjs"
Cohesion: 0.15
Nodes (11): abrirSolicitudes(), apiA, crear(), decidirEnUI(), dia, HEADED, ref(), results (+3 more)

### Community 99 - "SegAuthRepository.ts"
Cohesion: 0.13
Nodes (8): Accesos, asBinds(), AuthUserRow, EventoAcceso, Row, segAuthRepository, SesionRow, UsuarioDemoRow

### Community 100 - "RecepcionGuiada.tsx"
Cohesion: 0.12
Nodes (21): normalizarTexto(), useWizardStep(), avanzar(), cerrarSiNoAvanzo(), AsistenteCotizacion(), alCrearRfq(), saltarProveedor(), siguienteCotizacion() (+13 more)

### Community 101 - "DocumentoAppService"
Cohesion: 0.16
Nodes (6): CampoDetalle, ColumnaLinea, DocumentoDetalle(), Row, DocumentoAppService, TipoDocAdjunto

### Community 102 - "Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Por qué este alcance y no otro, 2. Infraestructura nueva, 3. Tests de lógica pura, 4. `ui/DataTable.test.tsx` (13 casos), 5. `ui/FlowStepper.test.tsx` (2 casos), 6. Verificación, 7. Puntos de entrada nuevos / tocados (+2 more)

### Community 103 - "nav.ts"
Cohesion: 0.13
Nodes (20): PermisoCodigo, Permisos, READ_COTIZACIONES, READ_DEVOLUCIONES, READ_FLUJO, READ_OC, READ_RECEPCIONES, READ_RFQ (+12 more)

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

### Community 109 - "OraclePool.ts"
Cohesion: 0.11
Nodes (12): envRaw, dml, envRaw, pares, tablas, CALL_TIMEOUT_MS, binds(), BorradorRepository (+4 more)

### Community 110 - "RefContext.tsx"
Cohesion: 0.14
Nodes (11): ALL_KINDS, DOC_PREFIX, DocRef, FALLBACK, RefContext, RefKind, RefProvider(), Refs (+3 more)

### Community 111 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, tsx, @types/node, @types/oracledb, @types/pdfkit, typescript, vitest

### Community 112 - "CompraReadRepository.ts"
Cohesion: 0.11
Nodes (16): HistorialProveedorResult, RecepcionPdfService, AhorroAdjudicacionRow, AlertaEscasezRow, CompraMesRow, DecisionSolicitudRow, EntradaMesRow, HistorialPrecioRow (+8 more)

### Community 113 - "DataTable.test.tsx"
Cohesion: 0.13
Nodes (7): BASE_COLUMNS, FakeResizeObserver, Row, ROWS, OPCIONES, @testing-library/react, @testing-library/user-event

### Community 114 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, db:deploy, db:deploy:full, db:seed, db:seed:flujo, dev, dev:apps (+5 more)

### Community 115 - "Avance 11 — Coherencia de documentos, buscador real, orden "lo último primero" y resistencia del sistema"
Cohesion: 0.13
Nodes (14): 0. Qué pidió el usuario y qué se encontró, 1. Orden: lo último primero, 2. Buscador global (`?q=`), 3. Coherencia de fechas y cantidades (`bll/compras/reglasDocumentos.ts`), 4. Resistencia, 5. Verificación (real, contra Oracle y navegador), 6. Descubierto al levantar el sistema, 7. Qué NO cambió (+6 more)

### Community 116 - "http"
Cohesion: 0.14
Nodes (14): Header, Linea, num2(), OrdenCompraPreview(), downloadService, http, EmpresaConfig, FALLBACK (+6 more)

### Community 117 - "AppError.ts"
Cohesion: 0.12
Nodes (25): AuthRequestInfo, MAX_INTENTOS_FALLIDOS, SesionUsuario, VENTANA_BLOQUEO_MIN, base64url(), fromBase64url(), JwtPayload, REVOCADOS (+17 more)

### Community 118 - "e2e-negocio-real.mjs"
Cohesion: 0.42
Nodes (8): api(), check(), expectStatus(), login(), main(), record(), results, section()

### Community 119 - "Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo"
Cohesion: 0.29
Nodes (6): 0. Resumen ejecutivo, 1. Cómo se llegó aquí (cronología de la sesión), 2. Estado final verificado, 3. Qué NO cambió (deliberadamente, y sigue vigente), 4. Sin pendientes de alcance, Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo

### Community 120 - "deploy.ts"
Cohesion: 0.27
Nodes (12): countAllTables(), countComTables(), ensureBorradores(), ensureDelegaciones(), EnvVars, HERE, loadEnv(), main() (+4 more)

### Community 122 - "e2e-ciclos-faltantes.mjs"
Cohesion: 0.52
Nodes (6): api(), check(), expectStatus(), login(), main(), results

### Community 123 - "Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06)"
Cohesion: 0.29
Nodes (6): 1. Hallazgos corregidos, 2. Lo que se probó y NO es vulnerable, 3. XSS, 4. Riesgo residual (decisiones / entorno), Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06), Resultado final

### Community 124 - "OracleErrorAdapter.ts"
Cohesion: 0.11
Nodes (12): AppError, ConflictError, ForeignKeyError, InternalError, OptimisticLockError, ServiceUnavailableError, asOracleError(), ORA_NO_DISPONIBLE (+4 more)

### Community 125 - "Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos"
Cohesion: 0.29
Nodes (6): 0. Resumen ejecutivo, 1. Cómo se llegó aquí (cronología de la sesión), 2. Estado final verificado, 3. Qué NO cambió (deliberadamente), 4. Sin pendientes de alcance, Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos

### Community 126 - "LiquidacionCxP.tsx"
Cohesion: 0.13
Nodes (14): ResumenLateral(), formatMoney(), BucketPago, ChequeoMatch, COLUMNS, FORMA_PAGO_OPCIONES, guardarUltimoPago(), leerUltimoPago() (+6 more)

### Community 127 - "scalar"
Cohesion: 0.14
Nodes (13): ensureBodega(), Ids, inTwoWeeks, mesActual, PRECIOS, scalar(), Ids, inTwoWeeks (+5 more)

### Community 128 - "ortografia.test.ts"
Cohesion: 0.25
Nodes (6): acentuar(), ACENTOS, checkNumero(), checkValue(), etiquetaDe(), RAIZ

### Community 129 - "qa-busqueda-orden.mjs"
Cohesion: 0.15
Nodes (8): badResponses, fallos, HEADED, nuevo, results, roleArg, SCREENS, shotsArg

### Community 130 - "searchSql.ts"
Cohesion: 0.32
Nodes (11): buildSearchClause(), condicionEtiquetaActivo(), condicionRef(), escaparLike(), esColumnaFecha(), esColumnaTexto(), norm(), normalizar() (+3 more)

### Community 131 - "comparativo.int.test.ts"
Cohesion: 0.29
Nodes (5): ensureBodega(), Ids, inTwoWeeks, PRECIOS, state

### Community 132 - "documentForms.ts"
Cohesion: 0.13
Nodes (14): ARTICULOS, BODEGAS, CENTROS, COND_PAGO, EMPLEADOS, GRUPOS, MONEDAS, PROVEEDORES (+6 more)

### Community 134 - "alcanceDepartamento.int.test.ts"
Cohesion: 0.53
Nodes (5): bearer(), crearSolicitud(), Fk, idsVisibles(), token()

### Community 135 - "search.ts"
Cohesion: 0.31
Nodes (6): coincide(), filtrarFilas(), textoDeFila(), SearchSelect(), SearchSelectOption, react-dom

### Community 136 - "qa-listas-con-buscador.mjs"
Cohesion: 0.20
Nodes (7): caja, combos, filtroCombo, grupo, page, res, shotsArg

### Community 137 - "AdjuntoService.ts"
Cohesion: 0.17
Nodes (13): AdjuntoMeta, AdjuntoService, assertRef(), COLAS, enCola(), EXTENSIONES, FIRMAS, Manifiesto (+5 more)

### Community 138 - "catalogsCrud.int.test.ts"
Cohesion: 0.33
Nodes (4): cases, CrudCase, ids, RefIds

### Community 139 - "ValidationError"
Cohesion: 0.33
Nodes (3): RfqService, ValidationError, validateAgainstDescriptor()

### Community 140 - "LiveNotifier.tsx"
Cohesion: 0.16
Nodes (9): BandejaEnVivo, DecisionEnVivo, LiveEvents, LiveConnection, LiveHandlers, LiveMessage, parseSse(), LiveNotifier() (+1 more)

### Community 141 - "gen-ddl-limits.ts"
Cohesion: 0.29
Nodes (6): ddl, destino, Limite, nCols, raiz, tablas

### Community 143 - "qa-panel-detalle.mjs"
Cohesion: 0.22
Nodes (4): mas, res, shotsArg, sorts

### Community 144 - "BaseCrudController.ts"
Cohesion: 0.15
Nodes (9): BorradorService, DIAS_VIGENCIA, BorradorRow, BaseCrudController, extractVersion(), parseId(), auditContextOf(), registerBorradorRoutes() (+1 more)

### Community 145 - "apiClient.ts"
Cohesion: 0.36
Nodes (6): api, ApiRequestError, client, guard(), toApiRequestError(), isAppError()

### Community 146 - "Auditoría del frontend (UX/UI, responsive, proporción áurea) y resiliencia de almacenamiento — 2026-10-06"
Cohesion: 0.14
Nodes (13): 1. MinIO ("sin conexión, no deja cargar"), 2. Idempotencia, 3. Evaluación del frontend (antes → ahora), 4. Autocompletado — el usuario no reescribe lo que el sistema ya tiene, 5. Pendiente / recomendaciones, Adenda — Agilidad, validación en vivo, delegación y resistencia (2026-10-06), Adenda — Borradores en el servidor y PDF formal (2026-10-06), Adenda — Lote UI/UX completo y ortografía (2026-10) (+5 more)

### Community 147 - "LiquidacionService.ts"
Cohesion: 0.16
Nodes (11): BucketPagoProyectado, DIAS_MAX_PAGO_FUTURO, FacturaRow, LiquidacionService, LiquidarInput, ORDEN_BUCKETS, ProyeccionPagosResumen, TresWayMatchReport (+3 more)

### Community 150 - "DelegacionRepository.ts"
Cohesion: 0.26
Nodes (5): binds(), delegacionRepository, DelegacionVigente, mapFila(), Row

### Community 151 - "escasezSubscriber.ts"
Cohesion: 0.36
Nodes (7): AlertaRow, ArticuloRow, onExistenciaActualizada(), registerEscasezSubscriber(), ExistenciaActualizadaPayload, alertaEscasezRepository(), articuloRepository()

### Community 152 - "SolicitudPdfService.ts"
Cohesion: 0.38
Nodes (4): dinero(), PRIORIDAD, ESTADO_LABEL, estadoLabel()

### Community 153 - "react"
Cohesion: 0.11
Nodes (7): Drawer(), esCampoDeTexto(), ErrorBoundary, Props, State, HelpContent, react

### Community 154 - "qa-recepcion-conforme.mjs"
Cohesion: 0.25
Nodes (3): REGISTRAR, res, shotsArg

### Community 155 - "Logger.ts"
Cohesion: 0.18
Nodes (4): LEVEL_WEIGHT, LogFields, LogLevel, ScopedLogger

### Community 157 - "notificacionesSubscriber.ts"
Cohesion: 0.27
Nodes (8): registerComprasSubscribers(), construirDecision(), DecisionEnVivo, registerNotificacionesSubscriber(), SIGUIENTE, SolicitudAprobacionPayload, loadDotenv(), main()

### Community 158 - "Toast.tsx"
Cohesion: 0.17
Nodes (6): Ctx, ToastAction, ToastApi, ToastItem, ToastTone, TONE

### Community 159 - "PdfBuilder.ts"
Cohesion: 0.20
Nodes (8): money(), moneyCompact(), rango(), Doc, LetterheadOptions, MARGIN, PdfColumn, pdfkit

### Community 161 - "fastify"
Cohesion: 0.22
Nodes (6): envRaw, H, Ids, inTwoWeeks, s, fastify

### Community 162 - "AuthContext.tsx"
Cohesion: 0.16
Nodes (9): AuthContext, AuthProvider(), boot(), AuthState, jwtExp(), Sesion, tokenVigente(), grants() (+1 more)

### Community 163 - "parseListQuery.ts"
Cohesion: 0.22
Nodes (8): FilterOperator, readOnlyList(), listQuery(), first(), OPERATORS, parseListQuery(), RawQuery, RESERVED

### Community 164 - "aprobacionEnVivo.int.test.ts"
Cohesion: 0.27
Nodes (8): call(), dia(), Evento, fk, msg(), nuevaSolicitud(), Sesion, u

### Community 165 - "DocumentForm.tsx"
Cohesion: 0.31
Nodes (9): displayValue(), DocumentFormConfig, PanelDerivado(), Values, AutoFillSpec, FormFieldDef, LineSeedSpec, formatRate() (+1 more)

### Community 166 - "playwright"
Cohesion: 0.20
Nodes (6): playwright, res, shotsArg, ALTOS, PANTALLAS, res

### Community 167 - "qa-tablas-sin-solapes.mjs"
Cohesion: 0.33
Nodes (4): ANCHOS, PANTALLAS, res, shotsArg

### Community 168 - "delegacion.int.test.ts"
Cohesion: 0.32
Nodes (6): call(), dia(), fk, nuevaSolicitud(), Sesion, u

### Community 170 - "estados.ts"
Cohesion: 0.25
Nodes (7): CALIFICACION_ESTRELLAS, calificacionProveedorEstrellas(), ICONO_ESTADO, LABEL, PRIORIDAD_LABEL, PRIORIDAD_TONO, TONO

### Community 171 - "qa-agilidad.mjs"
Cohesion: 0.25
Nodes (5): item, menu, p2, page, res

### Community 172 - "cxpSubscriber.ts"
Cohesion: 0.60
Nodes (5): hoyIsoDate(), onRecepcionRegistrada(), onRecepcionReversada(), registerCxpSubscriber(), sumarDias()

### Community 173 - "validators.ts"
Cohesion: 0.33
Nodes (3): class-transformer, class-validator, reflect-metadata

### Community 174 - "density.ts"
Cohesion: 0.60
Nodes (5): aplicar(), Densidad, initDensidad(), leer(), useDensidad()

### Community 177 - "Trazabilidad.tsx"
Cohesion: 0.50
Nodes (4): ESTILO, Hito, Trazabilidad(), formatFechaHora()

### Community 178 - "borradores.int.test.ts"
Cohesion: 0.83
Nodes (3): hdr(), listar(), put()

## Knowledge Gaps
- **1028 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+1023 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1352 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `n()` connect `messageOf` to `concurrencia.mjs`, `DocumentoList.tsx`, `mapearTextos`, `qa-panel-detalle.mjs`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `DataTable.tsx`, `frontend/package.json`, `search.ts`, `LiveNotifier.tsx`, `CompraServices.ts`, `Toast.tsx`, `AuthContext.tsx`, `DocumentForm.tsx`, `messageOf`, `App.tsx`, `Dashboard.tsx`, `density.ts`, `Trazabilidad.tsx`, `DocumentoList.tsx`, `formSupport.ts`, `CrudPage.tsx`, `outbox.ts`, `Field.tsx`, `AppShell.tsx`, `useNotificaciones.ts`, `RecepcionGuiada.tsx`, `DocumentoAppService`, `nav.ts`, `RefContext.tsx`, `DataTable.test.tsx`, `http`, `LiquidacionCxP.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `playwright` connect `playwright` to `qa-busqueda-orden.mjs`, `qa-notificaciones-en-vivo.mjs`, `qa-tablas-sin-solapes.mjs`, `qa-listas-con-buscador.mjs`, `qa-crud-open.mjs`, `qa-agilidad.mjs`, `qa-panel-detalle.mjs`, `qa-recepcion-conforme.mjs`, `qa-roles-smoke.mjs`, `package.json`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1028 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SCRIPT_DDL.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.0664869721473495 - nodes in this community are weakly interconnected._
- **Should `referencias.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13227513227513227 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08901515151515152 - nodes in this community are weakly interconnected._
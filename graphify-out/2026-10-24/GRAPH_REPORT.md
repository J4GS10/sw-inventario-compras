# Graph Report - sw-inventario  (2026-10-24)

## Corpus Check
- 304 files · ~376,963 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3153 nodes · 7080 edges · 172 communities (149 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 202 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `73c85d16`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SCRIPT_DDL.sql
- PdfBuilder
- referencias.ts
- DataTable.tsx
- LiquidacionService.ts
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
- ValidationError
- ComCrudService.ts
- CLAUDE.md
- GEMINI.md
- oracledb
- logger
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
- ReconciliacionService.ts
- messageOf
- AuditContext
- fastify
- Avance 03 — Analítica del dashboard: series temporales + índice de ahorro
- BaseOracleRepository
- sw-inventario · Módulo de Compras (COM_)
- Dashboard.tsx
- SolicitudCompraService.ts
- transaccional.ts
- Catálogos y campos de referencia — Módulo de Gestión de Compras
- OrdenCompraPdfService.ts
- ComparativoService
- Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras
- Validacion
- mapearTextos
- documentForms.ts
- Avance 06 — Roles endurecidos + inferencia de datos en los formularios
- DocumentoList.tsx
- formSupport.ts
- BaseOracleRepository.ts
- tildes-frontend.mjs
- Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras
- ReporteService.ts
- dependencies
- ReporteAppService
- descriptorHelpers.ts
- 7. Componentes reutilizables
- authGuard.ts
- 10. Pantallas de formularios
- 2. Objetivo y principios de diseño
- CrudPage.tsx
- outbox.ts
- 5. Arquitectura de la interfaz
- 4. Tipografía e iconografía
- 9. Pantallas de Catálogos y Productos
- scripts
- AdjuntoAppService
- aprobacionEnVivo.int.test.ts
- primitives.tsx
- 6. Fase actual y qué sigue (backlog priorizado)
- Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP
- StateMachine.ts
- DocumentForm
- Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo
- Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales
- Field.tsx
- DashboardRol.tsx
- DashboardService.ts
- Repository.ts
- qa-roles-smoke.mjs
- useNotificaciones.ts
- seedEvaluacionDemo.ts
- S3FileStorage
- qa-notificaciones-en-vivo.mjs
- Charts.tsx
- mapOracleError
- RecepcionGuiada.tsx
- DocumentoAppService
- Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)
- nav.ts
- OraclePool.ts
- idempotency.ts
- qa-crud-open.mjs
- reglasNegocio.int.test.ts
- DataTable
- RefContext.tsx
- devDependencies
- CompraReadRepository.ts
- DataTable.test.tsx
- oficial.mjs
- Avance 11 — Coherencia de documentos, buscador real, orden "lo último primero" y resistencia del sistema
- http
- DocumentForm.tsx
- e2e-negocio-real.mjs
- Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo
- CrudService
- useResource
- e2e-ciclos-faltantes.mjs
- Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06)
- AppError.ts
- Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos
- format.ts
- scalar
- ortografia.test.ts
- qa-busqueda-orden.mjs
- searchSql.ts
- search.ts
- stateMachines.ts
- documentoUpdate.int.test.ts
- alcanceDepartamento.int.test.ts
- reportes.ts
- qa-listas-con-buscador.mjs
- AdjuntoService.ts
- catalogsCrud.int.test.ts
- devDependencies
- LiveConnection
- gen-ddl-limits.ts
- apiClient.ts
- qa-panel-detalle.mjs
- ComparativoAppService
- SegAuthRepository.ts
- Auditoría del frontend (UX/UI, responsive, proporción áurea) y resiliencia de almacenamiento — 2026-10-06
- dashboard.int.test.ts
- dev.mjs
- density.ts
- DelegacionRepository.ts
- reportesRbac.int.test.ts
- react
- entrar
- ScopedLogger
- app.ts
- Toast.tsx
- validators.ts
- borradores.int.test.ts
- qa-oficial-api.mjs
- playwright
- qa-lib.mjs
- delegacion.int.test.ts
- HistorialAppService
- qa-agilidad.mjs
- ComparativoPdfService.ts
- alcanceDe
- EntityDescriptor.ts
- BaseHeaderDetailRepository.ts
- scripts
- qa-oficial.mjs

## God Nodes (most connected - your core abstractions)
1. `SEG_USUARIO` - 105 edges
2. `AuditContext` - 103 edges
3. `oraclePool` - 99 edges
4. `mapOracleError()` - 81 edges
5. `ValidationError` - 79 edges
6. `NotFoundError` - 72 edges
7. `CompraReadRepository` - 66 edges
8. `messageOf()` - 65 edges
9. `react` - 47 edges
10. `5. Lo realizado en detalle (bloques, orden cronológico inverso)` - 45 edges

## Surprising Connections (you probably didn't know these)
- `scanCode()` --indirect_call--> `n()`  [INFERRED]
  scripts/tildes-lib.mjs → frontend/src/modules/compras/DocumentoList.tsx
- `buildApp()` --indirect_call--> `errorHandler()`  [INFERRED]
  backend/src/app.ts → backend/src/presentation/middlewares/errorHandler.ts
- `ensureBodega()` --calls--> `scalar()`  [EXTRACTED]
  backend/tests/dashboard.int.test.ts → backend/tests/helpers/testApp.ts
- `guardarBorradorActual()` --calls--> `guardarBorrador()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/core/borradores.ts
- `confirmDelete()` --calls--> `messageOf()`  [EXTRACTED]
  frontend/src/components/CrudPage.tsx → frontend/src/core/errors.ts

## Import Cycles
- None detected.

## Communities (172 total, 13 thin omitted)

### Community 0 - "SCRIPT_DDL.sql"
Cohesion: 0.07
Nodes (105): COM_ACUERDO_DETALLE, COM_ACUERDO_PROVEEDOR, COM_ARTICULO_PROVEEDOR, COM_CATEGORIA_COMPRA, COM_CENTRO_COSTO, COM_COMPARATIVO_COTIZACIONES, COM_CONDICION_PAGO, COM_COTIZACION_DETALLE (+97 more)

### Community 1 - "PdfBuilder"
Cohesion: 0.23
Nodes (6): money(), pct(), rango(), ReportePdfService, dinero(), PdfBuilder

### Community 2 - "referencias.ts"
Cohesion: 0.14
Nodes (21): CrudRepository, chequeRepository(), contrasenaPagoRepository(), CXP_CHEQUE, CXP_CONTRASENA_PAGO, CXP_FACTURA_PROVEEDOR, INV_ALERTA_ESCASEZ, INV_ARTICULO (+13 more)

### Community 3 - "DataTable.tsx"
Cohesion: 0.13
Nodes (16): ESTILO, Hito, Trazabilidad(), prioridadLabel(), prioridadTono(), formatDia(), formatFechaHora(), BulkAction (+8 more)

### Community 4 - "LiquidacionService.ts"
Cohesion: 0.13
Nodes (13): BucketPagoProyectado, DIAS_MAX_PAGO_FUTURO, FacturaRow, LiquidacionService, LiquidarInput, ORDEN_BUCKETS, ProyeccionPagosResumen, ReconciliacionService (+5 more)

### Community 5 - "backend/package.json"
Cohesion: 0.13
Nodes (14): typescript, vitest, main, name, private, type, version, @aws-sdk/s3-request-presigner (+6 more)

### Community 6 - "HttpClient.ts"
Cohesion: 0.06
Nodes (23): AppError, ConflictError, ErrorDetail, ForbiddenError, LockedError, NetworkError, NotFoundError, RateLimitedError (+15 more)

### Community 7 - "frontend/package.json"
Cohesion: 0.12
Nodes (17): dependencies, react, react-dom, typescript, vitest, name, private, type (+9 more)

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
Cohesion: 0.11
Nodes (6): oraclePool, asBinds(), CompraReadRepository, iso(), num(), registerComReferenciaRoutes()

### Community 16 - "concurrencia.mjs"
Cohesion: 0.12
Nodes (29): aprobada(), conOc(), conRfq(), cot(), get(), post(), ref, solicitud() (+21 more)

### Community 17 - "Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)"
Cohesion: 0.29
Nodes (6): 1. División Estructural del Repositorio, 2. Definición del Stack Tecnológico, 3. Especificaciones de la Base de Datos (Oracle 21c), 4. Arquitectura y Escalabilidad con Docker, 5. Reglas Técnicas de Frontend (React + Vite + Tailwind v4), Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)

### Community 18 - "CompraServices.ts"
Cohesion: 0.06
Nodes (36): catalogCache, DashboardAppService, DesempenoProveedorItem, FiltroEvaluacion, GastoProveedorItem, HistorialResumen, MejorProveedor, NivelRiesgo (+28 more)

### Community 19 - "ValidationError"
Cohesion: 0.12
Nodes (14): CotizacionService, RecepcionService, RfqService, BusinessRuleError, NotFoundError, ValidationError, normalizePageQuery(), checkNumero() (+6 more)

### Community 21 - "ComCrudService.ts"
Cohesion: 0.16
Nodes (8): CrudServiceOptions, ComCrudService, Datos, ReglaCampos, REGLAS, vacio(), ComEntityKey, CrudResource

### Community 27 - "oracledb"
Cohesion: 0.08
Nodes (40): countAllTables(), countComTables(), ensureBorradores(), ensureCostoEnvio(), ensureDelegaciones(), EnvVars, HERE, loadEnv() (+32 more)

### Community 28 - "logger"
Cohesion: 0.07
Nodes (36): recepcionStateMachine, hoyIsoDate(), onRecepcionRegistrada(), onRecepcionReversada(), registerCxpSubscriber(), sumarDias(), AlertaRow, ArticuloRow (+28 more)

### Community 29 - "routes/com/index.ts"
Cohesion: 0.16
Nodes (13): buildCrudService(), AnyMethod, withTelemetry(), BaseCrudController, extractVersion(), parseId(), CRUD_OPERATIVOS, CRUD_SENSIBLES (+5 more)

### Community 30 - "package.json"
Cohesion: 0.05
Nodes (39): allowScripts, canvas@3.2.3, dependencies, canvas, mupdf, @napi-rs/canvas, pdfjs-dist, description (+31 more)

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
Cohesion: 0.18
Nodes (10): 1. El flujo, paso a paso, y qué lo cubre en el sistema, 2. Roles: quién ve y hace qué, Catálogo de permisos (módulo `COMPRAS`), Dashboard y Reportes por rol (qué decide cada uno), Diagrama del ciclo, Flujo del sistema y modelo de roles — Gestión de Compras, Jerarquía de aprobación y autorización, Qué ve cada rol en el menú (+2 more)

### Community 36 - "8. Pantallas clave — Gestión de Compras"
Cohesion: 0.25
Nodes (8): 8. Pantallas clave — Gestión de Compras, Catálogo, Cotizaciones, Facturación / CxP, Proveedores, Recepción, Solicitudes, Órdenes de Compra

### Community 37 - "analitica.ts"
Cohesion: 0.10
Nodes (12): fileStorage, InMemoryFileStorage, StorageFactory, comparativo, comparativoPdf, dashboard, idParam(), intQuery() (+4 more)

### Community 38 - "5. Lo realizado en detalle (bloques, orden cronológico inverso)"
Cohesion: 0.04
Nodes (45): 5.0 Endurecimiento de autenticación (subfase 6.1) — 2026-09-10, 5.-10 Roles endurecidos + inferencia de datos en formularios — 2026-09-10, 5.-11 Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales — 2026-09-10, 5.-12 Primera suite de tests del frontend (infra + cobertura inicial) — 2026-09-10, 5.-13 Acceso al PDF de la cotización desde el Comparativo — 2026-09-10/11, 5.-14 Asistente guiado RFQ→Cotización→Comparativo→OC + fusión Comprador/Financiero — 2026-09-11, 5.-15 Fixes tras probar el asistente en vivo: select ilegible ("#187") + "Autoriza la orden" sin filtrar — 2026-09-11, 5.-16 Revertida la fusión Comprador/Financiero — 2026-09-11 (+37 more)

### Community 39 - "ReconciliacionService.ts"
Cohesion: 0.14
Nodes (12): DevolucionProveedorService, OrdenCompraService, ConsistenciaReport, RECEPCION_ACTIVA, DevolucionProveedor, OrdenCompra, OrdenCompraDetalle, OrdenCompraEstado (+4 more)

### Community 40 - "messageOf"
Cohesion: 0.10
Nodes (30): AdjuntosPanel(), descargar(), eliminar(), onFile(), ver(), humanBytes(), Preview, SUGERENCIA_ADJUNTO (+22 more)

### Community 41 - "AuditContext"
Cohesion: 0.09
Nodes (11): BaseCrudService, SolicitudCompraService, SolicitudPdfService, AuditContext, validateDto(), HitoTrazabilidad, SolicitudCompra, SolicitudDetalle (+3 more)

### Community 42 - "fastify"
Cohesion: 0.14
Nodes (15): Ids, inTwoWeeks, state, Ids, inTwoWeeks, s, envRaw, startTestApp() (+7 more)

### Community 43 - "Avance 03 — Analítica del dashboard: series temporales + índice de ahorro"
Cohesion: 0.13
Nodes (14): 0. Resumen ejecutivo, 1. Decisiones de métrica (respuestas del usuario), 2.1 `dal/repositories/com/CompraReadRepository.ts` — 3 consultas nuevas, 2.2 `bll/services/com/DashboardService.ts` (nuevo), 2.3 `presentation/routes/com/analitica.ts`, 2. Backend, 3.1 `core/CompraServices.ts`, 3.2 `ui/Charts.tsx` (nuevo, exports nombrados — convención de `ui/`) (+6 more)

### Community 44 - "BaseOracleRepository"
Cohesion: 0.16
Nodes (5): asBinds(), auditUser(), BaseOracleRepository, ColumnDescriptor, findColumn()

### Community 45 - "sw-inventario · Módulo de Compras (COM_)"
Cohesion: 0.20
Nodes (9): Base de datos (Oracle 21c), Docker, Documentación, La tesis POO: configurar, no programar, Pruebas, Puesta en marcha, Servidor oficial (producción) y pruebas, sw-inventario · Módulo de Compras (COM_) (+1 more)

### Community 46 - "Dashboard.tsx"
Cohesion: 0.19
Nodes (11): DashboardResumen, dashboardService, AYUDA_DASHBOARD, Dashboard(), Q_COMPACT, Responsable, Row, tendencia() (+3 more)

### Community 47 - "SolicitudCompraService.ts"
Cohesion: 0.09
Nodes (42): MAX_LINEAS, ordenCompraStateMachine, solicitudStateMachine, ComEventName, ComEvents, OrdenCompraEstadoPayload, RecepcionRegistradaPayload, RecepcionReversadaPayload (+34 more)

### Community 49 - "transaccional.ts"
Cohesion: 0.06
Nodes (39): empleadosEnAlcance(), ROLES_SIN_ALCANCE, rfqIdsEnAlcance(), solicitudIdsEnAlcance(), DelegacionEfectiva, delegacionService, MAX_DIAS_DELEGACION, PERMISOS_APROBACION (+31 more)

### Community 50 - "Catálogos y campos de referencia — Módulo de Gestión de Compras"
Cohesion: 0.20
Nodes (9): 1. Tipos de "catálogo" en el módulo, 2. Datos semilla cargados (`database/dml/`), 3. Campos corregidos (eran texto/ID libre, ahora son catálogo), 4. Campos que quedan como texto libre (correcto), 5. Pendiente (catálogos estáticos ya definidos, faltan sus pantallas), Catálogos (`frontend/src/modules/compras/catalogPages.tsx`), Catálogos y campos de referencia — Módulo de Gestión de Compras, Comparativo de cotizaciones (`ComparativoView.tsx`) (+1 more)

### Community 51 - "OrdenCompraPdfService.ts"
Cohesion: 0.16
Nodes (14): estadoVisual(), fechaLarga(), MESES, money(), nombreMoneda(), OrdenCompraPdfService, qty(), CENTENAS (+6 more)

### Community 52 - "ComparativoService"
Cohesion: 0.16
Nodes (10): CONFIABILIDAD_NEUTRA, MAX_SOBRE_PRECIO, OfertaParaPuntuar, OfertaPuntuada, PESOS, puntuarRenglon(), r2(), SugerenciaRenglon (+2 more)

### Community 53 - "Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras"
Cohesion: 0.18
Nodes (10): 1. Qué es el proyecto, 2. Stack y comandos, 3. Arquitectura (6 capas, flujo unidireccional hacia abajo), 4. Estado por fases, 7. Cómo levantar y verificar, 8. Mapa de archivos de referencia, 9. Convenciones al retomar, Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras (+2 more)

### Community 54 - "Validacion"
Cohesion: 0.12
Nodes (36): CabeceraSolicitudDatos, devolvibleDeLinea(), HORIZONTE_DIAS, limiteFuturo(), LineaCotizacionDatos, LineaOrdenDatos, LineaSolicitudDatos, MAX_DESCRIPCION_LINEA (+28 more)

### Community 55 - "mapearTextos"
Cohesion: 0.06
Nodes (35): filas, acentuar(), lista, re, recorrer(), args, cuenta, dirs (+27 more)

### Community 56 - "documentForms.ts"
Cohesion: 0.06
Nodes (33): CALIFICACION_PROVEEDOR, CRITERIO_COMPARATIVO, ESTADO_AI, ESTADO_SEGUIMIENTO_ORDEN, MOTIVO_DEVOLUCION, PRIORIDAD_SOLICITUD, TIPO_EXCEPCION_ORDEN, ComparativoDTO (+25 more)

### Community 57 - "Avance 06 — Roles endurecidos + inferencia de datos en los formularios"
Cohesion: 0.12
Nodes (16): 0. Resumen ejecutivo, 1. La jerarquía de roles (respuesta a "no entiendo la lógica"), 2. Por qué "el bodeguero veía todo" — diagnóstico, 3.1 Atajo `X-Dev-User` cerrado por defecto, 3.2 Lectura por documento (segregación de funciones), 3.3 Alcance por departamento en RFQ y Cotización, 3.4 Verificado en vivo (login real, sin atajo), 3. Roles endurecidos (backend) (+8 more)

### Community 58 - "DocumentoList.tsx"
Cohesion: 0.08
Nodes (29): ActionModalState, CREAR_PERM, DETALLE_KEYS, DocConfig, DOCUMENTO_CONFIGS, DocumentoList(), abrirComparativoDeCotizacion(), cancelarRfq() (+21 more)

### Community 59 - "formSupport.ts"
Cohesion: 0.13
Nodes (21): aNumero(), buildLabel(), DEPENDS_LABEL, diaLocal(), esNumero(), fillPlaceholders(), getByPath(), norm() (+13 more)

### Community 60 - "BaseOracleRepository.ts"
Cohesion: 0.10
Nodes (15): buildPaginated(), DEFAULT_PAGE_SIZE, FilterCondition, FilterOperator, MAX_PAGE_SIZE, MAX_SEARCH_LENGTH, PageQuery, Paginated (+7 more)

### Community 61 - "tildes-frontend.mjs"
Cohesion: 0.21
Nodes (12): acentuar(), AMBIGUAS, conMayus(), DRY, esTextoUsuario(), PALABRAS, procesar(), raiz (+4 more)

### Community 62 - "Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras"
Cohesion: 0.12
Nodes (15): 0. Resumen ejecutivo, 1. Autenticación endurecida (6.1), 2. Alcance por departamento/equipo (6.2 + endurecimiento), 3.1 Catálogo de permisos (14, módulo `COMPRAS`), 3.2 Matriz de roles (qué puede hacer cada uno), 3.3 Gating en el frontend, 3. Modelo de roles — jerarquía correcta, 4. Bandeja de pendientes (notificaciones) (+7 more)

### Community 63 - "ReporteService.ts"
Cohesion: 0.08
Nodes (27): calcularScore(), CALIFICACION_SCORE, EvaluacionProveedorItem, GastoProveedorItem, mejorPor(), MejorProveedor, nivelDe(), NivelRiesgo (+19 more)

### Community 64 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-transformer, class-validator, fastify, @fastify/multipart, oracledb (+3 more)

### Community 66 - "descriptorHelpers.ts"
Cohesion: 0.14
Nodes (16): DDL_LIMITES, LimiteDdl, AuditMode, buildDescriptor(), BuildOpts, camelPk(), col(), ColOpts (+8 more)

### Community 68 - "7. Componentes reutilizables"
Cohesion: 0.33
Nodes (6): 7. Componentes reutilizables, Botones, Chips y badges, Inputs, Moneda, Tablas

### Community 70 - "authGuard.ts"
Cohesion: 0.07
Nodes (32): AuthRequestInfo, authService, MAX_INTENTOS_FALLIDOS, SesionUsuario, VENTANA_BLOQUEO_MIN, base64url(), fromBase64url(), JwtPayload (+24 more)

### Community 71 - "10. Pantallas de formularios"
Cohesion: 0.50
Nodes (4): 10. Pantallas de formularios, Campos automáticos, Organización, Validación

### Community 72 - "2. Objetivo y principios de diseño"
Cohesion: 0.50
Nodes (4): 2. Objetivo y principios de diseño, Apple Human Interface Guidelines, Fluent Design, Material Design 3

### Community 73 - "CrudPage.tsx"
Cohesion: 0.13
Nodes (16): CrudFieldDef, CrudPage(), confirmDelete(), descartarBorrador(), guardarBorradorActual(), openCreate(), openEdit(), save() (+8 more)

### Community 74 - "outbox.ts"
Cohesion: 0.09
Nodes (24): Suite(), CrudServiceOptions, AppEventName, AppEvents, EntityChangedPayload, eventBus, Handler, ToastPayload (+16 more)

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

### Community 84 - "StateMachine.ts"
Cohesion: 0.21
Nodes (6): StateMachine, ESTADO_LABEL, estadoLabel(), ORDEN_COMPRA_ESTADOS, OcEstado, ocMachine

### Community 85 - "DocumentForm"
Cohesion: 0.18
Nodes (15): DocumentForm(), cuerpoDeCreacion(), descartarBorrador(), enfocarPrimerError(), enfocarPrimerErrorServidor(), onPrimaryClick(), submit(), validar() (+7 more)

### Community 87 - "Avance 04 — Adjuntos de documentos (MinIO) + CRUD completo del ciclo"
Cohesion: 0.20
Nodes (9): 0. Resumen ejecutivo, 1. Aclaración de dudas del negocio, 2. MinIO (almacenamiento de objetos S3), 3. Adjuntos de documentos, 4. Pantalla de Cotizaciones más entendible, 5. CRUD de los documentos del ciclo (con cerrojo por estado), 6. Verificación, 7. Puntos de entrada nuevos (+1 more)

### Community 88 - "Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Análisis del módulo (resumen — detalle con cita en el plan), 2. WS1 — Sistema de columnas de `DataTable` (UI de listas), 3. WS2 — Gating de acciones por permiso, 4. WS3 — Rollback del estado de la OC en reversa/borrado de recepción, 5. WS4 — Resiliencia del bus de eventos, 6. WS5 — Pantallas de Seguimiento / Excepciones de OC, 7. Verificación (+2 more)

### Community 89 - "Field.tsx"
Cohesion: 0.16
Nodes (13): dateBounds, Field(), FieldDef, fieldError(), FieldValue, fmtDia(), hoyLocal(), SelectOption (+5 more)

### Community 90 - "DashboardRol.tsx"
Cohesion: 0.09
Nodes (22): ORDEN_POR_PERFIL, perfilAnalitico, PERMISO_DE_REPORTE, PRIORIDAD_POR_PERFIL, ReporteId, AUDITOR, BODEGA, COMPRADOR (+14 more)

### Community 91 - "DashboardService.ts"
Cohesion: 0.19
Nodes (12): AhorroAdjudicacionResumen, clampMeses(), DashboardResumen, DashboardService, MES_LABEL, ProyeccionGastoMensual, proyectarGasto(), PuntoCompraMes (+4 more)

### Community 92 - "Repository.ts"
Cohesion: 0.12
Nodes (7): Page, QueryParams, HttpRepository, IRepository, ListQuery, repositoryFactory, RestRepository

### Community 93 - "qa-roles-smoke.mjs"
Cohesion: 0.20
Nodes (9): byRole, __dirname, errores, HEADED, header, LEAVES, outFile, report (+1 more)

### Community 94 - "useNotificaciones.ts"
Cohesion: 0.14
Nodes (20): BandejaEnVivo, DecisionEnVivo, LiveEvents, BandejaPendientes, DecisionRecibida, fetchDecisiones(), fetchPendientes(), Notificacion (+12 more)

### Community 95 - "seedEvaluacionDemo.ts"
Cohesion: 0.18
Nodes (15): Ciclo, CICLOS, CONDICION, crear(), diasDesdeHoy(), envRaw, Estado, H (+7 more)

### Community 96 - "S3FileStorage"
Cohesion: 0.49
Nodes (3): S3FileStorage, traducirErrorAlmacenamiento(), @aws-sdk/client-s3

### Community 97 - "qa-notificaciones-en-vivo.mjs"
Cohesion: 0.15
Nodes (12): abrirSolicitudes(), apiA, crear(), decidirEnUI(), dia, entrar(), HEADED, ref() (+4 more)

### Community 99 - "mapOracleError"
Cohesion: 0.16
Nodes (6): asOracleError(), mapOracleError(), binds(), BorradorRepository, asBinds(), segAuthRepository

### Community 100 - "RecepcionGuiada.tsx"
Cohesion: 0.12
Nodes (21): withResolvedOptions(), normalizarTexto(), useWizardStep(), avanzar(), cerrarSiNoAvanzo(), AsistenteCotizacion(), alCrearRfq(), saltarProveedor() (+13 more)

### Community 101 - "DocumentoAppService"
Cohesion: 0.16
Nodes (6): CampoDetalle, ColumnaLinea, DocumentoDetalle(), Row, DocumentoAppService, TipoDocAdjunto

### Community 102 - "Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)"
Cohesion: 0.18
Nodes (10): 0. Resumen ejecutivo, 1. Por qué este alcance y no otro, 2. Infraestructura nueva, 3. Tests de lógica pura, 4. `ui/DataTable.test.tsx` (13 casos), 5. `ui/FlowStepper.test.tsx` (2 casos), 6. Verificación, 7. Puntos de entrada nuevos / tocados (+2 more)

### Community 103 - "nav.ts"
Cohesion: 0.05
Nodes (46): AuthContext, AuthProvider(), boot(), AuthState, jwtExp(), Sesion, tokenVigente(), grants() (+38 more)

### Community 104 - "OraclePool.ts"
Cohesion: 0.08
Nodes (25): envRaw, dml, envRaw, pares, tablas, PRIORIDAD, AppEnvironment, AuthConfig (+17 more)

### Community 106 - "idempotency.ts"
Cohesion: 0.19
Nodes (10): Entrada, enviar(), fastify, FastifyRequest, huellaDe(), limpiar(), METODOS, registerIdempotency() (+2 more)

### Community 107 - "qa-crud-open.mjs"
Cohesion: 0.25
Nodes (7): __dirname, errores, HEADED, outFile, report, rolesArg, SCREENS

### Community 108 - "reglasNegocio.int.test.ts"
Cohesion: 0.24
Nodes (9): cotizacionBody(), dia(), H, Ids, mensaje(), post(), rfqAbierto(), solicitudAprobada() (+1 more)

### Community 109 - "DataTable"
Cohesion: 0.14
Nodes (9): DataTable(), exportarFilas(), exportCsv(), isTruncatable(), resolveAlign(), resolveWidth(), sugerenciaBusqueda(), useAltoDisponible() (+1 more)

### Community 110 - "RefContext.tsx"
Cohesion: 0.14
Nodes (11): ALL_KINDS, DOC_PREFIX, DocRef, FALLBACK, RefContext, RefKind, RefProvider(), Refs (+3 more)

### Community 111 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, tsx, @types/node, @types/oracledb, @types/pdfkit, typescript, vitest

### Community 112 - "CompraReadRepository.ts"
Cohesion: 0.10
Nodes (17): HistorialProveedorResult, RecepcionPdfService, AhorroAdjudicacionRow, AlertaEscasezRow, CompraMesRow, DecisionSolicitudRow, EntradaMesRow, EvaluacionProveedoresFiltro (+9 more)

### Community 113 - "DataTable.test.tsx"
Cohesion: 0.12
Nodes (9): toggleAll(), BASE_COLUMNS, FakeResizeObserver, Row, rowKey(), ROWS, OPCIONES, @testing-library/react (+1 more)

### Community 114 - "oficial.mjs"
Cohesion: 0.17
Nodes (13): abierto(), backend, detener(), dirEstado, esperar(), estado(), frontend, leerPids() (+5 more)

### Community 115 - "Avance 11 — Coherencia de documentos, buscador real, orden "lo último primero" y resistencia del sistema"
Cohesion: 0.13
Nodes (14): 0. Qué pidió el usuario y qué se encontró, 1. Orden: lo último primero, 2. Buscador global (`?q=`), 3. Coherencia de fechas y cantidades (`bll/compras/reglasDocumentos.ts`), 4. Resistencia, 5. Verificación (real, contra Oracle y navegador), 6. Descubierto al levantar el sistema, 7. Qué NO cambió (+6 more)

### Community 116 - "http"
Cohesion: 0.10
Nodes (16): Header, Linea, num2(), OrdenCompraPreview(), DocumentDownloadService, downloadService, triggerDownload(), http (+8 more)

### Community 117 - "DocumentForm.tsx"
Cohesion: 0.31
Nodes (9): displayValue(), DocumentFormConfig, PanelDerivado(), ResumenLateral(), Values, AutoFillSpec, FormFieldDef, LineSeedSpec (+1 more)

### Community 118 - "e2e-negocio-real.mjs"
Cohesion: 0.42
Nodes (8): api(), check(), expectStatus(), login(), main(), record(), results, section()

### Community 119 - "Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo"
Cohesion: 0.29
Nodes (6): 0. Resumen ejecutivo, 1. Cómo se llegó aquí (cronología de la sesión), 2. Estado final verificado, 3. Qué NO cambió (deliberadamente, y sigue vigente), 4. Sin pendientes de alcance, Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo

### Community 122 - "e2e-ciclos-faltantes.mjs"
Cohesion: 0.52
Nodes (6): api(), check(), expectStatus(), login(), main(), results

### Community 123 - "Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06)"
Cohesion: 0.29
Nodes (6): 1. Hallazgos corregidos, 2. Lo que se probó y NO es vulnerable, 3. XSS, 4. Riesgo residual (decisiones / entorno), Informe de seguridad — Pentest OWASP, inyección y concurrencia (2026-10-06), Resultado final

### Community 124 - "AppError.ts"
Cohesion: 0.15
Nodes (13): AppError, ConflictError, ErrorCode, ForeignKeyError, InternalError, isAppError(), OptimisticLockError, ServiceUnavailableError (+5 more)

### Community 125 - "Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos"
Cohesion: 0.29
Nodes (6): 0. Resumen ejecutivo, 1. Cómo se llegó aquí (cronología de la sesión), 2. Estado final verificado, 3. Qué NO cambió (deliberadamente), 4. Sin pendientes de alcance, Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos

### Community 126 - "format.ts"
Cohesion: 0.08
Nodes (24): HistorialResp, historialService, formatMoney(), formatQty(), MONEY, PERCENT, QTY, RATE (+16 more)

### Community 127 - "scalar"
Cohesion: 0.13
Nodes (13): ensureBodega(), Ids, inTwoWeeks, PRECIOS, state, scalar(), Ids, inTwoWeeks (+5 more)

### Community 128 - "ortografia.test.ts"
Cohesion: 0.32
Nodes (3): acentuar(), ACENTOS, RAIZ

### Community 129 - "qa-busqueda-orden.mjs"
Cohesion: 0.15
Nodes (8): badResponses, fallos, HEADED, nuevo, results, roleArg, SCREENS, shotsArg

### Community 130 - "searchSql.ts"
Cohesion: 0.32
Nodes (11): buildSearchClause(), condicionEtiquetaActivo(), condicionRef(), escaparLike(), esColumnaFecha(), esColumnaTexto(), norm(), normalizar() (+3 more)

### Community 131 - "search.ts"
Cohesion: 0.31
Nodes (6): coincide(), filtrarFilas(), textoDeFila(), SearchSelect(), SearchSelectOption, react-dom

### Community 132 - "stateMachines.ts"
Cohesion: 0.20
Nodes (9): OrdenCompraEstado, RecepcionEstado, RfqEstado, rfqStateMachine, SOLICITUD_NIVEL, SolicitudEstado, RECEPCION_ESTADOS, RFQ_ESTADOS (+1 more)

### Community 134 - "alcanceDepartamento.int.test.ts"
Cohesion: 0.53
Nodes (5): bearer(), crearSolicitud(), Fk, idsVisibles(), token()

### Community 135 - "reportes.ts"
Cohesion: 0.16
Nodes (15): moneyCompact(), EvaluacionProveedoresInput, PrioridadEvaluacion, enteroQuery(), enviarPdf(), evaluacionQuery(), fechaQuery(), R_DESEMPENO (+7 more)

### Community 136 - "qa-listas-con-buscador.mjs"
Cohesion: 0.20
Nodes (7): caja, combos, filtroCombo, grupo, page, res, shotsArg

### Community 137 - "AdjuntoService.ts"
Cohesion: 0.17
Nodes (13): AdjuntoMeta, AdjuntoService, assertRef(), COLAS, enCola(), EXTENSIONES, FIRMAS, Manifiesto (+5 more)

### Community 138 - "catalogsCrud.int.test.ts"
Cohesion: 0.33
Nodes (4): cases, CrudCase, ids, RefIds

### Community 139 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, jsdom, tailwindcss, @tailwindcss/vite, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react (+5 more)

### Community 140 - "LiveConnection"
Cohesion: 0.22
Nodes (5): LiveConnection, LiveHandlers, LiveMessage, parseSse(), LiveNotifier()

### Community 141 - "gen-ddl-limits.ts"
Cohesion: 0.29
Nodes (6): ddl, destino, Limite, nCols, raiz, tablas

### Community 142 - "apiClient.ts"
Cohesion: 0.36
Nodes (6): api, ApiRequestError, client, guard(), toApiRequestError(), isAppError()

### Community 143 - "qa-panel-detalle.mjs"
Cohesion: 0.22
Nodes (4): mas, res, shotsArg, sorts

### Community 145 - "SegAuthRepository.ts"
Cohesion: 0.29
Nodes (6): Accesos, AuthUserRow, EventoAcceso, Row, SesionRow, UsuarioDemoRow

### Community 146 - "Auditoría del frontend (UX/UI, responsive, proporción áurea) y resiliencia de almacenamiento — 2026-10-06"
Cohesion: 0.12
Nodes (15): 1. MinIO ("sin conexión, no deja cargar"), 2. Idempotencia, 3. Evaluación del frontend (antes → ahora), 4. Autocompletado — el usuario no reescribe lo que el sistema ya tiene, 5. Pendiente / recomendaciones, Adenda — Agilidad, validación en vivo, delegación y resistencia (2026-10-06), Adenda — Borradores en el servidor y PDF formal (2026-10-06), Adenda — Interfaz más limpia (lote 1, 2026-10-06) (+7 more)

### Community 147 - "dashboard.int.test.ts"
Cohesion: 0.33
Nodes (5): ensureBodega(), Ids, inTwoWeeks, mesActual, PRECIOS

### Community 149 - "density.ts"
Cohesion: 0.60
Nodes (5): aplicar(), Densidad, initDensidad(), leer(), useDensidad()

### Community 150 - "DelegacionRepository.ts"
Cohesion: 0.29
Nodes (5): binds(), delegacionRepository, DelegacionVigente, mapFila(), Row

### Community 151 - "reportesRbac.int.test.ts"
Cohesion: 0.40
Nodes (4): MATRIZ, tokens, Usuario, USUARIOS

### Community 153 - "react"
Cohesion: 0.11
Nodes (7): Drawer(), esCampoDeTexto(), ErrorBoundary, Props, State, HelpContent, react

### Community 154 - "entrar"
Cohesion: 0.25
Nodes (5): entrar(), entrar(), REGISTRAR, res, shotsArg

### Community 157 - "app.ts"
Cohesion: 0.08
Nodes (33): adjuntoMaxBytes(), buildApp(), TipoDocumentoAdjunto, FormaPago, BorradorService, DIAS_VIGENCIA, requirePermiso(), ForbiddenError (+25 more)

### Community 158 - "Toast.tsx"
Cohesion: 0.17
Nodes (6): Ctx, ToastAction, ToastApi, ToastItem, ToastTone, TONE

### Community 159 - "validators.ts"
Cohesion: 0.33
Nodes (3): class-transformer, class-validator, reflect-metadata

### Community 161 - "borradores.int.test.ts"
Cohesion: 0.83
Nodes (3): hdr(), listar(), put()

### Community 165 - "qa-oficial-api.mjs"
Cohesion: 0.28
Nodes (6): api(), emp(), login(), res, sol(), tokens

### Community 166 - "playwright"
Cohesion: 0.20
Nodes (6): playwright, res, shotsArg, ALTOS, PANTALLAS, res

### Community 167 - "qa-lib.mjs"
Cohesion: 0.22
Nodes (6): BASE, PASS, ANCHOS, PANTALLAS, res, shotsArg

### Community 168 - "delegacion.int.test.ts"
Cohesion: 0.32
Nodes (6): call(), dia(), fk, nuevaSolicitud(), Sesion, u

### Community 171 - "qa-agilidad.mjs"
Cohesion: 0.20
Nodes (7): item, menu, p2, p3, page, rep, res

### Community 172 - "ComparativoPdfService.ts"
Cohesion: 0.14
Nodes (10): ComparativoPdfService, money(), ComparativoSolicitud, Doc, LetterheadOptions, MARGIN, PdfColumn, StoredFile (+2 more)

### Community 176 - "EntityDescriptor.ts"
Cohesion: 0.29
Nodes (5): AuditDescriptor, ColumnType, DetailRelationDescriptor, SearchRef, SoftDeleteDescriptor

### Community 179 - "BaseHeaderDetailRepository.ts"
Cohesion: 0.16
Nodes (3): IHeaderDetailRepository, BaseHeaderDetailRepository, EntityDescriptor

### Community 180 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 183 - "qa-oficial.mjs"
Cohesion: 0.40
Nodes (4): aqui, env, resumen, SUITES

## Knowledge Gaps
- **1096 isolated node(s):** `name`, `version`, `private`, `type`, `main` (+1091 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1427 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `n()` connect `DocumentoList.tsx` to `concurrencia.mjs`, `mapearTextos`, `qa-panel-detalle.mjs`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `DataTable.tsx`, `search.ts`, `frontend/package.json`, `CompraServices.ts`, `density.ts`, `Toast.tsx`, `messageOf`, `Dashboard.tsx`, `documentForms.ts`, `DocumentoList.tsx`, `formSupport.ts`, `CrudPage.tsx`, `outbox.ts`, `primitives.tsx`, `Field.tsx`, `DashboardRol.tsx`, `useNotificaciones.ts`, `RecepcionGuiada.tsx`, `DocumentoAppService`, `nav.ts`, `RefContext.tsx`, `DataTable.test.tsx`, `http`, `DocumentForm.tsx`, `format.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `fastify` connect `fastify` to `referencias.ts`, `backend/package.json`, `alcanceDepartamento.int.test.ts`, `reportes.ts`, `documentoUpdate.int.test.ts`, `catalogsCrud.int.test.ts`, `dashboard.int.test.ts`, `reportesRbac.int.test.ts`, `oracledb`, `routes/com/index.ts`, `app.ts`, `borradores.int.test.ts`, `analitica.ts`, `delegacion.int.test.ts`, `transaccional.ts`, `BaseOracleRepository.ts`, `authGuard.ts`, `aprobacionEnVivo.int.test.ts`, `seedEvaluacionDemo.ts`, `OraclePool.ts`, `idempotency.ts`, `reglasNegocio.int.test.ts`, `AppError.ts`, `scalar`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1096 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SCRIPT_DDL.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.0664869721473495 - nodes in this community are weakly interconnected._
- **Should `referencias.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13538461538461538 - nodes in this community are weakly interconnected._
- **Should `DataTable.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
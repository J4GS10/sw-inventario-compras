# Estado del proyecto y guía de continuidad — Módulo de Gestión de Compras

> **Propósito de este documento.** Refrescar en una ventana nueva todo el
> contexto de trabajo: qué es el proyecto, cómo está construido, qué se ha
> hecho, en qué fase vamos y qué sigue. Leerlo entero antes de tocar código.
> Última actualización: **2026-09-12** (limpieza total de la base de datos a
> pedido explícito del usuario — *"necesito que borres toda la data de la db,
> necesito que hayan cotizaciones de valor, data de valor, para ver ya el
> funcionamiento"*: se identificaron y borraron (lógico, vía API real) 113
> filas de contaminación de pruebas acumuladas en 4 catálogos, y se corrió la
> herramienta ya existente `pnpm db:seed:flujo` para vaciar TODA la data
> transaccional de Compras (+4700 filas de meses de pruebas) y generar 5
> ciclos de negocio reales y completos parados en distintas etapas del flujo
> — ver bloque §5.-36; antes, mismo día, paquete completo de mejoras
> visuales alineado a 3 imágenes de referencia que el usuario compartió
> (`skills/*.jpg`): marca real "Clavos S.A." en sidebar/login/PDF, buscador +
> botón "Filtrar" + "Exportar" en las 15 pantallas, calificación de
> proveedor con estrellas (sin perder la escala A+/A/B/C/Nuevo ya
> existente), "familias de producto" derivadas sin tocar el DDL, tarjetas
> KPI, mensajes de error en lenguaje de negocio, y una nueva "Vista previa de
> Orden de Compra" en pantalla — de paso, 2 fallas de `test:int` que venían
> arrastrándose se aislaron de raíz (**171/171 en verde por primera vez**) —
> ver bloque §5.-35; antes, mismo día, auditoría exhaustiva rol×recurso×
> operación (968 checks) + flujo de negocio real de punta a punta (88
> checks) por HTTP real, que encontró y corrigió un bug real: Bodega no
> podía recibir una Orden de Compra que el propio sistema le ofrecía como
> receptible (estado `EMITIDA`) — ver bloque §5.-34; antes, 2026-09-11
> (reversión total del esquema
> `*_VER`/`TRAZABILIDAD_VER` de los bloques §5.-28 y §5.-32 — el usuario
> rechazó de plano el concepto mismo de lectura-sin-escritura: *"por que
> tiene que ver alguien con un rol a algo que no tiene acceso, si no puede
> editarlo o manipularlo, para que lo ve"* y eligió explícitamente, entre 4
> opciones, **"Quitar toda lectura sin escritura"**. Principio rector ahora
> vigente para todo el módulo: **un rol solo ve un recurso si también puede
> gestionarlo/accionarlo** — únicas dos excepciones (preexistentes, no
> tocadas): `SOLICITUD_VER` (universal, para que cualquiera sepa si le toca
> actuar) y `ANALISIS_VER` (vistas agregadas/analíticas: Dashboard,
> Comparativo, Historial, Reportes — no documentos transaccionales crudos).
> Se eliminaron los 5 permisos `*_VER` y `TRAZABILIDAD_VER`; catálogo vuelve
> a 14 permisos. Al revertir apareció una dependencia funcional real de
> Bodega (elegía la OC para su Recepción desde el listado general de OC, que
> ya no puede ver) — resuelta con un endpoint de referencia acotado, `GET
> /api/com/ref/oc/receptibles`, gateado por `RECEPCION_GESTIONAR` (el
> permiso que Bodega sí tiene), no por acceso general a Órdenes de compra.
> También se encontró y corrigió un bug de arquitectura expuesto por el
> endurecimiento: `DocumentForm`/`CrudPage` piden las opciones del
> formulario (`useOptions`) apenas se monta la pantalla, no cuando se abre
> el modal de alta — causaba 403 en consola para roles sin el permiso de un
> catálogo referenciado que el usuario nunca llegó a abrir; ahora ambos
> componentes gatean `useOptions` con `open ? campos : []`. `pnpm qa:roles`
> confirma **0 errores en 168 checks** con la matriz de visibilidad estricta
> — ver bloque §5.-33 (ambos bloques anteriores, §5.-28 y §5.-32, quedan
> marcados como SUPERADOS/REVERTIDOS, se conservan solo como registro
> histórico de las dos rondas de diseño intermedias); antes, mismo día,
> rediseño profesional completo del modelo de permisos (RBAC) del módulo —
> ver bloque §5.-32 (revertido, ver arriba); antes, mismo día, ayuda contextual desplegada a las
> **21 pantallas** del módulo — no invasiva a propósito: un botón "?" que el
> usuario decide abrir, nunca un modal/tour automático; `pnpm qa:roles`
> extendido para abrir y cerrar cada ayuda visible y confirmar que no dispara
> red ni errores — 168/168 en verde — ver bloque §5.-31; antes, mismo día,
> sistema de ayuda contextual reutilizable
> — botón "?" en `PageHeader` que abre un modal explicando la pantalla, aplicado
> a Historial de precios y Panel de reportes — + Historial de precios gana
> columnas de trazabilidad real (Orden/Recepción de origen de cada línea) y su
> consulta se reescribió para exponerlas sin tocar el DDL — ver bloque §5.-30;
> antes, mismo día, infraestructura de QA real con
> Playwright (`scripts/qa-roles-smoke.mjs`, `pnpm qa:roles`) — sesión nueva
> por cada uno de los 8 usuarios demo, recorre las 21 pantallas del menú vía
> Command Palette y detecta 401/403/5xx o excepciones de consola; encontró
> y se corrigió un bug real (no de permisos): claves de React duplicadas en
> "Historial de precios" cuando dos compras históricas coinciden en fecha +
> artículo + proveedor + precio — ver bloque §5.-29 (incluye la aclaración
> del caso "auditor no puede ver Recepciones" reportado por el usuario: era
> un JWT viejo, no un bug — confirmado con 168/168 checks en verde); antes,
> mismo día, nuevo permiso `COMPRAS_TRAZABILIDAD_VER`:
> Gerente de área, Gerente financiero y Auditor ganan trazabilidad de solo
> lectura del ciclo completo (RFQ/Cotización/OC/Recepción/Devolución) — antes
> solo el admin del módulo (por su comodín `*`) veía todo eso, no las
> gerencias que deberían supervisarlo — ver bloque §5.-28; antes, mismo día,
> apartado dedicado "Reportes" en el
> menú, PDF de Orden de Compra (documento para el proveedor, hueco real del
> flujo) + auditoría de CRUD del módulo completo → 2 bugs reales de gating
> encontrados y corregidos: Editar/Eliminar de Cotizaciones e Eliminar de RFQ
> se ofrecían sin comprobar el cerrojo real del backend (RFQ abierto sin
> cotizaciones/línea adjudicada) — ver bloque §5.-27; antes, mismo día,
> gap analysis del flujo completo →
> corregido el único bug real de validación encontrado (sobre-recepción sin
> tope: `RecepcionService` no comprobaba lo ya recibido+rechazado contra lo
> ordenado) + expuesto en frontend (selector de renglón de Recepción ahora
> muestra "pendiente N de M" vía nuevo endpoint de referencia) + reportería
> nueva de punta a punta (3 reportes: Gasto por proveedor, Órdenes pendientes
> de recibir/aging, Desempeño de proveedores — JSON + PDF profesional con
> `PdfBuilder` extendido con KPI band y gráfico de barras) — ver bloque
> §5.-26; antes, mismo día: auditoría POO/GoF post-cambios: sin
> regresiones; auditoría de reutilización de botones: 4 botones sueltos
> (`<button className="btn ...">` a mano) reemplazados por el componente
> `Button` compartido en `AppShell.tsx` (menú móvil, toggle de tema),
> `DocumentForm.tsx` ("Quitar línea") y `AdjuntosPanel.tsx` (Ver/Descargar/
> Eliminar) — ver bloque §5.-25; antes, mismo día: Solicitudes: toggle
> "Pendientes de mi nivel" / "De otro nivel" filtrado por backend — reemplaza
> el separador rechazado por el usuario — más acción directa "Historial de
> aprobación" en el menú de fila, y el bug de gating que lo motivó —
> Aprobar/Rechazar salía fuera de turno — ver bloques §5.-24/§5.-22; mismo día, antes: validación general + 4 bugs
> visuales reales corregidos — el más serio, un overflow horizontal
> sistémico por `<div className="grid gap-N">` sin `grid-cols-1` en ~8
> contenedores raíz de alto tráfico, que dejaba botones inalcanzables fuera
> del viewport — ver bloque §5.-21; mismo día, antes: validación POO/GoF + auditoría de
> cobertura contra el DDL (catálogo Artículo-Proveedor e Historial de
> aprobación, ambos sin pantalla hasta entonces — §5.-20), bug real de
> `color-scheme` en los `<select>`, fusión de permisos Comprador/Financiero
> revertida — el financiero vuelve a ser quien adjudica, tal como pide la
> definición de negocio original —, asistente guiado
> RFQ→Cotización→Comparativo→OC — ver bloques §5.-19 a §5.-14; antes,
> 2026-09-10: primera suite de tests del frontend —
> infra jsdom/Testing Library + 28 casos sobre `DataTable`, gating de permisos
> y `FlowStepper` — ver `docs/08-ESTADO-Y-CONTINUIDAD.md`; antes, análisis del
> módulo + UI de listas responsive (`DataTable` con columnas, scroll limpio,
> colapso secundario, vista tarjeta) + gating de acciones por permiso + 3
> correcciones estructurales: rollback de estado de OC, reconciliación del bus
> de eventos, pantallas de Seguimiento/Excepciones de OC — ver
> `docs/07-ESTADO-Y-CONTINUIDAD.md`).

---

## 1. Qué es el proyecto

ERP corporativo en monorepo (`C:\sw-inventario`). El esquema canónico es
`database/ddl/SCRIPT_DDL.sql` (**103 tablas**; 6 módulos: `NOM_`, `SEG_`,
`INV_`, `COM_`, `CXP_`, `CXC_`). El trabajo se centra en el **módulo de Compras
(`COM_`, 26 tablas)**: CRUD de catálogos + el flujo transaccional
Solicitud → Aprobación → RFQ → Cotización → Orden de Compra → Recepción →
CxP/Devolución, con **POO + patrones GoF aplicados en backend y frontend**.

Base de datos: **Oracle 21c local**, `localhost:1521/proyecto`, usuario
`admin_proyecto` / `admin123` (en `.env`, claves `DB_*`).

---

## 2. Stack y comandos

| Capa | Stack |
|---|---|
| Backend | Node 20+, TypeScript 5.7 **estricto** (`any` prohibido), Fastify 5.1, `oracledb` 6.7 (Thin, SQL parametrizado, sin ORM), class-validator/transformer, pnpm 9 workspace, Vitest |
| Frontend | React 19, Vite 6.0.3 (la spec pide Vite 8, no existe), Tailwind CSS v4.1.11 (config **solo** en `index.css` con `@theme`), TS 5.7 estricto + `noUnusedLocals` |
| PDF / archivos | `pdfkit` (Builder), `@aws-sdk/client-s3` + presigner (Strategy S3 / memoria) |

```bash
# raíz
pnpm dev                 # backend :3000 + frontend :8443 en paralelo
pnpm minio               # MinIO local :9000 (adjuntos S3) + bucket com-adjuntos + consola :9001
pnpm -r build
pnpm db:deploy           # verifica esquema + aplica database/dml/*.sql (idempotente)
pnpm db:deploy:full      # además intenta aplicar el DDL sentencia a sentencia
graphify update .        # regenerar el grafo tras cambiar código (obligatorio, sin coste)

# backend/
pnpm --filter backend dev
pnpm --filter backend typecheck
pnpm --filter backend test            # unitarios (8)
pnpm --filter backend test:int        # integración contra Oracle real (98)

# frontend/
pnpm --filter frontend dev
pnpm --filter frontend typecheck
pnpm --filter frontend build
```

**Estado de pruebas verde (2026-09-12): 8 unitarias backend + 171/171 de integración backend (sin fallas conocidas, primera vez) + 29 en frontend (`pnpm --filter frontend test`).**
`test:int` ahora necesita **Oracle + un S3** arriba (`pnpm minio`); sin S3 cae a memoria y también pasa.
`tsc` estricto limpio en ambos proyectos; `vite build` OK.
Requiere `pnpm db:deploy` antes de `test:int` (siembra hashes scrypt y el 14º
permiso en `02_seg_rbac.sql`, y el enlace empleado→departamento/jefe en
`03_alcance_departamento.sql`).

> **Avance RBAC + notificaciones + diseño + intuitividad: ver
> `docs/02-ESTADO-Y-CONTINUIDAD.md`.**

---

## 3. Arquitectura (6 capas, flujo unidireccional hacia abajo)

```
database/{ddl,dml}
backend/src/dal/{contracts,repositories}      ← ÚNICO lugar que importa `oracledb`
backend/src/bll/services                       ← lógica de negocio, transacciones
backend/src/presentation/{controllers,routes,middlewares}
backend/src/entities  +  frontend/src/entities ← Capa 5 transversal
backend/src/common    +  frontend/src/core     ← Capa 6 transversal
```

Reglas no negociables (de `CLAUDE.md` + `skills/`):

- No modificar `database/ddl/SCRIPT_DDL.sql`. Cambios de datos solo por
  `database/dml/*.sql` (idempotentes) o código de app.
- `oracledb` jamás en `bll/` ni `presentation/`. **Siempre bind variables**,
  nunca concatenar SQL.
- Errores de Oracle se mapean en la DAL a excepciones semánticas de `common/` y
  las resuelve un middleware central.
- Pool único al arranque; `withConnection` / `withTransaction` (Template Method),
  `close` siempre en `finally`.
- Columna virtual `COM_ORDEN_COMPRA_DETALLE.SUBTOTAL_CALCULADO`: nunca en
  INSERT/UPDATE. FK circular `COM_RECEPCION ↔ CXP_FACTURA_PROVEEDOR`: se
  resuelve en 2 pasos dentro de la misma transacción.
- Bloqueo optimista (`VERSION`) en las 6 tablas transaccionales.
- Frontend: componentes `export default function`, uno por archivo; Tailwind v4
  solo por `@theme` en `index.css`.
- **Consultar `skills/stack-tecnologico.md`, `skills/patron-arquitectura.md`,
  `skills/patron-diseno.md` y el DDL antes de generar o modificar archivos.**
- Tras cambiar código: `graphify update .`. Para preguntas sobre el código:
  `graphify query "<pregunta>"` antes de grep.

### POO / patrones GoF (validación punto por punto en `docs/POO-modulo-compras.md`)

- **Backend**: Singleton (`OraclePool`, `EnvConfig`, `Logger`, `DomainEventBus`,
  `RepositoryFactory`, `StorageFactory`, `AuthService`, `SegAuthRepository`),
  Object Pool (`OraclePool`), Factory Method (`RepositoryFactory`,
  `StorageFactory`), Template Method (`OraclePool.withTransaction`,
  `TransactionalService`, `BaseCrudService`), Adapter (`OracleErrorAdapter`),
  Repository + orquestación sin SQL (`SegAuthRepository` ← `AuthService`),
  hashing aislado tras contrato (`common/auth/password.ts`, scrypt), Facade
  (`OrdenCompraService`, `RecepcionService`, `ComparativoService`), Decorator
  (`withTelemetry` vía Proxy), Strategy (`PriceResolver` + 3; `FileStorage`
  S3/memoria), Observer (`DomainEventBus` + `kardexSubscriber`/`cxpSubscriber`),
  Builder (`PdfBuilder`), Repository + herencia por clases base.
- **Frontend** (`frontend/src/core/`): Singleton (`HttpClient`, `EventBus`,
  `RepositoryFactory`, servicios de app, `AuthContext`), Template Method
  (`HttpClient.request`, `CrudService`), Adapter (`HttpClient.mapError`), Factory
  Method (`RepositoryFactory.for`), Facade (`ComparativoAppService`,
  `apiClient.ts`), Observer (`EventBus` + `useResource`, React Context de sesión).

---

## 4. Estado por fases

| Fase | Alcance | Estado |
|---|---|---|
| **0** | Bootstrap monorepo, tsconfig estricto, `deploy.ts`, seeds base | ✅ |
| **1** | Capa 6 (`common/`) + Capa 2 (`OraclePool`, `BaseOracleRepository`, `BaseHeaderDetailRepository`, `RepositoryFactory`) | ✅ |
| **2** | Capa 5: 26 descriptores `COM_` (`entities/com/descriptors.ts`), enums, columna virtual y FK circular marcadas | ✅ |
| **3** | Capa 3+4 genéricas (`BaseCrudService`, `StateMachine`, `BaseCrudController`, `registerCrudRoutes`, middlewares) + **14 recursos CRUD** por configuración | ✅ |
| **4** | Núcleo transaccional: `SolicitudCompra/Rfq/Cotizacion/OrdenCompra/Recepcion/DevolucionProveedor` Service; `TransactionalService`; eventos + suscriptores Kardex/CxP; state machines | ✅ (prueba e2e verde) |
| **5** | Frontend: sistema de diseño (`ui/`), `core/` POO, `CrudPage`, `DocumentoList`, `ComparativoView`, `HistorialProveedorView`, `Dashboard`, `AppShell` con navegación a nivel de sistema, dark mode, campos por tipo de dato, catálogos + selects dependientes | ✅ |
| **6** | **Transversales.** Login real + RBAC ✅ · endurecimiento de auth ✅ (6.1) · alcance por departamento ✅ (6.2) · `withTelemetry` en CRUD genéricos ✅ (6.3) · Docker ✅ (6.4) · realineación diseño a `patron-diseno.md` ✅ · pulido / intuitividad frontend ✅ (6.5) · **analítica del dashboard (series temporales + gauge) ✅ (6.6)** |

**Fase actual: 6 (transversales / cierre) — COMPLETA.** Autenticación
endurecida, visibilidad de solicitudes acotada por departamento/equipo, telemetría
en todos los servicios, Docker, diseño realineado al skill, el frontend hecho
más intuitivo (línea de proceso, estados legibles, aprobación sin pedir datos,
asistente de OC desde el comparativo) y el dashboard con sus gráficas de serie
temporal (compras del mes / rotación) e índice tipo gauge (ahorro de
adjudicación). Sin pendientes de alcance; ver §6 para el backlog residual opcional.

---

## 5. Lo realizado en detalle (bloques, orden cronológico inverso)

### 5.-37 Coherencia de documentos, buscador real, orden "lo último primero" y resistencia — 2026-10-05

Detalle completo, causas verificadas y resultados en `docs/11-ESTADO-Y-CONTINUIDAD.md`. Resumen:
reglas de fecha/cantidad entre documentos (`bll/compras/reglasDocumentos.ts`, "hoy" en
zona del negocio), límites del DDL generados (`pnpm --filter backend gen:limits`),
buscador global `?q=` (`dal/repositories/searchSql.ts`) en todas las tablas, listados con
`pk desc` por defecto + orden por encabezado en servidor, 503 reintentable / timeouts /
`/health/ready` / limitador de login / `ErrorBoundary`. Backend 69 unit + 210 int, frontend
35, QA UI 63/63, E2E de negocio 91/91.

### 5.-36 Limpieza total de la base de datos + reseed con data de valor — 2026-09-12

Pedido directo del usuario: *"necesito que borres toda la data de la db,
necesito que hayan cotizaciones de valor, data de valor, para ver ya el
funcionamiento"*. Dado que es una operación destructiva sobre la Oracle real,
se investigó el alcance exacto antes de borrar nada (nunca se tocó el
esquema/DDL, RBAC, usuarios ni maestros — solo la data de prueba acumulada y
la data transaccional del propio módulo).

**Contaminación real encontrada y limpiada** (borrado lógico vía API, no SQL
directo): 113 filas de pruebas automatizadas acumuladas en 4 catálogos —
41 "Cred xxxxx" en Condiciones de pago, 35 "Prueba" en Centros de costo, 36
"Prueba"/"Prueba UI"/"test2" en Monedas (generadas por `catalogsCrud.int.test.ts`
en corridas repetidas sin limpiar del todo), y 1 proveedor con NIT
auto-generado (`INT-<timestamp>`) que por ser el de menor id se colaba como
`proveedoresBase[0]` en cientos de órdenes de compra de prueba.

**Reset transaccional**: se usó la herramienta ya existente en el repo
(`backend/scripts/seedFlujoDemo.ts`, `pnpm db:seed:flujo` — no se creó nada
nuevo) que en una sola transacción: (1) borra TODA la data transaccional de
Compras y sus efectos en INV_/CXP_ (Kardex, existencias, facturas de
proveedor) sin tocar catálogos/maestros/RBAC/DDL, y (2) genera 5 ciclos de
negocio reales vía los endpoints reales (mismas reglas de negocio, state
machines y suscriptores de eventos que en producción), cada uno parado en una
etapa distinta para poder validar cada pantalla con datos con sentido:

| # | Artículo | Justificación | Etapa final |
|---|---|---|---|
| 653 | Laptops Dell Latitude 5450 (12) | Renovación de equipos de ventas | OC `RECIBIDA_COMPLETA` + CxP + Kardex |
| 654 | Sillas ergonómicas ejecutivas (40) | Mobiliario planta administrativa | Completo + devolución parcial (4 u.) |
| 655 | Impresoras multifunción láser (6) | Reposición en sucursales | OC `ENVIADA`, pendiente de recepción |
| 656 | Resmas de papel bond (500) | Consumo trimestral | RFQ `ABIERTO` con 3 cotizaciones, sin adjudicar |
| 657 | Cable UTP Cat 6 (20 cajas) | Cableado tercer nivel | Solicitud `PENDIENTE_GERENTE` |

**Resultado**: se eliminaron +4700 filas acumuladas de meses de pruebas (466
solicitudes, 275 RFQ, 407 cotizaciones, 207 OC, 240 recepciones, 264 facturas
CxP, 323 movimientos de kardex, 825 invitaciones de RFQ, 1086 registros de
workflow de aprobación...) y quedaron 5 solicitudes / 4 RFQ / 12 cotizaciones
/ 3 OC / 2 recepciones / 1 devolución, todas reales y trazables.

**Verificado real**: capturas de Solicitudes/Órdenes de compra/Condiciones de
pago tras el reset (limpias, con sentido de negocio); `pnpm --filter backend
test:int` corrido de nuevo tras el reset: **171/171 en verde** — la lógica de
negocio no depende del volumen de datos acumulados, solo de que existan los
maestros mínimos.

### 5.-35 Alineación visual completa con 3 imágenes de referencia — 2026-09-12

Pedido: *"analiza las imágenes en la carpeta skills, identifica su diseño,
identifica su patrón visual, necesito que el sistema sea así, así mismo, las
imágenes que presento, demuestran que hay cosas que no tengo consideradas en
mi sistema, se pueden aplicar??"* — 3 mockups en `skills/*.jpg`
(`directorio-proveedores-1.jpg`, `seguimiento-despachos-1.jpg`,
`vista-previa-orden-compra-1.jpg`).

**Análisis primero, código después**: se comparó cada imagen contra el código
real (no contra suposiciones) y contra una captura real de la pantalla
equivalente ya en producción. Conclusión: el patrón visual (sidebar navy,
tarjetas KPI, badges de estado, membrete de PDF) ya coincidía en ~90% con
`skills/patron-diseno.md` — no hacía falta "rediseñar", sino agregar 7
capacidades puntuales, cada una verificada contra `SCRIPT_DDL.sql` (congelado)
antes de prometerla como viable.

**Decisión del usuario** (`AskUserQuestion`): "Paquete completo (1-5)" +
nombre real **"Clavos S.A."** (NIT/dirección/teléfono genéricos, autorizados
explícitamente: *"nombre: Clavos S.A., nit y telefono ponle uno generico"*) +
dejar el perfil de usuario donde está hoy (arriba a la derecha, no en el pie
del sidebar como en la imagen — decisión estética sin impacto funcional).

**Implementado, cada pieza verificada con captura real y regresión completa
(`tsc` + unitarias + integración) tras cada cambio**:

- **Mensajes de error en lenguaje de negocio**: nuevo
  `backend/src/common/estadoLabels.ts` (espejo de
  `frontend/src/core/estados.ts::estadoLabel`) + `StateMachine.assertTransition`
  reescrito — de `"Transicion de estado no permitida para OrdenCompra: EMITIDA
  -> RECIBIDA_COMPLETA"` a `"No se puede pasar la orden de compra de "emitida"
  a "recibida completa".`, para las 4 máquinas de estado (Solicitud, RFQ,
  Orden de compra, Recepción).
- **Prevenir en vez de rechazar**: `DocumentForm.tsx` ahora deshabilita
  "Registrar" y muestra "Faltan N" mientras el RFQ no tenga sus 3 proveedores
  mínimos (antes solo se enteraba con un 422 al enviar); encabezado de la
  sección de líneas marca en naranja cuando falta.
- **Código HTTP de Eliminar unificado**: los 6 documentos transaccionales
  (Solicitudes, RFQ, Cotizaciones, OC, Recepciones, Devoluciones) pasan de
  `200` con cuerpo a `204` sin cuerpo, igual que los 9 catálogos.
- **2 fallas de `test:int` aisladas de raíz, no solo silenciadas**:
  `alcanceDepartamento` (la consulta "qué ve Comprador" ahora ordena
  `idSolicitud DESC`, ya no depende de que la solicitud recién creada quede
  entre las primeras 200 filas de una tabla que lleva meses acumulando datos
  de pruebas) y `comparativo` (crea 3 proveedores dedicados por corrida en vez
  de reutilizar los compartidos con el resto de la suite, cuya historia de
  precios ya no es "limpia" tras muchas corridas) — **171/171 en verde por
  primera vez en el historial del proyecto**.
- **Calificación de proveedor con estrellas** (`ui/primitives.tsx::StarRating`):
  traduce la escala cualitativa YA existente y deliberada (A+/A/B/C/Nuevo,
  `catalogosEstaticos.ts::CALIFICACION_PROVEEDOR`) a estrellas para el
  vistazo rápido — **no la reemplaza**, se preservó el significado de negocio.
- **"Familias de producto" por proveedor** — no existe (ni se agregó) una
  relación proveedor↔categoría en el DDL; se **deriva** cruzando las 3
  relaciones reales que sí existen (Artículo-Proveedor, Acuerdo marco, líneas
  reales de Orden de Compra) contra `INV_ARTICULO.ID_CATEGORIA`
  (`CompraReadRepository.familiasPorProveedor`, nuevo endpoint
  `GET /api/com/ref/proveedores/familias`), mostrado como tags de color en la
  tabla de Proveedores.
- **Tarjetas KPI** (`ui/primitives.tsx::StatCard`/`StatRow`) en Proveedores
  (conteo / familias / calificación promedio) y en Órdenes de compra (Activas
  / Pendientes de recepción / Completadas / Total) — el equivalente real de
  "Seguimiento de Despachos" del mockup.
- **Buscador + Filtrar + Exportar**, genéricos en `ui/DataTable.tsx` (buscador
  server-side vía `campo__like`, ya soportado por `parseListQuery` sin cambio
  de backend; panel "Filtrar" nuevo con un select por campo vía `campo__eq`;
  "Exportar" arma un CSV de la página cargada) — cableados en los 9 catálogos
  (buscador; Estado/Activa como filtro donde aplica: Proveedores, Categorías,
  Centros de costo, Monedas) y en Solicitudes/Órdenes de compra/Devoluciones
  (buscador) + Órdenes de compra/RFQ (filtro por Estado).
- **Marca real de la empresa**: nuevo `EmpresaConfig` en
  `backend/src/common/config/EnvConfig.ts` (variables `EMPRESA_NOMBRE`,
  `EMPRESA_NIT`, `EMPRESA_DIRECCION`, `EMPRESA_TELEFONO`, con "Clavos S.A." +
  genéricos como default) + endpoint público `GET /api/config/empresa` (sin
  autenticación, como `/api/auth/permisos` — lo necesita la pantalla de
  login) + hook `frontend/src/core/useEmpresaConfig.ts` — aplicado en sidebar,
  login, y **nuevo** membrete de "Empresa emisora" en el PDF de Orden de
  Compra (antes el PDF solo mostraba los datos del proveedor, nunca los
  propios) vía un parámetro `brand` nuevo en `PdfBuilder`.
- **Nueva "Vista previa de Orden de Compra" en pantalla**
  (`frontend/src/components/OrdenCompraPreview.tsx` + nuevo endpoint
  `GET /api/com/ordenes-compra/:id/vista-previa`, que reutiliza exactamente
  los mismos datos ya resueltos que usa `OrdenCompraPdfService` — lo que se ve
  en pantalla y lo que se descarga en PDF nunca pueden desincronizarse) — el
  hueco real que señaló el usuario: *"me refiero a que no hay una vista
  preliminar de la orden de compra"*. Incluye un botón "Descargar PDF"
  funcional. Se agregó un botón "Emitir vía correo" (deshabilitado, pendiente
  de SMTP) y se **quitó** a pedido explícito del usuario (*"no habra correo
  habilitado por ahora"*) — se prefirió no dejar un botón muerto sin plan
  cercano de activarlo.

**Bug real encontrado y corregido en el camino** (no en la app original, en mi
propio código de esta sesión): colisión de `key` de React en las tarjetas
KPI — `key={s.title}` hacía que dos tarjetas mostraran el mismo texto "—"
simultáneamente antes de que los datos cargaran, lo que rompía la
reconciliación de React y dejaba una tarjeta huérfana duplicada en el DOM
(confirmado inspeccionando el DOM real, no solo la captura). Corregido usando
el índice del arreglo como `key` (el número/orden de tarjetas es fijo por
configuración).

### 5.-34 Auditoría exhaustiva rol×recurso×operación + bug real de recepción — 2026-09-12

Pedido: *"necesito que la validación sea rol por rol, cada una de las
verificaciones crud... determi[na] a que mejoras... hacer más sencillo el uso
del módulo puede aplicarse"*.

**Matriz completa de autorización** (`scripts/rbac-crud-matrix.mjs`, nuevo):
para los 8 roles × 15 recursos (9 catálogos + 6 documentos) × Crear/Leer/
Editar/Eliminar + acciones especiales (aprobar, adjudicar, invitar, cerrar
RFQ, cambiar estado de OC, reversar, PDF, reconciliación), probado por HTTP
real sin fabricar datos válidos para cada combinación: el permiso se evalúa
antes de tocar el cuerpo/id, así que un rol sin permiso siempre da 403 (con
cualquier dato, hasta vacío) y uno con permiso nunca da 403 (falla por
validación/404, nunca por bloqueo) — **968/968 checks**, coincide exactamente
con `permissions.ts`/`transaccional.ts`, sin ningún 500 ni con datos basura.

**Flujo de negocio real de punta a punta** (`scripts/e2e-negocio-real.mjs` +
`scripts/e2e-ciclos-faltantes.mjs`, nuevos): sesión real de cada rol (sin
`x-dev-user`), HTTP real, datos con sentido de negocio — ciclo completo
Solicitud→Aprobación→RFQ→Cotizaciones→Adjudicación→OC→Recepción parcial y
completa→Devolución, con los casos negativos que un flujo real debe rechazar
(rol equivocado, regla de negocio violada, bloqueo optimista, RFQ con menos de
3 proveedores) — **88/88 + 14/14 checks**.

**Bug real encontrado y corregido**: `CompraReadRepository.ordenesReceptibles()`
(el endpoint que alimenta el selector de OC del formulario de Recepción de
Bodega) ofrece como "receptible" cualquier OC que no esté
`CANCELADA/RECHAZADA/RECIBIDA_COMPLETA` — **incluida `EMITIDA`** (orden aún no
marcada como enviada) — pero `stateMachines.ts` solo permitía recibir desde
`ENVIADA`/`EN_TRANSITO`. Bodega elegía una OC que el propio sistema le
ofrecía y el backend la rechazaba con un 409 críptico. Corregido: `EMITIDA`
ahora también admite transición directa a `RECIBIDA_PARCIAL`/
`RECIBIDA_COMPLETA` (la mercadería puede llegar antes de que Compras marque
la OC como enviada — situación real de negocio).

**2 bugs reales encontrados y corregidos en el propio arnés de QA** (no en la
app): `qa-roles-smoke.mjs`/`qa-crud-open.mjs` hacían match por substring en el
Command Palette ("Cotizaciones" también emparejaba "Comparativo de
cotizaciones", dando falsos "OK" cuando el documento real estaba oculto); al
corregirlo con `getByRole` sin acotar, colisionaba con el botón homónimo del
sidebar (tapado por el overlay del palette, colgando el click) — resuelto
acotando la búsqueda a la lista `<ul>` del palette + coincidencia exacta.

### 5.-33 Reversión total: "quitar toda lectura sin escritura" — 2026-09-11

> **Este bloque revierte por completo los bloques §5.-28 y §5.-32
> siguientes.** Se dejan sin borrar como registro histórico de las dos
> rondas de diseño intermedias, pero su contenido (catálogo de 15/19
> permisos, permisos `*_VER`, tabla de roles con Gerente/Financiero/Auditor
> viendo RFQ/Cotizaciones/OC/Recepciones/Devoluciones) **ya no describe el
> estado real del sistema**.

Tras aplicar el rediseño de §5.-32 (5 permisos `*_VER` explícitos,
`GERENTE_AREA`/`GERENTE_FINANCIERO`/`AUDITOR` con trazabilidad de solo
lectura del ciclo completo), el usuario cuestionó el fundamento mismo del
diseño, de forma directa: *"pero mi puta pregunta es, por que tiene que ver
alguioen con un rol a algo que no tiene acceso, si no puede editarlo o
manipularlo, para que lo ve"*. Se le presentaron 4 opciones (mantener la
visibilidad de solo lectura, acotarla más, documentarla mejor, o quitarla
por completo) vía `AskUserQuestion`. El usuario eligió, sin ambigüedad:
**"Quitar toda lectura sin escritura"**.

**Principio rector adoptado, ahora gobierna todo el módulo**: un rol solo
tiene acceso de lectura a un recurso si también tiene (o es) el permiso
para gestionarlo/accionarlo. Sin permisos "de solo observación". Dos
excepciones preexistentes, explícitamente no tocadas porque no son
"observación de un documento ajeno" sino necesidades funcionales propias:
- `SOLICITUD_VER` — universal, para que cualquier rol en la cadena de
  aprobación pueda comprobar si tiene una solicitud pendiente de su turno.
- `ANALISIS_VER` — gatea vistas agregadas/analíticas (Dashboard,
  Comparativo de cotizaciones, Historial de precios, Reportes), no acceso a
  los documentos transaccionales crudos que esas vistas resumen.

**Cambios de código** (reversión de §5.-32, no solo de §5.-28):
- `backend/src/common/auth/permissions.ts` / `frontend/src/core/auth/
  permisos.ts`: catálogo vuelve a **14 permisos** — se eliminan los 5
  `*_VER` (`RFQ_VER`, `COTIZACION_VER`, `OC_VER`, `RECEPCION_VER`,
  `DEVOLUCION_VER`) y no se reintroduce `TRAZABILIDAD_VER`. `ROLES` vuelve a
  manage-only estricto: `GERENTE_AREA` pierde todo acceso a
  RFQ/Cotizaciones/OC/Recepciones/Devoluciones; `AUDITOR` queda con
  `SOLICITUD_VER + CATALOGO_VER + ANALISIS_VER` únicamente.
- `backend/src/presentation/routes/com/transaccional.ts`: cada guarda
  `READ_*` vuelve a ser exactamente el/los permiso(s) de gestión propios
  del recurso (sin `*_VER` adjunto).
- **Migración de un solo uso** contra la BD viva (mismo patrón que §5.-16 y
  §5.-32): por cada uno de los 5 códigos `*_VER`, `DELETE` de sus grants en
  `SEG_ROL_PERMISO` y soft-delete de su fila `SEG_PERMISO`
  (`ELIMINADO='S'`). Script temporal, ejecutado una vez, borrado.
  `database/dml/02_seg_rbac.sql` reescrito a 14 permisos y el mapa de roles
  final, para que un `pnpm db:deploy` desde cero quede correcto sin la
  migración.
- **Dependencia funcional real descubierta al revertir**: quitarle `OC_VER`
  a Bodega rompía su capacidad real de crear una Recepción, porque el
  formulario elegía la OC contra el endpoint general `/api/com/ordenes-
  compra` (ahora 403 para Bodega). Se distinguió "navegar el documento OC
  como catálogo" (que Bodega no debe tener) de "consultar una OC como
  insumo de mi propia acción" (que sí necesita): nuevo endpoint de
  referencia `GET /api/com/ref/oc/receptibles`
  (`presentation/routes/com/referencias.ts`, nuevo método
  `CompraReadRepository.ordenesReceptibles`), gateado por
  `RECEPCION_GESTIONAR` — el permiso que Bodega ya tiene para actuar, no uno
  nuevo de lectura. `frontend/.../documentForms.ts` actualizado para que el
  selector de OC de Recepciones apunte ahí. Verificado end-to-end por HTTP:
  login bodega → `GET ref/oc/receptibles` → 200 → creó Recepción real
  (`idRecepcion=243`).
- **Bug de arquitectura expuesto (no causado) por el endurecimiento**:
  `DocumentForm.tsx` y `CrudPage.tsx` mantienen su `<Modal>` de alta/edición
  siempre montado (solo `open` cambia de `true`/`false`), pero llamaban
  `useOptions(config.fields, ...)` sin condicionar — las opciones de
  catálogos referenciados (p. ej. la lista de RFQ para el formulario de
  Cotizaciones) se pedían apenas la pantalla se montaba, no cuando el
  usuario abría "Nuevo". Con permisos permisivos esto quedaba oculto por
  solape incidental; con el modelo estricto, un rol sin permiso sobre un
  catálogo que ni siquiera llegó a abrir generaba un 403 en consola.
  Corregido en la raíz: ambos componentes ahora hacen
  `useOptions(open ? config.fields : [], ...)`.
- Tests actualizados: `backend/tests/auth.int.test.ts` (catálogo de
  permisos vuelve a 14; Gerente/Auditor → 403 en las 5 listas de recursos;
  nuevo caso Bodega — 403 en `/ordenes-compra`, 200 en
  `/ref/oc/receptibles`), `frontend/src/{nav,core/auth/permisos}.test.ts`
  (regresión WS2 de Bodega/OC vuelve a esperar que el leaf "Órdenes de
  compra" **no** sea visible para un rol con solo `RECEPCION_GESTIONAR`).

**Se mantiene sin revertir** (ortogonal al reclamo del usuario, que era
sobre visibilidad de rol, no sobre integridad de las tablas de auditoría):
`COM_WORKFLOW_APROBACION`/`COM_COMPARATIVO_COTIZACIONES` siguen sin ninguna
ruta de escritura vía API para nadie (`registerReadOnlyCrudRoutes`,
`404` en `POST`/`PUT`/`DELETE`); `CATALOGO_ADMIN` (monedas) sigue en
Gerente financiero, no Comprador.

**Verificado**: matriz de permisos por rol confirmada con login fresco de
los 8 usuarios demo vía `GET /api/auth/permisos`/`me`; `pnpm qa:roles` →
**0 errores en 168 checks**, con Gerente/Jefe/Auditor mostrando "-" para
Órdenes de compra/RFQ/Cotizaciones/Recepciones/Devoluciones, Comprador "OK"
solo en lo que gestiona, Bodega "OK" solo en Recepciones/Devoluciones (ya
no en Órdenes de compra). `graphify update .` corrido (2031 nodos, 4466
aristas, 118 comunidades). Pendiente de esta ronda: única falla conocida y
no relacionada, ya documentada antes de esta sesión —
`alcanceDepartamento.int.test.ts > COMPRADOR (rol transversal) ve ambas`
(acumulación de datos de pruebas repetidas contra la misma BD Oracle viva,
`pageSize=200` fijo).

### 5.-32 [SUPERADO/REVERTIDO por §5.-33 — se conserva como registro histórico] Rediseño profesional del modelo de permisos (RBAC) — 2026-09-11

Pedido del usuario, tras rechazar el diseño del botón de ayuda y volver a
preguntar por qué ciertos roles ven cosas que no debería: *"dime tu, en un
sistema realmente profesional, como deberia quedar. Eso necesito, analiza,
comprende el ddl, comprende la logica de negocio y plantea como debe
quedar"*. Se entró a **plan mode** (research → plan escrito → aprobación
explícita del usuario vía `ExitPlanMode` antes de tocar código) dado el
alcance (catálogo de permisos, 3 archivos de rutas, seed DML, 8 roles,
suite de tests). Plan completo:
`C:\Users\j.gonzalez\.claude\plans\hidden-doodling-creek.md`.

**Auditoría desde cero contra el DDL y el flujo de negocio** (no otro
parche sobre `COMPRAS_TRAZABILIDAD_VER`): se encontraron **2 problemas de
diseño reales**, no solo el permiso-paraguas de la ronda anterior:

1. **Lectura y escritura mezcladas en un solo permiso** — `RFQ_GESTIONAR`,
   `COTIZACION_GESTIONAR`, `OC_GESTIONAR`, `RECEPCION_GESTIONAR`,
   `DEVOLUCION_GESTIONAR` concedían a la vez "ver" y "mutar". Es la única
   razón por la que hizo falta inventar `TRAZABILIDAD_VER`: no existía un
   permiso de solo-lectura por recurso, a diferencia de `SOLICITUD_VER`
   (que sí estaba bien separado desde el principio).
2. **Las tablas de auditoría del propio flujo eran editables por una cuenta
   operativa vía API genérica** — `COM_WORKFLOW_APROBACION` y
   `COM_COMPARATIVO_COTIZACIONES` tenían CRUD completo
   (`presentation/routes/com/index.ts`, `CRUD_SENSIBLES`) con escritura tras
   `CATALOGO_ADMIN`, permiso que tenía `COMPRADOR` desde la fusión de
   catálogos de una sesión anterior. Verificado en código: **ninguna de las
   dos tablas tiene un camino de escritura legítimo fuera de las
   transacciones de negocio** —
   `SolicitudCompraService.registrarWorkflow` (privado, solo desde
   `aprobar`/`rechazar`) y `ComparativoService.registrarCriterio` (con su
   propia validación) son los únicos escritores reales. La ruta CRUD
   genérica era una puerta trasera paralela que permitía a Compras
   reescribir o borrar el historial de aprobaciones sin pasar por esa
   lógica — hueco real de integridad, no cosmético.

**Diseño aplicado** (matriz completa en el plan y en
`docs/flujo-y-roles-compras.md`):

- **5 permisos `*_VER` nuevos** (`RFQ_VER`, `COTIZACION_VER`, `OC_VER`,
  `RECEPCION_VER`, `DEVOLUCION_VER`) reemplazan `TRAZABILIDAD_VER`. Cada
  guarda `READ_*` (`transaccional.ts` + espejo `frontend/.../permisos.ts`)
  queda como `[gestión propia del recurso, *_VER del mismo recurso]` — sin
  listar permisos de otro recurso "porque de casualidad también servía"
  (así estaba antes). `GERENTE_AREA` y `AUDITOR` reciben los 5 `*_VER`
  explícitos; `GERENTE_FINANCIERO` los recibe donde no los tenía ya
  implícitos por sus permisos de gestión (`RFQ_VER`,
  `RECEPCION_VER`, `DEVOLUCION_VER`); `BODEGA` gana `OC_VER` explícito
  (antes veía OC de rebote vía `RECEPCION_GESTIONAR` estando en el arreglo
  equivocado); `COMPRADOR` gana `RECEPCION_VER`/`DEVOLUCION_VER` explícitos.
  `AUDITOR` queda con **cero permisos de escritura**, ni de catálogos.
- **`CATALOGO_ADMIN` (monedas) se mueve de `COMPRADOR` a
  `GERENTE_FINANCIERO`** — administrar moneda es función de Finanzas, no de
  Compras.
- **`COM_WORKFLOW_APROBACION`/`COM_COMPARATIVO_COTIZACIONES` pierden toda
  ruta de escritura** — nuevo `registerReadOnlyCrudRoutes` en
  `presentation/routes/crudRouter.ts` (mismo `BaseCrudController`, solo
  registra `GET`/`GET :id`, ni siquiera intenta `POST`/`PUT`/`DELETE` — 404,
  no 403). Se separaron de `CRUD_SENSIBLES` (que ahora solo tiene `moneda`)
  a un nuevo `CRUD_SOLO_LECTURA` en `index.ts`.
- **Migración de un solo uso** contra la BD viva (mismo patrón que §5.-16:
  un seed idempotente `INSERT ... WHERE NOT EXISTS` no puede revocar lo ya
  otorgado) — script temporal ejecutado una vez y borrado: `DELETE` de los 4
  grants de `COMPRAS_TRAZABILIDAD_VER`, soft-delete de su fila
  `SEG_PERMISO`, `DELETE` del grant `COMPRADOR → CATALOGO_ADMIN`.
  `database/dml/02_seg_rbac.sql` actualizado (19 permisos, mapa rol→permiso
  reescrito) para que un `pnpm db:deploy` desde cero ya quede correcto sin
  la migración.

**Verificado exhaustivamente**:
- Matriz de permisos por rol (`GET /api/auth/me` con login fresco de los 8
  usuarios demo) coincide **exactamente** con la tabla del plan aprobado.
- `comprador` → `POST /api/com/monedas` → **403** (antes podía);
  `financiero` → `POST /api/com/monedas` → **201** (antes no podía).
- `admin` (con el comodín `*`) → `POST`/`PUT`/`DELETE` a
  `/api/com/workflow-aprobacion` y `/api/com/comparativo-cotizaciones` →
  **404** (la ruta ya no existe, para nadie); `GET` sigue en 200.
- Capturas reales por Playwright: catálogo "Monedas" — botón "Nuevo"
  desaparece para `comprador` y aparece para `financiero`.
- `pnpm qa:roles`: **0 errores en 168 checks**, con la matriz de visibilidad
  de pantallas **idéntica** a la de antes del rediseño (cambio de plomería
  interna, no de comportamiento visible, salvo Monedas).
- Tests actualizados: `backend/tests/auth.int.test.ts` (se invirtió el caso
  Comprador/Financiero sobre monedas; nuevo caso que exige 404 en las 2
  tablas de auditoría para cualquier rol incluido admin; catálogo pasa a 19
  permisos) y `frontend/src/{nav,core/auth/permisos}.test.ts` (regresión
  WS2 de Bodega/OC reescrita para probar `OC_VER` en vez de la implicación
  vieja vía `RECEPCION_GESTIONAR`).

`tsc`/`vite build` (76 mod)/tests frontend (28) y backend (8 unit +
169/170 integración — misma falla preexistente no relacionada de
`alcanceDepartamento.int.test.ts`) verdes. `graphify update` (2030 nodos).
Documentado en `docs/flujo-y-roles-compras.md` (catálogo de permisos, tabla
de roles y nota sobre las tablas de auditoría de solo lectura).

### 5.-31 Ayuda contextual en las 21 pantallas del módulo, no invasiva — 2026-09-11

Pedido del usuario: *"si, necesito esas ayudas, pero que no sean invasivas,
que el usuario seleccione si quiere verlas o no"* — confirmando que se
generalice el mecanismo de §5.-30 al resto del módulo, con esa condición
explícita.

**Ya era no invasivo por diseño** (`HelpTip` es un botón "?" con estado
`open` local — nada se renderiza hasta que el usuario hace click; no hay
overlay ni tour automático), así que el pedido era extender la cobertura,
no cambiar el mecanismo.

**Cableado config-driven, no un componente nuevo por pantalla** (mismo
principio de reutilización de toda la sesión):
- `CrudPageConfig.help` (`components/CrudPage.tsx`) — nueva prop opcional,
  pasada a `PageHeader`. Contenido agregado a los **11 catálogos**
  (`catalogPages.tsx`): Monedas, Proveedores, Categorías/Grupos de compra,
  Condiciones de pago, Términos de entrega, Centros de costo, Acuerdos
  marco (explica la cadena de precio completa: cotización adjudicada →
  acuerdo marco → último precio de compra), Artículo-Proveedor (el último
  escalón de esa misma cadena), Seguimiento y Excepciones de OC (aclara que
  son solo bitácora, no cambian el estado de la OC).
- `DocConfig.help` (`modules/compras/DocumentoList.tsx`) — mismo patrón para
  los **6 documentos** (Solicitudes, RFQ, Cotizaciones, Órdenes de compra,
  Recepciones, Devoluciones), cada uno explicando su cerrojo real de
  Editar/Eliminar (los mismos que se corrigieron en gating en §5.-27).
- `Dashboard.tsx` y `ComparativoView.tsx` — `help` directo en su
  `PageHeader` (no pasan por un config compartido).

**Verificado real, no solo por tipo**: `scripts/qa-roles-smoke.mjs` se
extendió para, en cada pantalla visible, además de navegar a ella, **abrir
y cerrar su botón de ayuda** (si existe) y confirmar que no dispara ninguna
llamada de red ni excepción — el modal es puramente local, como debe ser
algo "no invasivo". Corrida completa: **0 errores en 168 checks** (8 roles
× 21 pantallas, cada una con su ayuda abierta al menos una vez donde
aplica). Captura real adicional del modal de "Órdenes de compra".

`tsc`/`vite build` (76 mod)/tests frontend (28) y backend (8 unit) verdes.
Sin cambios de backend ni de DDL/DML — todo el trabajo fue de contenido y
cableado de UI. `graphify update` (2026 nodos).

### 5.-30 Ayuda contextual reutilizable + Historial de precios explicado y con trazabilidad real — 2026-09-11

Pedido del usuario: *"que me digas por que se ve ese historial de precios,
cual es la logica... necesito que tenga sentido, poder ver filtrar. Agrega
mensaje o la opcion a ver ayudas en el sistema para entender que hace y como
usarlo"*.

**La lógica de "Historial de precios" (explicada al usuario y ahora también
en la propia pantalla)**: cada fila sale de cruzar `COM_RECEPCION` →
`COM_RECEPCION_DETALLE` → `COM_ORDEN_COMPRA_DETALLE` → `COM_ORDEN_COMPRA`
(las mismas 4 tablas que arma `VW_COM_PRECIO_HISTORIAL` en el DDL) — es un
**log de líneas realmente recibidas**, no una lista de precios de catálogo
ni un resumen deduplicado. Dos filas que coinciden en fecha+artículo+
proveedor+precio son **normales**: dos recepciones reales distintas al
mismo precio el mismo día (la causa exacta del bug de React keys corregido
en §5.-29) — antes no había forma de distinguirlas en pantalla.

**Fix de fondo (no solo cosmético)**: `CompraReadRepository.historialPrecios`
dejó de consultar `VW_COM_PRECIO_HISTORIAL` (que no expone qué OC/recepción
originó cada línea) y pasó a consultar las mismas 4 tablas base directamente
— sin tocar el DDL, la vista queda intacta para quien más la use — agregando
`idOrdenCompra`/`idRecepcion` al resultado. Nuevas columnas "Orden"/
"Recepción" (`refKind: docOrden/docRecepcion`, prioridad `secondary`, se ven
en el disclosure "+" de cada fila) permiten distinguir a simple vista dos
compras que coinciden en todo lo demás — resuelve el "que tenga sentido"
además de la explicación.

**Sistema de ayuda contextual — nuevo, reutilizable en todo el sistema**:
`ui/HelpTip.tsx` (botón "?" que abre un `Modal` con título + contenido) +
nuevo ícono `help` en `ui/Icon.tsx` + prop opcional `help` en
`ui/primitives.tsx::PageHeader` — cualquier pantalla lo activa con una sola
prop (`<PageHeader ... help={{ title, body }} />`), sin componente nuevo por
pantalla. Aplicado de entrada a **Historial de precios** (explica el
cruce de tablas, por qué se repiten filas, y qué filtra cada campo) y
**Panel de reportes** (qué calcula cada uno de los 3 reportes). Las demás
~19 pantallas quedan listas para sumar su propio `help` cuando haga falta.

**Verificado real** (HTTP + Playwright): `GET /api/com/historial-precios`
devuelve `idOrdenCompra`/`idRecepcion` reales y distintos por fila (mismo
`resumen` agregado que antes, verificado idéntico); captura real del modal
de ayuda abierto y del disclosure de una fila mostrando "ORDEN: OC-188" /
"RECEPCION: REC-217". `pnpm qa:roles` corrido de nuevo tras el cambio:
**0 errores en 168 checks** (8 roles × 21 pantallas).

`tsc`/`vite build` (76 mod, +1 por `HelpTip.tsx`)/tests frontend (28) y
backend (8 unit + 168/169 integración, misma falla preexistente no
relacionada) verdes. `graphify update` (2023 nodos). Sin cambios de DDL/DML
— la vista `VW_COM_PRECIO_HISTORIAL` no se tocó.

### 5.-29 Infraestructura de QA real (Playwright) + bug real de React keys en Historial de precios — 2026-09-11

Reporte del usuario: *"desde el perfil de auditor abri recepciones y me dio
[Requiere uno de: COMPRAS_RECEPCION_GESTIONAR, ...]... necesito que valides
esos errores, no pueden haber, que hago para que seas un QA y valides cada
punto funcional del sistema desde el frontend, instala chromium si es
necesario"*.

**Diagnóstico del reporte puntual — no era un bug**: reproducido de
inmediato por HTTP con un login **nuevo** de `auditor` → `GET
/api/com/recepciones` → 200 (94 registros). El permiso `TRAZABILIDAD_VER`
del bloque §5.-28 sí estaba activo en la base (`pnpm db:deploy` ya corrido
esa misma sesión). Causa real: el JWT lleva los permisos "horneados" al
momento del login (`ctx.permisos` se decodifica del token, no se re-consulta
a la BD en cada request) — la sesión del navegador del usuario venía de
**antes** de otorgarse el permiso nuevo, así que seguía viendo el catálogo
viejo hasta volver a loguearse. No requirió cambio de código.

**Infraestructura de QA nueva** (para que este tipo de duda se resuelva con
evidencia, no memoria): se instaló **Playwright** (`pnpm add -D -w
playwright` + `pnpm exec playwright install chromium`, descarga real del
binario) — reemplaza los scripts de CDP crudo ad-hoc usados en rondas
anteriores (§5.-17, §5.-26, §5.-27), que eran mas fragiles (typos de
selector, condiciones de carrera con React) y no quedaban en el repo.

`scripts/qa-roles-smoke.mjs` (nuevo, `pnpm qa:roles`): abre una sesión de
navegador **nueva** (sin `localStorage` previo — así nunca se repite el
falso-positivo de arriba) por cada uno de los 8 usuarios demo, y para las
**21 pantallas** de `nav.ts` intenta abrirlas vía Command Palette (Ctrl+K);
registra `NOT_VISIBLE` (el rol no la ve — puede ser correcto), `OK` o
`ERROR` (401/403/5xx en alguna llamada `/api/` o excepción de consola/
página durante esa navegación — la clase exacta de bug reportada). Imprime
una matriz pantalla×rol y guarda `qa-report.json` (gitignored).

**Primera corrida: 14 errores reales, en 2 pantallas** ("Historial de
precios" y, por contagio de consola de la corrida anterior en la misma
página — falso positivo aclarado abajo, "Panel de reportes"), en **las 7
sesiones que las tienen visibles** (todas menos bodega). Causa real (bug
genuino, no relacionado con permisos): `HistorialProveedorView.tsx`
generaba la clave de React de cada fila con `fecha|articuloCodigo|
proveedor|precioAcordado` — dos compras históricas reales coinciden en esos
4 campos (visto con datos reales: `2026-09-11T18:24:31.166Z|TOR-M6|
Proveedor Integracion S.A.|25`), y React advierte "Encountered two children
with the same key" (riesgo real de fila duplicada/omitida al re-renderizar,
no solo ruido de consola). **Fix**: la clave ahora agrega el índice dentro
del array (`resp.data.indexOf(r)`), que es única por definición dentro de
una misma respuesta — sin tocar el contrato de `rowKey` de `DataTable`
(usado por otras 5+ pantallas). El error idéntico en "Panel de reportes" no
se repitió tras el fix — era la misma advertencia de React llegando tarde
al buffer de consola de la navegación siguiente en el script de QA, no un
bug de esa pantalla.

**Segunda corrida, tras el fix: 0 errores de 168 checks** (8 roles × 21
pantallas). La matriz de visibilidad resultante coincide exactamente con lo
documentado en `docs/flujo-y-roles-compras.md` tras §5.-28 (Gerente/
Financiero/Auditor ven RFQ/Cotizaciones/OC/Recepciones/Devoluciones en
solo lectura; Solicitante/Jefe no; Bodega solo lo suyo + OC).

`tsc`/`vite build` (75 mod)/tests frontend (28) verdes. Sin cambios de
backend ni de DDL/DML. `pnpm qa:roles` queda disponible para correr esta
auditoría completa (backend :3000 + frontend :8443 arriba) en menos de un
minuto tras cualquier cambio futuro de permisos o navegación.

### 5.-28 [SUPERADO/REVERTIDO por §5.-33 — se conserva como registro histórico] Nuevo permiso `TRAZABILIDAD_VER`: Gerente/Financiero/Auditor ganan solo-lectura del ciclo completo — 2026-09-11

Pregunta del usuario: *"por que el administrador del sistema ve modulos que
el gerente no, si el gerente es quien deberia ver la trazabilidad de todo...
el admin del sistema no es gerente"*.

**Causa raíz confirmada en código**: `ADMIN_COMPRAS` tiene el comodín `"*"`
(`hasPermiso` lo trata como "sí a cualquier permiso") — ve todo por ser una
cuenta técnica omnipotente, no por diseño de negocio. Las guardas de LECTURA
de RFQ/Cotizaciones/OC/Recepciones/Devoluciones (`READ_RFQ` etc. en
`transaccional.ts`) solo incluían los permisos `*_GESTIONAR`/`ADJUDICAR` de
quien **opera** cada paso — no existía ningún permiso de "solo trazabilidad"
para quien **supervisa** sin operar. `GERENTE_AREA` (aprueba solicitudes) y
`AUDITOR` (control interno) quedaban limitados a Solicitudes/Dashboard/
Comparativo/Historial.

**Decisión del usuario** (`AskUserQuestion`): extender la trazabilidad de
solo lectura a **Gerente de área + Gerente financiero + Auditor** (los tres,
no solo el caso literal planteado).

**Intento fallido y corregido en el momento**: el primer intento reutilizó
`ANALISIS_VER` en las 5 guardas `READ_*` — roto de inmediato por
`auth.int.test.ts`: `ANALISIS_VER` también la tienen `SOLICITANTE` y
`JEFE_INMEDIATO`, así que de rebote también ellos habrían ganado acceso a
la plomería operativa, exactamente lo que la segregación de funciones
(`docs/06-ESTADO-Y-CONTINUIDAD.md` §3.2) prohíbe. Se descartó y se creó un
permiso nuevo y específico.

**Fix real**: nuevo permiso `COMPRAS_TRAZABILIDAD_VER` (15º del catálogo) —
`backend/src/common/auth/permissions.ts` + espejo
`frontend/src/core/auth/permisos.ts` + seed idempotente en
`database/dml/02_seg_rbac.sql` (otorgado a `GERENTE_AREA`, `GERENTE_FINANCIERO`
—ya tenía acceso de facto vía `OC_GESTIONAR`/`COTIZACION_ADJUDICAR`, se hizo
explícito— y `AUDITOR`; `ADMIN_COMPRAS` lo recibe automático por el
`CROSS JOIN` de todos los permisos `COMPRAS`). Las 5 guardas `READ_RFQ`/
`READ_COTIZACIONES`/`READ_OC`/`READ_RECEPCIONES`/`READ_DEVOLUCIONES` (backend
y su espejo frontend, que alimenta directamente `nav.ts`) lo incluyen ahora.

**Verificado con matriz real por HTTP** (los 8 usuarios demo × 5 endpoints):
`solicitante`/`jefe` → 403 en los 5 (sin cambio, correcto); `gerente`/
`financiero`/`auditor`/`comprador`/`admin` → 200 en los 5; `bodega` → 403 en
RFQ/Cotizaciones (no le compete), 200 en OC/Recepciones/Devoluciones (ya lo
tenía). Confirmado además que el nuevo permiso es SOLO lectura: `POST
/api/com/recepciones` como `gerente`/`auditor` sigue devolviendo 403.
**Verificado visualmente por CDP** (login real `gerente`, sesión nueva sin
cache): "RFQ / Invitaciones" aparece en el menú (antes no), la lista carga
19 RFQ reales, y el botón "Nuevo" no aparece (coherente con solo lectura).

`pnpm db:deploy` corrido (15 permisos, sin tocar el DDL). `tsc`/`vite build`
(75 mod)/tests frontend (28) y backend (8 unit + 168/169 integración — la
misma falla preexistente de `alcanceDepartamento.int.test.ts` de §5.-27, no
relacionada) verdes; se actualizó `auth.int.test.ts` (catálogo pasa de 14 a
15 permisos; el caso "SOLICITANTE no ve RFQ/OC" se reescribió para cubrir
también `gerente`/`auditor` con lectura sí pero escritura no). `graphify
update` (2002 nodos).

### 5.-27 Apartado dedicado "Reportes" + PDF de Orden de Compra + auditoría de CRUD del módulo completo — 2026-09-11

Pedido del usuario: *"necesito... un apartado para ver la reportería
dedicadamente"* + *"considerando el crud de todo lo que implica el módulo...
está cubierto o debería ser ingresado algo adicional"*.

**Apartado dedicado**: `nav.ts` — "Reportes" deja de ser un ítem dentro de la
sección "Análisis" (junto a Comparativo/Historial) y pasa a ser su **propia
sección** del acordeón ("REPORTES" → "Panel de reportes"), entre "Seguimiento
de OC" y "Catálogos". Verificado con captura real (CDP): se expande y
navega correctamente.

**PDF de Orden de Compra** (hueco real del flujo, detectado en la ronda
anterior — la OC es el documento que "se envía al proveedor", paso 6, y no
tenía ninguna representación imprimible): nuevo
`CompraReadRepository.ordenCompraParaPdf` (join a proveedor/moneda/empleado
autoriza/artículo/unidad — lo que `OrdenCompraService.obtener` no resuelve),
`OrdenCompraPdfService` (Facade, mismo patrón que `ComparativoPdfService`),
rutas `GET/POST /api/com/ordenes-compra/:id/pdf` en `transaccional.ts`, botón
"Descargar PDF" en el menú "⋯" de `DocumentoList` (todas las OC, no solo
`OC_GESTIONAR`). Diseño: banda de KPIs (neto/impuesto/total), datos del
proveedor y de la orden, tabla de renglones, nota de equivalente en GTQ si la
moneda no es GTQ. **Verificado real**: PDF descargado por HTTP es
`%PDF-1.3` válido con cifras correctas (OC-68: Q98,280 neto + Q11,793.60
impuesto = Q110,073.60); botón confirmado en el menú real vía CDP.

**Auditoría de CRUD del módulo completo** (documentos + catálogos, contra lo
que cada `Service.actualizar/eliminar` valida realmente en el backend, no
contra lo que el frontend *asume*): las 26 tablas `COM_` tienen CRUD
completo y los cerrojos por estado de Solicitud/OC/Recepción ya están bien
reflejados en el frontend (usan el `estado` de la propia fila). Se
encontraron **2 bugs reales de gating** — el mismo patrón que el fix de
sobre-recepción de §5.-26, pero en la capa de Editar/Eliminar en vez de
Crear: el frontend ocultaba estas acciones mirando solo el `estado` de la
fila, cuando el backend exige ADEMÁS una condición que no vive en esa fila:

1. **Cotizaciones** — `LOCK_EDITAR`/`LOCK_ELIMINAR` en `DocumentoList.tsx`
   eran `() => false` (nunca ocultaban nada); `CotizacionService.assertEditable`
   exige RFQ `ABIERTO` **y** ninguna línea adjudicada. Con datos reales: de
   193 cotizaciones, **120 mostraban Editar/Eliminar sin poder usarse**
   (RFQ ya cerrado/cancelado o línea ya adjudicada) — el usuario se enteraba
   recién con el 409.
2. **RFQ** — `LOCK_ELIMINAR.rfq` solo miraba `estado !== "ABIERTO"`;
   `RfqService.eliminar` además exige que el RFQ no tenga ninguna cotización
   registrada. Con datos reales: de 137 RFQ, solo **16 admitían Eliminar**
   de verdad, bastantes más aparecían con el botón visible sin poder usarlo.

**Fix** (mismo patrón en ambos, reutilizando lo ya construido en §5.-26 para
`lineasPendientesOc`): nuevo `CompraReadRepository.cotizacionesEditables()` /
`.rfqEliminable()` (SQL con el mismo cerrojo exacto que el service, `EXISTS`
sobre línea adjudicada / cotizaciones registradas) + rutas
`GET /api/com/ref/cotizaciones-editables` y `GET /api/com/ref/rfq-eliminable`
en `referencias.ts` + `DocumentoList.tsx` los carga una vez por listado
(`cotizacionEditable(r)`/`rfqEliminable(r)`) y reemplaza el `hidden` estático
por el real. **Verificado con capturas y extracción de menú reales por CDP**:
fila de cotización editable → menú trae Editar/Eliminar; fila no editable
(RFQ cerrado o línea adjudicada) → el menú NO los trae; ídem RFQ.

**Sin cambios adicionales de alcance**: catálogos (9), tablas sensibles
(monedas, workflow de aprobación, comparativo) y Devoluciones/Recepciones
(sin "editar" por decisión de negocio ya tomada en §5.-18) se revisaron y
siguen correctos.

`tsc`/`vite build` (75 mod)/tests frontend (28) y backend (8 unit) verdes;
`graphify update` (2001 nodos). **Nota**: `test:int` mostró 1 falla no
relacionada (`alcanceDepartamento.int.test.ts`, "COMPRADOR ve ambas") por
un `pageSize=200` fijo en el test que ya no alcanza — el módulo acumuló más
de 200 solicitudes entre corridas repetidas de la suite contra la misma
Oracle local sin resetear; no se tocó (requeriría `pnpm db:seed:flujo`,
destructivo sobre datos de demo, o corregir el test — se deja pendiente,
no bloqueante, no causado por este cambio). Sin cambios de DDL/DML.

### 5.-26 Gap analysis del flujo completo → fix de sobre-recepción + reportería con PDF profesional — 2026-09-11

Pedido del usuario: *"que falta para completar todo el flujo lógico,
completar las validaciones, flujos, reportería y demás"*, seguido de
*"aplica las correcciones... la reportería debe ser incluida... PDFs
profesional, con diseño armonioso, elegante"*. Auditoría previa
(archivo:línea, sin cambios de código) encontró un solo bug real de
validación y un hueco real de reportería (el resto — flujo, roles,
adjuntos, dashboard — ya estaba completo, confirmado contra las 26 tablas
`COM_` del DDL en §5.-20).

**Bug corregido — sobre-recepción sin tope**: `RecepcionService.registrar`
(`backend/src/bll/services/com/RecepcionService.ts`) validaba que el
renglón perteneciera a la OC pero nunca comprobaba `cantidadRecibida +
cantidadRechazada` (sumando TODAS las recepciones activas previas de ese
renglón) contra `cantidad` ordenada — bodega podía sobre-recibir sin
límite, incluso repartido en varias recepciones parciales. Fix: nuevo
bucle de validación antes de `createWithDetails`, reutilizando
`this.recDetalleRepo` (el mismo repositorio genérico que ya usaba
`calcularEstadoOc`) — `BusinessRuleError` (409) con el mensaje exacto de
cuánto admite la línea. **Verificado por HTTP real** (login `bodega`):
100 unidades contra un renglón de 6 → 409 con mensaje claro; recepción
parcial de 4 → OK; segundo intento de 3 más (4+3=7 > 6) → 409 acumulando
correctamente lo ya procesado.

**Descubribilidad del límite en frontend** (para que bodega no lo
descubra por el error): nuevo `CompraReadRepository.lineasPendientesOc`
(CTE que suma `CANTIDAD_RECIBIDA+CANTIDAD_RECHAZADA` por renglón sobre
recepciones activas) + `GET /api/com/ref/oc/:id/lineas-pendientes`
(`referencias.ts`, filtra a `cantidadPendiente > 0` — un renglón ya
completo no aparece para elegir). `documentForms.ts` (`recepciones.
lineFields[0].optionsFrom`) apunta a este endpoint en vez del genérico
`/api/com/ordenes-compra/{id}` + `pick:"details"`; el `labelTpl` ahora
muestra `"pendiente {cantidadPendiente} de {cantidad}"`. **Verificado en
vivo por CDP** (Chrome headless): al elegir OC-70 en el formulario de
Recepción, el select de renglón muestra exactamente `"#70 · Impresoras
multifuncion laser · pendiente 2 de 6"` tras una recepción parcial previa
— el mismo cálculo que usa la validación del backend.

**Reportería — nueva de punta a punta** (antes solo existían el Dashboard
con 2 series + gauge, y el PDF del Comparativo — sin exportación general
ni reportes de gasto/atrasos/desempeño):

- **Backend**: 3 consultas nuevas en `CompraReadRepository`
  (`gastoPorProveedor`, `ocPendientesRecibir`, `desempenoProveedores` —
  mismo estilo SQL parametrizado con bind variables que las agregaciones
  del dashboard ya existentes), compuestas por el nuevo `ReporteService`
  (Capa 3, solo lectura, mismo patrón que `DashboardService`) y renderizadas
  por el nuevo `ReportePdfService` (Capa 3, Facade sobre `ReporteService` +
  `PdfBuilder`, mismo patrón Builder que `ComparativoPdfService`). Rutas
  nuevas en `presentation/routes/com/reportes.ts` (JSON y `/pdf` por cada
  reporte), montadas en `app.ts`; mismo permiso de lectura que Dashboard/
  Comparativo (`COMPRAS_ANALISIS_VER`).
- **`PdfBuilder`** (`common/pdf/PdfBuilder.ts`, Capa 6, sin dependencia del
  negocio) gana dos métodos reutilizables para que el PDF no sea "una
  tabla más": `kpiBand(...)` (tarjetas de cifras clave, mismo lenguaje
  visual que `KpiCard` del frontend) y `barChart(...)` (barras horizontales
  proporcionales, un solo hue de marca — mismo lenguaje que `ui/Charts.tsx`,
  skill `dataviz`). Los 3 reportes abren con banda de KPIs + gráfico de
  barras del top 12 antes de la tabla de detalle, con el mismo encabezado/
  pie de página con numeración que ya tenía el Comparativo.
- **Frontend**: nueva pantalla `modules/compras/ReportesView.tsx`
  (3 pestañas — `Tabs` de `ui/Modal.tsx` — con `FilterBar` de rango de
  fechas donde aplica, `KpiCard`s, `DataTable` y botón "Descargar PDF"),
  nuevo `ReporteAppService` (Facade + Singleton en `core/CompraServices.ts`,
  mismo patrón que `DashboardAppService`) y `DownloadService.
  descargarReportePdf` genérico. Nueva entrada de navegación "Reportes"
  bajo "Análisis" (`nav.ts`, permiso `ANALISIS_VER` — mismo nivel que
  Comparativo/Historial) y nuevo `ViewKind: "reportes"` enrutado en
  `App.tsx`.
- **Verificado con datos reales por HTTP y por CDP** (login `admin`): los 3
  endpoints JSON devuelven cifras coherentes con la BD viva (Q179,200.00 en
  85 OC de 2 proveedores; 27 OC pendientes de recibir; 2 proveedores
  evaluados en desempeño); el PDF de "Gasto por proveedor" descargado es un
  `%PDF-1.3` válido con banda de título navy, KPI band, gráfico de barras y
  tabla zebra — capturas reales de las 3 pestañas en el navegador sin
  errores de consola, con datos y layout correctos (ajustado el ancho de 3
  columnas que recortaban su encabezado en la primera pasada).

`tsc`/`vite build` (75 mod, +1 por `ReportesView.tsx`)/tests frontend (28)
y backend (8 unit + 168 integración, con `pnpm minio` arriba) verdes;
`graphify update` (1986 nodos). Sin cambios de DDL/DML — los 3 reportes se
apoyan enteramente en las 26 tablas `COM_` ya existentes (no hay campo de
presupuesto en `COM_CENTRO_COSTO`, así que un reporte de presupuesto vs.
gasto real no es viable sin tocar el esquema canónico — queda fuera de
alcance, ver §6.8).

### 5.-25 Auditoría POO/GoF post-cambios + reutilización de botones — 2026-09-11

Pedido del usuario: *"valida que este correctamente aplicado con POO... la
mayor parte del código sea reutilizable, no quiero mil botones, quiero uno y
que replique a donde necesita"*. Se lanzó una auditoría dedicada (agente
independiente, evidencia por grep/lectura real, no impresión general) sobre
todo lo tocado en esta sesión más un barrido del repo completo.

**POO/GoF: sin regresiones.** Cero instanciaciones directas de los Singleton
(`new HttpClient(`, `new OraclePool(`, `new EnvConfig(`, etc.) fuera de sus
propios `getInstance()` en todo `backend/src`/`frontend/src`.
`CotizacionService` sigue extendiendo `TransactionalService` correctamente
(el guard de estado de RFQ agregado antes vive dentro del Template Method,
no lo bypassea). `AsistenteCotizacion.tsx` no tiene ningún `fetch`/`http.*`
directo — solo compone `DocumentForm`/`DOCUMENT_FORMS`. El nuevo parámetro
`extra` de `DocumentoAppService.list()` es un simple pass-through hacia
`http.list()`; el armado del query string (`estado__in=...`) se queda en
`DocumentoList.tsx`, no se filtró al service — encapsulación correcta.

**Reutilización de botones: el mecanismo ya existía y es la norma (el
sistema `actions: RowAction<Row>[]` de `DataTable.tsx` — un único
`.map()` que renderiza el menú "⋯" — es exactamente "un botón que
replica donde se necesita", usado por `DocumentoList.tsx`,
`HistorialProveedorView.tsx` y `CrudPage.tsx`), pero se encontraron 4
botones sueltos preexistentes (de antes de esta sesión) que reinventaban a
mano las clases que el componente `Button` (`ui/primitives.tsx`) ya genera.
Corregidos, reemplazando `<button className="btn btn-ghost btn-sm">` por
`<Button variant="ghost" size="sm" icon="...">`:

- `ui/AppShell.tsx`: botón de menú móvil y botón de alternar tema (topbar).
- `components/DocumentForm.tsx`: botón "Quitar línea" de una fila del
  formulario (import de `Icon` eliminado, quedó sin otro uso en el archivo).
- `components/AdjuntosPanel.tsx`: los 3 botones de icono por adjunto
  (Ver/Descargar/Eliminar) — se dejó intacto el botón-enlace del nombre del
  archivo (`flex-1 truncate text-left`, un patrón distinto: link de texto
  creciente, no botón de icono, no duplica a `Button`).

**Verificado**: `tsc`/`vite build` (74 mod)/tests frontend (28) verdes;
CDP en vivo confirmó que el toggle de tema sigue funcionando idéntico tras
el cambio (`system → light` al click, captura real de la topbar sin
diferencias visuales). Sin cambios de backend.

### 5.-24 Solicitudes: toggle "Pendientes de mi nivel" / "De otro nivel" (reemplaza el separador de §5.-23) + acción directa "Historial de aprobación" — 2026-09-11

El separador de §5.-23 (una sola tabla con fila-etiqueta divisoria) se probó
con capturas reales y el usuario lo rechazó explícitamente ("LA DIVISION DE
EN ESPERA DE OTRO NIVEL, NO ME AGRADA") pidiendo en su lugar **dos conjuntos
de datos lógicamente separados, pero mostrando solo uno a la vez, cambiando
con un toggle** entre "lo que corresponde a su nivel" y "superior/inferior".
Se revirtió por completo `sectionBreaks` de `ui/DataTable.tsx` (prop, cómputo
y renderizado en tabla y tarjeta) y se reemplazó por filtrado real en el
backend:

- **`core/CompraServices.ts`**: `DocumentoAppService.list(page, pageSize,
  extra?)` gana un tercer parámetro opcional, fusionado en el query string —
  reutiliza el filtro genérico `estado__in=<csv>` que ya soporta
  `parseListQuery.ts` (confirmado antes por HTTP con `estado`/`estado__ne`).
- **`DocumentoList.tsx`**: `nivelesPropios` (los estados que le corresponden
  al rol según `puedeAprobarJefe`/`puedeAprobarGerente`, soporta tener
  ambos) + estado `vistaAprobacion: "mio"|"otros"` (default `"mio"`). `load()`
  pasa `estado__in` con `nivelesPropios` o su complemento sobre
  `SOLICITUD_ESTADOS_TODOS`, según la vista activa; un `useEffect` resetea
  `page` a 1 al cambiar de vista (evita quedar en una página fuera de rango
  del nuevo conjunto filtrado). El toggle se renderiza con el componente
  `Tabs` ya existente (`ui/Modal.tsx`, estilo subrayado), visible solo cuando
  `configKey==="solicitudes" && puedeAprobar`. A diferencia de §5.-23, el
  filtrado ahora es 100% del backend — ya no queda acotado a la página de 20
  filas visible, cubre el total real.
- **Descubribilidad del historial** (segunda mitad del mismo pedido: "DONDE
  VEO EL HISTORICO... POR QUE NO SE VE" — el componente `HistorialAprobacion`
  de una tanda anterior sí funcionaba, estaba solo escondido dentro de
  "Detalle"): se agregó una acción de fila propia **"Historial de
  aprobación"** (icono reloj), separada de "Detalle" en el menú "⋯", que abre
  el mismo modal (ya la incluye vía `extraContent`) pero con un nombre que no
  hay que adivinar.

**Verificado en vivo por CDP** (Chrome headless, logins reales `jefe`/
`gerente`): jefe en "Pendientes de mi nivel" ve solo `Pendiente del jefe`;
al cambiar a "De otro nivel" ve `Rechazada`/`En cotización`/`Pendiente del
gerente` (el complemento exacto); gerente, simétrico e inverso. Captura del
menú "⋯" confirma `Historial de aprobación` visible junto a `Detalle`.

`tsc`/`vite build` (74 mod)/tests frontend (28) verdes. Sin cambios de
backend (el filtro genérico ya existía).

### 5.-22 Bug real de gating: "Aprobar/Rechazar" salía fuera de turno (jefe veía solicitudes del gerente y viceversa) — 2026-09-11

El usuario reportó: *"no quiero que le salga para aprobar si alguien que
depende su aprobación aún no lo ha hecho"*. Confirmado: `DocumentoList.tsx`
mostraba "Aprobar"/"Rechazar" con `hidden: (r) => ["ORDEN_GENERADA",
"RECHAZADA","EN_COTIZACION"].includes(estado)` — solo excluía 3 estados
terminales, sin exigir que el estado de la fila coincidiera con el NIVEL que
el permiso del usuario cubre. Resultado: un gerente (solo
`SOLICITUD_APROBAR_GERENTE`) veía "Aprobar" en solicitudes aún
`PENDIENTE_JEFE` (antes de que el jefe decidiera), y un jefe veía "Aprobar"
en solicitudes ya `PENDIENTE_GERENTE` (que ya no eran su turno). El backend
ya rechazaba la decisión equivocada con 403 (`autorizarDecision` en
`SolicitudCompraService.ts` sí exige el nivel correcto) — el problema era
puramente de UI, ofreciendo una acción que iba a fallar.

**Fix** (`DocumentoList.tsx`): `puedeAprobar` se descompone en
`puedeAprobarJefe`/`puedeAprobarGerente` + `puedeDecidirNivel(fila)` que
exige que el estado de la fila (`PENDIENTE_JEFE`/`PENDIENTE_GERENTE`)
coincida con el permiso específico del rol — "Aprobar"/"Rechazar" ahora usan
ese único chequeo como `hidden`.

**Verificado en vivo con los 4 casos reales** (login real `jefe`/`gerente`,
abriendo el menú "⋯" de una fila real de cada estado):
- jefe + `PENDIENTE_JEFE` → ve Aprobar/Rechazar ✅
- jefe + `PENDIENTE_GERENTE` → NO los ve (antes sí) ✅
- gerente + `PENDIENTE_JEFE` → NO los ve (antes sí) ✅
- gerente + `PENDIENTE_GERENTE` → ve Aprobar/Rechazar ✅

`tsc`/`vite build` (74 mod)/tests frontend (28) verdes. Sin cambios de
backend (ya validaba correctamente).

### 5.-21 Validación general + 4 bugs visuales reales encontrados y corregidos (alineación, chips, overflow horizontal sistémico) — 2026-09-11

Responde a *"completa lo que falta, valida el funcionamiento general del
módulo... el orden visual de la información, bien alineados, rectos y
centrados, con hints que orienten qué hacer si el usuario metió mal algo"*.

**Sistema de hints de validación**: revisado (`ui/Field.tsx` + `ui/fieldKinds.ts`)
y confirmado con captura real de un formulario enviado vacío — ya es sólido:
borde rojo + mensaje específico por campo ("Requerido", "NIT no válido",
"Correo no válido", "Mínimo/Máximo N") en tiempo real (`onBlur`) + al enviar,
más un toast con el primer error. **No requirió cambios.**

**Barrido visual con capturas reales** (Chrome headless vía CDP, ~20 pantallas:
todos los catálogos, las 6 listas de documentos, Dashboard, Comparativo,
Historial) — 4 bugs reales encontrados y corregidos:
1. **Labels de KPI truncados** ("ORDENES DE CO...", "HISTORIAL DE PR...") —
   `ui/primitives.tsx` (`KpiCard`) usaba la utilidad `truncate` de Tailwind;
   cambiado a `leading-tight` para que envuelva a 2 líneas en vez de cortar
   información.
2. **Chips de estado partidos en 2 líneas** ("Recibida" / "completa",
   "Enviada al" / "proveedor") — descuadraba la altura de las filas.
   `index.css` (`.chip`) gana `white-space: nowrap`; `ui/DataTable.tsx`
   (`COLUMN_WIDTH.estado`) sube de 140 a 176px (cabe "Pendiente del gerente",
   el estado más largo del dominio, en una sola línea).
3. **"Cantidad total" del Historial de precios formateada como dinero**
   ("Q 1,012.00" en vez de "1,012") — `HistorialProveedorView.tsx` usaba
   `formatMoney` en vez de `formatQty` para una cantidad de unidades.
4. **Overflow horizontal sistémico — el más serio**: `<div className="grid
   gap-N">` (sin `grid-template-columns`) usado como contenedor raíz de
   página/modal en ~8 sitios de alto tráfico crea una pista de grid `auto`
   que **crece más allá del contenedor para caber su contenido** en vez de
   quedarse acotada al ancho disponible — a diferencia de un `<div>` de
   bloque normal. Encontrado en el Comparativo: con 3 botones de acción +
   subtítulo largo, "Descargar PDF" quedaba renderizado 112px más allá del
   viewport, inalcanzable (`html{overflow-x:hidden}`, sin scroll para
   revelarlo). Diagnosticado recorriendo la cadena de ancestros con
   `getComputedStyle`/`getBoundingClientRect` (ver detalle de la
   investigación en la conversación) — **no era el candado `min-w:auto` de
   flex habitual, sino el track `auto` de un grid de una sola columna sin
   `grid-cols-1`**. Corregido con `grid-cols-1` en los 8 contenedores raíz de
   mayor riesgo (los que envuelven un `PageHeader` u otra fila de acciones
   ancha): `CrudPage.tsx` (raíz de TODOS los catálogos), `DocumentoList.tsx`
   (raíz de las 6 listas de documentos), `Dashboard.tsx`, `DocumentoDetalle.tsx`
   (modal de detalle), `DocumentForm.tsx` (modal de alta/edición),
   `AdjuntosPanel.tsx`, `HistorialProveedorView.tsx`,
   `HistorialAprobacion.tsx`. Verificado sin overflow (`scrollWidth <=
   innerWidth`) en Dashboard/Comparativo/catálogo de Proveedores (lista +
   modal)/Solicitudes (lista + Detalle) tras el fix.

`tsc`/`vite build` (74 mod, sin cambio de conteo)/tests frontend (28) verdes;
`graphify update` (1913 nodos). Sin cambios de backend/DDL/DML.

### 5.-20 Validación POO/GoF + auditoría de cobertura contra el DDL — 2026-09-11

Responde a *"valida que se esté aplicando POO correctamente... determina qué
funcionalidades faltan para completar el módulo, considerando el DDL"*.

**Validación POO/GoF** (`docs/POO-modulo-compras.md`, refrescado — tenía
cifras de pruebas desactualizadas, la estructura seguía vigente): confirmado
contra el código actual que las clases base genéricas siguen intactas
(`BaseOracleRepository`, `BaseHeaderDetailRepository`, `BaseCrudService`,
`TransactionalService`, `StateMachine`, `RepositoryFactory`) y que los 6
servicios de flujo (`SolicitudCompraService`, `RfqService`,
`CotizacionService`, `OrdenCompraService`, `RecepcionService`,
`DevolucionProveedorService`) siguen componiendo esa base en vez de
duplicarla. Explica por qué los últimos arreglos fueron chicos: "Cancelar
RFQ" fue una fila de config + reusar `service.accion()` genérico; el cerrojo
de `CotizacionService.registrar` fueron ~12 líneas reusando
`this.rfqRepo.findById` + `BusinessRuleError` ya existentes; nada exigió
tocar el DAL ni la presentación. Aclarado además: `modules/`/`components/`
son funciones (React lo exige), NO clases — las clases POO viven en `core/`
(frontend) y `bll/`/`dal/` (backend); un componente nuevo (`AsistenteCotizacion.tsx`)
solo **compone** objetos de esa capa, nunca reimplementa su lógica.

**Auditoría de cobertura vs. las 26 tablas `COM_` del DDL**: las 26 tienen
CRUD/lógica de negocio completa en el backend (11 catálogos operativos + 3
sensibles + 6 pares cabecera/detalle transaccionales + 6 tablas de detalle).
Se encontraron **2 huecos reales, ambos solo de frontend** (el backend ya
los soportaba):
1. **`COM_ARTICULO_PROVEEDOR` sin ninguna pantalla** (cero referencias en todo
   `frontend/src`) — la tabla que respalda `UltimaCompraStrategy` (precio de
   respaldo cuando no hay acuerdo marco ni cotización adjudicada) no se podía
   ver ni mantener nunca desde la UI. **Agregado**: catálogo
   "Artículo-Proveedor" (`catalogPages.tsx` + `nav.ts`), mismo patrón que los
   demás catálogos chicos.
2. **`COM_WORKFLOW_APROBACION` invisible en el frontend** (cero referencias) —
   el backend registra cada decisión de jefe/gerente (nivel, quién, estado
   anterior→nuevo, comentario, fecha) pero nunca se mostraba. **Agregado**:
   sección "Historial de aprobación" en el Detalle de una Solicitud
   (`HistorialAprobacion.tsx`, nuevo — reusa `catalogService`/`CrudService`
   tal cual, cero clases nuevas; nuevo prop `extraContent` en
   `DocumentoDetalle.tsx` para inyectar la sección).

**Verificado con capturas reales** (Chrome headless vía CDP, mismo método
que los bugs anteriores): el catálogo nuevo renderiza (vacío — nunca tuvo
datos, coherente con que nadie podía cargarlos); el historial de aprobación
muestra los 3 niveles reales de una solicitud `ORDEN_GENERADA` (creación →
jefe → gerente) con nombre de empleado resuelto, transición de estado y
fecha.

`tsc`/`vite build` (74 mod, +1 por `HistorialAprobacion.tsx`)/tests
frontend (28) verdes; `graphify update` (1912 nodos). Sin cambios de
backend/DDL/DML.

### 5.-19 Bug real de tema: el texto de los `<select>` se perdía hasta pasar el mouse — 2026-09-11

El usuario insistió en que "algo se pierde" en modo claro Y oscuro, "en todo
el sistema". Probé 5 catálogos completos (listas + modal "Nuevo") con
capturas reales en los 3 estados de tema y no reproduje nada — hasta
que el usuario dio la pista exacta: *"cuando quiero cambiar un estado, la
lista no se ve que dice, hasta que la remarco con el mouse se ve el texto"*.
Eso apunta a un solo tipo de control: el `<select>`.

**Causa raíz** (confirmada midiendo `getComputedStyle` antes/después, no
solo teoría): `index.css` nunca declaraba la propiedad CSS `color-scheme`.
Sin ella, el navegador dibuja el **popup nativo** de `<option>` de un
`<select>` con el tema del **sistema operativo**, no con el `data-theme` de
la app — `.field-control` (`ui/Field.tsx`) solo fija `color`/`background` en
la CAJA cerrada del select, nunca en las opciones del desplegable. Si el SO
está en oscuro y la app en claro (o viceversa), el texto de las opciones
queda pintado con el `color` de un tema sobre el `background` nativo del
otro → invisible, salvo al pasar el mouse (ahí sí se ve: el resaltado nativo
por hover usa el color de acento del SO, que por coincidencia sí contrasta).
Explica por qué "pasa con todo el sistema" (un solo componente, `<select
className="field-control">`, reusado en cada formulario) y por qué pasaba
"en claro o en oscuro" (el desajuste es entre la app y el SO, no dentro de
la app).

**Fix** (`frontend/src/index.css`):
- `:root { color-scheme: light; }` base, `color-scheme: dark;` en los dos
  bloques que ya aplican oscuro (`@media (prefers-color-scheme: dark)
  :root:not([data-theme="light"])` y `:root[data-theme="dark"]`) — misma
  condición exacta que ya usan las demás variables de tema, así el navegador
  usa la UI nativa (popup de `<select>`, scrollbars, autofill) en el MISMO
  tono que la app, no el del SO.
- Defensivo además: `select.field-control option { color: var(--color-ink);
  background-color: var(--color-surface); }` — fija explícitamente el color
  del popup en vez de confiar solo en la herencia nativa.
- **Verificado con evidencia real** (Chrome headless vía CDP, `getComputedStyle`
  antes/después): en "system" (SO oscuro) el option pasó de sin
  `background-color` propio a `optionBg: rgb(21,27,43)` (navy oscuro) con
  `optionColor` claro — contraste correcto en los 3 estados de tema
  probados (system/light/dark).

`tsc`/`vite build` (73 mod, sin cambio de conteo)/tests frontend (28)
verdes; `graphify update` (1907 nodos). Sin cambios de backend/DDL/DML.

### 5.-18 Auditoría de CRUD del ciclo completo + falta el botón "Cancelar RFQ" — 2026-09-11

Responde a *"que más necesito a nivel CRUD... las cotizaciones pueden cambiar,
pueden descontinuarse, debo poder agregar nuevas a una gestión ya realizada,
removerla, debe ser así con todo el módulo"*. Auditoría archivo:línea de
`DocumentoList.tsx` (acciones de fila) + los 6 servicios `bll/services/com/*`
(qué `actualizar`/`eliminar`/`cancelar` existen y su cerrojo por estado):

| Documento | Crear | Editar | Eliminar | Otro |
|---|---|---|---|---|
| Solicitud | ✅ | ✅ solo `PENDIENTE_JEFE` | ✅ mismo cerrojo | Aprobar/Rechazar |
| RFQ | ✅ (≥3 prov.) | ✅ fecha límite, solo `ABIERTO` | ✅ solo `ABIERTO` sin cotizaciones | Cerrar; **Cancelar ya existía en el backend (`RfqService.cancelar`) pero SIN botón en pantalla — arreglado hoy** |
| Cotización | ✅ (`registrar`, sin cerrojo de estado del RFQ — ver nota) | ✅ cabecera+líneas, mientras RFQ `ABIERTO` y ninguna línea adjudicada | ✅ mismo cerrojo | Adjudicar (por línea) |
| Orden de compra | ✅ (desde Comparativo) | ✅ campos limitados, solo `EMITIDA` | ✅ solo `EMITIDA/CANCELADA/RECHAZADA` | Cambiar estado (incl. Cancelar vía el selector) |
| Recepción | ✅ | – (no aplica) | ✅ solo `RECIBIDO` | Reversar CxP (si `ALIMENTADO_CXP`) |
| Devolución | ✅ | – (no existe `actualizar` en el backend) | ✅ sin cerrojo de estado | — |

**Fix aplicado ahora** (`DocumentoList.tsx`): acción de fila **"Cancelar RFQ"**
(tono danger + `ConfirmDialog`, mismo patrón que "Reversar CxP"), visible solo
`ABIERTO`, llama `POST /api/com/rfq/:id/cancelar` (backend sin cambios, ya
soportaba la transición `ABIERTO→CANCELADO`).

**Decisiones del usuario tras la auditoría** (`AskUserQuestion`):
1. **Bloquear cotizaciones nuevas contra un RFQ `CERRADO`/`CANCELADO`**
   (elegido, sobre "permitir siempre"). Implementado:
   `CotizacionService.registrar` (`backend/src/bll/services/com/CotizacionService.ts`)
   ahora exige `rfq.estado === "ABIERTO"` antes de crear — mismo cerrojo que
   ya tenían `actualizar`/`eliminar`, ahora consistente en los 3. Nuevo test
   de regresión (`backend/tests/regresiones.int.test.ts`, +1: reutiliza el
   RFQ ya `CERRADO` del test anterior en el mismo archivo y confirma 409).
2. **No hace falta editar devoluciones** (elegido, sobre "agregar edición") —
   sin cambios, se deja como está (crear/eliminar, sin `actualizar`).
3. `LOCK_EDITAR`/`LOCK_ELIMINAR` de `cotizaciones` (`() => false`, nunca
   ocultan la acción aunque el backend la vaya a rechazar con 409) queda
   **pendiente, no bloqueante** — corregirlo bien requiere que el listado de
   cotizaciones traiga el estado del RFQ y si hay línea adjudicada (cambio en
   `CompraReadRepository`, no solo frontend); no se preguntó explícitamente,
   se anota como backlog.

**Pruebas**: 8 unit + **168 integración** (+1 de regresión) + 28 frontend,
todos verdes. `tsc` limpio (be+fe); `vite build` OK (73 mod, sin cambio de
conteo); `graphify update` (1907 nodos). Sin cambios de DDL/DML.

### 5.-17 Bug real encontrado y corregido: el botón "⋯" de acciones era invisible — 2026-09-11

El usuario insistió en que el botón de acciones de fila "no se ve" (tras mi
afirmación anterior, sin evidencia visual real, de que "sí estaba ahí"). Se
tomó en serio: como no hay Playwright/chromium-cli instalado, se automatizó
**Chrome headless ya instalado en el equipo** vía el protocolo CDP crudo
(WebSocket + fetch nativos de Node 24, **sin instalar nada en el repo**) para
loguearse de verdad, navegar a Solicitudes y capturar pantalla real.

- **Hallazgo confirmado con capturas** (antes/después): el botón SÍ existe y
  SÍ es clickeable (el script lo clickeó y el menú "⋯" abrió con "Iniciar
  cotización/Detalle/Comparativo"), pero el ícono de 3 puntos era
  **visualmente invisible** — un cuadro gris vacío. Causa raíz, confirmada
  midiendo `getBoundingClientRect()` del `<svg>`: su ancho renderizado era
  **0px** a pesar de `width="16"` como atributo. El `svg { max-width:100% }`
  global de `index.css` se resuelve como porcentaje contra el contenedor;
  dentro de este botón (`inline-flex` sin ancho propio, dentro de un
  `<td overflow:visible>` de una tabla `table-layout:fixed`) esa resolución
  colapsaba a 0 — el `fill`/`stroke` computados eran correctos, pero no había
  caja donde pintarlos.
- **Fix**: `frontend/src/ui/Icon.tsx` — el `<svg>` ahora también fija
  `style={{ width: size, height: size, flexShrink: 0 }}` (un `style` inline
  gana por especificidad sobre cualquier regla de la hoja de estilos,
  cerrando la ambigüedad de raíz para **todos** los íconos de la suite, no
  solo el de "⋯").
- **Verificado con capturas reales antes/después** (no solo revisión de
  código): el zoom 8x del botón pasó de un óvalo gris vacío a mostrar
  claramente los 3 puntos. `tsc`/`vite build` (73 mod)/tests frontend (28)
  sin cambios de conteo; `graphify update` sin cambios de topología.
- **Lección**: cuando el usuario contradice una afirmación de "ya lo
  verifiqué" con evidencia de código/API (no visual), hay que conseguir
  evidencia visual real antes de insistir — la revisión de código por sí
  sola no detecta bugs de layout/CSS como este.

### 5.-16 Revertida la fusión Comprador/Financiero — 2026-09-11

El usuario probó la fusión de 5.-14 y se retractó explícitamente ("me
equivoqué"): pidió volver al flujo canónico original donde **el gerente
financiero es quien adjudica** (paso 5 de la definición del negocio que él
mismo transcribió). Revertido por completo:

- `backend/src/common/auth/permissions.ts` — `COMPRADOR` pierde
  `COTIZACION_ADJUDICAR` (vuelve a su set original).
- `database/dml/02_seg_rbac.sql` — quitada la fila agregada en 5.-14.
- **Corrección puntual en la BD viva**: `pnpm db:deploy` solo hace `INSERT
  ... WHERE NOT EXISTS`, no revoca un permiso ya otorgado — hizo falta un
  `DELETE FROM SEG_ROL_PERMISO` de un solo uso (script temporal, ejecutado y
  borrado) para quitar el grant que ya estaba vivo en Oracle. **Lección**:
  cualquier reversión de un permiso YA otorgado necesita un `DELETE`
  explícito, el seed idempotente por sí solo no alcanza.
- `backend/tests/auth.int.test.ts` — el `it(...)` vuelve a esperar `403`
  para "COMPRADOR adjudica".
- `docs/flujo-y-roles-compras.md` — tabla de roles y paso 5 del flujo
  revertidos a la redacción original (financiero adjudica).
- **Lo que SÍ se conserva** (no era parte de la fusión, sigue teniendo
  sentido con roles separados): el asistente guiado
  `AsistenteCotizacion.tsx` (comprador arma RFQ+cotizaciones más rápido; el
  financiero entra después a adjudicar en el Comparativo con los mismos
  datos ya listos), el fix de `idEmpleadoGerenteFinanciero` (`fromSession`
  en vez de listar TODOS los empleados) y los `labelTpl` legibles de
  Solicitud/RFQ/OC/Recepción.
- **Pruebas**: 8 unit + **167 integración** (verde con la aserción
  original restaurada), sin cambios de frontend. `tsc` limpio.

**Por qué no se veía el asistente**: verificado en vivo — SÍ está montado
(confirmado por build/typecheck) y SÍ hay solicitudes `EN_COTIZACION`
visibles en la primera página del listado (p. ej. #184, #190, #197, #198
con el usuario `comprador`). La causa más probable es de **descubribilidad**,
no un bug: como toda acción de fila en este sistema vive detrás de un único
botón "⋯" por fila (convención de `DataTable.tsx`, "mismo peso visual en
toda fila"), "Iniciar cotización" no aparece como un botón suelto — hay que
abrir el "⋯" de una fila en estado **"En cotización"** para verlo (aparece
primero y en negrita, por ser `primary: true`). No se tocó código por esto;
si al abrir el "⋯" de una fila en_cotizacion tampoco aparece, es un bug real
a reportar con capturas o el `configKey`/rol exacto usado.

### 5.-15 Fixes tras probar el asistente en vivo: select ilegible ("#187") + "Autoriza la orden" sin filtrar — 2026-09-11

El usuario probó el asistente nuevo y encontró 2 problemas concretos:
1. El campo **"Gerente financiero"** del formulario de Orden de Compra
   (`documentForms.ts` → `ordenesCompra.headerFields`) ofrecía **todos** los
   empleados sin filtrar (bodega incluido) — vestigio de cuando ese rol era
   distinto del comprador. Con el rol fusionado (bloque 5.-14) ya no tiene
   sentido elegirlo a mano. Fix: `fromSession: "idEmpleado"` (mismo patron ya
   usado en `idEmpleadoSolicitante`/`idEmpleadoRecibe`) — se fija solo, sin
   selector, y se renombro a **"Autoriza la orden"**.
2. Los selects de Solicitud/RFQ/OC/Recepcion (`SOLICITUDES`/`RFQS`/`ORDENES`/
   `RECEPCIONES` en `documentForms.ts`) mostraban solo el numero crudo
   (`"#187"`) — `buildLabel` caia a `#<id>` porque esas constantes no tenian
   `label`/`label2`, solo `prefix`. Fix: `labelTpl` con datos reales de cada
   fila (`"SOL-187 · Renovacion de equipos..."`,
   `"RFQ-108 · Sol #181 · ABIERTO"`, `"OC-68 · RECIBIDA_COMPLETA"`,
   `"REC-.. · OC-.. · RECIBIDO"`), confirmado contra la API real.

`tsc`/`vite build` (73 mod)/tests frontend (28) sin cambios de conteo;
`graphify update` (1902 nodos). Sin cambios de backend ni de DDL.

### 5.-14 Asistente guiado RFQ→Cotización→Comparativo→OC + fusión Comprador/Financiero — 2026-09-11

Responde a *"analiza el CRUD completo del módulo, los roles y esa
burocracia... es poco trabajoso; necesito algo funcional, sencillo, que
automatice los pasos"*. Tras varias rondas de `AskUserQuestion` se acotó:
jefe/gerente/bodega **quedan intactos** (el usuario los quiere así); se
**fusiona la capacidad de `COMPRADOR` y `GERENTE_FINANCIERO`**; el dolor de
"muchas pantallas" se resuelve con un asistente guiado, no con más pantallas
nuevas. Plan:
`C:\Users\j.gonzalez\.claude\plans\shiny-watching-pearl.md` (reemplaza el
plan anterior de esa misma ruta, de la tanda de tests de frontend ya cerrada).

- **RBAC — `COMPRADOR` gana `COTIZACION_ADJUDICAR`**
  (`backend/src/common/auth/permissions.ts`, `database/dml/02_seg_rbac.sql`):
  el mismo usuario que arma el RFQ y registra cotizaciones ahora también
  adjudica y genera la OC, de punta a punta. `GERENTE_FINANCIERO` no se toca
  ni se elimina (queda como rol opcional/redundante). Único test que asumía
  la separación (`backend/tests/auth.int.test.ts` — "COMPRADOR no puede
  adjudicar (403)") se invirtió a "sí puede".
- **`DocumentForm.onSuccess`** (`frontend/src/components/DocumentForm.tsx`)
  ahora recibe el registro creado (`(created?: Record<string,unknown>) => void`,
  antes `() => void`) — cambio compatible hacia atrás, necesario para que un
  asistente pueda encadenar pasos con IDs reales en vez de solo refrescar la
  lista.
- **`AsistenteCotizacion.tsx`** (nuevo,
  `frontend/src/modules/compras/AsistenteCotizacion.tsx`): orquestador de
  estado que reutiliza los mismos `DocumentForm`/`DOCUMENT_FORMS` de RFQ y
  Cotizaciones — sin pantallas nuevas que aprender. Paso RFQ (pre-llena
  `idSolicitud` + 3 líneas de proveedor vacías, el mínimo que ya exige
  `RfqService`) → al crearse, carga los proveedores invitados
  (`GET /api/com/ref/rfq/:id/proveedores`) → un paso de cotización por
  proveedor (pre-llena `idRfq`+`idProveedor`, con `key` por proveedor para
  forzar el re-seed de `DocumentForm`) → al completar el último, llama
  `onFinish(idSolicitud)`, que abre el Comparativo (adjudicar + generar OC ya
  estaban unidos ahí desde la tanda anterior). Nota de implementación: como
  `DocumentForm.submit()` llama `onSuccess` y LUEGO `onClose` en toda alta
  exitosa, se usa una bandera (`avanzandoRef`) para no confundir "avancé de
  paso" con "el usuario canceló".
- **Enganche**: nueva acción de fila "Iniciar cotización" en `solicitudes`
  (`DocumentoList.tsx`), visible solo si `estado === "EN_COTIZACION"` y
  `hasPerm(RFQ_GESTIONAR)`.
- **Pruebas**: 8 unit + **167 integración** (el de `auth.int.test.ts`
  invertido, resto sin cambios) + 28 frontend, todos verdes. `tsc` limpio
  (be+fe); `vite build` OK (73 módulos, +1 por `AsistenteCotizacion.tsx`);
  `graphify update` (1901 nodos). Verificado en vivo: login real `comprador`
  → JWT trae `COMPRAS_COTIZACION_ADJUDICAR` → `POST
  /api/com/cotizaciones/detalle/999999/adjudicar` → 404 (antes 403).
- Fuera de alcance (documentado en el plan): tests automatizados del
  asistente nuevo (2ª tanda de testing frontend); detectar un RFQ ya abierto
  al relanzar el asistente para la misma solicitud.

### 5.-13 Acceso al PDF de la cotización desde el Comparativo — 2026-09-10/11

Pedido del usuario: *"en la comparación de cotizaciones, necesito tener acceso
al PDF de referencia de la cotización realizada"*. El backend ya soportaba
adjuntos por cotización (`AdjuntoService`, tipo `"cotizacion"` = header
`COM_COTIZACION_PROVEEDOR`) y el `ComparativoDTO` ya traía `idCotizacion` por
línea (`CompraReadRepository.ts:824`), pero `ComparativoView.tsx` no exponía
ningún acceso a esos adjuntos — solo generaba/descargaba el PDF *del reporte
comparativo* (distinto del PDF de la oferta subida por el proveedor).

- **`frontend/src/modules/compras/ComparativoView.tsx`** — cada fila de
  cotización gana un botón "PDF" (icono clipboard) que abre un `Modal` con
  `<AdjuntosPanel tipo="cotizaciones" id={cz.idCotizacion} canWrite={hasPerm(COTIZACION_GESTIONAR)} />`
  — el mismo componente reutilizable ya usado en `DocumentoDetalle`. Lectura
  abierta a quien pueda ver cotizaciones (financiero incluido, vía
  `COTIZACION_ADJUDICAR`); solo `comprador` (dueño de `COTIZACION_GESTIONAR`)
  puede subir/eliminar. No requirió cambios de backend.
- Verificado por HTTP en vivo (login `financiero` real): `GET
  /api/com/comparativo/solicitud/181` trae `idCotizacion` por línea; `GET
  /api/com/cotizaciones/180/adjuntos` responde 200 con la lista (vacía porque
  aún no se ha subido ningún PDF de prueba). `pnpm --filter frontend
  typecheck`/`test` (28/28) limpios; `graphify update` (1892 nodos).

### 5.-12 Primera suite de tests del frontend (infra + cobertura inicial) — 2026-09-10

Responde a la elección del usuario, tras cerrar sin capturas la verificación
visual pendiente de la tanda anterior, de atacar el ítem de backlog **"Frontend
con CERO tests"** (docs/07 §1). Detalle en **`docs/08-ESTADO-Y-CONTINUIDAD.md`**.
Sin cambios de DDL ni de backend.

- Infra nueva: `jsdom` + `@testing-library/{react,jest-dom,user-event}` como
  devDependencies de `frontend/`; bloque `test` en `frontend/vite.config.ts`
  (`environment:"jsdom"`, `setupFiles:["./src/testSetup.ts"]`, `globals:false`,
  mismo estilo explícito que el backend); `frontend/src/testSetup.ts` (matchers
  jest-dom + `cleanup` + `IS_REACT_ACT_ENVIRONMENT=true`).
- 4 archivos de test nuevos, 28 casos: `core/auth/permisos.test.ts` +
  `nav.test.ts` (lógica pura de gating, incluye regresión de WS2 punto 5 —
  bodega ve OC), `ui/DataTable.test.tsx` (13 casos: formato de celdas, orden,
  selección + acciones masivas, menú de fila con `hidden`, paginación, vacío/
  loading, **columna de relleno `hasSpacer`** del fix de hoy mismo, colapso de
  columnas `secondary` + disclosure, vista tarjeta <560px — con un stub local
  de `ResizeObserver` que jsdom no implementa), `ui/FlowStepper.test.tsx`
  (gating de pasos por permiso, WS2 punto 2).
- **Pruebas: 8 unit backend + 167 int backend (sin cambios) + 28 nuevas en
  frontend.** `tsc` limpio (be+fe); `vite build` sin cambios de conteo (72
  módulos — los tests no entran al árbol de producción); `graphify update`
  (1880 nodos).
- Fuera de alcance explícito (2ª tanda futura): `ComparativoView`,
  `DocumentoList`, `App.tsx`, `CrudPage`/formularios — necesitan mockear
  `HttpClient` y más contexto (Auth+Refs+EventBus).

### 5.-11 Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales — 2026-09-10

Responde a *"haz un análisis... qué está bien, qué está mal; mejora la UI —
las listas con más columnas no se ven bien; si un usuario no tiene el rol
para una acción, que no aparezca siquiera"*. Plan ejecutado:
`C:\Users\j.gonzalez\.claude\plans\glimmering-foraging-glacier.md` (análisis
completo good/bad con cita archivo:línea). Detalle en
**`docs/07-ESTADO-Y-CONTINUIDAD.md`**. Sin cambios de DDL.

- **Análisis** — mayor riesgo estructural: el bus de eventos solo logueaba un
  fallo de suscriptor tras el commit (sin outbox/reintento) → kardex/CxP
  podían desincronizarse sin aviso. Mayor debilidad de UX: `DataTable` sin
  sistema de columnas + `DocumentoList` god-component sin Observer/responsive.
- **WS1 — Columnas de `DataTable`**: `Column` gana `width`/`grow`/`align`/
  `priority:"secondary"`/`title`; `.data-table` pasa a `table-layout:fixed`
  siempre + `<colgroup>` + `min-width` → las tablas anchas **scrollean** (con
  sombra de borde) en vez de aplastarse; texto/`refKind` con elipsis+tooltip;
  columnas `secondary` se colapsan a un disclosure por fila cuando no caben;
  **vista tarjeta** por debajo de ~560px. Aplicado a `DocumentoList`,
  `HistorialProveedorView` (la más densa, 9 cols), catálogos `proveedores`/
  `acuerdos`, headers de `ComparativoView` acortados. RFQ gana acción "Detalle"
  (`DocumentoDetalle.tipoAdjunto` ahora opcional).
- **WS2 — Gating de acciones**: cerradas 6 fugas (Comparativo "Adjudicar" +
  panel de criterios sin permiso; `FlowStepper` sin filtrar; Dashboard KPIs/
  "Nueva solicitud" sin filtrar; `App.navigateById` con fallback a
  `ALL_LEAVES`) + `nav.ts` ahora reusa los mismos `READ_*` que el backend
  (bodega ve "Órdenes de compra", financiero ve RFQ/Cotizaciones).
- **WS3 — Rollback de estado de OC**: `calcularEstadoOc` gana el resultado
  `ENVIADA` (sin recepciones activas); `recalcularYActualizarOc` se llama al
  eliminar/reversar una recepción; `ordenCompraStateMachine` gana aristas de
  compensación. Antes una OC podía quedar `RECIBIDA_COMPLETA` sin poder
  recibir de nuevo.
- **WS4 — Reconciliación del bus de eventos**: suscriptores idempotentes
  (kardex/CxP saltan si su trabajo ya existe) + `GET/POST
  /api/com/recepciones/:id/{consistencia,reprocesar}` (`ReconciliacionService`,
  nuevo) para detectar y reparar divergencias sin outbox ni tabla nueva.
- **WS5 — Seguimiento/Excepciones de OC**: 2 pantallas `CrudPage` nuevas
  (el backend ya tenía el CRUD, sin UI) + sección de nav.
- **Pruebas** — `reconciliacion.int.test.ts` (6, nuevo) + casos en
  `devolucionAdjuntosYReversa.int.test.ts` y `catalogsCrud.int.test.ts` (+2
  recursos). **8 unit + 167 integración**, verdes. `tsc` limpio (be+fe);
  `vite build` OK (72 módulos); `graphify update` (1842 nodos). El
  comportamiento responsive de `DataTable` se verificó por revisión de código
  (sin `chromium-cli`/Playwright en este host Windows) — recomendado
  confirmarlo visualmente en `pnpm dev`.

### 5.-10 Roles endurecidos + inferencia de datos en formularios — 2026-09-10

Responde a *"no entiendo la lógica de roles — quién aprueba, la jerarquía; hasta
el bodeguero ve la data y hace solicitudes, el sistema no respeta los roles;
necesito inferencia de datos, que no seleccione lo que ya va relacionado"*.
Detalle en **`docs/06-ESTADO-Y-CONTINUIDAD.md`**. Sin cambios de DDL.

- **Diagnóstico** — el RBAC de escritura sí funcionaba (`bodega` → `POST
  solicitudes` = 403). "Veía todo" por (a) el atajo `X-Dev-User` que el frontend
  mandaba sin sesión = permisos `*`, y (b) las lecturas abiertas a cualquier
  permiso del ciclo.
- **Atajo `X-Dev-User` cerrado** — `EnvConfig.devAuth` = `NODE_ENV!=production
  && APP_DEV_AUTH=1`; `authGuard` solo lo admite con `devAuth`. `.env` gana
  `APP_DEV_AUTH=1` (dev/tests). Frontend `HttpClient` ya no manda la cabecera:
  sin token → 401 → LoginScreen.
- **Lectura por documento** — `registrarLecturas(..., readPerms)`: solicitudes =
  quienes ven/aprueban; RFQ/cotizaciones = comprador + financiero; OC = +bodega;
  recepciones/devoluciones = bodega + comprador. `bodega` deja de leer
  solicitudes/RFQ/cotizaciones (403); `auditor` conserva la traza de la decisión
  (solicitudes/comparativo/historial) pero no la plomería operativa. Espejo en
  `routes/com/adjuntos.ts`.
- **Alcance por departamento** en RFQ + Cotización (`alcanceDocumentos.ts`):
  `listar` filtra `idSolicitud/idRfq IN (…)`, `obtener` fuera de alcance → 404.
  OC/recepción/devolución no (sin `ID_SOLICITUD` en la OC; y ya sin roles
  acotados con lectura tras el punto anterior).
- **Inferencia — cotización**: *Proveedor* pasa a select dependiente del RFQ;
  solo lista los invitados (`GET /api/com/ref/rfq/:id/proveedores`).
- **Inferencia — OC**: motor `DocumentFormConfig.autoFill` (`useAutoFill`): al
  elegir la cotización adjudicada de cada línea se copian y **bloquean**
  descripción/unidad/precio/%desc/%imp; si el proveedor es único, se bloquean
  también proveedor/moneda/tasa del header. `cotizacionesAdjudicadas` devuelve
  ya `idProveedor`/`idMoneda`/`tasaCambio`.
- **Inferencia — solicitud**: `FormFieldDef.defaultFromSessionEmpleado` prellena
  (editable) `idSucursal` desde el empleado de la sesión.
- **Pruebas** — `auth.int.test.ts` (+ casos de 403/200 de lectura por rol),
  `referencias.int.test.ts` (+ `rfq/:id/proveedores`, campos de la OC). **8 unit
  + 150 integración**, verdes. `tsc` limpio (be+fe); `vite build` OK (72
  módulos). `graphify update` (1792 nodos). Verificado por HTTP con logins
  reales.

### 5.-9 Datos de demostración del flujo — `pnpm db:seed:flujo` — 2026-09-10

`backend/scripts/seedFlujoDemo.ts` (+ script raíz `db:seed:flujo`): **limpia** toda
la data transaccional de Compras y sus efectos en INV_/CXP_ (kardex, existencia,
facturas de proveedor) — sin tocar catálogos, maestros, RBAC ni el DDL — y
**genera 5 registros limpios y completos** que recorren el flujo a distintas
profundidades, todos por los endpoints reales (mismas reglas, state machines y
suscriptores):

| # | Artículo | Estado alcanzado |
|---|---|---|
| 1 | Laptops Dell (12) | Ciclo completo → Recepción total → **CxP + Kardex** (OC `RECIBIDA_COMPLETA`) |
| 2 | Sillas ergonómicas (40) | Completo → Recepción → CxP → **Devolución parcial** (10 %) |
| 3 | Impresoras multifunción (6) | Solicitud→RFQ→3 cotizaciones→adjudicada→**OC `ENVIADA`** (pendiente de recepción) |
| 4 | Resmas de papel (500) | Solicitud→**RFQ `ABIERTO` con 3 cotizaciones** (pendiente de adjudicar) |
| 5 | Cable UTP Cat 6 (20) | Solicitud aprobada por el jefe → **`PENDIENTE_GERENTE`** (bandeja de aprobación) |

Resultado: `Solicitudes=5 · RFQ=4 · Cotizaciones=12 · OC=3 · Recepciones=2 ·
Devoluciones=1 · FacturasCxP=2 · Kardex=2`. Dashboard poblado (compras del mes,
ahorro de adjudicación ~9 %, rotación). Volver a correrlo re‑limpia y regenera
(idempotente por diseño). Requiere `pnpm db:deploy` previo (maestros ≥ 5
artículos y ≥ 3 proveedores).

### 5.-8 Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, editar líneas de cotización, reversa de recepción post‑CxP — 2026-09-10 (lo más reciente)

Cierra los 4 puntos del backlog opcional (§6.7). Detalle en
**`docs/05-ESTADO-Y-CONTINUIDAD.md`**. Sin cambios de DDL/DML.

- **Adjuntos en Devolución** — `AdjuntoService` gana el tipo `devolucion`
  (`COM_DEVOLUCION_PROVEEDOR`), `routes/com/adjuntos.ts` registra las 4 rutas
  para `/api/com/devoluciones/:id/adjuntos` (escritura: `DEVOLUCION_GESTIONAR`).
  Frontend: `TIPO_ADJUNTO.devoluciones`, ramas `devoluciones` en `detalleCampos`/
  `detalleColumnas` de `DocumentoList` → acción **Detalle** con `AdjuntosPanel`.
- **Vista previa inline** — `GET …/adjuntos/:ref?disposition=inline`
  (`Content-Disposition: inline`). `AdjuntoAppService.abrir()` devuelve un
  `object URL`; `AdjuntosPanel` abre un `Modal` (PDF → `<iframe>`, imagen →
  `<img>`) con botón Descargar. El clic en el nombre ahora previsualiza.
- **Editar líneas de cotización** — el backend ya lo soportaba
  (`CotizacionService.actualizar` → `replaceDetails`, cerrojo RFQ `ABIERTO` sin
  adjudicar). `DocumentForm` gana `editLines?`; en Cotizaciones la acción Editar
  usa `seedEditCotizacion` (trae el documento completo y siembra cabecera +
  líneas; incluye `idRfq` oculto para resolver el select dependiente del renglón).
- **Reversa de recepción post‑CxP** — `POST /api/com/recepciones/:id/reversar`
  (`RECEPCION_GESTIONAR`). `RecepcionService.reversar`: exige estado
  `ALIMENTADO_CXP`; cerrojos "sin devoluciones" y "factura sin pagos"; state
  machine `ALIMENTADO_CXP → RECIBIDO`; suelta la FK a la factura, vuelve a
  `RECIBIDO` y borra lógico; emite `RecepcionReversada`. Suscriptores:
  `kardexSubscriber` compensa con `AJUSTE_NEGATIVO` (+ back‑out del promedio;
  `CANTIDAD > 0` por el CHECK del DDL), `cxpSubscriber` deja la factura `ANULADA`
  + borrada. Frontend: acción **"Reversar CxP"** en Recepciones (solo si
  `ALIMENTADO_CXP`) con `ConfirmDialog`. *Limitación:* no revierte el estado de
  la OC (misma brecha que `eliminar`, ya asumida).
- **Pruebas** — `devolucionAdjuntosYReversa.int.test.ts` (10) +
  `adjuntosYCrud.int.test.ts` (+1 caso de reemplazo de líneas). **8 unit + 148
  integración**, verdes. `tsc` limpio (be+fe); `vite build` OK (72 módulos).
  `graphify update` (1739 nodos).
- **Acciones de fila uniformes** — antes cada fila mostraba 1/2/3 botones según
  su estado (ragged). Ahora `DataTable` renderiza **un único control por fila**:
  el menú **"⋯"** (icono `more`, tres puntos). Toda fila de toda pantalla tiene
  el mismo peso visual. Las acciones que no aplican a una fila salen de su menú;
  si no queda ninguna, el botón se deshabilita. `RowAction.primary` ya solo
  ordena primero + resalta dentro del menú (no hay botones en línea). Sin cambios
  en las pantallas que declaran las acciones.

### 5.-7 Fixes de usabilidad: inserción por rol, selects, RBAC de catálogos, botones — 2026-09-10

Responde a *"hago insert de solicitudes y no las agrega; muestra la data según
el rol y la selección; no muestres basura en los selects de catálogos; ¿por qué
solo el admin edita catálogos?; hay muchos botones, ordénalos"*.

- **Solicitud "no se agrega"** — el formulario dejaba elegir cualquier
  `idEmpleadoSolicitante`; si no era el usuario, la solicitud **sí se creaba**
  pero el filtro de alcance por rol la ocultaba de su lista. Ahora los campos de
  "quién hace esto" se **fijan al empleado de la sesión** y se muestran
  deshabilitados ("Se registra a tu nombre"): `idEmpleadoSolicitante` (solicitud),
  `idEmpleadoRecibe` (recepción), `idEmpleadoSolicita` (devolución). Nuevo
  `FormFieldDef.fromSession`; `DocumentForm` lee `useAuth().sesion.idEmpleado`
  (si es 0 = admin sin empleado, el campo queda editable). Verificado: un
  `solicitante` que crea a su nombre ahora ve la solicitud (39→40).
- **Selects sin basura** — `prioridad` pasa de input numérico libre a `select`
  (`PRIORIDAD_SOLICITUD`: "3 · Normal"…); `motivo` de devolución pasa a `select`
  (`MOTIVO_DEVOLUCION`). Un select **dependiente sin su padre** ya no muestra un
  desplegable vacío: la opción única dice "Elige primero el RFQ / la solicitud /
  …" (`Field.emptyHint`, resuelto en `withResolvedOptions`).
- **RBAC de catálogos** — antes solo `COMPRADOR`/`ADMIN` editaban (y solo `ADMIN`
  los sensibles = monedas). La lógica: los catálogos son datos maestros que
  afectan a todas las compras → segregación de funciones. Se amplió de forma
  razonable: **`COMPRADOR` gana `CATALOGO_ADMIN`** (Compras es dueño de sus
  catálogos, monedas incluidas) y **`GERENTE_FINANCIERO` gana `CATALOGO_EDITAR`**
  (condiciones de pago, términos, centros de costo). `SOLICITANTE`/`JEFE`/
  `GERENTE_AREA`/`BODEGA`/`AUDITOR` siguen en solo lectura (no reescriben datos
  de proveedores/monedas). Cambios en `02_seg_rbac.sql` (idempotente),
  `permissions.ts` y el test de auth. **Correr `pnpm db:deploy`.**
- **Menos botones por fila** — `DataTable` agrupa las acciones: las marcadas
  `primary` quedan en línea (Aprobar/Rechazar en solicitudes, Detalle en
  cotizaciones, Cambiar estado en OC, Cerrar en RFQ, Editar en catálogos) y el
  resto se colapsa en un menú **"⋯"** (cierra con Escape / clic afuera).
- **Pruebas** — `auth.int.test.ts` actualizado (COMPRADOR sí edita monedas;
  nuevo caso GERENTE_FINANCIERO). **8 unit + 137 integración**, verdes. `tsc`
  limpio (be+fe); `vite build` OK (72 módulos). `graphify update` (1724 nodos).

### 5.-6 Adjuntos de documentos (MinIO) + CRUD completo del ciclo — 2026-09-10

Responde a *"en cotizaciones no se entiende qué se ve; necesito adjuntar PDFs y
ver los datos clave; que todo se pueda actualizar, editar y eliminar — un CRUD
completo"*. Detalle en **`docs/04-ESTADO-Y-CONTINUIDAD.md`**.

- **MinIO** — almacenamiento S3 para adjuntos (el DDL está congelado, no hay
  tabla de adjuntos). `pnpm minio` / `scripts/minio.ps1` (binario oficial a
  `tools/`, datos en `.minio-data/`, bucket `com-adjuntos`, consola :9001);
  servicios `minio` + `minio-setup` en `docker-compose.yml`; claves `S3_*` /
  `AWS_*` / `ADJUNTO_MAX_BYTES` en `.env`. `FileStorage.get` real para S3 +
  `remove`; lectura perezosa de `env()`.
- **Adjuntos** — `@fastify/multipart` + `bll/services/com/AdjuntoService.ts` +
  `routes/com/adjuntos.ts`: `GET/POST/GET :ref/DELETE :ref`
  `/api/com/{solicitudes,cotizaciones,ordenes-compra,recepciones}/:id/adjuntos`.
  Binario en `adjuntos/<tipo>/<id>/<uuid>-<nombre>`, índice en `_manifest.json`.
  Valida mime (PDF/PNG/JPG), tamaño, existencia del documento y `ref` sin
  traversal. Frontend: `HttpClient.upload`, `AdjuntoAppService`,
  `components/AdjuntosPanel.tsx`.
- **Cotizaciones entendibles** — `components/DocumentoDetalle.tsx` (nuevo): modal
  con datos clave de la cabecera (FK legibles), líneas con **P. neto** y **total
  con impuesto** calculados, y el panel de adjuntos. `DocumentoList` gana las
  acciones **Detalle / Comparar / Editar / Eliminar**. `ComparativoView`: las dos
  columnas "P. neto" pasan a *P. neto (orig.)* / *P. neto (GTQ)*, con leyenda y
  una sugerencia por línea.
- **CRUD del ciclo con cerrojo por estado** — `PUT` + `DELETE` (borrado lógico)
  para Cotización (RFQ `ABIERTO` y sin adjudicar), OC (`EMITIDA`), y `DELETE`
  para Solicitud (`PENDIENTE_JEFE`), RFQ (`ABIERTO` sin cotizaciones), Recepción
  (`RECIBIDO`), Devolución (mismo día). `BaseHeaderDetailRepository.softDeleteWithDetails`.
  Cerrojo → `BusinessRuleError` (409).
- **Catálogos** — el CRUD (crear/editar/eliminar lógico/borrado múltiple) ya
  existía en `CrudPage`; solo se muestra con `CATALOGO_EDITAR` (`comprador`/
  `admin`); el resto en solo lectura (diseño RBAC).
- **Pruebas** — `tests/adjuntosYCrud.int.test.ts` (8, contra MinIO real).
  **8 unit + 136 integración**, verdes. `tsc` limpio (be+fe); `vite build` OK
  (72 módulos). `graphify update` (1711 nodos). Fix colateral: `@fastify/multipart`
  estrechaba un overload de `.on` en `PdfBuilder` → cast a `NodeJS.EventEmitter`.

### 5.-5 Analítica del dashboard: series temporales + índice de ahorro — 2026-09-10

Cierra el último pendiente opcional de la Fase 6. Detalle en
**`docs/03-ESTADO-Y-CONTINUIDAD.md`**.

- **Endpoint de agregación nuevo** — `GET /api/com/dashboard/resumen?meses=`
  (`authGuardAny(ANALISIS_VER)`, `meses` 1–24, def. 12). Devuelve
  `{ meses, comprasPorMes[], rotacion{porMes[],existenciaValorizada,valorEntradas12m,rotacion12m}, ahorroAdjudicacion{...}, generadoEn }`.
- **`bll/services/com/DashboardService.ts`** (nuevo, solo lectura — no hereda de
  `TransactionalService`): compone `CompraReadRepository`, rellena la rejilla de
  N meses (los meses sin datos entran en cero, en UTC) y calcula los derivados.
  Envuelto en `withTelemetry` en la ruta.
- **`CompraReadRepository`** +3 consultas parametrizadas:
  `comprasPorMesOc` (monto GTQ = `Σ cantidad·precio·(1-desc)·tasa` de OC
  **emitidas**, `TRUNC(FECHA_EMISION,'MM')`), `valorEntradasPorMes` (kardex
  `ENTRADA_COMPRA`, mismo costo-base que la existencia), `existenciaValorizada`
  (`Σ CANTIDAD_ACTUAL·COSTO_PROMEDIO_ACTUAL` de `INV_EXISTENCIA_BODEGA`),
  `ahorroAdjudicacion` (CTE: por línea con adjudicada **y** ≥2 cotizaciones,
  precio neto GTQ de la adjudicada vs. el máximo cotizado → % promedio simple y
  % ponderado por monto).
- **Rotación** = `valor entradas ÷ existencia valorizada` (denominador = existencia
  actual, constante en la serie). Serie mensual + índice 12 m. Lee de INV_ solo
  para agregación (INV sigue fuera del alcance como módulo).
- **Frontend** — `core/CompraServices.ts` gana `DashboardAppService`
  (Singleton) + `dashboardService`. `ui/Charts.tsx` (nuevo, export nombrado):
  `TimeBars` (columnas verticales, 1 serie → 1 hue de marca, extremos 4px,
  gap 2px, labels selectivos, `<details>` con tabla — guía skill `dataviz`) y
  `Gauge` (arco semicircular 0–100, SVG, `role="img"`). `modules/Dashboard.tsx`
  añade 2 filas: *Compras por mes* + *Rotación de inventario* (con índice 12 m y
  existencia valorizada) y *Ahorro de adjudicación* (gauge + monto adjudicado /
  evitado). Degradación limpia si el fetch falla.
- **Bug corregido** — `Intl.DateTimeFormat` formateaba la rejilla (fechas a
  medianoche UTC) en hora local → etiquetas de mes corridas una posición.
  Fijado con `timeZone: "UTC"`.
- **Pruebas** — `tests/dashboard.int.test.ts` (5): ciclo completo →
  `comprasPorMes` 12 buckets con el mes actual > 0, `rotacion` con existencia y
  serie, `ahorro` > 0 (adjudica 25.5 vs. techo 30 → ~15 %), `?meses=6` acota.
  **8 unit + 128 integración**, verdes. `tsc` limpio (be+fe); `vite build` OK
  (70 módulos). `graphify update` (1605 nodos). Verificado por HTTP en vivo.

### 5.-4 RBAC endurecido + bandeja de pendientes — 2026-09-10

Responde a *"los roles no validan bien; un bodeguero puede cambiar data
importante; establece la jerarquía; si un rol necesita aprobación de otro que le
llegue la notificación"*. Detalle completo en **`docs/02-ESTADO-Y-CONTINUIDAD.md`**.

- **14º permiso `COMPRAS_CATALOGO_ADMIN`** — separa catálogos **sensibles**
  (monedas + tablas de auditoría comparativo/workflow) de los **operativos**.
  `routes/com/index.ts` los registra en dos listas (`CRUD_OPERATIVOS` write
  `CATALOGO_EDITAR`, `CRUD_SENSIBLES` write `CATALOGO_ADMIN`). Solo ADMIN.
- **Alcance en la ACCIÓN de aprobar** — `SolicitudCompraService.transicionar`
  valida `empleadosEnAlcance` antes de la transición: un jefe que intente aprobar
  una solicitud de otro equipo → **403**. Lógica extraída a
  `bll/services/com/alcance.ts` (usada por Solicitud y Notificaciones).
- **Gating de catálogos en el frontend** — `CrudPage` gana `writePerm`; sin el
  permiso oculta Nuevo/Editar/Eliminar/selección y marca "Solo lectura para tu
  rol". Antes cualquier `CATALOGO_VER` veía los botones de edición.
- **Bandeja de pendientes** — `NotificacionService` + `GET /api/com/notificaciones`
  (derivada del estado, sin tabla nueva): jefe→`PENDIENTE_JEFE` de su equipo,
  gerente→`PENDIENTE_GERENTE` de su área, comprador→`EN_COTIZACION` sin RFQ,
  financiero→comparativos por adjudicar, bodega→OC por recibir. Frontend:
  `useNotificaciones` + `NotificacionesMenu` (campana de la topbar con badge +
  panel navegable, refresco cada 60 s y ante eventos del `EventBus`).
- **Notificaciones estrictas (2ª pasada)** — `NotificacionService.alcanceAprobacion`:
  las de aprobación exigen poder aprobar ese nivel **y** que la solicitud esté en
  el equipo/área del usuario; centinela `NADA` para usuarios sin empleado ligado
  que no son admin. Nadie ve notificaciones que no le corresponden ni que no
  puede aprobar. Verificado: `comprador` solo ve "listas para cotizar", `jefe`
  solo `APROBAR_JEFE` de su equipo (nunca `idB`).
- **CRUD de documentos completado** — `PUT /api/com/solicitudes/:id` (solo en
  `PENDIENTE_JEFE`, `version` obligatorio, alcance) y `PUT /api/com/rfq/:id`
  (`fechaLimite` mientras `ABIERTO`). `DocumentForm` gana modo edición
  (`editId`/`editFields`); `DocumentoList` muestra la acción "Editar" gated por
  permiso. Test `documentoUpdate.int.test.ts` (5).
- Pruebas: `+11` de integración (**123** total). `graphify update` (1564 nodos).
- Verificado por captura: `jefe`/`comprador` con notificaciones solo de su rol;
  `bodega`/`auditor` con catálogo en solo lectura; modal "Editar · Solicitud".

### 5.-3 Data legible en tablas + fix de encabezado sticky — 2026-09-10

- **Encabezado de tabla se transparentaba** — `--table-head-bg` era
  `rgba(0,0,0,0.015)` (casi transparente) y al hacer scroll la data se veía a
  través del `<th>` sticky. Ahora es **opaco** (`#f2f4f7` claro / `#1b2233`
  oscuro) + `z-index:3` + sombra inferior. Verificado por captura con scroll.
- **`Column` nuevos tipos**: `"rate"` (`× 1.00`, `× 7.85` — se lee como factor,
  no como id) y `"prioridad"` (chip **Baja / Media / Alta / Urgente** con tono,
  no el número). `core/format.ts::formatRate`, `core/estados.ts::prioridadLabel`
  / `prioridadTono`.
- **Más FK a etiqueta** — `solicitudes` gana columna *Grupo de compra*
  (`refKind`), `montoEstimado` pasa a `type:"money"`; `cotizaciones` / `OC`
  añaden *Moneda* (`refKind`) y `tasaCambio` → `type:"rate"`; `Historial` añade
  *Moneda* y `tasaCambio` → `"rate"`.
- **Filtros que pedían id a mano** — `Historial de precios`: "ID Artículo"
  (input numérico) → **select** de artículos; `Comparativo`: "ID de solicitud"
  → **select** de solicitudes (con auto-carga al elegir).
- **Colores arbitrarios tokenizados** — el sidebar navy tenía ~8 hex sueltos
  (`#8fa2c8`, `#6f83ac`, `#eef3fc`…); ahora `--color-navy-ink` /
  `--color-navy-ink-soft` / `--color-navy-ink-faint`. Velo de modales/paleta:
  `rgba(11,26,56,.45)` (navy viejo) → token neutro `--overlay`.
- Verificado por captura (login claro/oscuro, dashboard, OC y solicitudes con
  scroll): sin IDs crudos, sin solape de encabezado, paleta/tipografía del skill.

### 5.-2 Fase 6.5 — Intuitividad del frontend — 2026-09-10

Objetivo: *"que se entienda lo que trabajamos, fácil y funcional, sin agregar
trabajo al usuario."*

- **`ui/FlowStepper.tsx`** (nuevo) — línea de proceso de las 8 etapas del ciclo
  (`patron-diseno.md` §8): Solicitud → Aprobación → RFQ → Cotización → Comparativo
  → Orden → Recepción → CxP/Devolución. Resalta la etapa actual, marca las
  previas con check, cada una navega a su pantalla. Va arriba de cada
  `DocumentoList` y del `Dashboard`.
- **`core/estados.ts`** (nuevo) — `estadoLabel()` / `estadoTono()`: única fuente
  que traduce `PENDIENTE_JEFE` → "Pendiente del jefe", `RECIBIDA_PARCIAL` →
  "Recibida parcial", etc. `EstadoChip` y el dropdown "Cambiar estado" de la OC
  ahora muestran texto legible, no el código crudo.
- **Aprobar / rechazar solicitud sin pedir datos** — el modal ya no pide "ID de
  empleado": el aprobador es el usuario en sesión (`sesion.idEmpleado`). El modal
  explica en una frase qué va a pasar ("… avanzará al siguiente nivel" / "…
  quedará cerrada") y sólo deja un comentario opcional.
- **Estados vacíos que enseñan** — `DataTable` gana `emptyHint`; cada listado
  dice el siguiente paso ("Primero aprueba una solicitud; luego crea el RFQ e
  invita al menos 3 proveedores", …).
- **Nada de IDs crudos en las tablas — `core/RefContext.tsx`** (nuevo): un
  `RefProvider` (bajo `<Suite>`) carga una vez los 13 catálogos pequeños
  (monedas, proveedores, condiciones de pago, grupos, términos, centros de costo,
  categorías, unidades, artículos, empleados, sucursales, bodegas, departamentos)
  y los cachea. `DataTable` gana `Column.refKind`: cualquier columna marcada como
  FK muestra la **etiqueta** (idMoneda 3 → "EUR", idProveedor 501 → "Distribuidora
  Metalúrgica Central", idBodega 1 → "Bodega Central"); los `DocRef`
  (`docSolicitud`/`docRfq`/`docOrden`/…) se muestran con prefijo (OC-123). Aplica
  a **todas** las tablas del sistema (catálogos vía `CrudPage`, documentos vía
  `DocumentoList`, historial). Los montos/tasas usan `type:"money"` / `formatQty`,
  nunca el número pelado. Tolerante: si un catálogo no carga, esa clave cae a
  `#id` sin romper la vista.
- **Dashboard** — KPIs navegables (clic → su pantalla, con teclado); nuevo
  gráfico "Órdenes de compra por estado" (barras horizontales proporcionales,
  una sola serie → un hue de marca, etiqueta + valor siempre visibles, extremos
  redondeados 4px, separación 2px — guía de la skill `dataviz`); tarjeta
  "Empezar" con accesos directos.
- **Asistente de Orden de Compra desde el Comparativo** — `DocumentForm` acepta
  `initial` (prefill). En `ComparativoView`, si hay renglones adjudicados aparece
  **"Generar orden de compra"**: abre el formulario de OC con `idSolicitud`, el
  proveedor (si todo se adjudicó a uno solo) y una línea por renglón adjudicado
  (`idCotizacionDetalle` + descripción + cantidad). El usuario sólo elige unidad
  y confirma.
- **`CommandPalette`** (Ctrl+K) ya filtra por permisos del rol (round anterior).
- **Selects de detalle-línea** (`idSolicitudDetalle`/`idOcDetalle`/
  `idRecepcionDetalle`) ya eran `select` dependientes — nada que hacer.
- Verificación: `tsc -b` + `vite build` OK (65 módulos). Backend sin cambios
  (112 int + 8 unit siguen verdes). Sistema dev levantado, HMR aplicado.

### 5.-1 Realineación de diseño + Fase 6.2/6.3/6.4 — 2026-09-10

**Realineación del sistema de diseño a `skills/patron-diseno.md`** (el skill
cambió: la paleta/tipografía anteriores venían del plan maestro, no del skill).
Se cambiaron los **valores** de los tokens manteniendo los **nombres** (los
componentes no se tocaron):
- `index.css` §3 paleta oficial: `--color-brand` `#0071e3` (era `#1857b8`),
  `--color-danger` `#ff3b30`, `--color-warning` `#ff9500`, `--color-success`
  `#34c759`, `--color-ink` `#1d1d1f`, `--color-ink-soft` `#6e6e73`,
  `--color-ink-faint` `#aeaeb2`, `--color-line` `rgba(0,0,0,0.06)`, `--color-bg`
  `#e8f0fe`. Nuevos `--color-teal`/`-050`, `--color-sidebar-hover/-active`,
  `--field-bg`, `--field-border`, `--btn-ghost-bg`, `--table-head-bg`,
  `--font-mono`. Bloque oscuro recalibrado a los nuevos hues.
- §4 tipografía: UI = stack del sistema (`-apple-system, BlinkMacSystemFont,
  "SF Pro Text"…`); datos/códigos/tablas = **JetBrains Mono** (`--font-data`).
  `index.html` carga solo JetBrains Mono (se quitaron Inter y Roboto).
- §7 componentes: inputs `--field-bg` + borde 1.5px + radio 8 + `padding 7px 12px`
  + 13px; botones radio 8 + transición `opacity/background .15s`, ghost con fondo
  tenue, danger con fondo de baja opacidad; chips 11px/500/radio 20; header de
  tabla `--table-head-bg` a 11px. §12 radios 8/10/14, sombras
  `0 2px 16px / 0 4px 24px`.
- **Formato de moneda (§7)**: nuevo `frontend/src/core/format.ts`
  (`formatMoney`/`formatQty`/`formatPercent`) con
  `Intl.NumberFormat('es-GT',{style:'currency',currency:'GTQ',minimumFractionDigits:2})`.
  `DataTable` gana el tipo de columna `"money"`; `ComparativoView` e
  `HistorialProveedorView` usan el helper compartido.

**6.2 — Alcance por departamento / equipo**
- `AuditContext` gana `empleadoId?` y `roles?`; `auditContextOf` los propaga del
  JWT (el path `X-Dev-User` no los trae → sin restricción, tests intactos).
- `SolicitudCompraService.listar(query, ctx)` / `obtener(id, ctx)`: calculan
  `empleadosVisibles(ctx)` → `null` (ve todo: `ADMIN_COMPRAS`, `COMPRADOR`,
  `GERENTE_FINANCIERO`, `AUDITOR`, o contexto de sistema), o una lista de
  `ID_EMPLEADO`: **GERENTE_AREA** = su departamento, **JEFE_INMEDIATO** = sus
  reportes directos + él, **SOLICITANTE** = solo él. El filtro entra como
  `idEmpleadoSolicitante IN (…)` por el whitelist del descriptor; `obtener` fuera
  de alcance → 404 (no revela existencia).
- DAL: `CompraReadRepository.departamentoDeEmpleado` / `empleadosDeDepartamento`
  / `empleadosBajoJefe` (SQL parametrizado sobre `NOM_EMPLEADO`).
- `routes/com/transaccional.ts::registrarLecturas` pasa `auditContextOf(req)` a
  `listar`/`obtener` (los otros 5 documentos lo ignoran).
- DB: `database/dml/03_alcance_departamento.sql` (idempotente) liga EMP-101/102/103
  a "Compras y Abastecimiento", EMP-101→jefe EMP-102, EMP-104 a otro depto.
- Pruebas: `tests/alcanceDepartamento.int.test.ts` (6): jefe/gerente/solicitante
  ven lo suyo y no lo de otro depto; comprador ve todo; GET por id fuera de
  alcance → 404.

**6.3 — `withTelemetry` (Decorator) en los CRUD genéricos**
- `buildCrudService` ahora devuelve `withTelemetry(service, 'CrudService:<key>')`.
  Antes solo los servicios de flujo tenían el Proxy de telemetría.

**6.4 — Empaquetado Docker**
- `backend/Dockerfile` (multi-stage, `pnpm deploy --prod`, imagen `node:20-alpine`
  sin devDeps), `frontend/Dockerfile` (build Vite → `nginx:1.27-alpine`),
  `frontend/nginx.conf` (SPA + proxy `/api → backend:3000`), `docker-compose.yml`
  (red `inventory-net`, volumen `oracle-data`, servicios `oracle`/`backend`/
  `frontend` + `db-init` opcional), `.dockerignore`, sección Docker en el README.
- Imagen de BD: `gvenzl/oracle-free` (Oracle DB 23 Free) por falta de imagen 21c
  turnkey; documentado cómo cambiar a la oficial.

### 5.0 Endurecimiento de autenticación (subfase 6.1) — 2026-09-10

- **Hash de contraseña real** — `backend/src/common/auth/password.ts`: `scrypt`
  (`node:crypto`, sin dependencias nuevas; mismo criterio que `jwt.ts`), salted,
  comparación `timingSafeEqual`. Formato `scrypt$N$r$p$salt$hash`. Toda la lógica
  queda tras `hashPassword` / `verifyPassword`: migrar a argon2/bcrypt no toca la
  BLL. `isPlaceholderHash()` detecta marcadores de dev.
- **SQL de auth movido a la Capa 2** — `dal/repositories/seg/SegAuthRepository.ts`
  (Singleton): concentra TODO el SQL de SEG_ (resolver usuario+hash, roles,
  permisos, `INTENTOS_FALLIDOS`/`FECHA_BLOQUEO`/`FECHA_ULTIMO_LOGIN`, inserts en
  `SEG_BITACORA_ACCESO`, `usuariosDemo`). Bind vars, `mapOracleError`, escrituras
  en `withTransaction`. `AuthService` queda como **orquestación pura sin SQL**
  (cumple la regla "nada de SQL fuera de `dal/`").
- **Política de bloqueo** — `AuthService`: 5 intentos fallidos consecutivos →
  `FECHA_BLOQUEO = SYSTIMESTAMP` + evento `BLOQUEO_CUENTA`; ventana de 15 min →
  `LockedError` (**HTTP 423**, nueva clase en `common/errors/AppError.ts` y en
  `frontend/src/core/errors.ts`). Login correcto resetea intentos/bloqueo y marca
  `FECHA_ULTIMO_LOGIN`. Mensaje genérico "Usuario o contraseña inválidos" (no se
  revela si el usuario existe); aun así se deja huella `LOGIN_FALLIDO`.
- **Bitácora `SEG_BITACORA_ACCESO`** — filas `LOGIN_EXITOSO` / `LOGIN_FALLIDO` /
  `BLOQUEO_CUENTA` / `LOGOUT` con `USERNAME_INTENTO`, `IP_ORIGEN` (de `req.ip` /
  `x-forwarded-for`) y `DETALLE`.
- **`POST /api/auth/logout`** — `presentation/routes/auth.ts` (requiere token):
  registra `LOGOUT` y responde 204. `login` ahora **exige `password`** (422 si
  falta).
- **Frontend**
  - `core/HttpClient.ts` — `mapError` 423 → `LockedError`; callback
    `onAuthExpired()` que se dispara ante un 401 en llamada autenticada
    (≠ login/logout) → limpia el token.
  - `core/auth/AuthContext.tsx` — `login(username, password)`; `logout()` llama
    al endpoint best-effort; registra `onAuthExpired` → degrada a `LoginScreen`
    con aviso; **valida `exp` del JWT** al rehidratar (no llama `/me` si venció).
    Nuevo estado `notice` + `clearNotice()`.
  - `modules/LoginScreen.tsx` — **campo Contraseña** conforme a
    `skills/patron-diseno.md`: label visible, `field-control` (radio 8px, foco
    `--color-brand`), estado de error que cambia **borde + texto con icono**
    (no solo color, WCAG 2.2 AA), `<p role="alert">`, banner `role="status"` para
    el aviso de sesión expirada, `<form onSubmit>` (Enter), toggle Mostrar/Ocultar,
    botón primario, `useToast`. Los perfiles demo entran con la contraseña común.
- **DB** — `database/dml/02_seg_rbac.sql` (idempotente): hashes scrypt reales para
  los 8 usuarios demo (contraseña **`compras.demo`**) + `UPDATE ... CASE` que
  sustituye el marcador `$dev$` en instalaciones ya sembradas. Sin PL/SQL (lo
  aplica el splitter de `deploy.ts`). **Correr `pnpm db:deploy` antes de
  `test:int`.**
- **Pruebas** — `tests/auth.int.test.ts` reescrito: login con password;
  password incorrecta → 401; 5 fallos → 423 + bitácora `LOGIN_FALLIDO` /
  `BLOQUEO_CUENTA`; login correcto reinicia el contador; `logout` → 204 + rastro
  `LOGOUT`; `logout` sin token → 401. **106 integración + 8 unit, verdes.**
  `tsc` estricto limpio (be+fe); `vite build` OK.
- `X-Dev-User` sigue admitido en no-producción (los ~86 tests restantes lo usan
  con id 0 = contexto de sistema).

### 5.1 Flujo del sistema + RBAC por rol — 2026-09-10

Responde a *"no entiendo el flujo… los departamentos deben ver solo lo suyo"*.

- **`docs/flujo-y-roles-compras.md`**: los 8 pasos del negocio mapeados a
  pantallas / endpoints / estados, diagrama `stateDiagram-v2`, catálogo de 13
  permisos, 8 roles, matriz de visibilidad del menú, usuarios demo.
- **Backend — autorización**
  - `common/auth/permissions.ts` — `Permisos` (13 códigos `COMPRAS_*`),
    `PERMISO_META`, `ROLES` (SOLICITANTE, JEFE_INMEDIATO, GERENTE_AREA,
    COMPRADOR, GERENTE_FINANCIERO, BODEGA, AUDITOR, ADMIN_COMPRAS=`*`),
    `hasPermiso`, `requirePermiso`.
  - `common/types/AuditContext.ts` gana `permisos: readonly string[]`
    (`SYSTEM_AUDIT_CONTEXT` = `{ userId: 0, permisos: ["*"] }`).
  - `common/auth/jwt.ts`: payload gana `empleadoId?`, `roles?`.
  - `presentation/middlewares/authGuard.ts`: añade `authGuardAny(perms)` (≥1);
    sigue admitiendo `X-Dev-User` en no-producción (→ `permisos: ["*"]`).
  - `presentation/middlewares/requestContext.ts`: `auditContextOf` propaga
    `request.auth.permisos`.
  - Rutas etiquetadas por permiso: `routes/com/index.ts` (catálogos: `CATALOGO_VER`/
    `CATALOGO_EDITAR`), `routes/com/transaccional.ts` (crear solicitud, aprobar
    jefe/gerente con `authGuardAny`, RFQ, cotización, adjudicar, OC, recepción,
    devolución; **lecturas** con `authGuardAny(READ_FLUJO)`),
    `routes/com/analitica.ts` (`ANALISIS_VER` / `COTIZACION_ADJUDICAR`).
  - `bll/services/com/SolicitudCompraService.ts`:
    - `autorizarDecision(ctx, estado)` — exige `SOLICITUD_APROBAR_JEFE` en
      `PENDIENTE_JEFE` y `SOLICITUD_APROBAR_GERENTE` en `PENDIENTE_GERENTE`.
    - **`aplicarAjustes()`** — el paso "el jefe modifica cantidades": valida el
      renglón y actualiza `CANTIDAD_AUTORIZADA` (`DecisionInput.ajustes[]`).
  - `bll/services/com/RfqService.ts`: **mínimo 3 proveedores distintos**
    (`RfqService.MIN_PROVEEDORES = 3`) al crear el RFQ — el paso "solicita tres
    cotizaciones".
- **Backend — autenticación**
  - `bll/services/seg/AuthService.ts` (Singleton). `login(username)` resuelve
    `SEG_USUARIO → SEG_USUARIO_ROL → SEG_ROL → SEG_ROL_PERMISO → SEG_PERMISO`,
    emite **JWT HS256 (8 h)** con permisos; si el rol es `ADMIN_COMPRAS` o hay
    permiso `*`, `permisos = ["*"]`. Sin validación de contraseña (dev).
    `me(idUsuario)`, `usuariosDemo()` (LISTAGG de roles).
  - `presentation/routes/auth.ts` (registrada en `app.ts`):
    `POST /api/auth/login`, `GET /api/auth/me` (token), `GET /api/auth/usuarios-demo`,
    `GET /api/auth/permisos`.
- **DB** `database/dml/02_seg_rbac.sql` (idempotente, `WHERE NOT EXISTS`):
  13 `SEG_PERMISO` (MODULO `COMPRAS`), 8 `SEG_ROL`, `SEG_ROL_PERMISO` (mapa
  completo; ADMIN por CROSS JOIN), 4 `NOM_EMPLEADO` extra (EMP-105..108),
  8 `SEG_USUARIO` demo + `SEG_USUARIO_ROL`.
- **Frontend — RBAC**
  - `core/auth/permisos.ts` — espejo de códigos + `READ_FLUJO`, `grants`,
    `grantsAny`.
  - `core/auth/AuthContext.tsx` — `AuthProvider` + `useAuth()` con
    `hasPerm` / `hasAnyPerm`; rehidrata token de `localStorage` → `GET /api/auth/me`.
  - `core/HttpClient.ts` — persiste token (`localStorage` `erp.auth.token`),
    `getToken()`, mapea **403 → `ForbiddenError`** (nuevo en `core/errors.ts`).
  - `modules/LoginScreen.tsx` — selector de perfil (uno por rol) + campo usuario.
  - `App.tsx` — `AuthProvider` → splash mientras resuelve → `LoginScreen` si no
    hay sesión → `Suite` (keyed por `idUsuario`); vista inicial = primer item
    visible.
  - `nav.ts` — `NavLeaf.perm?`; helpers `leafVisible` / `visibleSections` /
    `visibleLeaves`. Cada pantalla lleva su permiso (RFQ, Cotizaciones, OC,
    Recepciones, Devoluciones por su permiso de gestión; Solicitudes por
    cualquiera de solicitud; Catálogos por `CATALOGO_VER`; Análisis por
    `ANALISIS_VER`).
  - `ui/AppShell.tsx` — filtra secciones por permiso; topbar con nombre + rol +
    menú "Cerrar sesión".
  - `modules/compras/DocumentoList.tsx` — botón "Nuevo" y acciones de fila
    (Aprobar/Rechazar/Cambiar estado/Cerrar/Comparativo) ocultos según permiso.
- **Pruebas**: `tests/auth.int.test.ts` (12). `comFlujo` y `regresiones`
  ajustados a 3 proveedores en el RFQ.
- **Usuarios demo** (login sin contraseña, hay selector en pantalla):

  | usuario | empleado | rol |
  |---|---|---|
  | `solicitante` | María López | SOLICITANTE |
  | `jefe` | Jorge Ramírez | JEFE_INMEDIATO |
  | `gerente` | Ana Castillo | GERENTE_AREA |
  | `comprador` | Sofía Herrera | COMPRADOR |
  | `financiero` | Ricardo Morales | GERENTE_FINANCIERO |
  | `bodega` | Luis González | BODEGA |
  | `auditor` | Patricia Núñez | AUDITOR |
  | `admin` | Diego Vargas | ADMIN_COMPRAS |

### 5.2 Catálogos: datos semilla + campos que debían ser catálogo — 2026-09-10

`docs/catalogos-modulo-compras.md`. `database/dml/01_seed_maestros.sql`
(NOM_DEPARTAMENTO 6, INV_UNIDAD_MEDIDA 12, INV_ARTICULO 9, NOM_EMPLEADO,
NOM_SUCURSAL 3, COM_PROVEEDOR 7, COM_GRUPO_COMPRA 7, COM_CENTRO_COSTO 6).
Campos texto/ID libre → `select` (departamento, artículo, calificación,
criterio). `core/catalogosEstaticos.ts`. **Selects dependientes** en formularios
de captura (`formSupport.ts::useOptions`): renglón de solicitud ← `idRfq`,
cotización adjudicada ← `idSolicitud`, renglón de OC ← `idOrdenCompra`, renglón
de recepción ← `idRecepcion`. Nuevas consultas en `CompraReadRepository` +
rutas en `referencias.ts`.

### 5.3 Modo oscuro — texto que se perdía — 2026-09-10

Tokens `--color-heading` (títulos/valores, adapta) y `--color-brand-ink`
(texto/iconos de marca). Los dos bloques oscuros de `index.css` (media
`prefers-color-scheme` y `[data-theme="dark"]`) consistentes. `AppShell`
sidebar se deja navy fijo a propósito.

### 5.4 Layout (nav/topbar fijos) + PDF pulido — 2026-09-09

`AppShell` = `h-[100dvh] overflow-hidden`; sidebar y topbar `shrink-0`;
`<main>` es el ÚNICO scroller. `DataTable` con cuerpo de scroll propio, header
sticky, sin `min-width` forzado, paginación al pie. `PdfBuilder` reescrito con
`bufferPages` (1 página limpia; verificado leyendo el PDF).

### 5.5 Capa POO frontend + PDF/S3 — 2026-09-09

`frontend/src/core/` (`HttpClient`, `errors`, `EventBus`, `Repository` +
`RepositoryFactory`, `CrudService`, `DownloadService`, `CompraServices`).
`common/pdf/PdfBuilder.ts`, `common/storage/FileStorage.ts`,
`bll/services/com/ComparativoPdfService.ts`. Endpoints
`GET/POST /api/com/comparativo/solicitud/:id/pdf`, `GET /api/files/:key`.
Config S3 en `.env` (`S3_*`, `AWS_*`); sin configurar → memoria.

### 5.6 Rediseño UI/UX + navegación a nivel de sistema — 2026-09-09

Sistema de diseño Material 3 / Fluent en `index.css` (paleta exacta
`#0B1A38 #1857B8 #E8F0FE #5B6478 #16A34A #E8A317 #DC2626`, Inter + Roboto).
`ui/`: Icon, Button, Card, KpiCard, Chip/EstadoChip, Skeleton, EmptyState,
PageHeader, DataTable, Modal+Tabs+ConfirmDialog, Toast, CommandPalette (Ctrl+K),
FilterBar (colapsable), AppShell. `ui/fieldKinds.ts` — 17 tipos de campo con su
ancho, atributos y validación en tiempo real. `nav.ts` a dos niveles: nivel 1 =
los 6 módulos del DDL (solo Compras `available`), nivel 2 = acordeón de
secciones colapsables con icono por pantalla.

### 5.7 Bugs corregidos

- `SEG_USUARIO` vacía → FK en toda alta con auditoría. `00_seed_base.sql` crea
  usuario sistema id 1 + bodega central; `deploy.ts` corre todo `database/dml/`.
- `api.action()` mandaba `Content-Type: application/json` con cuerpo vacío →
  Fastify 400. `api.action` omite el header sin payload + `addContentTypeParser`
  tolerante en `app.ts` (cuerpo vacío → `{}`). Regresión cubierta.
- `index.css` con CSS inválido reventaba Tailwind v4 → pantalla en blanco.
  Reescrito; Tailwind a 4.1.11.

---

## 6. Fase actual y qué sigue (backlog priorizado)

**Estamos en la Fase 6.** Sugerencia de orden:

### 6.1 Endurecer autenticación — ✅ HECHO (2026-09-10, ver §5.0)
- ✅ Contraseña real: `PASSWORD_HASH` scrypt en `SEG_USUARIO`, validada en
  `AuthService.login`; hashes sembrados en `02_seg_rbac.sql` (`compras.demo`).
- ✅ Bloqueo por intentos fallidos (`INTENTOS_FALLIDOS`, `FECHA_BLOQUEO`, 5 → 15 min)
  y bitácora `SEG_BITACORA_ACCESO` (`LOGIN_EXITOSO`/`LOGIN_FALLIDO`/`LOGOUT`/
  `BLOQUEO_CUENTA`).
- ✅ `POST /api/auth/logout` (registra en bitácora) + expiración suave del token
  en el frontend (chequeo de `exp` + interceptor 401 → `LoginScreen`).
- Pendiente futuro (no bloqueante): `REQUIERE_CAMBIO_PASSWORD` / cambio de
  contraseña de usuario; rotación de `JWT_SECRET`; refresh tokens.

### 6.2 Alcance por departamento / equipo — ✅ HECHO (2026-09-10, ver §5.-1)

### 6.3 `withTelemetry` (Decorator) en los CRUD genéricos — ✅ HECHO (2026-09-10)

### 6.4 Empaquetado Docker — ✅ HECHO (2026-09-10, ver §5.-1)

### 6.5 Pulido / intuitividad de frontend — ✅ HECHO (2026-09-10, ver §5.-2)
- ✅ "Wizard" de OC que preselecciona líneas desde el comparativo.
- `CommandPalette` ya filtra por permisos.

### 6.6 Analítica del dashboard — ✅ HECHO (2026-09-10, ver §5.-5 y `docs/03-...`)
- ✅ Gráficas de serie temporal: *compras del mes* (monto GTQ de OC emitidas) y
  *rotación* (entradas por compra ÷ existencia valorizada), 12 meses.
- ✅ Índice tipo gauge: *ahorro de adjudicación* (adjudicada vs. techo cotizado).
- ✅ Endpoint `GET /api/com/dashboard/resumen` + `DashboardService` + `ui/Charts.tsx`.

### 6.7 Backlog opcional post‑Fase 6 — ✅ HECHO (2026-09-10, ver §5.-8 y `docs/05-...`)
- ✅ Adjuntos también en Devolución a proveedor.
- ✅ Vista previa inline de adjuntos (PDF/imagen), no solo descarga directa.
- ✅ Editar líneas de cotización desde el frontend (el backend ya lo soportaba).
- ✅ Reversa de recepción cuando ya alimentó CxP (anula factura + compensa kardex).

### 6.8 Opcional / backlog residual (no bloqueante)
- La reversa de recepción **no** revierte el estado de la OC (misma brecha que el
  borrado de recepción; requeriría aflojar la state machine de OC).
- `scripts/gen-entities.ts` (generador de descriptores desde el DDL) — nunca se
  necesitó, los 26 descriptores están a mano.
- Vite 8 cuando exista estable con React 19 + Tailwind v4.
- Los otros 5 módulos del ERP (NOM/SEG/INV/CXP/CXC) están fuera del alcance.

---

## 7. Cómo levantar y verificar

```bash
# 1. Base de datos (Oracle 21c local ya debe tener el DDL aplicado)
pnpm db:deploy                 # -> "103 tablas, 26 COM_" + aplica los .sql de dml/
pnpm db:seed:flujo             # (opcional) limpia la data transaccional y siembra
                               #   5 ciclos de demo a distintas etapas del flujo

# 2. Servicios
pnpm dev                       # backend :3000, frontend :8443 (proxy /api -> :3000)

# 3. Pruebas
pnpm --filter backend test && pnpm --filter backend test:int   # 8 + 98
pnpm --filter frontend build                                   # tsc -b + vite build

# 4. Humo de RBAC por HTTP
curl -s -XPOST localhost:3000/api/auth/login -H "content-type: application/json" -d "{\"username\":\"comprador\"}"
#   -> { data: { token, sesion: { permisos: [...] } } }
#   GET  /api/com/rfq            con Bearer  -> 200
#   POST /api/com/cotizaciones/detalle/1/adjudicar  -> 403
#   sin token                                        -> 401

# 5. QA real end-to-end (Playwright, backend+frontend deben estar arriba)
pnpm qa:roles                  # 8 roles x 21 pantallas del menu, sesion nueva
                                #   por rol (evita falsos positivos de JWT viejo);
                                #   reporta 401/403/5xx y excepciones de consola.
```

En el navegador (`http://localhost:8443`): aparece **LoginScreen** con el
selector de perfiles. Entrar como `solicitante` (ve solo Solicitudes +
Catálogos + Análisis), `bodega` (solo Recepciones/Devoluciones), `comprador`
(RFQ/Cotizaciones/OC), etc. El menú de usuario (arriba a la derecha) cierra
sesión.

---

## 8. Mapa de archivos de referencia

| Necesito… | Archivo |
|---|---|
| Reglas del repo | `CLAUDE.md` |
| Specs normativas | `skills/stack-tecnologico.md`, `skills/patron-arquitectura.md`, `skills/patron-diseno.md` |
| Esquema (nombres, FKs, tipos) | `database/ddl/SCRIPT_DDL.sql` (**no modificar**) |
| Plan maestro + progreso por fecha | `C:\Users\j.gonzalez\.claude\plans\por-favor-revisa-graph-json-vast-flurry.md` |
| Validación POO/GoF punto por punto | `docs/POO-modulo-compras.md` |
| Flujo de negocio + roles/permisos | `docs/flujo-y-roles-compras.md` |
| Análisis de catálogos y selects | `docs/catalogos-modulo-compras.md` |
| Este documento | `docs/01-ESTADO-Y-CONTINUIDAD.md` |
| Avance RBAC + notificaciones + diseño | `docs/02-ESTADO-Y-CONTINUIDAD.md` |
| Analítica del dashboard (series + gauge) | `docs/03-ESTADO-Y-CONTINUIDAD.md` |
| Adjuntos (MinIO) + CRUD del ciclo | `docs/04-ESTADO-Y-CONTINUIDAD.md` |
| Adjuntos en Devolución · preview inline · editar líneas cotización · reversa recepción | `docs/05-ESTADO-Y-CONTINUIDAD.md` |
| Roles endurecidos (X-Dev-User, lectura por rol) + inferencia de datos en formularios | `docs/06-ESTADO-Y-CONTINUIDAD.md` |
| Análisis del módulo + UI de listas responsive + gating de acciones + rollback OC + reconciliación + seguimiento/excepciones | `docs/07-ESTADO-Y-CONTINUIDAD.md` |
| Grafo de código | `graphify-out/` (`graphify query "…"`, `graphify-out/GRAPH_REPORT.md`) |

### Puntos de entrada de código

- Backend arranque: `backend/src/server.ts` → `backend/src/app.ts` (registra
  auth + com + flujo + analítica + referencias).
- Rutas Compras: `backend/src/presentation/routes/com/{index,transaccional,analitica,referencias,adjuntos}.ts`,
  `backend/src/presentation/routes/auth.ts` (login/logout/me/usuarios-demo/permisos).
  Analítica incluye `GET /api/com/dashboard/resumen`; `adjuntos.ts` monta
  `GET/POST/GET :ref/DELETE :ref /api/com/{solicitudes,cotizaciones,ordenes-compra,recepciones,devoluciones}/:id/adjuntos`
  (el `GET :ref` acepta `?disposition=inline` para vista previa embebida).
  `transaccional.ts` añade `PUT`/`DELETE` de los documentos del ciclo (cerrojo por
  estado) y `POST /api/com/recepciones/:id/reversar` (reversa post‑CxP:
  `RecepcionService.reversar` + eventos `RecepcionReversada` a kardex/CxP).
- Servicios: `backend/src/bll/services/com/*` (incl. `DashboardService.ts` —
  series del dashboard; `AdjuntoService.ts` — adjuntos sobre FileStorage/MinIO),
  `backend/src/bll/services/seg/AuthService.ts` (login/bloqueo/bitácora, sin SQL).
- Almacenamiento de archivos: `backend/src/common/storage/FileStorage.ts`
  (Strategy S3/MinIO/memoria); config en `.env` (`S3_*`, `AWS_*`); `pnpm minio`.
- Consultas de agregación: `backend/src/dal/repositories/com/CompraReadRepository.ts`
  (`comprasPorMesOc`, `valorEntradasPorMes`, `existenciaValorizada`, `ahorroAdjudicacion`).
- Autenticación: `backend/src/common/auth/{password,jwt,permissions}.ts`,
  `backend/src/dal/repositories/seg/SegAuthRepository.ts` (todo el SQL de SEG_).
- DAL genérica: `backend/src/dal/repositories/{BaseOracleRepository,BaseHeaderDetailRepository,RepositoryFactory}.ts`.
- Descriptores: `backend/src/entities/com/descriptors.ts`.
- Frontend raíz: `frontend/src/App.tsx` → `AuthProvider` → `LoginScreen` / `Suite` → `ui/AppShell.tsx`.
- Frontend core POO: `frontend/src/core/**` (incl. `core/auth/**`, `core/format.ts`
  moneda GTQ, `core/estados.ts` etiquetas/tonos de estado).
- Sistema de diseño: `frontend/src/index.css` (tokens `patron-diseno.md` §3/§4/§7),
  `frontend/src/ui/**` (`FlowStepper` = línea de proceso, `Charts` = `TimeBars`/`Gauge`
  del dashboard, `DataTable`, `Field`, …).
- Dashboard: `frontend/src/modules/Dashboard.tsx` ← `core/CompraServices.ts::dashboardService`.
- Adjuntos + detalle de documento: `frontend/src/components/{AdjuntosPanel,DocumentoDetalle}.tsx`
  (`AdjuntosPanel` = lista + subir + **vista previa inline** + descargar + eliminar),
  `core/CompraServices.ts::adjuntoService` (`abrir()` = object URL para preview),
  `core/HttpClient.ts::upload`.
- Formulario de captura/edición: `frontend/src/components/DocumentForm.tsx`
  (`editLines` = editar también las líneas en modo edición — usado por Cotizaciones).
- Listados del ciclo: `frontend/src/modules/compras/DocumentoList.tsx`
  (acciones Detalle / Comparar / Editar / Eliminar / **Reversar CxP** por permiso
  y estado; `seedEditCotizacion` siembra cabecera + líneas).
- Navegación: `frontend/src/nav.ts`.
- Seeds: `database/dml/{00_seed_base,01_seed_maestros,02_seg_rbac,com_seed}.sql`.

---

## 9. Convenciones al retomar

1. Antes de tocar un área, `graphify query "<pregunta>"`; para relaciones
   `graphify path "A" "B"`.
2. Respetar las 6 capas y los patrones ya establecidos (no introducir un patrón
   nuevo si hay uno equivalente en uso).
3. Todo cambio de datos → `database/dml/*.sql` idempotente; correr `pnpm db:deploy`.
4. Terminar con: `typecheck` en ambos proyectos, `test` + `test:int` en backend,
   `graphify update .`, y anotar el avance en el plan maestro y en este documento.
5. Sin `any`; sin `oracledb` fuera de `dal/`; bind variables siempre; React
   `export default function` uno por archivo; Tailwind solo por `@theme`.

# Avance 07 — Análisis del módulo + UI de listas responsive + gating de acciones + 3 correcciones estructurales

> Reporte de avance sobre `docs/01-ESTADO-Y-CONTINUIDAD.md` (documento vivo).
> Responde a: *"haz un análisis del módulo de gestión de compras, determina qué
> está bien, qué está mal; sé un experto en UI/UX y mejora la interfaz — las
> listas con más columnas no se ven bien; si un usuario no tiene el rol para
> una acción, que la opción no aparezca siquiera"*.
> Plan ejecutado: `C:\Users\j.gonzalez\.claude\plans\glimmering-foraging-glacier.md`
> (allí está el análisis completo good/bad con cita de archivo:línea).
> Fecha: **2026-09-10**. Sin cambios de DDL.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| **Análisis** completo del módulo (bueno/malo, riesgo #1, deuda técnica) | ✅ (ver plan + §1 aquí) |
| **WS1 — Sistema de columnas de `DataTable`** (ancho, truncado+tooltip, scroll limpio, colapso secundario, vista tarjeta en móvil) | ✅ |
| **WS2 — Gating de acciones por permiso** (6 fugas cerradas + menú alineado al backend) | ✅ |
| **WS3 — Rollback del estado de la OC** al reversar/eliminar una recepción | ✅ |
| **WS4 — Resiliencia del bus de eventos** (detección + reparación idempotente) | ✅ |
| **WS5 — Pantallas de Seguimiento / Excepciones de OC** | ✅ |

**Pruebas:** 8 unitarias + **167 de integración** (161 → +6 de `reconciliacion.int.test.ts`;
151→161 de WS5; 150→151 de WS3). `tsc` estricto limpio (be+fe); `vite build`
OK (72 módulos); `graphify update` (1842 nodos).

> Nota de verificación: no hay `chromium-cli` ni Playwright instalado en este
> host Windows, así que el nuevo comportamiento responsive de `DataTable`
> (colapso de columnas, vista tarjeta) se verificó por **revisión de código
> línea por línea** + `tsc`/`vite build`, no por captura de pantalla en vivo.
> Recomendado: abrir `pnpm dev` y confirmar visualmente Historial de precios,
> Proveedores y Acuerdos marco a distintos anchos.

---

## 1. Análisis del módulo (resumen — detalle con cita en el plan)

**Lo bueno:** 6 capas respetadas (`oracledb` solo en `dal/`, 0 SQL en `bll/`,
0 lógica de negocio en rutas); bind vars + whitelist de identificadores sin
excepción; `OraclePool.withTransaction` + eventos publicados solo tras commit;
FK circular y columna VIRTUAL manejadas correctamente; OCC → 409; POO/GoF reales
(Singleton, Object Pool, Factory, Strategy `PriceResolver`, Adapter, Observer);
~150+ tests de integración contra Oracle+MinIO reales; frontend `core/` (POO
mirror) limpio y tipado.

**Lo malo (priorizado):**
1. **[Mayor riesgo estructural]** el bus de eventos (`DomainEventBus.publish`)
   solo *loguea* un fallo de suscriptor tras el commit de la recepción — sin
   outbox ni reintento, kardex/CxP podían quedar desincronizados sin forma de
   detectarlo ni repararlo. → **WS4**.
2. El estado de la OC no se revertía al reversar/eliminar su única recepción
   (quedaba `RECIBIDA_COMPLETA` sin poder recibir de nuevo). → **WS3**.
3. `DataTable` no tenía API de ancho/prioridad de columna → tablas de muchas
   columnas se aplastaban y envolvían texto en filas altas en vez de scrollear.
   → **WS1**.
4. Seis fugas de gating (acciones visibles para roles sin el permiso) + el
   menú lateral más estrecho que las lecturas que el backend ya permite. → **WS2**.
5. `COM_SEGUIMIENTO_ORDEN`/`COM_EXCEPCION_ORDEN` tenían CRUD en el backend
   pero cero UI. → **WS5**.
6. **Backlog no atacado ahora** (documentado, no bloqueante): suscriptores
   kardex/CxP "provisionales" viviendo en COM_ (deuda de migración cuando
   existan los módulos INV_/CXP_); OCC salteado en `RfqService`/`RecepcionService.registrar`
   (`expectedVersion=null`); 10 imports `type … from "oracledb"` en `bll/`
   (borrados al compilar, rozan la regla pero no la rompen); `withTelemetry`
   ceremonial (solo `log.debug`); `DocumentoList.tsx` de 772 líneas sin usar el
   `EventBus`/`useResource` del frontend (crear en una pantalla no refresca
   otra); `RefContext` sin reintento ni aviso de error; **frontend con cero
   tests** (ni unitarios ni e2e); RFQ sin auto-cierre; devolución sin state
   machine ni efecto en kardex/CxP.

---

## 2. WS1 — Sistema de columnas de `DataTable` (UI de listas)

**Causa raíz** (`ui/DataTable.tsx` antes): sin API de ancho por columna,
`table-layout: auto` + `width:100%`, headers/celdas numéricas `nowrap` pero
texto/`refKind` sin `max-width` ni truncado → se aplastaban a la palabra más
larga y envolvían en filas altas en vez de disparar scroll horizontal. Sin
nada responsive (`patron-diseno.md` §11 lo exige: *"Tablas y formularios
adaptables. Ocultamiento o colapso de elementos secundarios cuando el espacio
sea limitado"*).

**Qué cambió** (`frontend/src/ui/DataTable.tsx` + `index.css`):
- `Column<T>` gana `width?`, `grow?`, `align?`, `priority?: "primary"|"secondary"`,
  `title?`. Ancho por defecto por `ColumnType` (`COLUMN_WIDTH`, espeja
  `ui/fieldKinds.ts`) o `REF_WIDTH=176` para `refKind`.
- `.data-table` → **`table-layout: fixed`** siempre + `<colgroup>` con los
  anchos + `min-width` en `<table>` = Σ anchos. La columna `grow` (a lo sumo
  una) absorbe el espacio sobrante; sin ella, la tabla toma `width:max-content`.
  Efecto: la tabla ancha **scrollea** dentro de `.table-scroll`, nunca se
  aplasta ni envuelve texto.
- Celdas de texto/`refKind`: recorte con elipsis (`.truncate-cell`, `max-width:0`)
  + `title` con el valor completo (tooltip nativo).
- **Afordance de scroll-x**: sombra en el borde (izquierda/derecha) cuando hay
  más contenido, calculada por `scrollLeft`/`scrollWidth` (`table-scroll-fade`).
- **Columna de relleno cuando no hay `grow`** (fix del 2026-09-10, 2da pasada):
  varios catálogos pequeños (monedas, condiciones de pago, términos de entrega,
  centros de costo) y listas del flujo (RFQ, recepciones) no tenían ninguna
  columna `grow` → la tabla quedaba en `width:max-content`, angosta pegada a su
  contenido, con espacio vacío al lado dentro del card ("se ven pequeñas"). Sin
  `grow` explícito, `DataTable` ahora agrega una **columna de relleno invisible**
  (`hasSpacer`, sin header ni celda visible) que absorbe el espacio sobrante;
  la tabla pasa a `width:100%` siempre. Todo catálogo llena el ancho disponible
  sin necesidad de marcar `grow` a mano en cada config.
- **Colapso de columnas `secondary`**: `ResizeObserver` sobre el contenedor;
  si `primary + secondary` no caben, se ocultan las `secondary` de la tabla y
  cada fila gana un disclosure "▸/▾" que expande una sub-fila con las
  etiquetas:valor ocultas.
- **Vista tarjeta** (`ResizeObserver` < 560px): cada fila se renderiza como
  una tarjeta apilada (cabecera = columna primaria + estado + menú "⋯"; cuerpo
  = el resto como etiqueta:valor). Reemplaza la tabla por completo, no solo
  colapsa columnas.
- Las 2 raras tablas RAW (`ComparativoView` per-línea, `DocumentoDetalle`
  líneas) vuelven a `table-layout: auto` explícito (no pasan por `DataTable`,
  no tienen `<colgroup>`) para no romperse con el nuevo default `fixed`.

**Aplicado por pantalla** (anchos/`priority`/`grow`/headers cortos):
- `DocumentoList` (`DOCUMENTO_CONFIGS`): primary ≈ id·estado·ref clave·monto;
  secondary: `justificacion`/`idGrupoCompra` (solicitudes), `idMoneda`+`tasaCambio`
  (cotizaciones, OC), `motivo` (devoluciones), `idBodega` (recepciones).
- `HistorialProveedorView` (9 cols, la más densa): primary = Fecha·Artículo(grow)·
  P. acordado·Cantidad; secondary = Proveedor·Desc%·Imp%·Moneda·Tasa.
- Catálogo `proveedores` (8 cols): `razonSocial` grow; `nombreComercial`/`email`
  secondary. `acuerdos` (8 cols): `idProveedor` grow, `idArticulo` ancho fijo
  220, `fechaInicio`/`fechaFin` secondary + headers cortos ("Desde"/"Hasta").
- `ComparativoView`: headers acortados ("P. neto (orig.)"→"Neto orig.",
  "(GTQ)"→"Neto Q", "Cond. pago"→"Pago") + `min-width` para scroll predecible.
- **RFQ gana "Detalle"** (antes solo tenía adjuntos → sin detalle): `DocumentoDetalle.tipoAdjunto`
  pasa a opcional (oculta el panel de adjuntos si no aplica); `DETALLE_KEYS`
  desacopla "tiene Detalle" de "tiene adjuntos"; nuevas ramas `rfq` en
  `detalleCampos`/`detalleColumnas` (solicitud, fecha límite, proveedores
  invitados).

---

## 3. WS2 — Gating de acciones por permiso

**Diagnóstico:** la mayoría del sistema ya gateaba bien (`DocumentoList`,
`CrudPage`, sidebar, `CommandPalette`). Fugas concretas encontradas y cerradas:

1. **`App.tsx::navigateById`** — caía a `ALL_LEAVES` cuando el id no estaba en
   el menú visible del rol; ahora solo resuelve dentro de `leaves` y muestra
   `toast.info("No tienes acceso a esa pantalla")` si no. Era el habilitador
   estructural de las 3 fugas siguientes.
2. **`FlowStepper.tsx`** — los 8 pasos nunca se filtraban por permiso; ahora
   cada paso cuyo `leafId` no es visible para el rol se muestra **atenuado y
   deshabilitado** (la línea de proceso se ve completa, pero no se puede
   navegar a un 403).
3. **`Dashboard.tsx`** — las KPI cards navegan solo si `leafVisible(...)`;
   "Nueva solicitud" gated con `SOLICITUD_CREAR`.
4. **`ComparativoView.tsx`** — el botón **"Adjudicar"** por fila y el panel
   de **entrada** "Registrar criterio" ahora exigen `COMPRAS_COTIZACION_ADJUDICAR`
   (antes cualquier `ANALISIS_VER` los veía y recibía 403 al usarlos). La
   tabla de criterios en solo lectura sigue visible para todos.
5. **`nav.ts` ↔ `READ_*` del backend** — el menú era más estrecho que lo que
   el backend ya permitía leer (p. ej. bodega no veía "Órdenes de compra"
   aunque la API se lo permite y la necesita para recibir). `core/auth/permisos.ts`
   gana los mismos arrays `READ_SOLICITUDES/RFQ/COTIZACIONES/OC/RECEPCIONES/DEVOLUCIONES`
   que `transaccional.ts`; `nav.ts` los reusa. Resultado: bodega ve OC,
   financiero ve RFQ/Cotizaciones.
6. Backend `READ_SOLICITUDES` += `ANALISIS_VER` (comparativo/dashboard/historial
   navegan legítimamente la lista de solicitudes).

---

## 4. WS3 — Rollback del estado de la OC en reversa/borrado de recepción

- `RecepcionService.calcularEstadoOc` gana un tercer resultado: **`ENVIADA`**
  cuando no queda ninguna recepción activa para ninguna línea (antes solo
  devolvía `RECIBIDA_COMPLETA`/`RECIBIDA_PARCIAL`).
- Nuevo `recalcularYActualizarOc(idOrdenCompra, ctx, conn)`: recalcula desde
  las recepciones **activas** restantes (el `findAll` genérico ya filtra
  `ELIMINADO='N'`) y aplica la transición si cambió. Se llama al final de
  `eliminar()` y `reversar()`.
- `ordenCompraStateMachine` gana aristas de **compensación** (documentadas
  como tales, no como flujo normal): `RECIBIDA_PARCIAL → ENVIADA`,
  `RECIBIDA_COMPLETA → RECIBIDA_PARCIAL | ENVIADA`.
- **Tests**: reversar una de dos recepciones (10+10 de una línea de 20) deja
  la OC en `RECIBIDA_PARCIAL`; un ciclo aparte con una sola recepción total
  reversada vuelve la OC a `ENVIADA` **y permite recibir de nuevo** (verificado
  recibiendo otra vez → `RECIBIDA_COMPLETA`).

---

## 5. WS4 — Resiliencia del bus de eventos

Sin outbox (no hay tabla nueva; DDL congelado). Detección + reparación:

- **`DomainEventBus.publish`** — el log de fallo de suscriptor gana `code:
  "SUBSCRIBER_FAILED"` + el payload completo (greppable/alertable). Sigue sin
  relanzar (la recepción ya está comprometida).
- **Suscriptores idempotentes** (prerequisito para reprocesar sin duplicar):
  `kardexSubscriber` salta si ya existe un movimiento `ENTRADA_COMPRA`/
  `AJUSTE_NEGATIVO` con ese `idDocumentoRef` (el lote de una recepción es
  atómico — una fila de cualquier línea basta para saber que el evento ya se
  aplicó entero); `cxpSubscriber` salta si ya hay una factura no eliminada
  para esa recepción.
- **`GET /api/com/recepciones/:id/consistencia`** (`ReconciliacionService`,
  nuevo, `OC_GESTIONAR`): compara lo esperado (kardex de entrada; factura si
  `ALIMENTADO_CXP`) contra lo que existe realmente. Devuelve
  `{ok, kardex:{esperado,encontrado,ok}, cxp:{esperada,encontrada,ok}}`.
- **`POST /api/com/recepciones/:id/reprocesar`** (`OC_GESTIONAR`): reconstruye
  el payload `RecepcionRegistrada` desde la recepción + OC actuales y lo
  vuelve a publicar; los suscriptores idempotentes recrean solo lo que falta.
  Rechaza recepciones no activas (ya reversadas/eliminadas) con 404/409.
- **Pruebas** (`reconciliacion.int.test.ts`, 6): recepción consistente → `ok`;
  se borra el kardex y se anula/borra la factura a mano (simulando un
  suscriptor fallido) → `consistencia` detecta ambas divergencias;
  `reprocesar` las repara; `reprocesar` de nuevo no duplica; 404 en recepción
  inexistente o ya reversada.

---

## 6. WS5 — Pantallas de Seguimiento / Excepciones de OC

- Backend ya tenía el CRUD registrado (`presentation/routes/com/index.ts` →
  `seguimiento-orden`/`excepciones-orden`, catálogos "operativos" con
  `CATALOGO_EDITAR`) — no requirió cambios.
- Frontend: 2 configs `CrudPage` nuevas en `catalogPages.tsx`
  (`seguimientoOrden`: OC·fecha·estado del reporte·notas;
  `excepcionOrden`: OC·tipo·descripción·quién reporta·resuelta·fecha de
  resolución), `writePerm: OC_GESTIONAR` (no `CATALOGO_EDITAR` — son del
  ámbito de Compras/OC, no un catálogo maestro). Nueva sección de nav
  "Seguimiento de OC" (dos ítems), gated por `READ_OC`.
- Columnas dentro del presupuesto de WS1 (refs, chips, `secondary` en texto
  libre/fechas).
- **Pruebas**: `catalogsCrud.int.test.ts` data-driven +2 recursos (10 casos);
  `beforeAll` crea una OC standalone (precio explícito, sin solicitud/cotización)
  solo para tener un FK válido.

---

## 7. Verificación

```bash
pnpm minio ; pnpm db:deploy
pnpm -r typecheck                 # limpio (be + fe)
pnpm --filter backend test        # 8/8
pnpm --filter backend test:int    # 167/167  (necesita Oracle + MinIO)
pnpm --filter frontend build      # tsc -b + vite build OK (72 módulos)
graphify update .                 # 1842 nodos
```

Smoke por HTTP en vivo: `bodega` → `GET /api/com/ordenes-compra` 200 (ahora en
su menú); `GET /api/com/seguimiento-orden` / `excepciones-orden` 200;
`GET /api/com/recepciones/:id/consistencia` → reporte `ok:true` sobre una
recepción real.

---

## 8. Puntos de entrada nuevos / tocados

| Necesito… | Archivo |
|---|---|
| Sistema de columnas de tabla | `frontend/src/ui/DataTable.tsx`, `frontend/src/index.css` (`.data-table`, `.truncate-cell`, `.table-scroll-fade`) |
| Detalle de RFQ | `frontend/src/components/DocumentoDetalle.tsx` (`tipoAdjunto?`), `modules/compras/DocumentoList.tsx` (`DETALLE_KEYS`) |
| Gating de navegación | `frontend/src/App.tsx` (`navigateById`), `ui/FlowStepper.tsx`, `modules/Dashboard.tsx`, `modules/compras/ComparativoView.tsx`, `nav.ts`, `core/auth/permisos.ts` (`READ_*`) |
| Rollback de estado de OC | `backend/src/bll/services/com/RecepcionService.ts` (`calcularEstadoOc`, `recalcularYActualizarOc`), `bll/compras/stateMachines.ts` |
| Reconciliación | `backend/src/bll/services/com/ReconciliacionService.ts`, `bll/compras/subscribers/{kardexSubscriber,cxpSubscriber}.ts` (idempotencia), `common/events/DomainEventBus.ts`, `presentation/routes/com/transaccional.ts` (`.../consistencia`, `.../reprocesar`) |
| Seguimiento/Excepciones de OC | `frontend/src/modules/compras/catalogPages.tsx` (`seguimientoOrden`, `excepcionOrden`), `nav.ts` |
| Pruebas nuevas | `backend/tests/reconciliacion.int.test.ts`; +casos en `devolucionAdjuntosYReversa.int.test.ts`, `catalogsCrud.int.test.ts` |
| Análisis completo con cita archivo:línea | `C:\Users\j.gonzalez\.claude\plans\glimmering-foraging-glacier.md` |

# Avance 05 — Backlog opcional post‑Fase 6: adjuntos en Devolución, vista previa inline, edición de líneas de cotización y reversa de recepción post‑CxP

> Reporte de avance sobre `docs/01-ESTADO-Y-CONTINUIDAD.md` (documento vivo).
> Responde al backlog opcional declarado al cierre de la Fase 6 (§6.7 de `docs/01`
> y "Backlog residual" del plan maestro).
> Fecha: **2026-09-10**. Verificado contra Oracle 21c + MinIO locales.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| Adjuntos de documentos también en **Devolución a proveedor** | ✅ |
| **Vista previa inline** de adjuntos (PDF en iframe, imagen en `<img>`) | ✅ |
| **Editar líneas de cotización** desde el frontend (no solo cabecera) | ✅ |
| **Reversa de recepción** cuando ya alimentó CxP (anula factura + compensa kardex) | ✅ |

**Pruebas:** 8 unitarias + **148 de integración** (137 → +11: `+10` en
`devolucionAdjuntosYReversa.int.test.ts`, `+1` en `adjuntosYCrud.int.test.ts`).
`tsc` estricto limpio (be + fe); `vite build` OK (72 módulos); `graphify update`
(1739 nodos). Sin cambios de DDL/DML — el esquema sigue congelado.

> `pnpm --filter backend test:int` sigue necesitando Oracle + un S3 (`pnpm minio`);
> sin S3 el backend cae a memoria y los tests igual pasan.

---

## 1. Adjuntos en Devolución a proveedor

Antes: adjuntos sobre Solicitud / Cotización / OC / Recepción. Ahora también en
**Devolución** — mismo patrón (`FileStorage` Strategy + manifiesto JSON, el DDL
no tiene tabla de adjuntos).

- **`bll/services/com/AdjuntoService.ts`** — `TipoDocumentoAdjunto` gana
  `"devolucion"`; `REPOS.devolucion = devolucionRepository`,
  `TABLA.devolucion = "COM_DEVOLUCION_PROVEEDOR"`. Sin más cambios: validación de
  mime/tamaño/existencia y saneo de `ref` son genéricos.
- **`presentation/routes/com/adjuntos.ts`** — nueva entrada en `DOCS`:
  `{ base: "/api/com/devoluciones", tipo: "devolucion", write: DEVOLUCION_GESTIONAR }`.
  Se montan las 4 rutas de siempre:
  `GET / POST / GET :ref / DELETE :ref  /api/com/devoluciones/:id/adjuntos`.
  **Lectura**: cualquier permiso del flujo (`READ` ya incluía `DEVOLUCION_GESTIONAR`).
  **Escritura**: `COMPRAS_DEVOLUCION_GESTIONAR` (lo tienen `bodega` y `admin`).
- **Frontend**
  - `core/CompraServices.ts` — `TipoDocAdjunto` gana `"devoluciones"`.
  - `modules/compras/DocumentoList.tsx` — `TIPO_ADJUNTO.devoluciones = "devoluciones"`,
    de modo que la acción **Detalle** (→ `DocumentoDetalle` con `AdjuntosPanel`)
    aparece también en Devoluciones. Nuevas ramas `devoluciones` en
    `detalleCampos()` (Recepción, Motivo, Solicita, Fecha) y `detalleColumnas()`
    (Renglón recep., Devuelto).

## 2. Vista previa inline de adjuntos

Antes: el nombre del adjunto disparaba **descarga directa**. Ahora abre una
**vista previa embebida** sin salir de la pantalla.

- **Backend** — `routes/com/adjuntos.ts`: `GET {base}/:id/adjuntos/:ref` acepta
  `?disposition=inline` → `Content-Disposition: inline` (por defecto sigue siendo
  `attachment`). Es cosmético para el caso normal (el frontend renderiza desde un
  `blob:` URL), pero deja el enlace directo correcto.
- **Frontend**
  - `core/CompraServices.ts` — `AdjuntoAppService.abrir(tipo, id, meta)` hace
    `http.blob(..., { disposition: "inline" })`, crea un `object URL` y devuelve
    `{ url, revoke }` (el llamador libera al cerrar). Se conserva `descargar()`.
  - `components/AdjuntosPanel.tsx` — clic en el nombre (o en el icono 🔍) abre un
    `Modal` de 900px: **PDF** → `<iframe>` a 70vh; **PNG/JPG** → `<img>` centrado.
    El modal tiene botón "Descargar" (misma acción de antes) y "Cerrar".
    Se añadió un botón explícito de descarga por fila. El `object URL` se revoca
    en `useEffect` de limpieza y al cambiar de preview.
  - La descarga con `<a download>` desde `blob:` funciona en el navegador real;
    en Artifacts no, pero esto es la SPA de Vite, no un Artifact.

## 3. Editar líneas de cotización desde el frontend

El backend ya lo soportaba (`CotizacionService.actualizar` → `replaceDetails`
si llega `lineas[]`, con el cerrojo de siempre: **RFQ `ABIERTO` y ninguna línea
adjudicada**). Faltaba exponerlo: el `DocumentForm` en modo edición solo tocaba
cabecera.

- **`components/DocumentForm.tsx`** — nueva prop `editLines?: boolean`.
  - `hasLines` pasa a ser `(!editing || props.editLines === true) && …`.
  - El seed de líneas ya leía `props.initial?.lines`; ahora también aplica en
    edición.
  - En el submit de edición, si `hasLines`, el `PUT` incluye
    `{ [linesKey ?? "lineas"]: [...] }` (para cotización, `"lineas"`).
  - Ancho del modal: 760 cuando `editLines` (antes 560 fijo en edición).
- **`modules/compras/DocumentoList.tsx`** — la acción **Editar** de Cotizaciones
  ahora llama `seedEditCotizacion(r)` (async): trae el documento completo
  (`GET /api/com/cotizaciones/:id` → `{header, details}`) y siembra:
  - cabecera: `idCondicionPago`, `idMoneda`, `tasaCambio`, `fechaVencimiento`,
    `version`, **y `idRfq`** (no editable, pero necesario para resolver el select
    dependiente "Renglón de la solicitud" de cada línea);
  - líneas: `idSolicitudDetalle`, `precioUnitario`, `cantidad`, `idUnidadMedida`,
    `porcentajeDescuento`, `porcentajeImpuesto`.
  - `editState` gana `lines?` y `editLines?`; se pasan a `DocumentForm`.
  El cerrojo (409 si el RFQ ya cerró o hay adjudicación) lo sigue haciendo el
  backend; el frontend muestra el mensaje.

## 4. Reversa de recepción que ya alimentó CxP

Antes: `DELETE /api/com/recepciones/:id` solo si estado `RECIBIDO` (aún no había
tocado kardex ni CxP). Para `ALIMENTADO_CXP` no había salida. Ahora:

### Endpoint
`POST /api/com/recepciones/:id/reversar` (`authGuard(RECEPCION_GESTIONAR)`,
envuelto en `withTelemetry`). Devuelve `{ idRecepcion, idFacturaAnulada }`.

### `RecepcionService.reversar(id, ctx)` (Capa 3, dentro de `runInTransaction`)
1. La recepción debe estar en **`ALIMENTADO_CXP`** (si sigue en `RECIBIDO` →
   `BusinessRuleError` 409 con "usa Eliminar").
2. **Cerrojo — sin devoluciones**: si hay `COM_DEVOLUCION_PROVEEDOR` activa contra
   esta recepción → 409.
3. **Cerrojo — factura sin pagos**: lee `CXP_FACTURA_PROVEEDOR` (solo lectura,
   para el cerrojo — mismo criterio que la analítica del dashboard, que ya lee
   INV_/CXP_ para agregar). Si no está `PENDIENTE` o `SALDO_PENDIENTE < MONTO_TOTAL`
   → 409.
4. Reúne las líneas (recepción + OC) para el evento inverso **antes** del borrado.
5. `recepcionStateMachine.assertTransition('ALIMENTADO_CXP', 'RECIBIDO')`
   (nueva arista en `stateMachines.ts`), `update` de la recepción
   (`ID_FACTURA_PROVEEDOR = NULL`, `ESTADO = 'RECIBIDO'`), luego
   `softDeleteWithDetails` (cabecera + líneas).
6. `enqueueEvent(ComEvents.RecepcionReversada, payload)` — se publica tras el
   commit. Las mutaciones de INV_/CXP_ ocurren en sus suscriptores (bajo
   acoplamiento, igual que en la creación).

### Evento y suscriptores
- **`bll/events/domainEvents.ts`** — `ComEvents.RecepcionReversada` +
  `RecepcionReversadaPayload` (`idRecepcion`, `idBodega`, `idFacturaProveedor`,
  `fechaRecepcion`, `lineas[{idArticulo, cantidadRecibida, costoUnitario}]`, `userId`).
- **`kardexSubscriber.ts`** — `onRecepcionReversada`: por línea, un movimiento
  **`AJUSTE_NEGATIVO`** (`TIPO_DOCUMENTO_REF = 'COM_RECEPCION_REVERSA'`,
  `CANTIDAD` = lo recibido, **positiva** por el `CHECK (CANTIDAD > 0)` del DDL) y
  **back‑out del promedio ponderado**
  (`(prevCant·prevCosto − cant·costo) / (prevCant − cant)`, con guardas a 0).
  `upsertExistencia` deja el nuevo saldo.
- **`cxpSubscriber.ts`** — `onRecepcionReversada`: la `CXP_FACTURA_PROVEEDOR`
  pasa a **`ANULADA`** (valor válido del enum del DDL), `SALDO_PENDIENTE = 0`, y
  borrado lógico. Idempotente (si ya está `ANULADA`, no hace nada).
- Ambos suscriptores se registran junto a los de `RecepcionRegistrada` en
  `registerKardexSubscriber` / `registerCxpSubscriber`.

### Frontend
`modules/compras/DocumentoList.tsx` — Recepciones gana la acción **"Reversar CxP"**
(icono `undo`, tono `danger`), visible solo si `estado === "ALIMENTADO_CXP"` y el
rol puede gestionar recepciones. `ConfirmDialog` con el aviso ("se anulará la
factura de CxP, se compensará el kardex, la recepción quedará eliminada; solo
procede sin pagos ni devoluciones"). "Eliminar" sigue oculta salvo `RECIBIDO`
(los dos estados son mutuamente excluyentes).

### Limitación conocida (documentada, no bloqueante)
La reversa **no revierte el estado de la OC**: si la OC había quedado
`RECIBIDA_COMPLETA`/`RECIBIDA_PARCIAL`, ahí se queda (la state machine de OC no
tiene transiciones salientes desde `RECIBIDA_COMPLETA`, y `eliminar` de recepción
tiene la misma brecha, ya asumida en `docs/01`). Si se quiere cerrar esta brecha
habría que aflojar `ordenCompraStateMachine` y recalcular; queda como backlog.

## 4-bis. Acciones de fila uniformes (todas las tablas del sistema)

Petición: *"hay filas con 2 botones, otras con 3, otras con 1 en la misma
pantalla — que sea ordenado, todas las filas con la misma cantidad de botones"*.

- **`ui/DataTable.tsx` — `RowActions`** reescrito: cada fila renderiza **un solo
  control**, el menú **"⋯"** (icono nuevo `more` = tres puntos, `ui/Icon.tsx`).
  Ya no hay botones "en línea": desaparece el reparto `primary` inline / resto en
  menú que producía filas de distinto ancho.
- Dentro del menú, las acciones se ordenan **primarias primero** (en negrita) y
  luego el resto. Las que no aplican a esa fila (`hidden(row) === true`) **no
  aparecen** en su menú. Si la fila no tiene ninguna acción disponible, el botón
  "⋯" queda **deshabilitado** (mismo hueco, sin clic).
- Resultado: toda fila de toda tabla (documentos del ciclo y catálogos vía
  `CrudPage`) tiene exactamente **1 botón de acciones**, alineado a la derecha.
- `RowAction.primary` pasa a ser solo "ordenar primero + resaltar"; `hidden` y
  `tone` sin cambios. Las pantallas que declaran las acciones (`DocumentoList`,
  `CrudPage`) no se tocaron.

---

## 5. Verificación

```bash
pnpm minio                                  # MinIO :9000 + bucket com-adjuntos
pnpm db:deploy                              # sin cambios de DDL/DML (28 sentencias)
pnpm -r typecheck                           # limpio (be + fe)
pnpm --filter backend test                  # 8/8
pnpm --filter backend test:int              # 148/148  (necesita Oracle + MinIO)
pnpm --filter frontend build               # tsc -b + vite build OK (72 módulos)
graphify update .                           # 1739 nodos
```

`tests/devolucionAdjuntosYReversa.int.test.ts` (10):
- **Adjuntos en devolución** (6): registra una devolución contra una recepción,
  sube un PDF y lo lista / descarga / **previsualiza inline** (`Content-Disposition:
  inline`) / elimina; adjuntar a devolución inexistente → 404.
- **Reversa** (4): la recepción A está `ALIMENTADO_CXP` con factura + kardex →
  `POST /reversar` → factura `ANULADA` + borrada, recepción borrada
  (`ELIMINADO='S'`), kardex con un `AJUSTE_NEGATIVO` (`COM_RECEPCION_REVERSA`),
  existencia baja exactamente lo recibido; reversar de nuevo → 404; reversar una
  recepción con devolución registrada → 409.

`tests/adjuntosYCrud.int.test.ts` (+1): `PUT /api/com/cotizaciones/:id` con
`lineas[]` reemplaza el detalle (precio 15.25, cantidad 8) mientras el RFQ está
`ABIERTO` y sin adjudicar.

---

## 6. Puntos de entrada nuevos / tocados

| Necesito… | Archivo |
|---|---|
| Adjuntos en devolución | `bll/services/com/AdjuntoService.ts` (tipo `devolucion`), `presentation/routes/com/adjuntos.ts` (`DOCS`) |
| Vista previa inline | `routes/com/adjuntos.ts` (`?disposition=inline`), `core/CompraServices.ts::AdjuntoAppService.abrir`, `components/AdjuntosPanel.tsx` (modal) |
| Editar líneas de cotización | `components/DocumentForm.tsx` (`editLines`), `modules/compras/DocumentoList.tsx` (`seedEditCotizacion`) |
| Reversa de recepción | `bll/services/com/RecepcionService.ts::reversar`, `bll/events/domainEvents.ts` (`RecepcionReversada`), `bll/compras/stateMachines.ts` (`ALIMENTADO_CXP → RECIBIDO`), `bll/compras/subscribers/{kardex,cxp}Subscriber.ts`, `presentation/routes/com/transaccional.ts` (`POST …/reversar`), `modules/compras/DocumentoList.tsx` (acción "Reversar CxP") |
| Pruebas | `backend/tests/devolucionAdjuntosYReversa.int.test.ts`, `backend/tests/adjuntosYCrud.int.test.ts` |

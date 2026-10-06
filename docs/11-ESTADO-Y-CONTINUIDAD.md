# Avance 11 — Coherencia de documentos, buscador real, orden "lo último primero" y resistencia del sistema

> Fecha: **2026-10-05**. Sin cambios de DDL (`SCRIPT_DDL.sql` es la fuente: de él
> se generan ahora los límites de validación).

---

## 0. Qué pidió el usuario y qué se encontró

| Pedido | Hallazgo verificado (no supuesto) |
|---|---|
| "No hay validaciones de fechas: si una orden es de tal fecha no se puede una menor" | Cierto. Ningún servicio validaba fechas: se podía crear una solicitud con fecha requerida de ayer, un RFQ vencido, una oferta ya caducada, una OC con entrega en el pasado, una factura anterior a la orden. Tampoco `cantidad <= 0`, porcentajes fuera de 0–100, líneas repetidas, ni devolver varias veces la misma mercadería. |
| "El concepto de resistencia es deplorable" | Cierto. `?page=abc` daba 500; cualquier texto como fecha de reporte daba ORA-01861/500; Oracle caído = 500 genérico; sin timeouts de pool/consulta; sin readiness; sin frenos al login masivo; el frontend se colgaba o mostraba "Failed to fetch". |
| "Los recuadros de búsqueda no sirven: no buscan, no filtran" | Cierto. Solo 3 documentos tenían buscador y cada uno buscaba en **una sola columna** (a menudo vacía: `numeroReferencia`, `justificacion`). RFQ, Cotizaciones y Recepciones no tenían buscador. Los encabezados "ordenaban" solo las 20 filas de la página. |
| "En la primera ventana de cada tabla, lo último que se realizó" | Cierto. Todo listaba por id **ascendente** (lo más viejo primero). Además los datetime se mostraban en hora UTC (un registro de las 16:26 aparecía 22:26). |

## 1. Orden: lo último primero

- `EntityDescriptor.defaultOrder` (+ `buildDescriptor`): documentos y catálogos
  listan **`pk desc`** por defecto; las líneas de detalle conservan su orden natural (`asc`).
- `ORDER BY … NULLS LAST, pk` — la PK de desempate hace **estable** la paginación
  (antes, filas con el mismo valor se repetían/omitían entre páginas).
- Orden por encabezado ahora **en el servidor** (`sort`/`order`, whitelist del
  descriptor): ordena todo el conjunto, no la página. Ciclo asc → desc → sin
  orden (vuelve a "lo último primero"). `aria-sort` accesible.
- Columnas de fecha ordenables y visibles: Creada (solicitudes), Emitido (RFQ),
  Registrada/Vence (cotizaciones), Entrega esperada (OC), etc.
- Fechas: `DATE`/día tecleado (medianoche UTC) se muestra tal cual; instantes
  (TIMESTAMP) en la hora local del usuario (`core/format.ts`).

## 2. Buscador global (`?q=`)

- `PageQuery.search` + `searchSql.ts` (DAL, función pura, probada sin BD).
- Cada **palabra** debe aparecer (AND) en **cualquier** campo de texto, fecha
  (`2026-10`, `05/10/2026`), estado, o **entidad relacionada** (proveedor de una
  OC, solicitante, bodega, líneas de la solicitud/OC: "martillo" encuentra la
  solicitud que lo pide). Configurado por documento en `SearchDescriptor`.
- Número de documento: `12`, `OC-12`, `SOL-12` → id exacto (no `LIKE`).
- Sin distinguir mayúsculas ni acentos; `%`/`_` son texto; "activo/inactivo"
  encuentran las banderas `A/I`, `S/N`; máx. 6 palabras / 100 caracteres.
- Todo con bind variables; identificadores solo de descriptor.
- UI: **todos** los documentos y catálogos tienen buscador; botón ✕ y `Esc`;
  contador "N resultados"; estado "Sin resultados para «…»" con salida;
  respuestas viejas descartadas (carrera al teclear rápido).
- Reportes y Cuentas por pagar (todas las filas ya cargadas): `localSearch` con
  las mismas reglas, en memoria.

## 3. Coherencia de fechas y cantidades (`bll/compras/reglasDocumentos.ts`)

Funciones puras, un único lugar. "Hoy" = **zona del negocio** (`APP_TIMEZONE`,
por defecto `America/Guatemala`), no UTC: con UTC una regla "no menor a hoy" falla
desde las 18:00 locales.

| Documento | Reglas nuevas |
|---|---|
| Solicitud | fecha requerida ≥ hoy y ≤ hoy+3 años, día real del calendario; cantidad > 0; prioridad 1–5; justificación 5–500; monto ≥ 0; ≤ 200 líneas |
| RFQ | solicitud **aprobada** (EN_COTIZACION); fecha límite ≥ hoy y ≤ última fecha requerida de la solicitud; proveedores activos; sin invitar dos veces |
| Cotización | RFQ abierto **y dentro de plazo**; proveedor **invitado**; una por proveedor/RFQ; vencimiento ≥ hoy; renglones de **esa** solicitud, sin repetir; precio/cantidad > 0; % 0–100; tasa > 0 |
| Orden de compra | entrega ≥ hoy y ≥ fecha de la solicitud origen (en edición, ≥ emisión de la OC); proveedor activo; oferta **adjudicada, del mismo proveedor y vigente**; cantidades/porcentajes/tasa; ofertas no repetidas |
| Recepción | cantidad rechazada ≥ 0; **línea repetida rechazada** (antes eludía el tope de pendiente) |
| Devolución | **acumulado**: lo ya devuelto cuenta contra lo recibido (antes se devolvía lo mismo N veces); motivo; líneas sin repetir |
| Cuentas por pagar | orden ≤ fecha documento/emisión ≤ hoy; documento ≤ fecha de pago ≤ hoy+90 d; monto > 0 con 2 decimales; longitudes DDL |
| Acuerdo marco | fin ≥ inicio; **sin solape** vigente del mismo proveedor/artículo; precio > 0 |
| Otros catálogos | correo/teléfono/días de crédito (proveedor), código ISO de moneda, días 0–365, resolución de excepción ≥ reporte (la fecha la estampa el sistema) |
| Reportes/historial | `desde`/`hasta` días reales y `desde ≤ hasta` (422); `hasta` **inclusivo** también en el historial |

Límites del DDL (longitud, `NUMBER(p,s)`, `CHECK`) generados por
`pnpm --filter backend gen:limits` → `ddlLimits.generated.ts`; los aplica
`validateAgainstDescriptor` a **todos** los CRUD (mensaje claro en vez de
ORA-12899/ORA-01438/ORA-02290). Se verificó contra el esquema vivo de Oracle: 0 diferencias.

Frontend: el mismo conjunto de reglas se ve al teclear (`minDate`, `maxDate`,
`minDateField`, `positive` en `FieldDef`): el selector de fecha no deja elegir el
pasado y muestra "No puede ser anterior al 05/10/2026".

## 4. Resistencia

Backend: errores de conectividad/Oracle → **503 reintentable** con `Retry-After`
(antes 500); deadlock/recurso ocupado → 409; formato de número/fecha → 422;
`page=abc` saneado; `requestId` en toda respuesta de error y cabecera
`x-request-id` (correlación con el log); 404 con el mismo sobre que el resto;
cabeceras de seguridad y `Cache-Control: no-store` en `/api`; pool con
`poolPingInterval`, `queueTimeout`, `callTimeout` (30 s) y caché de sentencias;
`GET /health/ready` (round-trip real a Oracle + estado del pool; `/health` sigue
siendo liveness); limitador de **login fallido por IP** (20/10 min → 429) sobre el
bloqueo por usuario existente; `unhandledRejection`/`uncaughtException`
registrados y cierre ordenado con vigilante de 15 s.

Frontend: `HttpClient` con **timeout 30 s**, **reintento automático solo de GET**
(502/503/504/corte de red, con espera creciente — nunca de POST/PUT), mensajes en
lenguaje claro (503, 429, timeout, sin conexión) y `ErrorBoundary` raíz (adiós
pantalla en blanco).

## 5. Verificación (real, contra Oracle y navegador)

| Suite | Resultado |
|---|---|
| Backend unitarias | 69/69 |
| Backend integración (Oracle real, incl. MinIO) | 210/210 (antes 171: +39 de reglas/búsqueda/orden) |
| Frontend (Vitest) | 35/35 (antes 29, con 3 pruebas obsoletas ya corregidas) |
| `tsc` backend y frontend | limpio |
| `scripts/qa-busqueda-orden.mjs` (Playwright, UI real) | 63/63 |
| `scripts/e2e-negocio-real.mjs` (ciclo completo, roles reales) | 91/91 |

## 6. Descubierto al levantar el sistema

- `OracleServiceORCL` estaba **detenido** (el listener respondía pero sin
  instancia): el backend arrancaba "bien" y fallaba en cada consulta. Se inició.
- MinIO no estaba levantado: 9 pruebas de adjuntos/PDF fallaban solo por eso.
- `e2e-negocio-real.mjs` generaba un NIT de 21 caracteres (columna de 20) y
  nombres fijos que chocaban entre corridas: ahora usa sufijo único por corrida.

## 7. Qué NO cambió

DDL, RBAC, permisos, usuarios demo, máquina de estados, flujo y diseño visual.

## 8. Pendientes honestos

- "Exportar" sigue exportando la **página actual** (no todo el resultado filtrado).
- Los límites de horizonte (3 años, pago a 90 días, RFQ ≤ última fecha requerida)
  son decisiones de negocio razonables, ajustables en `reglasDocumentos.ts` /
  `LiquidacionService.ts`.
- Varias réplicas del backend: el limitador de login está en memoria (un proceso).
- Las pruebas de integración escriben en la Oracle local; `pnpm db:seed:flujo`
  restablece los datos de demostración cuando se quiera.

---

# Adenda — Notificaciones en vivo de aprobación / rechazo (2026-10-05)

**Pedido:** que a un usuario le avisen en vivo cuando alguien aceptó o denegó su
solicitud, y validar que el flujo continúe y la data llegue completa.

## Qué se hizo
- **Canal en vivo (SSE)** `GET /api/com/notificaciones/stream`: `LiveHub` (Capa 6) +
  `notificacionesSubscriber` (reacciona a `SolicitudAprobada/Rechazada`, ya
  publicados **después del commit**). Dos mensajes: `decision` (solo al dueño de la
  solicitud: quién, qué sigue, motivo) y `bandeja` (a todos: refrescar campana; el
  cliente avisa "SOL-12 espera tu acción" solo si está en SU bandeja, que ya viene
  acotada por rol/equipo). Latido 25 s; nginx con `proxy_buffering off`.
- **Persistente:** `GET /api/com/notificaciones/decisiones` (últimos 14 días) se
  deriva del historial de aprobación, sin tabla nueva: quien estaba desconectado
  las ve al entrar. La campana muestra "Respuestas a tus solicitudes" + no leídas.
- **Frontend:** `LiveConnection` (fetch + reconexión 1→15 s, reinicia al volver la
  pestaña/red), `LiveNotifier` (toast verde "aprobó… · ahora espera al gerente" /
  rojo "rechazó… — Motivo: …"), las listas de solicitudes se actualizan solas.
- **Flujo (reglas nuevas):** rechazar **exige motivo** (≥3 caracteres, API y UI); la
  decisión se registra **a nombre de quien la toma** (403 si el `idEmpleado` no es
  el de la sesión); no se aprueba dos veces ni se salta de nivel; tras rechazar no
  se puede aprobar ni crear RFQ.
- Columna `#` sin separador de miles (`1,016` se truncaba a `1,0…`).

## Verificación
| | |
|---|---|
| `aprobacionEnVivo.int.test.ts` (9): jefe→gerente→RFQ, ajuste de cantidad, historial, rechazo con/sin motivo, suplantación, aislamiento del aviso | ✅ |
| Backend integración | 219/219 · unitarias 69/69 · frontend 37/37 |
| `scripts/qa-notificaciones-en-vivo.mjs` (2 navegadores reales: el aviso llega en ~2 s sin recargar) | 8/8 |
| E2E de negocio con roles reales | 91/91 |

---

# Adenda — Listas desplegables con buscador dedicado (2026-10-05)

Todo `<select>` del sistema (formularios de documentos y de catálogos, líneas de
documento, panel "Filtrar" de las tablas) usa ahora `ui/SearchSelect.tsx`: al
desplegar la lista aparece **dentro del panel** un cuadro de búsqueda ya enfocado
(todas las palabras, sin mayúsculas ni acentos, contador "N de M", "Sin
resultados"). Teclado: ↑ ↓ Inicio Fin, Enter elige, Esc cierra (sin cerrar el
modal), Tab. Panel en portal con posición fija (no lo recortan modales ni
tablas) y abre hacia arriba si no hay espacio. Opcionales traen "quitar
selección". Accesible (`combobox`/`listbox`, `aria-activedescendant`).
Verificación: 7 pruebas unitarias nuevas (frontend 44/44) y
`scripts/qa-listas-con-buscador.mjs` 12/12 en navegador real (modal, filtros y catálogos).

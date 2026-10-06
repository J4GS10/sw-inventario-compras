# Auditoría del frontend (UX/UI, responsive, proporción áurea) y resiliencia de almacenamiento — 2026-10-06

## 1. MinIO ("sin conexión, no deja cargar")
- **Causa:** MinIO es un proceso aparte y solo lo arrancaba `iniciar-sistema.bat`; si no estaba corriendo, el cliente S3
  reintentaba ~30 s y respondía "error interno". Con el bucket inexistente fallaba igual.
- **Corrección:** cliente S3 único con *timeouts* (2,5 s conexión) y 2 intentos; el bucket se **crea solo** si falta; los fallos
  se traducen a **503 con mensaje claro** ("El almacenamiento de archivos (MinIO) no está disponible. Inícialo con `pnpm minio`…",
  respuesta en ~70 ms); `/health/ready` informa `storage: up|down` (el sistema sigue operando, degradado);
  `pnpm dev` ahora **inicia MinIO** (desacoplado de la terminal) y levanta backend + frontend.
- Verificado: con MinIO apagado → 503 inmediato; al encenderlo → la subida funciona sin reiniciar nada.

## 2. Idempotencia
- **Servidor** (`Idempotency-Key`, `presentation/middlewares/idempotency.ts`): misma clave + mismo cuerpo ⇒ se repite la
  respuesta original sin re-ejecutar; en curso ⇒ la 2.ª espera a la 1.ª; otro cuerpo ⇒ 422; solo se recuerdan los 2xx;
  alcance por sesión; TTL 10 min.
- **Cliente** (`HttpClient`): *single-flight* (el doble clic no envía dos) + clave automática que se **reutiliza si el resultado
  es incierto** (corte, timeout, 5xx) y se descarta en un desenlace definitivo.
- `scripts/pentest/idempotencia.mjs`: 10/10 (10 peticiones simultáneas ⇒ 1 documento; PUT repetido ⇒ 3×200; etc.).
  Además, las operaciones críticas ya eran seguras por bloqueo de filas (doc. 12).

## 3. Evaluación del frontend (antes → ahora)
| Criterio | Antes | Ahora |
|---|---|---|
| Profesional / consistente | Sólido: tokens de color, Material/Fluent, tablas con sticky/scroll, estados vacíos, toasts, ErrorBoundary | igual + resumen lateral, fechas legibles |
| Responsive | **Bueno**: sidebar → menú, tablas → tarjetas <560 px, columnas secundarias colapsables, modal a pantalla | + resumen móvil compacto; Dashboard sin desbordes |
| Proporción áurea | No aplicada (rejilla de campos arbitraria) | Formulario **1,618 : 1** (61,8 % captura / 38,2 % resumen fijo), espaciado de **Fibonacci** (5·8·13·21·34·55 px, `--sp-*`), tokens `--phi` |
| Carga de datos | Todo manual: 7–10 campos vacíos por documento | El sistema completa lo que ya sabe (ver §4) |
| Foco en lo importante | Formulario plano, sin feedback de avance | Panel "Resumen": qué se crea, lo decidido, total estimado, **barra de avance** y lista de lo que falta |
| Campos secundarios | Siempre visibles | Colapsados en "+ Más datos (opcional)" |
| Selección en listas | `<select>` nativo | Lista con buscador dedicado |

Defecto encontrado y corregido en la auditoría: los controles se salían de su celda cuando la etiqueta era larga
(`grid` sin `minmax(0,1fr)`), fechas del resumen en formato técnico, filas del Dashboard desbordadas en móvil.

## 4. Autocompletado — el usuario no reescribe lo que el sistema ya tiene
`FormFieldDef` ahora admite `defaultValue`, `defaultDays`, `remember`, `advanced`, `fillOnSelect`; `DocumentFormConfig.seedLines`.
| Documento | Lo que ya viene hecho |
|---|---|
| Solicitud | Sucursal (de su empleado), prioridad Normal, fecha requerida +14 d, cantidad 1; **al elegir el artículo se llenan descripción y unidad**; grupo/término/centro/unidad **recordados** de la última vez; centro de costo y monto en "opcional" |
| RFQ | Fecha límite +5 d y **los 3 proveedores habituales ya invitados** al elegir la solicitud |
| Cotización | Al elegir el RFQ, **un renglón por artículo pedido** (cantidad y unidad incluidas): solo se teclean precios; tasa 1, IVA 12 %, vencimiento +15 d, moneda y condición recordadas |
| Orden de compra | Entrega +14 d; proveedor/moneda/tasa/precio desde la cotización adjudicada (ya existía) |
| Recepción | Bodega recordada; guiada con renglones pendientes (ya existía) |
| Devolución | Al elegir la recepción, sus renglones ya vienen cargados: solo se indica cuánto devolver |
| Catálogos | Estado = Activo, activa/activo = sí, días de crédito 0 |
Además: si una lista obligatoria tiene **una sola opción**, queda elegida; nunca se pisa lo que el usuario escribió.

## 5. Pendiente / recomendaciones
- El selector de fecha del navegador sigue el idioma del sistema operativo (mm/dd/aaaa en en-US).
- Barra de acciones fija inferior en móvil y atajos de teclado por formulario (Ctrl+Enter para registrar) serían el siguiente paso.
- Los valores "recordados" viven en el navegador del usuario (por usuario y formulario).

---

## Adenda — Lote UI/UX completo y ortografía (2026-10)

**Implementado:** tipografía/densidad de tablas, chips de estado con icono, atajos de fecha, hoja inferior y botón flotante en móvil, héroe del Dashboard con cola de trabajo, accesibilidad (foco, movimiento reducido, "saltar al contenido"), siguiente paso guiado, clic en fila, acciones masivas y "exportar todo", urgencia por antigüedad, línea de tiempo (`GET /api/com/solicitudes/:id/trazabilidad`, filtrada por permisos), borradores y "Deshacer", errores del servidor sobre el campo, vistas guardadas, atajos de teclado, indicador de conexión/guardado, primeros pasos por rol.

**Cerrados en la segunda pasada:**
- **Tendencias (UI7):** las tarjetas KPI del Dashboard muestran "▲/▼/＝ N nuevos · 7 días" frente a los 7 días anteriores (solicitudes, cotizaciones, órdenes, recepciones; solo lo que el rol puede ver).
- **Recibir todo conforme:** en la Recepción guiada, tras marcar la declaración *"Conté físicamente cada renglón y todo coincide con lo ordenado"*, el botón rellena lo pendiente **sin mostrar cantidades** (el conteo sigue ciego). Cada línea puede volver a "Contar manualmente". El backend sigue validando contra lo pendiente.
- **Ortografía en toda la aplicación (frontend, mensajes del backend, PDF, semillas SQL y datos ya cargados):**
  - `scripts/tildes.mjs` (barrido; `--dry`, `--tests`), `tildes-lib.mjs` (localiza solo texto visible: cadenas, plantillas y JSX; ignora identificadores, rutas, SQL, claves y valores de datos), `tildes-diccionario.mjs` + `tildes-contextuales.mjs` (palabras ambiguas solo en construcciones inequívocas: *está*, *se registró*, *¿qué…?*, *para qué sirve*), `tildes-sql.mjs` (semillas `database/dml`) y `backend/scripts/tildes-db.ts` (actualiza la BD ya cargada con coincidencia exacta).
  - `scripts/gen-acentos.mjs` genera `backend/src/common/util/acentos.generated.ts` (una sola fuente de verdad) para acentuar textos **derivados de nombres de campo** en tiempo de ejecución (`etiquetaDe`).
  - Guardia permanente: `backend/tests/ortografia.test.ts` falla si queda una palabra del diccionario sin tilde en un texto visible. Si falla: `node scripts/tildes.mjs frontend/src backend/src`.
  - Importe en letras del PDF: DIECISÉIS, VEINTIDÓS, VEINTITRÉS, VEINTISÉIS, VEINTIÚN, MILLÓN.
  - Verificado además con un diccionario Hunspell español (`nspell`/`dictionary-es`) sobre todas las palabras visibles: no queda ninguna palabra que exija tilde y no la tenga (salvo identificadores).
- Scripts QA actualizados a las etiquetas con tilde; `qa-recepcion-conforme.mjs` cubre la recepción conforme y las tendencias.

---

## Adenda — Tablas limpias y mejoras de flujo (2026-10-06)

- **Sin superposiciones:** la columna de acciones mide 192 px con botón principal (104 px en contenedor angosto: solo icono) y 60 px sin él; queda fija a la derecha (`sticky`) si hay scroll. `scripts/qa-tablas-sin-solapes.mjs` valida 9 pantallas en 3 anchos.
- **Solo lo importante en la tabla:** las columnas `secondary` van siempre en el «+» de cada fila. Cada usuario puede elegir sus columnas («Columnas», se recuerda en `erp.cols.<tabla>`).
- **Detalle sin redundancia:** se quitó la acción duplicada «Historial de aprobación»; el renglón muestra un solo dato; el recorrido se oculta si solo dice «creada»; prioridad/monto con el mismo texto que la lista; sugerencia de adjuntos según el documento.
- **Panel lateral de detalle** (`ui/Drawer.tsx`): 480 px de ancho; la lista queda visible a su izquierda desde 1180 px (en menos, el panel la atenúa), ↑/↓ navega, Esc cierra, «N de M».
- **Aprobar/Rechazar desde el panel** y pasa al siguiente pendiente de tu lista.
- **PDF de la solicitud** (`GET /api/com/solicitudes/:id/pdf`, respeta alcance y permisos) + PDF de la nota de ingreso desde el panel.
- **Conteos reales** en los filtros rápidos; se eliminaron las tarjetas «(en esta página)».
- **Orden por urgencia:** «Espera / Plazo / Entrega» ordenan por su fecha (`Column.sortKey`).
- **Resaltado** de la fila creada/editada; **estados vacíos con acción**; **sugerencia de búsqueda** («Probar con…»).
- **Formularios:** resumen de errores del servidor con salto a la línea afectada.
- **Referencias huérfanas:** un id que no vino en la carga inicial se resuelve bajo demanda; si no existe se muestra «Proveedor #337 (no disponible)».
- QA: `scripts/qa-panel-detalle.mjs`.

---

## Adenda — Menú de acciones, panel y columnas (2026-10-06, cierre)

- **Menú «Más opciones» en portal** (`DataTable.RowActions`): se dibuja fuera de la tabla (`position: fixed`), así el scroll y la columna fija no lo recortan; se abre hacia arriba si no cabe, no se sale de pantalla, se cierra al hacer scroll/redimensionar; teclado (foco a la primera opción, ↑/↓, Esc devuelve el foco, Tab cierra); separador antes de las acciones destructivas.
- **Panel lateral:** un clic fuera lo cierra (no cuentan el propio panel, filas de la tabla —cambian de documento—, modales, menús, listas y avisos `data-toast`). En <1180 px un fondo atenuado cubre la lista.
- **Muchas columnas:** botón «Más columnas ›» / «‹» (`.table-scroll-hint`); la acción principal pasa a solo icono cuando la tabla no cabe; la columna que crece cede hasta 96 px; la columna de acciones es `sticky`.
- **Plantillas de etiqueta (`labelTpl`):** los marcadores `{campo}` NO llevan tilde (si no, se muestran literales: «SOL-1400 · {justificación}»). `tildes-acentuar.mjs` ya no toca nada dentro de `{ }`; guardia en `backend/tests/ortografia.test.ts`.
- **QA nuevos/actualizados:** `qa-panel-detalle.mjs` (17), `qa-menu-acciones.mjs` (40), `qa-tablas-sin-solapes.mjs` (27), `qa-recepcion-conforme.mjs` (8). Backend: unitarias 72+, integración 219+ (incl. PDF de solicitud).

### Pendientes / ideas
Clic derecho en fila como menú contextual; atajos de una tecla en el menú (A aprobar, R rechazar); deshacer para Rechazar/Eliminar de documentos; menú como hoja inferior en móvil; contador en las pestañas «Pendientes de mi nivel / De otro nivel».

---

## Adenda — Paginación siempre visible, avisos inmediatos y continuidad (2026-10-06)

- **Tabla (total/paginación fuera de pantalla):** no era la resolución sino el diseño: el alto del cuerpo era `min(64vh, 100dvh − 270px)`, un descuento fijo que ignoraba lo que hay sobre la tabla (título, flujo, filtros, barra de herramientas). En pantallas bajas o con escala de Windows >100 % la pantalla desbordaba y había que desplazar para ver «Pág. N / M · total». Ahora `useAltoDisponible` (`ui/DataTable.tsx`) **mide** el espacio real de `<main>` y la paginación es `sticky` al pie del área visible (la tarjeta usa `overflow: clip` para que el `sticky` funcione). `maxBodyHeight` explícito sigue mandando.
- **Avisos inmediatos:** `Field` marca el error desde que hay algo escrito/elegido (antes: solo al salir del campo o al registrar); un obligatorio vacío sigue marcándose al salir. Nuevo `FieldDef.limitFrom` (+ `limiteError`): tope tomado de la fila elegida (Devolución: no más de lo recibido), también en el resumen «faltan» y al registrar.
- **Continuidad:** el borrador de documentos se guarda además al instante en `pagehide`/`visibilitychange`; los catálogos (alta) ahora tienen borrador (7 días, recuperable con «Empezar de nuevo»); la app recuerda **la última pantalla** por usuario (`erp.pantalla.<id>`).
- **Pendiente (decisión):** validar reglas que dependen del servidor (proveedor no invitado, artículo ajeno al RFQ…) *mientras se escribe* exigiría un «ensayo» (ejecutar y revertir). Cada ensayo consumiría un folio de la columna `IDENTITY`, dejando huecos en SOL-/OC-; por eso hoy esas reglas se muestran sobre el campo al registrar (el formulario conserva todo).

---

## Adenda — Borradores en el servidor y PDF formal (2026-10-06)

- **Borradores entre equipos:** tabla nueva `SEG_BORRADOR_USUARIO` (DDL: 103 tablas; migración idempotente en `scripts/deploy.ts`, `ensureBorradores`). API `GET|PUT|DELETE /api/borradores` (solo del usuario en sesión; JSON ≤200 KB, ≤100 por usuario, no pisa un guardado más reciente). Cliente: `core/borradores.ts` guarda local al instante y en el servidor a los 1,5 s (y con `keepalive` al cerrar); `sincronizarBorradores` corre al entrar, al volver a la pestaña y al recuperar la red: gana la edición más reciente, lo que se registró/descartó en otro equipo se retira de éste. Pruebas: `borradores.int.test.ts` (6) y `borradores.test.ts` (6).
- **PDF formal** (`common/pdf/PdfBuilder.ts`, referencia `pdf/factura.pdf`): monocromo, título centrado, «Emisor:» a la izquierda y número/fechas/estado a la derecha, regla negra, tablas con cuadrícula gris sin rellenos, totales con filetes, pie con «Página N de M» al centro y la empresa a la derecha. Todos los PDF (OC, solicitud, recepción, comparativo, reportes) lo heredan.

---

## Adenda — Agilidad, validación en vivo, delegación y resistencia (2026-10-06)

**Menos trabajo para el usuario**
- **Duplicar solicitud** (acción «Duplicar», tecla U): abre una solicitud nueva con los mismos datos y renglones. *Órdenes de compra no se duplican a propósito:* exigen una oferta adjudicada de su solicitud, así que una OC «copiada» no sería válida; se repite la solicitud.
- **Reabastecer todo en una sola solicitud** (alertas de escasez): `POST /api/com/ref/articulos/bajo-minimo/vincular` liga las alertas con la solicitud creada y dejan de ofrecerse (mientras no sea rechazada).
- **Adjudicar al mejor precio** (Comparativo): adjudica de un clic cada renglón pendiente a su oferta de menor precio neto (con confirmación que lista cada elección). Criterio actual: solo precio.
- **Recepción:** lector de código de barras (teclado + Enter; `CODIGO*12` cuenta 12); un código ajeno a la orden se avisa al instante; el conteo sigue ciego. **Pegar de Excel** en los renglones de cualquier documento (`parsearPegado`: con o sin encabezados, reconoce artículo por nombre/código, números es/en, fechas dd/mm/aaaa; avisa lo que no entiende).
- **Cuentas por pagar:** el pago se propone en la fecha de vencimiento (o hoy si ya venció), con la forma de pago y el banco de la última liquidación; aviso inmediato si el monto difiere del calculado por la recepción.
- **Pestañas con conteo** («Pendientes de mi nivel · N / De otro nivel · M»); **atajos de una tecla** en el menú de fila (A aprobar, R rechazar, E editar, D detalle, U duplicar, X eliminar); **clic derecho** en la fila abre el menú; en móvil el menú es una hoja inferior; **Rechazar con «Deshacer»** (6 s; el solicitante no recibe el aviso hasta que se confirma).

**Validación en vivo con reglas del servidor (sin quemar folios)**
- Cabecera `X-Solo-Validar: 1` en el POST de creación: el servicio ejecuta *todas* sus validaciones (plazos, proveedor invitado, topes, vigencias…) y, justo antes de escribir, lanza `SoloValidacionExitosa`: se revierte sin insertar nada y responde `200 {valido:true}`; un documento inválido devuelve su 422/409 de siempre. Cubre solicitud, RFQ, cotización, OC, recepción y devolución. `DocumentForm` lo consulta (900 ms tras dejar de teclear, solo con el formulario completo) y muestra el aviso del sistema y el campo afectado antes de registrar. Prueba: `soloValidar.int.test.ts`.

**Delegación de aprobaciones** (`SEG_DELEGACION_APROBACION`, 105 tablas en la BD; migración en `deploy.ts`)
- Un jefe/gerente delega a otra persona hasta 60 días (sin traslape, no a sí mismo); revocable. El delegado ve y decide con el alcance del delegante **solo mientras está vigente** (se consulta la base en cada decisión: revocar corta al instante); la decisión queda a nombre de quien la toma con la nota «[por delegación de X]»; no puede decidir sobre su propia solicitud. La interfaz lo refleja (la sesión se refresca sola cada minuto). Pantalla: menú de usuario → «Delegar mis aprobaciones». Prueba: `delegacion.int.test.ts` (6).

**Resistencia**
- **Cola de envíos sin conexión** (`core/outbox.ts`): si al registrar se cae la red/servidor, el envío queda guardado con su Idempotency-Key propia y sale solo al volver (en orden; indicador «N por enviar»); un rechazo de negocio sale de la cola con su motivo. `HttpClient.postConClave`.
- **Aviso de salud** (`/api/salud` + `ui/AvisoSalud`): banda clara si la base de datos o el almacenamiento de archivos están caídos, o si no se alcanza el servidor.

**QA nuevos:** `scripts/qa-paginacion-visible.mjs` (11 — el pie «Pag. N / M» queda dentro de la pantalla a 900, 768 y 600 px de alto), `scripts/qa-agilidad.mjs` (5). Suites: backend unitarias 73, integración 235 (con Oracle y MinIO reales), frontend 59.

---

## Adenda — Servidor oficial, pruebas únicas y funciones restantes (2026-10-06)

**Servidor oficial = `pnpm oficial`** (`scripts/oficial.mjs`): migra el esquema (idempotente), compila backend y frontend y los levanta en **modo producción** contra **tu Oracle local** (`.env`) y el MinIO local: backend `node dist/src/server.js` con `NODE_ENV=production` (:3000) y frontend compilado servido con proxy `/api` (:8443, `vite preview`, equivalente al nginx de la imagen Docker). Sin recarga en caliente, sin atajo `X-Dev-User`, sin perfiles demo (se entra con usuario y contraseña), `JWT_SECRET` obligatorio. `pnpm oficial status|stop`. Logs en `.oficial/`.
- *Docker:* el `docker-compose.yml` es el mismo despliegue en contenedores, pero trae **su propio Oracle** (gvenzl 23 Free), no el local, y Docker no está instalado en este equipo. Se corrigió además el comando de arranque de la imagen (`dist/src/server.js`; antes apuntaba a un archivo inexistente).
- **Todas las pruebas se corren contra ese servidor:** `pnpm qa:oficial` (`scripts/qa-oficial.mjs`) se niega a ejecutarse si lo que responde no es producción y corre 17 suites: negocio extremo a extremo (91), matriz de roles (968), funciones nuevas (29: borradores, solo-validar, delegación, idempotencia, sugerida, escasez, PDF, MinIO), seguridad (idempotencia 10, concurrencia 16, OWASP 166 + 1 advertencia) y 10 de interfaz real con Playwright (entran por la pantalla de acceso, `scripts/qa-lib.mjs`). Las pruebas `vitest` en proceso (`backend/tests`, `frontend`) siguen existiendo como apoyo de desarrollo, pero ya no son la referencia.

**Defecto previo corregido (hallado al correr en producción):** los hooks `onSend` eran `async`, lo que hacía que cada handler que llama `reply.send()` sin `return` enviara la respuesta dos veces internamente («Cannot write headers after they are sent»), dejando miles de falsos 500 en el log. Ahora son síncronos (`app.ts`, `idempotency.ts`). También la pantalla de acceso ya no pide `/api/auth/usuarios-demo` en producción (daba 404 en cada carga).

**Funciones restantes**
- **Adjudicación sugerida ponderada** (`bll/compras/adjudicacionSugerida.ts`, `GET /api/com/comparativo/solicitud/:id/sugerencia`): puntaje = 60 % precio + 25 % confiabilidad histórica del proveedor (el score del reporte de riesgo: plazo real de entrega, rechazo y calificación; sin historial = neutral) + 15 % días de crédito; nunca sugiere una oferta con más de 15 % sobre la más barata. El botón «Adjudicar lo sugerido» muestra el puntaje y el motivo de cada elección.
- **Repetir compra** (acción en Órdenes de compra, tecla U): abre una **solicitud** nueva con los artículos y cantidades de la orden (grupo/término/centro tomados de la solicitud origen); recorre el flujo normal. La OC no se copia porque exige una oferta adjudicada.
- Limitación que persiste: el selector de fecha nativo muestra el formato del idioma del sistema operativo/navegador (el sitio no puede cambiarlo); las fechas del sistema se muestran dd/mm/aaaa.
- **Aviso de seguridad (único WARN de OWASP):** `.env` usa credenciales por defecto (DB y MinIO `minioadmin`): cambiarlas antes de exponer el sistema fuera de este equipo.

---

## Adenda — Interfaz más limpia (lote 1, 2026-10-06)
- **Barra lateral:** módulos «Próximo» plegados en un solo renglón «Próximamente» (sin el «Cuentas por Pagar» duplicado); secciones en acordeón (una abierta, la de la pantalla activa).
- **Listas:** la acción principal de cada fila (`RowAction.alPasar`) solo aparece al pasar el cursor o enfocar la fila (siempre visible en táctil); sigue en el menú y con su atajo.
- **Flujo de ciclo** en una línea fina, sin tarjeta. **Dashboard:** se quitó el bloque duplicado de aprobaciones; «Primeros pasos» plegado por omisión (se abre a pedido y se recuerda).
- **Textos:** «Página 1 de 27 · 533 registros»; montos vacíos como «Sin monto».
- Verificado en el servidor oficial: 11/11 suites de interfaz.

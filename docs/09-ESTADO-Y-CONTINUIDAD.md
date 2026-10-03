# Avance 09 — Reportería profesional, ayuda contextual y rediseño (y reversión) del RBAC del módulo

> Reporte de avance sobre `docs/01-ESTADO-Y-CONTINUIDAD.md` (documento vivo,
> ya actualizado con el estado final — este archivo es el registro narrativo
> de **cómo** se llegó a ese estado en esta sesión, con el razonamiento y las
> idas y vueltas). Fecha: **2026-09-11**. Sin cambios de DDL.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| Validación de que el sistema corre de verdad (no solo compila) | ✅ |
| Gap analysis del flujo + corrección de validaciones/reportería reales | ✅ |
| Módulo de reportería con PDFs profesionales (`PdfBuilder` extendido) + apartado dedicado "Reportes" en el menú | ✅ |
| Auditoría de CRUD completa del módulo (2 bugs reales de gating corregidos) | ✅ |
| Infraestructura de QA real con Playwright (`pnpm qa:roles`, 21 pantallas × 8 roles) | ✅ — 0 errores en 168 checks (estado final) |
| Sistema de ayuda contextual no invasiva, en las 21 pantallas | ✅ |
| Rediseño de RBAC "de solo lectura para supervisión" (`TRAZABILIDAD_VER` → 5 `*_VER`) | ⚠️ implementado y luego **revertido** a pedido del usuario |
| Reversión total a "manage = ve, si no, nada" | ✅ — es el estado final vigente |
| Bug de arquitectura descubierto y corregido: fetch de opciones de formulario en el montaje, no en la apertura del modal | ✅ |
| `graphify update .` + `tsc` backend y frontend | ✅ verdes |

**Estado final del módulo tras esta sesión**: sin pendientes de alcance. La
fuente de verdad detallada por bloque está en `docs/01-ESTADO-Y-CONTINUIDAD.md`
§5 (bloques `5.-27` a `5.-33`).

---

## 1. Cómo se llegó aquí (cronología de la sesión)

1. **Verificación de que el sistema corre** — backend (`:3000`, Fastify +
   oracledb) y frontend (`:8443`, React 19/Vite 6) levantados con `pnpm dev`,
   login real confirmado con varios usuarios demo contra Oracle 21c local.

2. **"¿Qué falta para completar el flujo lógico, validaciones, flujos,
   reportería?"** — gap analysis. Único bug de validación real encontrado:
   `RecepcionService` no topaba lo ya recibido+rechazado contra lo ordenado
   (sobre-recepción sin límite). Corregido y expuesto en el frontend (el
   selector de renglón de Recepción ahora muestra el pendiente real). Se pidió
   además que la reportería completa se implementara con **PDF profesional**
   → se extendió `PdfBuilder` (Builder pattern sobre `pdfkit`) con `kpiBand()`
   y `barChart()`, y se generó el PDF de Orden de Compra que faltaba (el
   documento real que se le manda al proveedor).

3. **Apartado dedicado "Reportes" + auditoría CRUD más profunda** — nueva
   sección de navegación. La auditoría encontró **2 bugs reales de gating**:
   Editar/Eliminar de Cotizaciones y Eliminar de RFQ se ofrecían en el
   frontend sin comprobar el cerrojo real que ya validaba el backend (RFQ
   abierto sin cotizaciones, línea sin adjudicar). Corregidos.

4. **"¿Por qué el administrador ve módulos que el gerente no, si el gerente
   es quien debería ver la trazabilidad de todo?"** — primera vez que el
   usuario cuestiona el modelo de visibilidad por rol. Tras presentar
   opciones, se decidió dar a Gerente de área + Gerente financiero + Auditor
   lectura de trazabilidad del ciclo completo. Primer intento (reutilizar
   `ANALISIS_VER` como guardia) fue **incorrecto**: `ANALISIS_VER` también lo
   tienen Solicitante/Jefe, que habrían ganado acceso de más — detectado por
   el propio test suite antes de llegar a producción. Se corrigió con un
   permiso dedicado nuevo, `TRAZABILIDAD_VER`.

5. **Auditor reporta un error real al abrir Recepciones** — investigado con
   una sesión de QA real: se instaló Playwright + Chromium
   (`scripts/qa-roles-smoke.mjs`, `pnpm qa:roles`), que abre sesión fresca por
   cada uno de los 8 usuarios demo (sin arrastrar `localStorage`) y navega las
   21 pantallas del menú vía Command Palette (Ctrl+K), detectando 401/403/5xx
   y errores de consola. El caso reportado resultó ser un **JWT viejo** (los
   permisos se hornean en el JWT al iniciar sesión, no se resuelven por
   request) — no un bug; confirmado con la primera corrida en verde salvo un
   bug real distinto: **claves de React duplicadas** en "Historial de
   precios" cuando dos compras históricas coinciden en fecha+artículo+
   proveedor+precio. Corregido.

6. **"¿Por qué se ve ese historial de precios? Necesito ayudas no
   invasivas"** — se explicó la lógica de `VW_COM_PRECIO_HISTORIAL` y se
   añadieron columnas de trazabilidad real (Orden/Recepción de origen),
   reescribiendo la consulta para unir las tablas base directamente (sin
   tocar el DDL, que está congelado). Se construyó `HelpTip`, un botón "?"
   opcional cableado a `PageHeader` — el usuario confirmó que el diseño
   opt-in (nada se abre solo) era el correcto, y se pidió generalizarlo a las
   21 pantallas del módulo. `qa:roles` se extendió para abrir/cerrar cada
   ayuda visible y confirmar que no dispara red ni errores.

7. **"No me agrada el botón de ? ni cómo se ve la ayuda, debe ser
   profesional. Tampoco entiendo por qué algunos roles ven cosas que no
   deberían"** — doble pedido:
   - Rediseño visual de `HelpTip`: de icono circular a botón tipo píldora
     ("Ayuda" + icono), modal con encabezado compuesto (badge de color + texto,
     título ahora acepta `React.ReactNode`) y pie con botón "Entendido".
   - Segunda vuelta a la pregunta de RBAC → esta vez se resolvió en **Plan
     Mode** formal: *"dime tú, en un sistema realmente profesional, cómo
     debería quedar. Analiza, comprende el DDL, comprende la lógica de
     negocio y plantea cómo debe quedar"*. El plan (`hidden-doodling-creek.md`)
     encontró **dos problemas de diseño reales**, no solo el permiso-paraguas:
     (a) lectura y escritura mezcladas en un único permiso `*_GESTIONAR` por
     recurso, y (b) `COM_WORKFLOW_APROBACION`/`COM_COMPARATIVO_COTIZACIONES`
     (tablas de auditoría del propio flujo) editables vía CRUD genérico por
     una cuenta operativa (Comprador, vía `CATALOGO_ADMIN`) sin ningún camino
     de escritura legítimo fuera de las transacciones de negocio que ya las
     alimentan. Se implementó: 5 permisos `*_VER` (uno por recurso, mismo
     patrón que `SOLICITUD_VER`) reemplazando `TRAZABILIDAD_VER`; las 2 tablas
     de auditoría pasaron a **solo lectura para absolutamente todos**,
     incluido Admin (`registerReadOnlyCrudRoutes`, nuevo helper que solo
     registra `GET`); `CATALOGO_ADMIN` (monedas) se movió de Comprador a
     Gerente financiero (función de Finanzas, no de Compras).

8. **"Pero mi [...] pregunta es, ¿por qué tiene que ver alguien con un rol a
   algo que no tiene acceso, si no puede editarlo o manipularlo, para qué lo
   ve?"** — el usuario rechaza de raíz el concepto mismo de "lectura de
   supervisión" recién implementado, sin importar qué tan bien diseñado
   estuviera el permiso. Se presentaron 4 opciones vía `AskUserQuestion`
   (mantener, acotar más, documentar mejor, o **quitarlo del todo**). El
   usuario eligió sin ambigüedad: **"Quitar toda lectura sin escritura"**.

9. **Reversión completa** (bloque `5.-33` del documento vivo) — se estableció
   el principio rector definitivo: **un rol solo ve un recurso si también
   puede gestionarlo/accionarlo**, con únicamente dos excepciones
   preexistentes y deliberadas (`SOLICITUD_VER`, universal para que cualquiera
   sepa si le toca actuar; `ANALISIS_VER`, que gatea vistas agregadas —
   Dashboard/Comparativo/Historial/Reportes — no documentos crudos). Se
   eliminaron los 5 `*_VER` y no se reintrodujo `TRAZABILIDAD_VER` — catálogo
   vuelve a 14 permisos. Al revertir apareció una dependencia funcional real
   de Bodega (su formulario de Recepción elegía la OC desde el listado
   general, que ya no podía ver) — resuelta correctamente con un endpoint de
   referencia acotado, `GET /api/com/ref/oc/receptibles`, gateado por
   `RECEPCION_GESTIONAR` (el permiso que Bodega sí tiene para actuar). También
   se encontró, en la corrida final de `qa:roles`, un bug de arquitectura
   expuesto (no causado) por el endurecimiento: `DocumentForm`/`CrudPage`
   pedían las opciones del formulario (`useOptions`) apenas se montaba la
   pantalla, no cuando se abría el modal de alta — corregido gateando ambos
   con `open ? campos : []`.

---

## 2. Estado final verificado

- Catálogo de permisos: **14** (sin `*_VER`, sin `TRAZABILIDAD_VER`).
- Matriz de roles: ver `docs/flujo-y-roles-compras.md` (tabla de roles y
  tabla "qué ve cada rol en el menú", ambas reescritas al modelo estricto).
- `pnpm qa:roles`: **0 errores en 168 checks** — Gerente de área/Jefe/Auditor
  muestran "–" en Órdenes de compra/RFQ/Cotizaciones/Recepciones/
  Devoluciones; Comprador solo ve lo que gestiona; Bodega solo ve
  Recepciones/Devoluciones (ya no Órdenes de compra como documento, pero sí
  puede elegir una OC dentro de su propio formulario de Recepción).
- Verificado end-to-end por HTTP con login fresco: Bodega crea una Recepción
  real usando `/api/com/ref/oc/receptibles` (`idRecepcion=243` en la prueba).
- `tsc` backend y frontend: verdes. `graphify update .` corrido (2031 nodos,
  4466 aristas, 118 comunidades).
- Única falla conocida, preexistente y no relacionada con esta sesión:
  `alcanceDepartamento.int.test.ts > COMPRADOR (rol transversal) ve ambas`
  (acumulación de datos de pruebas repetidas contra la misma Oracle viva,
  `pageSize=200` fijo). No se toca sin pedido explícito.

## 3. Qué NO cambió (deliberadamente, y sigue vigente)

- `COM_WORKFLOW_APROBACION` y `COM_COMPARATIVO_COTIZACIONES` siguen sin
  ninguna ruta de escritura vía API para nadie (ni con el comodín `*` de
  Admin) — esto es ortogonal al reclamo del usuario (era sobre visibilidad
  de rol, no sobre integridad de las tablas de auditoría) y se mantiene.
- `CATALOGO_ADMIN` (monedas) sigue en Gerente financiero, no en Comprador.
- El sistema de ayuda contextual (`HelpTip`, opt-in, rediseño "píldora")
  sigue como quedó en el punto 7 — no fue tocado por la reversión de RBAC.

## 4. Sin pendientes de alcance

No hay tareas abiertas de esta sesión. Cualquier trabajo nuevo (backlog
opcional, nueva funcionalidad) requiere una decisión explícita del usuario
sobre qué atacar a continuación.

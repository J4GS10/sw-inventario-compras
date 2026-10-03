# Avance 06 — Roles endurecidos + inferencia de datos en los formularios

> Reporte de avance sobre `docs/01-ESTADO-Y-CONTINUIDAD.md` (documento vivo).
> Responde a: *"necesito inferencia de datos, que el usuario no seleccione cosas
> que ya van relacionadas; no entiendo la lógica de roles — quién aprueba, la
> jerarquía; hasta el bodeguero ve la data y hace solicitudes, el sistema no
> respeta los roles"*.
> Fecha: **2026-09-10**. Verificado contra Oracle 21c + MinIO locales. Sin
> cambios de DDL.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| **Diagnóstico**: por qué "el bodeguero ve todo" | ✅ (era el atajo `X-Dev-User`, no un fallo de RBAC) |
| **Atajo `X-Dev-User` cerrado** por defecto (login real obligatorio) | ✅ |
| **Lectura de documentos restringida por rol** (segregación de funciones) | ✅ |
| **Alcance por departamento** extendido a RFQ y Cotización | ✅ |
| **Inferencia**: cotización → proveedor limitado a los invitados del RFQ | ✅ |
| **Inferencia**: OC → proveedor/moneda/tasa/precio se toman de la cotización adjudicada y quedan **bloqueados** | ✅ |
| **Inferencia**: solicitud → sucursal prellenada desde el empleado de la sesión (editable) | ✅ |

**Pruebas:** 8 unitarias + **150 de integración** (148 → +2). `tsc` estricto
limpio (be + fe); `vite build` OK (72 módulos); `graphify update` (1792 nodos).

---

## 1. La jerarquía de roles (respuesta a "no entiendo la lógica")

```
Solicitante  ─crea─▶  PENDIENTE_JEFE
     │
     ▼  JEFE_INMEDIATO   1er nivel de aprobación — SOLO solicitudes de SU equipo
PENDIENTE_GERENTE          (reportes directos vía NOM_EMPLEADO.ID_JEFE_INMEDIATO);
     │                     puede además ajustar cantidades
     ▼  GERENTE_AREA      2º nivel — SOLO solicitudes de SU departamento
EN_COTIZACIÓN              (NOM_EMPLEADO.ID_DEPARTAMENTO)
     │
     ▼  COMPRADOR         crea el RFQ (≥3 proveedores) y registra las cotizaciones
     ▼  GERENTE_FINANCIERO adjudica la mejor oferta y autoriza la OC
     ▼  COMPRADOR         genera la OC y la envía al proveedor
     ▼  BODEGA            registra la recepción → kardex + CxP (automático)
```

- **"El rol de departamentos que aprueba"** = `JEFE_INMEDIATO` (jefe directo) y
  `GERENTE_AREA` (gerente del área). Cada uno solo ve y decide lo de su
  ámbito; intentar aprobar fuera de su equipo/área → **403**.
- `COMPRADOR`, `GERENTE_FINANCIERO`, `AUDITOR`, `ADMIN_COMPRAS` operan a nivel de
  **toda la empresa** (no se acotan por departamento) — es el diseño.
- Matriz completa de 14 permisos × 8 roles en `docs/flujo-y-roles-compras.md`.

## 2. Por qué "el bodeguero veía todo" — diagnóstico

No era un fallo de RBAC. Verificado en vivo: `bodega` **no puede** crear
solicitudes (`POST /api/com/solicitudes` → 403). Había **dos causas**:

1. **Atajo de desarrollo `X-Dev-User`.** El backend aceptaba la cabecera
   `X-Dev-User: <id>` (permisos `*`, admin total) sin login, y el **frontend la
   mandaba automáticamente cuando no había sesión** (sin login, o token vencido).
   Resultado: sin iniciar sesión de verdad, se veía y se hacía *todo*.
2. **Lecturas abiertas por diseño.** `registrarLecturas` usaba
   `authGuardAny(READ_FLUJO)` → *cualquier* permiso del ciclo permitía `GET` a
   *cualquier* documento del flujo. Un `bodega` logueado (que tiene
   `RECEPCION_GESTIONAR`) podía `GET /api/com/solicitudes` → 200, aunque el menú
   se lo ocultara.

## 3. Roles endurecidos (backend)

### 3.1 Atajo `X-Dev-User` cerrado por defecto
- **`common/config/EnvConfig.ts`** — nuevo `env().devAuth: boolean`, `true` solo
  si `NODE_ENV != production` **Y** `APP_DEV_AUTH=1` (doble candado).
- **`presentation/middlewares/authGuard.ts`** — `resolvePayload` solo admite
  `X-Dev-User` si `env().devAuth`. En cualquier otro caso exige un JWT válido.
- **`.env`** — `APP_DEV_AUTH=1` (con comentario: *solo dev/tests, NUNCA en
  producción*). Docker/compose no lo define → producción siempre exige login.
- **Frontend `core/HttpClient.ts`** — `authHeaders()` ya **no** manda
  `X-Dev-User`: sin token → sin cabecera de auth → 401 → `LoginScreen`. Se
  eliminaron `devUserId` / `setDevUser`.
- Los tests de integración cargan `.env` (`APP_DEV_AUTH=1`) → siguen usando
  `x-dev-user: 0` como contexto de sistema sin cambios.

### 3.2 Lectura por documento (segregación de funciones)
`routes/com/transaccional.ts` — `registrarLecturas(app, base, service, readPerms)`
gana el 4º parámetro. Listas por documento (espejadas en `routes/com/adjuntos.ts`):

| Documento (`GET` lista y `:id`) | Roles que lo leen |
|---|---|
| **Solicitudes** | solicitante, jefe, gerente, comprador, financiero (los que ven o aprueban) — **no bodega** |
| **RFQ** | comprador (gestiona) + financiero (adjudica) — **no bodega, no solicitante, no auditor** |
| **Cotizaciones** | comprador + financiero |
| **Órdenes de compra** | comprador + financiero + **bodega** (necesita ver la OC para recibir) |
| **Recepciones** | bodega + comprador (traza la OC) |
| **Devoluciones** | bodega + comprador |

- **AUDITOR** conserva Solicitudes + Comparativo + Historial + Dashboard (la
  traza de la *decisión*), pero pierde el acceso de lectura a la plomería
  operativa (RFQ/cotizaciones/OC/recepciones). Coincide con lo que ya mostraba
  el menú.
- `/api/com/notificaciones` sigue abierto a cualquier permiso del ciclo (se
  auto-filtra por rol).
- Los endpoints `/api/com/ref/*` (selects dependientes) siguen con `authGuard([])`
  (solo autenticación): cualquier usuario logueado puede poblar un formulario.

### 3.3 Alcance por departamento en RFQ y Cotización
- **`bll/services/com/alcanceDocumentos.ts`** (nuevo) — reutiliza
  `empleadosEnAlcance` y lo lleva hasta `idSolicitud` (`solicitudIdsEnAlcance`) y
  `idRfq` (`rfqIdsEnAlcance`). Nuevas consultas en `CompraReadRepository`
  (`solicitudIdsDeEmpleados`, `rfqIdsDeSolicitudes`, helper `idsIn`).
- `RfqService.listar/obtener(query|id, ctx?)` y `CotizacionService.listar/obtener`
  aplican el filtro: si el usuario está acotado, `listar` añade
  `idSolicitud IN (...)` / `idRfq IN (...)` y `obtener` fuera de alcance → 404.
- **OC / Recepción / Devolución NO se acotan por departamento** — decisión
  documentada en `alcanceDocumentos.ts`: `COM_ORDEN_COMPRA` no guarda
  `ID_SOLICITUD` (el vínculo es multi-salto vía la cotización adjudicada) y,
  tras 3.2, ningún rol acotado (solicitante/jefe/gerente) tiene ya lectura de
  esos documentos — solo comprador/financiero/auditor/admin, que son de alcance
  global por diseño.

### 3.4 Verificado en vivo (login real, sin atajo)
```
bodega:       solicitudes 403 · rfq 403 · cotizaciones 403 · ordenes 200 · recepciones 200
solicitante:  solicitudes 200 · rfq 403 · ordenes 403
auditor:      solicitudes 200 · rfq 403 · recepciones 403 · comparativo 200
sin token:    401
```

## 4. Inferencia de datos en los formularios (frontend)

### 4.1 Cotización — el proveedor sale del RFQ
El campo *Proveedor* deja de ofrecer **todo el catálogo**; ahora es un select
dependiente de `idRfq` que solo lista los **invitados a ese RFQ**:
- Backend: `CompraReadRepository.proveedoresDeRfq(idRfq)` +
  `GET /api/com/ref/rfq/:id/proveedores` (`[{idProveedor, razonSocial, nit}]`).
- `documentForms.ts` → `idProveedor.optionsFrom = { path: ".../rfq/{idRfq}/proveedores", dependsOn: "idRfq" }`.
- Sin RFQ elegido, el select dice "Elige primero el RFQ".

### 4.2 Orden de compra — todo lo decidido queda bloqueado
Nuevo motor declarativo `DocumentFormConfig.autoFill` (`components/formSupport.ts`
→ `useAutoFill`):
- `source` = endpoint con las filas fuente (placeholders `{campo}` del header).
- `matchLineField` / `matchKey` = el campo de línea que elige la fila.
- `lineMap` = `filaProp → campoLinea` que se copia **y bloquea**.
- `headerMapIfUniform` = si todas las líneas elegidas comparten la fila fuente,
  se copian al header **y se bloquean**.

Config de la OC: al elegir la **cotización adjudicada** de cada línea se fijan
`descripción`, `unidad`, `precioUnitario`, `% descuento`, `% impuesto`; y si
todas las líneas son del mismo proveedor, se fijan en el header `idProveedor`,
`idMoneda`, `tasaCambio`. El usuario ya no re-elige ni puede escribir el precio.
- Backend: `cotizacionesAdjudicadas` ahora devuelve también `idProveedor`,
  `idMoneda`, `tasaCambio`.
- `DocumentForm.tsx` aplica `disabled` a los campos de header y de línea
  marcados por `useAutoFill` (los de línea, solo si esa línea ya tiene la
  cotización elegida). El asistente "Generar OC" desde el Comparativo sigue
  funcionando (prefill + estos bloqueos).

### 4.3 Solicitud — sucursal desde el empleado de la sesión
`FormFieldDef.defaultFromSessionEmpleado?: string` (nuevo): `DocumentForm`, al
abrir en modo alta, resuelve `/api/com/ref/empleados`, busca al empleado de la
sesión y **prellena** el campo (editable, no bloqueado). Aplicado a
`solicitudes.idSucursal` (`defaultFromSessionEmpleado: "idSucursal"`). El
`idEmpleadoSolicitante` sigue *bloqueado* al empleado de la sesión (`fromSession`).
- *Pendiente opcional:* `idCentroCosto` por defecto según el departamento del
  empleado (requiere llevar `idDepartamento` en la sesión).

### 4.4 Datos derivados solo-lectura en los detalles
`DocumentoDetalle` y las tablas (`DataTable` con `refKind`) ya resuelven las FK a
etiqueta (`refs.label`) y nunca piden re-seleccionar el proveedor/moneda de un
documento ya guardado. Sin cambios.

---

## 5. Verificación

```bash
pnpm minio ; pnpm db:deploy
pnpm -r typecheck                 # limpio (be + fe)
pnpm --filter backend test        # 8/8
pnpm --filter backend test:int    # 150/150  (necesita Oracle + MinIO)
pnpm --filter frontend build      # tsc -b + vite build OK (72 módulos)
graphify update .                 # 1792 nodos
```

- `auth.int.test.ts` — nuevas aserciones: bodega/solicitante/auditor reciben
  **403** al leer documentos que no les tocan; comprador/financiero **200** en
  RFQ/cotizaciones/OC/recepciones.
- `referencias.int.test.ts` — `rfq/:id/proveedores` devuelve exactamente los
  invitados (`= COUNT(COM_RFQ_PROVEEDOR)`); `cotizaciones-adjudicadas` incluye
  `idProveedor` / `idMoneda` / `tasaCambio`.

---

## 6. Puntos de entrada nuevos / tocados

| Necesito… | Archivo |
|---|---|
| Candado del atajo dev | `common/config/EnvConfig.ts` (`devAuth`), `presentation/middlewares/authGuard.ts`, `.env` (`APP_DEV_AUTH`) |
| Frontend sin atajo | `frontend/src/core/HttpClient.ts` (`authHeaders`) |
| Lectura por rol | `presentation/routes/com/transaccional.ts` (`READ_*` + `registrarLecturas`), `routes/com/adjuntos.ts` |
| Alcance por depto en RFQ/cotización | `bll/services/com/alcanceDocumentos.ts`, `RfqService`, `CotizacionService`, `CompraReadRepository` (`solicitudIdsDeEmpleados`, `rfqIdsDeSolicitudes`) |
| Inferencia cotización (proveedor ← RFQ) | `CompraReadRepository.proveedoresDeRfq`, `routes/com/referencias.ts`, `modules/compras/documentForms.ts` |
| Inferencia OC (autoFill) | `components/formSupport.ts` (`AutoFillSpec`, `useAutoFill`), `components/DocumentForm.tsx`, `documentForms.ts`, `CompraReadRepository.cotizacionesAdjudicadas` |
| Prellenado de sesión | `components/formSupport.ts` (`defaultFromSessionEmpleado`), `components/DocumentForm.tsx` |

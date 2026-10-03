# Avance 02 — Cierre de Fase 6, diseño y RBAC — Módulo de Gestión de Compras

> **Qué es este documento.** Reporte del avance realizado sobre el estado que
> describe `docs/01-ESTADO-Y-CONTINUIDAD.md` (que sigue siendo el documento vivo).
> Cubre el cierre de la Fase 6, la realineación de diseño, la intuitividad del
> frontend, la legibilidad de datos y el **endurecimiento del modelo de roles +
> notificaciones**.
> Fecha: **2026-09-10**. Verificado contra Oracle 21c local y capturas headless.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| 6.1 Endurecer autenticación (scrypt, bloqueo, bitácora, logout) | ✅ |
| 6.2 Alcance por departamento/equipo (lectura **y** acción) | ✅ |
| 6.3 `withTelemetry` en los CRUD genéricos | ✅ |
| 6.4 Empaquetado Docker (backend/frontend/compose/nginx) | ✅ |
| Realineación del sistema de diseño a `skills/patron-diseno.md` | ✅ |
| 6.5 Intuitividad del frontend (línea de proceso, estados legibles, asistente de OC) | ✅ |
| Data de valor en tablas (sin IDs crudos) + fix de encabezado sticky | ✅ |
| **RBAC: jerarquía correcta + catálogos sensibles + bandeja de pendientes** | ✅ |
| **Notificaciones estrictamente por rol + alcance (no ver lo que no le toca)** | ✅ |
| **CRUD de documentos completado — `PUT` de Solicitud y RFQ** | ✅ |

**Pruebas:** 8 unitarias + **123 de integración**, todas verdes. `tsc` estricto
limpio (backend + frontend); `vite build` OK. `pnpm db:deploy` requerido antes de
`test:int` (siembra hashes, alcance por departamento y el 14º permiso).

---

## 1. Autenticación endurecida (6.1)

- **Hash real** — `backend/src/common/auth/password.ts`: `scrypt` de `node:crypto`
  (sin dependencias nuevas), salted, `timingSafeEqual`, formato
  `scrypt$N$r$p$salt$hash`. Aislado tras `hashPassword` / `verifyPassword`.
- **SQL de auth movido a Capa 2** — `dal/repositories/seg/SegAuthRepository.ts`
  (Singleton): resolver usuario+hash, roles, permisos,
  `INTENTOS_FALLIDOS`/`FECHA_BLOQUEO`/`FECHA_ULTIMO_LOGIN`, inserts en
  `SEG_BITACORA_ACCESO`, `usuariosDemo`. `AuthService` quedó como orquestación
  pura (regla "nada de SQL fuera de `dal/`").
- **Bloqueo** — 5 fallos → `FECHA_BLOQUEO`; ventana 15 min → `LockedError`
  (HTTP 423, nueva clase). Login correcto resetea intentos y marca último login.
- **Bitácora** — `LOGIN_EXITOSO`/`LOGIN_FALLIDO`/`BLOQUEO_CUENTA`/`LOGOUT` con
  `USERNAME_INTENTO`, `IP_ORIGEN`, `DETALLE`.
- **`POST /api/auth/logout`** (registra `LOGOUT`, 204); `login` exige `password`.
- **Frontend** — `HttpClient` mapea 423 y limpia el token en un 401 autenticado;
  `AuthContext` valida `exp` del JWT al rehidratar; `LoginScreen` con campo
  contraseña conforme al skill. Contraseña demo: **`compras.demo`**.

---

## 2. Alcance por departamento/equipo (6.2 + endurecimiento)

- `AuditContext` lleva `empleadoId?` y `roles?` (propagados por `auditContextOf`
  desde el JWT). El header `X-Dev-User` no los trae → contexto de sistema sin
  restricción (los tests lo siguen usando).
- **Fuente única** — `bll/services/com/alcance.ts::empleadosEnAlcance(ctx, read)`:
  `null` = ve/actúa sobre todo (ADMIN, COMPRADOR, GERENTE_FINANCIERO, AUDITOR);
  o una lista de `ID_EMPLEADO`:
  - **GERENTE_AREA** → empleados de su departamento
  - **JEFE_INMEDIATO** → sus reportes directos + él
  - **SOLICITANTE** → solo él
- **Lectura** — `SolicitudCompraService.listar/obtener` filtran por
  `idEmpleadoSolicitante IN (…)`; `obtener` fuera de alcance → 404.
- **Acción (nuevo)** — `SolicitudCompraService.transicionar` (aprobar/rechazar)
  valida el alcance **antes** de la transición: un jefe que intente decidir sobre
  una solicitud de otro equipo recibe **403**.
- DAL — `CompraReadRepository.departamentoDeEmpleado` /
  `empleadosDeDepartamento` / `empleadosBajoJefe` (SQL parametrizado sobre
  `NOM_EMPLEADO`).
- Seed — `database/dml/03_alcance_departamento.sql` liga EMP-101/102/103 al depto
  "Compras y Abastecimiento", EMP-101 → jefe EMP-102, EMP-104 a otro depto.

---

## 3. Modelo de roles — jerarquía correcta

### 3.1 Catálogo de permisos (14, módulo `COMPRAS`)

`backend/src/common/auth/permissions.ts` y `database/dml/02_seg_rbac.sql` (espejo
en `frontend/src/core/auth/permisos.ts`).

Nuevo **`COMPRAS_CATALOGO_ADMIN`** — separa los catálogos **sensibles**
(monedas + tablas de auditoría `comparativo-cotizaciones` y `workflow-aprobacion`)
de los **operativos**. `CATALOGO_EDITAR` ya solo cubre proveedores, acuerdos,
condiciones de pago, términos, grupos, categorías, centros de costo y los logs de
seguimiento/excepciones de OC. `CATALOGO_ADMIN` → solo `ADMIN_COMPRAS`.

`backend/src/presentation/routes/com/index.ts` registra dos listas:
`CRUD_OPERATIVOS` (write = `CATALOGO_EDITAR`) y `CRUD_SENSIBLES`
(write = `CATALOGO_ADMIN`); ambas con read = `CATALOGO_VER`.

### 3.2 Matriz de roles (qué puede hacer cada uno)

| Rol | Crea sol. | Aprueba | RFQ/Cotiz. | Adjudica | OC | Recep./Devol. | Cat. oper. | Cat. sensibles | Analítica |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| SOLICITANTE | ✔ | – | – | – | – | – | – | – | ✔ |
| JEFE_INMEDIATO | ✔ | **jefe** (su equipo) | – | – | – | – | – | – | ✔ |
| GERENTE_AREA | – | **gerente** (su área) | – | – | – | – | – | – | ✔ |
| COMPRADOR | – | – | ✔ | – | ✔ | – | ✔ | – | ✔ |
| GERENTE_FINANCIERO | – | – | – | ✔ | ✔ | – | – (solo ver) | – | ✔ |
| BODEGA | – | – | – | – | – | ✔ | – (solo ver) | – | – |
| AUDITOR | – | – | – | – | – | – | – (solo ver) | – | ✔ (solo lectura) |
| ADMIN_COMPRAS | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

- La aprobación es **2 niveles obligatorios**: jefe (`PENDIENTE_JEFE`) → gerente
  de área (`PENDIENTE_GERENTE`) → `EN_COTIZACION`. `autorizarDecision` exige el
  permiso del nivel exacto según el estado; la `StateMachine` bloquea saltos.
- El **comprador no adjudica** (eso es del gerente financiero) y **no aprueba
  solicitudes**. El **gerente financiero adjudica y autoriza la OC**, pero no
  crea RFQ ni registra cotizaciones.
- **Bodega** no llega a solicitudes/RFQ/cotización/OC ni edita ningún catálogo,
  ni en el menú ni por API (403). Verificado.

### 3.3 Gating en el frontend

`components/CrudPage.tsx` gana `writePerm` (por defecto `CATALOGO_EDITAR`;
`monedas` usa `CATALOGO_ADMIN`). Si el rol no tiene el permiso: se ocultan
"Nuevo", "Editar", "Eliminar" y la selección múltiple; el subtítulo indica
"Solo lectura para tu rol". Antes cualquier rol con `CATALOGO_VER` veía los
botones de edición (el backend los rechazaba, pero la UI confundía).

---

## 4. Bandeja de pendientes (notificaciones)

**Derivada del estado del flujo** — no hay tabla de notificaciones ni cambios en
el DDL.

- Backend — `bll/services/com/NotificacionService.ts` + consultas nuevas en
  `CompraReadRepository` (`solicitudesEnEstado`, `solicitudesSinRfq`,
  `solicitudesParaAdjudicar`, `ordenesPorRecibir`). Ruta
  **`GET /api/com/notificaciones`** (`authGuardAny(READ_FLUJO)`), devuelve
  `{ total, items: [{ tipo, titulo, detalle, cantidad, leafId, refs }] }`.
- Qué recibe cada rol:
  | Rol | Notificación |
  |---|---|
  | JEFE_INMEDIATO | Solicitudes `PENDIENTE_JEFE` **de su equipo** por aprobar |
  | GERENTE_AREA | Solicitudes `PENDIENTE_GERENTE` **de su área** por aprobar |
  | COMPRADOR | Solicitudes `EN_COTIZACION` sin RFQ (listas para cotizar) |
  | GERENTE_FINANCIERO | Comparativos con cotizaciones y sin adjudicar |
  | BODEGA | OC `ENVIADA`/`EN_TRANSITO`/`RECIBIDA_PARCIAL` por recibir |
  | AUDITOR | ninguna (solo lectura) · ADMIN_COMPRAS: vista supervisora de todo |
- **Endurecido (2ª pasada)**: las notificaciones de aprobación exigen poder
  aprobar ese nivel **Y** que la solicitud esté en el equipo/área del usuario
  (`NotificacionService.alcanceAprobacion`, centinela `NADA` para usuarios sin
  empleado ligado que no son admin). Un usuario nunca ve notificaciones que no le
  corresponden ni que no puede aprobar. Test: el `refs` del jefe jamás incluye
  una solicitud de otro departamento.
- Frontend — `core/NotificacionService.ts`, `hooks/useNotificaciones.ts`
  (carga inicial + refresco cada 60 s + refresco inmediato ante eventos del
  `EventBus`), `ui/NotificacionesMenu.tsx` (campana de la topbar con **badge** de
  total y **panel** navegable; cada grupo lleva a su pantalla). `AppShell` recibe
  `onNavigateById`.

Así, cuando una solicitud queda esperando la aprobación de otro rol, a ese rol
**le llega el aviso** en su campana con el conteo y el acceso directo.

---

## 4-bis. CRUD de documentos completado (opciones de actualización)

Hasta ahora los documentos del flujo solo tenían **crear** + acciones; faltaba
**editar**. Añadido:

| Documento | Endpoint | Regla | Concurrencia |
|---|---|---|---|
| Solicitud | `PUT /api/com/solicitudes/:id` | solo en `PENDIENTE_JEFE`; solo el solicitante/creador o quien tenga alcance; no cambia el estado | `version` obligatorio (bloqueo optimista) |
| RFQ | `PUT /api/com/rfq/:id` | solo mientras `ABIERTO`; edita `fechaLimite` | — |

- `SolicitudCompraService.actualizar` / `RfqService.actualizar` (Capa 3, sin SQL).
- Frontend — `DocumentForm` gana modo edición (`editId` + `editFields`): título
  "Editar · …", subconjunto de campos de cabecera, sin líneas, `PUT` con `version`.
  `DocumentoList` muestra la acción **"Editar"** en Solicitudes (`PENDIENTE_JEFE`)
  y RFQ (`ABIERTO`), gated por permiso.
- Los **catálogos** ya tenían CRUD completo (`CrudPage` → `PUT`), ahora también
  con gating por permiso (ver §3.3).
- Pruebas: `tests/documentoUpdate.int.test.ts` (5): edita en `PENDIENTE_JEFE`
  (200), sin `version` → 422, tras aprobar → 409, solicitante puede / bodega 403,
  RFQ `fechaLimite` mientras `ABIERTO` (200).

---

## 5. Diseño + intuitividad + data legible (resumen)

Detalle completo en `docs/01-ESTADO-Y-CONTINUIDAD.md` §5.-1 / §5.-2 / §5.-3.

- **Realineación a `patron-diseno.md`**: paleta oficial (`--color-brand`
  `#0071e3`, semánticos `#ff3b30`/`#ff9500`/`#34c759`, texto `#1d1d1f`/`#6e6e73`),
  tipografía (stack del sistema + JetBrains Mono para datos), inputs/botones/chips
  §7, radios 8/10/14, sombras §12, `--overlay` neutro, tokens del sidebar navy.
- **`ui/FlowStepper.tsx`**: línea de las 8 etapas del ciclo, arriba de cada
  listado y del dashboard.
- **`core/estados.ts`**: `estadoLabel` / `estadoTono` / `prioridadLabel` /
  `prioridadTono` — los estados y la prioridad se muestran como **chips legibles**
  ("Pendiente del jefe", "Recibida parcial", "Alta"), nunca el código.
- **`core/format.ts`**: `formatMoney` (GTQ, `Intl.NumberFormat es-GT`),
  `formatQty`, `formatRate` (`× 1.00`).
- **`core/RefContext.tsx`**: `RefProvider` carga+cachea 13 catálogos; `DataTable`
  gana `Column.refKind` → toda columna FK muestra la **etiqueta**
  (idMoneda → "GTQ", idProveedor → razón social, idBodega → nombre), los `DocRef`
  con prefijo (OC-123). Sin IDs crudos en ninguna tabla del sistema.
- **Fix**: `--table-head-bg` era casi transparente → el encabezado sticky dejaba
  ver la data al hacer scroll. Ahora opaco (`#f2f4f7` / `#1b2233`) + sombra.
- **Aprobar/rechazar** ya no pide "ID de empleado": es el usuario en sesión.
- **Asistente de OC**: botón "Generar orden de compra" en el Comparativo abre el
  formulario de OC prellenado con lo adjudicado.
- **Dashboard**: KPIs navegables + gráfico "OC por estado" (guía `dataviz`).
- Filtros que pedían ID a mano → `select` (Historial: artículo; Comparativo:
  solicitud).

---

## 6. Docker (6.4)

- `backend/Dockerfile` (multi-stage, `pnpm deploy --prod`, `node:20-alpine` sin
  devDeps), `frontend/Dockerfile` (Vite → `nginx:1.27-alpine`),
  `frontend/nginx.conf` (SPA + proxy `/api → backend:3000`), `docker-compose.yml`
  (red `inventory-net`, volumen `oracle-data`, servicios `oracle`/`backend`/
  `frontend` + `db-init` opcional), `.dockerignore`, sección Docker en el README.
- Imagen de BD: `gvenzl/oracle-free` (Oracle DB 23 Free) por falta de imagen 21c
  turnkey; documentado cómo cambiar a la oficial.

---

## 7. Verificación

```bash
pnpm db:deploy                                    # 103 tablas, 26 COM_, 14 permisos
pnpm -r typecheck                                 # limpio (backend + frontend)
pnpm --filter backend test                        # 8/8 unitarias
pnpm --filter backend test:int                    # 118/118 integración
pnpm --filter frontend build                      # tsc -b + vite build OK
graphify update .                                  # 1536 nodos
```

Pruebas nuevas de integración de este avance:
- `tests/auth.int.test.ts` — catálogo de 14 permisos; COMPRADOR edita operativos
  pero **no** monedas (403); BODEGA no edita ningún catálogo (403), sí los ve.
- `tests/alcanceDepartamento.int.test.ts` — el JEFE no puede aprobar una
  solicitud de otro departamento (403); sí la de su equipo; bandeja de
  `/api/com/notificaciones` para JEFE (solo items `APROBAR_JEFE`) y BODEGA
  (solo `RECIBIR`, nada de aprobación).

Validado por capturas headless (Edge/CDP):
- `jefe` → campana con badge **2** y panel "Solicitudes por aprobar (jefe) · 2";
  menú lateral reducido a lo suyo; KPI Solicitudes acotado a su equipo.
- `bodega` y `auditor` → catálogo Proveedores en **solo lectura** (sin Nuevo /
  Editar / Eliminar / selección); `comprador` → con edición completa.
- Tablas sin IDs crudos, encabezado opaco sin solape, estados y prioridad como
  chips legibles.

---

## 8. Qué queda (opcional, no bloqueante)

- Gráficas de serie temporal en el dashboard (rotación / compras del mes) —
  requieren endpoints de agregación nuevos.
- Índice tipo *gauge*.
- `CommandPalette` ya filtra por permisos; los `idSolicitudDetalle` /
  `idOcDetalle` / `idRecepcionDetalle` ya son selects dependientes.
- Vite 8 cuando exista estable con React 19 + Tailwind v4.
- Los otros 5 módulos del ERP (NOM/SEG/INV/CXP/CXC) están fuera del alcance del
  proyecto (solo Compras).

---

## 9. Puntos de entrada nuevos de este avance

| Necesito… | Archivo |
|---|---|
| Alcance por rol/departamento (fuente única) | `backend/src/bll/services/com/alcance.ts` |
| Bandeja de pendientes (lógica) | `backend/src/bll/services/com/NotificacionService.ts` |
| Consultas de pendientes | `backend/src/dal/repositories/com/CompraReadRepository.ts` (`solicitudesEnEstado`, `solicitudesSinRfq`, `solicitudesParaAdjudicar`, `ordenesPorRecibir`) |
| Ruta de notificaciones | `backend/src/presentation/routes/com/transaccional.ts` (`GET /api/com/notificaciones`) |
| Permisos + catálogos sensibles | `backend/src/common/auth/permissions.ts`, `backend/src/presentation/routes/com/index.ts`, `database/dml/02_seg_rbac.sql` |
| Campana / bandeja (frontend) | `frontend/src/ui/NotificacionesMenu.tsx`, `frontend/src/hooks/useNotificaciones.ts`, `frontend/src/core/NotificacionService.ts` |
| Gating de catálogos | `frontend/src/components/CrudPage.tsx` (`writePerm`), `frontend/src/modules/compras/catalogPages.tsx` |
| Etiquetas de FK en tablas | `frontend/src/core/RefContext.tsx`, `frontend/src/ui/DataTable.tsx` |
| Estados/prioridad legibles | `frontend/src/core/estados.ts` |
| Línea de proceso | `frontend/src/ui/FlowStepper.tsx` |

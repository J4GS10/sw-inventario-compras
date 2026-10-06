# sw-inventario · Módulo de Compras (COM_)

ERP de Inventario y Compras. Monorepo pnpm: **backend** Fastify + `oracledb` (Thin),
**frontend** React 19 + Vite + Tailwind v4, **database** Oracle 21c.

Arquitectura estricta de 6 capas y patrones GoF — ver `skills/` y
`C:\Users\<user>\.claude\plans\por-favor-revisa-graph-json-vast-flurry.md`.

## Puesta en marcha

```bash
corepack enable && corepack prepare pnpm@9.12.0 --activate
pnpm install

# 1. Verificar/desplegar esquema en Oracle local (usa .env)
pnpm db:deploy            # verifica (26 tablas COM_) + siembra catálogos base
pnpm db:deploy:full       # además intenta aplicar SCRIPT_DDL.sql (DDL simple)

# 2. Backend  -> http://localhost:3000
pnpm --filter backend dev

# 3. Frontend -> http://localhost:8443  (proxy /api -> :3000)
pnpm --filter frontend dev
```

`.env` (raíz) — ya presente: `DB_USER=admin_proyecto`, `DB_CONNECT_STRING=localhost:1521/proyecto`.
Para producción/Docker añade `JWT_SECRET=<cadena larga aleatoria>`.

## Docker

```bash
# .env debe definir JWT_SECRET (obligatorio en producción)
docker compose up -d --build           # oracle + backend(:3000) + frontend(:8443)

# una sola vez: crear esquema + datos semilla contra la BD del compose
docker compose run --rm db-init        # aplica SCRIPT_DDL.sql (DDL simple) + database/dml/*
```

- `backend/Dockerfile` y `frontend/Dockerfile`: multi-stage, sin devDependencies
  en la imagen final; contexto de build = raíz del monorepo.
- `frontend/nginx.conf`: sirve la SPA y hace de proxy inverso `/api → backend:3000`.
- Red privada `inventory-net`; volumen `oracle-data` para la BD.
- La imagen de BD es `gvenzl/oracle-free` (Oracle DB 23 Free, superset SQL de 21c);
  no hay imagen 21c oficial sin login a `container-registry.oracle.com`. Para 21c
  oficial, cambia la imagen del servicio `oracle` y `DB_CONNECT_STRING`.

## Pruebas

```bash
pnpm --filter backend test        # unитarias (sin BD): StateMachine, validación por descriptor
pnpm --filter backend test:int    # integración end-to-end contra Oracle local (CRUD COM_PROVEEDOR)
```

## La tesis POO: configurar, no programar

Una sola descripción por tabla — `EntityDescriptor` en
`backend/src/entities/com/descriptors.ts` — alimenta las clases base genéricas:

| Capa | Clase base genérica | Qué aporta |
|---|---|---|
| 2 DAL | `BaseOracleRepository` / `CrudRepository` / `BaseHeaderDetailRepository` | CRUD + SQL parametrizado + OCC + soft-delete + mapeo de filas, 0 SQL a mano |
| 3 BLL | `BaseCrudService` (+ `StateMachine`, `DomainEventBus`) | Template Method con hooks `beforeX/afterX`; validación por descriptor o DTO class-validator |
| 4 API | `BaseCrudController` + `registerCrudRoutes` | 5 rutas REST (list/get/create/update/delete) por recurso en 1 llamada |
| 4 UI | `CrudPage` + `DataTable` + `useCrud` | Pantalla de catálogo completa = 1 objeto de configuración |

Añadir un catálogo nuevo = 1 descriptor + 1 fila en `presentation/routes/com/index.ts`
+ 1 config en `frontend/src/modules/compras/catalogPages.tsx`. Sin handlers, sin SQL.

## Servidor oficial (producción) y pruebas

```bash
cp .env.example .env     # completa DB_PASSWORD y JWT_SECRET
pnpm oficial             # migra el esquema, compila y levanta backend (:3000) + frontend (:8443) en modo producción
pnpm oficial status|stop
pnpm qa:oficial          # TODAS las pruebas contra ese servidor (API, seguridad OWASP, interfaz con Playwright)
```

Usa tu Oracle local (`.env`) y MinIO (`pnpm minio`). En producción no hay selector de perfiles ni atajo
`X-Dev-User`: se ingresa con usuario y contraseña (usuarios de demostración: `admin`, `solicitante`, `jefe`,
`gerente`, `comprador`, `financiero`, `bodega`, `auditor`; contraseña de demostración en `database/dml/02_seg_rbac.sql`
y `docs/`). **Cámbialas antes de exponer el sistema.**

## Base de datos (Oracle 21c)

- `database/ddl/SCRIPT_DDL.sql`: esquema canónico (105 tablas: NOM_, SEG_, INV_, COM_, CXP_, CXC_...), incluye
  `SEG_BORRADOR_USUARIO` y `SEG_DELEGACION_APROBACION`.
- `database/dml/`: semillas (maestros, RBAC, catálogos de compras, alcance por departamento).
- `pnpm db:deploy` verifica el esquema, aplica las migraciones idempotentes de `backend/scripts/deploy.ts` y siembra.
- No se versionan volcados de datos ni credenciales.

## Tecnologías

Node 20+, pnpm 9 (monorepo), TypeScript estricto · Backend: Fastify 5, `oracledb` (Thin), PDFKit, S3 (MinIO) ·
Frontend: React 19, Vite 6, Tailwind v4, Vitest, Playwright (QA) · Base de datos: Oracle 21c ·
Docker Compose (Oracle gvenzl + MinIO + backend + nginx).

## Documentación

`docs/` (estado y continuidad por etapa: `13-AUDITORIA-FRONTEND-UX.md` es la más reciente, `12-SEGURIDAD-PENTEST.md`),
`skills/` (stack, arquitectura de 6 capas y guía de diseño).

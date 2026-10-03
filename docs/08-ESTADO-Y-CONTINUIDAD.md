# Avance 08 — Primera suite de tests del frontend (infra + cobertura inicial)

> Reporte de avance sobre `docs/01-ESTADO-Y-CONTINUIDAD.md` (documento vivo).
> Responde a la elección del usuario, tras cerrar sin capturas la verificación
> visual pendiente al abrir esta sesión (se confió en revisión de código +
> build ya hecho en `docs/07`), de atacar el ítem de backlog documentado en
> `docs/07-ESTADO-Y-CONTINUIDAD.md` §1: **"Frontend con CERO tests (ni
> unitarios, ni de componentes, ni e2e)"**.
> Plan ejecutado: `C:\Users\j.gonzalez\.claude\plans\shiny-watching-pearl.md`.
> Fecha: **2026-09-10**. Sin cambios de DDL ni de backend.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| Infraestructura de testing en `frontend/` (jsdom + Testing Library) | ✅ nueva |
| Tests de lógica pura de gating (`permisos.ts`, `nav.ts`) | ✅ 13 casos |
| Tests de `DataTable` (WS1: columnas, colapso, vista tarjeta, relleno) | ✅ 13 casos |
| Tests de `FlowStepper` (WS2: gating de pasos por permiso) | ✅ 2 casos |
| **Total** | **28 tests nuevos, todos verdes** |

Antes de esta tanda: `frontend/package.json` ya declaraba `vitest` 2.1.8 y un
script `"test": "vitest run"`, pero no existía ningún archivo `*.test.ts(x)`
en `frontend/src` ni configuración de entorno DOM — el script corría 0 tests.

---

## 1. Por qué este alcance y no otro

Se priorizaron las piezas de **más riesgo y más recién tocadas**:

1. **`ui/DataTable.tsx`** — el componente más grande y más modificado en la
   tanda anterior (`docs/07` WS1), incluyendo el fix de "columna de relleno"
   (`hasSpacer`) aplicado hoy mismo en esta misma sesión antes de este bloque.
   Sin tests, cualquier retoque futuro al sistema de columnas/responsive podía
   romper silenciosamente el colapso `secondary` o la vista tarjeta.
2. **Gating de acciones por permiso** (`core/auth/permisos.ts`, `nav.ts`,
   `ui/FlowStepper.tsx`) — lógica pura + un componente representativo de WS2
   (`docs/07` §3), la corrección de seguridad/UX más reciente del módulo.

Se dejó **fuera de alcance explícitamente**: `ComparativoView`, `DocumentoList`,
`App.tsx`, `CrudPage`/formularios, y probar `RefContext`/`AuthContext`
directamente (se ejercitan indirectamente vía el mock de `AuthContext` en
`FlowStepper.test.tsx`). Todos requieren mockear `HttpClient` (`core/HttpClient.ts`,
singleton `http`, se mockearía con `vi.mock`/`vi.spyOn`) y más superficie de
contexto (Auth+Refs+EventBus) — quedan como candidatos concretos de una 2ª
tanda de testing.

---

## 2. Infraestructura nueva

- **`frontend/package.json`** — devDependencies nuevas: `jsdom`,
  `@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event`. El script `"test": "vitest run"` no cambió.
- **`frontend/vite.config.ts`** — bloque `test` (Vitest reutiliza la config de
  Vite; no hace falta un archivo separado):
  ```ts
  test: {
    environment: "jsdom",
    setupFiles: ["./src/testSetup.ts"],
    globals: false, // igual que el backend: imports explícitos de vitest
  }
  ```
  Requiere `/// <reference types="vitest/config" />` para que TS reconozca la
  clave `test` en `defineConfig`.
- **`frontend/src/testSetup.ts`** (nuevo) — matchers `jest-dom`, `cleanup`
  automático entre tests (con `globals:false` no viene gratis como en Jest), y
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true` (React 19 + Vitest no lo activa
  por defecto; sin él, cualquier `act(...)` manual —usado para simular
  `ResizeObserver`— emite un warning falso).
- Estilo de test alineado al backend (confirmado en `backend/tests/
  stateMachine.test.ts` / `descriptorValidation.test.ts`): `describe`/`it` en
  español, `expect` nativo de vitest, sin librerías de mocking adicionales más
  allá de `vi` del propio vitest.
- No hay CI en el repo (sin `.github/`); `pnpm -r test` en la raíz ahora
  ejecuta tests reales en frontend en vez de un no-op.

---

## 3. Tests de lógica pura

- **`frontend/src/core/auth/permisos.test.ts`** (8 casos) — `grants`/
  `grantsAny` (match exacto, comodín `"*"`, sin match, lista vacía) + una
  aserción de regresión directa: `READ_OC` debe incluir `RECEPCION_GESTIONAR`
  (el fix de `docs/07` WS2 punto 5 que le da a bodega acceso a "Órdenes de
  compra").
- **`frontend/src/nav.test.ts`** (5 casos) — `leafVisible` (sin `perm` →
  siempre visible; con `perm` → depende de `hasAnyPerm`), `visibleSections`
  (descarta secciones que quedan vacías), y un caso concreto de regresión:
  con un `hasAnyPerm` que solo otorga `RECEPCION_GESTIONAR` (bodega), el leaf
  real `com-doc-ordenes` de `ALL_LEAVES` aparece en `visibleLeaves(...)`.

---

## 4. `ui/DataTable.test.tsx` (13 casos)

`useRefs()` ya expone un `FALLBACK` fuera de `<RefProvider>`
(`RefContext.tsx:96-103`), así que ningún test necesitó envolver en
providers. jsdom no implementa `ResizeObserver` — se definió un stub local
(`FakeResizeObserver`) que captura el callback observado por `DataTable` y
expone `.fire(width)` para simular cambios de tamaño del contenedor; sin él,
`containerWidth` queda `null` para siempre y las ramas responsive
(`DataTable.tsx:250-264`) nunca se ejercitan.

Casos cubiertos: render + formato de celdas (`money`/`estado`), tooltip con el
valor completo en celdas truncables, orden asc/desc al hacer click en un
header `sortable`, selección + barra de acciones masivas (aparece/desaparece
con "Limpiar"), menú de fila "⋯" (abre, dispara la acción, oculta una acción
marcada `hidden`), paginación (`onPage`, límites), estados vacío/loading
(`EmptyState`/`Skeleton`), **columna de relleno `hasSpacer`** — regresión
directa del fix aplicado hoy mismo: una tabla sin ninguna columna `grow`
agrega un `<td aria-hidden="true">` extra por fila (nota: al estar
`aria-hidden`, queda fuera del árbol de accesibilidad — el conteo se hizo con
`querySelectorAll("td")`, no con `getAllByRole("cell")`), colapso de columnas
`secondary` con disclosure por fila, y vista tarjeta por debajo de 560px.

---

## 5. `ui/FlowStepper.test.tsx` (2 casos)

Se mockeó `../core/auth/AuthContext.js` (`vi.mock`, con `vi.hoisted` para
compartir el permiso de prueba entre la factory y las aserciones) para
controlar `hasAnyPerm` sin `<AuthProvider>` ni red, y se mockeó `../nav.js`
para reemplazar `ALL_LEAVES` por una fixture controlada (7 leaves sintéticos,
cada uno con un único permiso distinto) — así el test no depende de la matriz
real de permisos de negocio (`READ_OC`/`READ_RFQ`/... comparten códigos entre
sí, lo que haría frágil fijar "solo un paso habilitado" contra los datos
reales). Casos: solo el paso cuyo permiso está otorgado queda habilitado
(el resto atenuado/`disabled`) + `aria-current="step"` en el actual; un click
en un paso deshabilitado no dispara `onStep`, uno habilitado sí.

---

## 6. Verificación

```bash
pnpm --filter frontend test        # 28/28 verde (4 archivos)
pnpm -r typecheck                  # limpio (be + fe)
pnpm --filter frontend build       # tsc -b + vite build OK, 72 módulos (sin cambio)
pnpm --filter backend test         # 8/8 verde, sin tocar backend
graphify update .                  # 1880 nodos
```

`pnpm --filter backend test:int` (167 casos) no se re-ejecutó en esta tanda —
no se tocó backend ni DDL/DML.

---

## 7. Puntos de entrada nuevos / tocados

| Necesito… | Archivo |
|---|---|
| Config de testing del frontend | `frontend/vite.config.ts` (bloque `test`), `frontend/src/testSetup.ts` |
| Tests de gating puro | `frontend/src/core/auth/permisos.test.ts`, `frontend/src/nav.test.ts` |
| Tests de `DataTable` | `frontend/src/ui/DataTable.test.tsx` |
| Tests de `FlowStepper` | `frontend/src/ui/FlowStepper.test.tsx` |
| Plan de esta tanda | `C:\Users\j.gonzalez\.claude\plans\shiny-watching-pearl.md` |

## 8. Backlog actualizado (2ª tanda de testing sugerida)

- `ComparativoView` — botón "Adjudicar"/panel de criterios gated por permiso
  (WS2 punto 4), requiere mockear `http.get`/`http.post`.
- `DocumentoList.tsx` (772 líneas) — el god-component del módulo; sin tests,
  cualquier refactor (p. ej. el pendiente de conectarlo al `EventBus`) es
  arriesgado.
- `App.tsx::navigateById` — el fix de WS2 punto 1; hoy solo probado
  indirectamente vía `FlowStepper`/`nav.test.ts`.
- `CrudPage`/`FormGrid`/`Field` — validación en tiempo real de formularios.

El resto del backlog de `docs/07` §1 (OCC salteado, `withTelemetry`
ceremonial, RFQ sin auto-cierre, Devolución sin state machine, etc.) sigue
sin atacar — no era el alcance de esta tanda.

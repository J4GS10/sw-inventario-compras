# Avance 03 — Analítica del dashboard: series temporales + índice de ahorro

> **Qué es este documento.** Reporte del avance sobre el estado que describe
> `docs/01-ESTADO-Y-CONTINUIDAD.md` (documento vivo) y complementa a
> `docs/02-ESTADO-Y-CONTINUIDAD.md`. Cubre el **último pendiente opcional de la
> Fase 6**: las gráficas de serie temporal del dashboard (compras del mes /
> rotación) y el índice tipo *gauge*, que requerían endpoints de agregación
> nuevos.
> Fecha: **2026-09-10**. Verificado contra Oracle 21c local y por HTTP en vivo.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| Endpoint de agregación `GET /api/com/dashboard/resumen` | ✅ |
| `DashboardService` (capa 3, solo lectura) + 3 consultas en `CompraReadRepository` | ✅ |
| Gráfica **Compras por mes** (monto GTQ de OC emitidas, 12 meses) | ✅ |
| Gráfica **Rotación de inventario** (entradas por compra ÷ existencia valorizada) | ✅ |
| **Gauge** de **Ahorro de adjudicación** (adjudicada vs. techo cotizado) | ✅ |
| Primitivos de gráfico reutilizables `ui/Charts.tsx` (`TimeBars`, `Gauge`) | ✅ |
| Fix: etiquetas de mes corridas por `Intl.DateTimeFormat` en hora local | ✅ |

**Pruebas:** 8 unitarias + **128 de integración** (123 previas + 5 nuevas de
`dashboard.int.test.ts`), todas verdes. `tsc` estricto limpio (backend +
frontend); `vite build` OK (70 módulos). `graphify update` (1605 nodos).
`pnpm db:deploy` sin cambios (no toca DDL ni DML).

**Con esto la Fase 6 queda cerrada; el módulo de Compras no tiene pendientes de
alcance.** Backlog residual (opcional, no bloqueante) en `01` §6.7.

---

## 1. Decisiones de métrica (respuestas del usuario)

| Métrica | Definición elegida |
|---|---|
| **Compras del mes** | Monto (GTQ) de **órdenes de compra emitidas** por mes de emisión, últimos 12 meses. Fuente: `COM_ORDEN_COMPRA` + `_DETALLE`. Una sola serie. |
| **Rotación** | Rotación de inventario clásica ≈ **valor de entradas por compra ÷ existencia valorizada**. El usuario aceptó explícitamente leer de INV_ para la agregación (INV sigue fuera del alcance como *módulo*). |
| **Índice gauge** | **Ahorro de adjudicación**: % promedio del ahorro de la cotización adjudicada frente a la más cara cotizada para la misma línea. |

---

## 2. Backend

### 2.1 `dal/repositories/com/CompraReadRepository.ts` — 3 consultas nuevas

SQL parametrizado, mismo estilo que el resto del modelo de lectura (bind vars,
`mapOracleError`, `withConnection`).

| Método | Devuelve | Notas de cálculo |
|---|---|---|
| `comprasPorMesOc(meses)` | `{ periodo, monto, ordenes }[]` (solo meses con datos) | `monto = Σ CANTIDAD·PRECIO_UNITARIO·(1 - PORCENTAJE_DESCUENTO/100)·TASA_CAMBIO` sobre `COM_ORDEN_COMPRA_DETALLE`, agrupado por `TRUNC(FECHA_EMISION,'MM')`. Ventana: `FECHA_EMISION >= ADD_MONTHS(TRUNC(SYSTIMESTAMP,'MM'), -(:meses-1))`. `ordenes = COUNT(DISTINCT ID_ORDEN_COMPRA)`. |
| `valorEntradasPorMes(meses)` | `{ periodo, valor }[]` | `Σ CANTIDAD·COSTO_UNITARIO` de `INV_KARDEX_MOVIMIENTO` con `TIPO_MOVIMIENTO='ENTRADA_COMPRA'`, por `TRUNC(FECHA_MOVIMIENTO,'MM')`. **Mismo costo-base que la existencia** (el kardex guarda el neto en moneda origen de la OC, no re-normalizado a GTQ) para que la razón entradas/existencia sea consistente. |
| `existenciaValorizada()` | `number` | `Σ CANTIDAD_ACTUAL·COSTO_PROMEDIO_ACTUAL` de `INV_EXISTENCIA_BODEGA` (`ELIMINADO='N'`). |
| `ahorroAdjudicacion()` | `{ lineasAdjudicadas, lineasConAlternativa, ahorroPromedioPct, montoAdjudicado, montoSiMasCaro }` | CTE: por `ID_SOLICITUD_DETALLE`, precio neto GTQ `= PRECIO_UNITARIO·(1 - PORCENTAJE_DESCUENTO/100)·TASA_CAMBIO` de cada cotización; se toma el **máximo** cotizado y el de la **adjudicada** (`ADJUDICADO='S'`). Solo cuentan líneas con adjudicada **y** ≥ 2 cotizaciones. `ahorroPromedioPct = AVG((max - adj)/max·100)`; `montoAdjudicado`/`montoSiMasCaro = Σ precio·cantidad adjudicada`. |

### 2.2 `bll/services/com/DashboardService.ts` (nuevo)

- Capa 3, **solo lectura** → **no** hereda de `TransactionalService` (no hay
  escritura ni evento). Compone `CompraReadRepository`.
- `resumen(meses?)`: `meses` se acota a `[1, 24]` (def. 12). Construye la
  **rejilla de N meses** terminando en el mes actual (fechas a medianoche
  **UTC**) y mapea los resultados por `periodo` — los meses sin datos entran en
  cero, así el frontend dibuja una serie continua sin lógica de huecos.
- Derivados: `rotacion.porMes[].rotacion = valorEntradas / existenciaValorizada`
  (denominador constante = existencia actual; 0 si no hay existencia);
  `rotacion12m = Σ entradas 12 m / existencia`; `ahorroPonderadoPct =
  (montoSiMasCaro - montoAdjudicado)/montoSiMasCaro·100`.
- Se expone envuelto en `withTelemetry(new DashboardService(), "DashboardService")`
  en la ruta.

### 2.3 `presentation/routes/com/analitica.ts`

```
GET /api/com/dashboard/resumen?meses=<1..24>   preHandler: authGuard([ANALISIS_VER])
  -> { data: { meses, comprasPorMes[], rotacion{ porMes[], existenciaValorizada,
               valorEntradas12m, rotacion12m }, ahorroAdjudicacion{ lineasAdjudicadas,
               lineasConAlternativa, ahorroPromedioPct, ahorroPonderadoPct,
               montoAdjudicado, montoEvitado }, generadoEn } }
```

`comprasPorMes[]` = `{ periodo:"YYYY-MM", label:"sept 26", monto, ordenes }`.
`rotacion.porMes[]` = `{ periodo, label, valorEntradas, rotacion }`.

---

## 3. Frontend

### 3.1 `core/CompraServices.ts`

- `DashboardAppService` (Singleton) + export `dashboardService`.
  `resumen(meses?)` → `http.get<DashboardResumen>("/api/com/dashboard/resumen", …)`
  (desempaqueta el sobre `{ data }`). Interfaces `DashboardResumen`,
  `PuntoCompraMes`, `PuntoRotacionMes` exportadas.

### 3.2 `ui/Charts.tsx` (nuevo, exports nombrados — convención de `ui/`)

Guía de la skill `dataviz`: **una sola serie → un único hue de marca**
(`--color-brand`), sin leyenda (el título de la tarjeta nombra la serie); texto
siempre con tokens de tinta; marcas finas, extremos redondeados 4px anclados a la
línea base, separación 2px; cada gráfico expone una **vista de tabla**
(`<details>`) para lectores de pantalla / impresión / daltonismo.

- **`TimeBars`** — columnas verticales para change-over-time. `props: { data:
  {label,value}[], format?, ariaLabel, emptyText?, valueHeader? }`. Labels de
  valor **selectivos** (solo la barra máxima y la última); resto en `title` y en
  la tabla. `role="img"` + `aria-label`. Degradación: si toda la serie es 0
  muestra `emptyText`.
- **`Gauge`** — arco semicircular SVG 0–100. `props: { value, label, caption?,
  format? }`. Pista en `--color-surface-2`, valor en `--color-brand`, número
  central con `--color-heading`. `role="img"` con `aria-label`.

### 3.3 `modules/Dashboard.tsx`

Tras las tarjetas existentes (KPIs, *OC por estado*, *Empezar*), si
`dashboardService.resumen()` respondió:

- **Fila**: *Compras por mes* (`TimeBars`, formato `Q N.Nk` compacto) ·
  *Rotación de inventario* (`TimeBars` en `×`, + índice 12 m y existencia
  valorizada como texto).
- **Fila**: *Ahorro de adjudicación* (`Gauge` con `ahorroPonderadoPct`, caption
  con nº de líneas y promedio simple) · tarjeta "Qué mide este índice" con monto
  adjudicado / evitado / líneas adjudicadas.

Si el fetch falla, `resumen` queda `null` y esas filas simplemente no se
renderizan (el resto del dashboard sigue).

---

## 4. Bug corregido

`Intl.DateTimeFormat` formatea en la zona horaria **local** por defecto. La
rejilla de meses usa fechas a **medianoche UTC**; en un servidor al oeste de UTC
(p. ej. `America/Guatemala`, UTC−6) `Date.UTC(2026, 8, 1)` cae el 31/08 local y se
etiquetaba como "ago 26" en el bucket "2026-09". Se corrigió añadiendo
`timeZone: "UTC"` al formateador `MES_LABEL` en `DashboardService.ts`. Verificado
por HTTP: `2026-09 -> "sept 26"`.

---

## 5. Verificación

```bash
pnpm db:deploy                    # 103 tablas, 26 COM_ (sin cambios de datos)
pnpm -r typecheck                 # limpio (backend + frontend)
pnpm --filter backend test        # 8/8 unitarias
pnpm --filter backend test:int    # 128/128 integración
pnpm --filter frontend build      # tsc -b + vite build OK (70 módulos)
graphify update .                 # 1605 nodos
```

`tests/dashboard.int.test.ts` (5): monta Solicitud → Aprobación×2 → RFQ (3 prov.)
→ 3 cotizaciones (30 / **25.5** / 28) → adjudica la barata → OC → ENVIADA /
EN_TRANSITO → Recepción, y comprueba sobre `GET /api/com/dashboard/resumen`:

1. `comprasPorMes` tiene 12 buckets, el último es el mes actual, `label`
   no vacío, el bucket del mes actual con `ordenes ≥ 1` y `monto ≥ 510`.
2. `rotacion`: `existenciaValorizada > 0`, `valorEntradas12m > 0`, `porMes` de
   12 puntos, el mes actual con `valorEntradas > 0`.
3. `ahorroAdjudicacion`: `lineasAdjudicadas ≥ 1`, `lineasConAlternativa ≥ 1`,
   `ahorroPonderadoPct ∈ (0, 100]`, `ahorroPromedioPct > 0`, `montoEvitado > 0`
   (adjudica 25.5 frente a techo 30 → ~15 %).
4. `?meses=6` → `meses:6` y series de 6 puntos.

Comprobación en vivo (`X-Dev-User: 0` contra `:3000`):
`?meses=6` → mes actual `monto` 16 320 / `ordenes` 43; `rotacion.rotacion12m` 1.0
con `existenciaValorizada` 15 810; `ahorroPonderadoPct` 14.67 /
`ahorroPromedioPct` 14.89 sobre 22 líneas con alternativa.

---

## 6. Puntos de entrada nuevos de este avance

| Necesito… | Archivo |
|---|---|
| Series temporales + índice del dashboard (lógica) | `backend/src/bll/services/com/DashboardService.ts` |
| Consultas de agregación | `backend/src/dal/repositories/com/CompraReadRepository.ts` (`comprasPorMesOc`, `valorEntradasPorMes`, `existenciaValorizada`, `ahorroAdjudicacion`) |
| Ruta | `backend/src/presentation/routes/com/analitica.ts` (`GET /api/com/dashboard/resumen`) |
| Servicio de app (frontend) | `frontend/src/core/CompraServices.ts` (`DashboardAppService`, `dashboardService`) |
| Primitivos de gráfico | `frontend/src/ui/Charts.tsx` (`TimeBars`, `Gauge`) |
| Wiring del dashboard | `frontend/src/modules/Dashboard.tsx` |
| Pruebas | `backend/tests/dashboard.int.test.ts` |

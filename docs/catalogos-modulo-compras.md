# Catálogos y campos de referencia — Módulo de Gestión de Compras

Análisis de dónde el módulo usa (o debería usar) un catálogo / lista controlada
en lugar de texto libre o ID a mano, y qué se implementó.

---

## 1. Tipos de "catálogo" en el módulo

| Tipo | Fuente | Ejemplos |
|---|---|---|
| **Tabla catálogo COM_** | CRUD propio (`/api/com/*`) | monedas, proveedores, condiciones de pago, términos de entrega, categorías, grupos, centros de costo, acuerdos marco |
| **Tabla de otro módulo (referencia)** | endpoint solo lectura (`/api/com/ref/*`) | empleados (NOM), sucursales (NOM), departamentos (NOM), artículos (INV), unidades de medida (INV), bodegas (INV) |
| **Catálogo estático** | lista fija en `frontend/src/core/catalogosEstaticos.ts` | calificación de proveedor, criterio de comparación, estado A/I, prioridad, tipo de excepción, estado de seguimiento, motivo de devolución |
| **Select dependiente** | endpoint parametrizado por otro campo | renglón de solicitud (por RFQ), cotización adjudicada (por solicitud), renglón de OC (por orden), renglón de recepción (por recepción) |

---

## 2. Datos semilla cargados (`database/dml/`)

`00_seed_base.sql` — usuario de sistema (id 1) + bodega central.
`01_seed_maestros.sql` (nuevo) — hace útiles los selects:

| Tabla | Antes | Ahora |
|---|---|---|
| NOM_DEPARTAMENTO | 0 | 6 |
| INV_UNIDAD_MEDIDA | 2 | 12 |
| INV_ARTICULO | 1 | 9 |
| NOM_EMPLEADO | 1 | 5 |
| NOM_SUCURSAL | 1 | 3 |
| COM_PROVEEDOR | 3 | 7 (con calificación) |
| COM_GRUPO_COMPRA | 3 | 7 |
| COM_CENTRO_COSTO | 3 | 6 (ligados a departamento) |

`com_seed.sql` — monedas (3), condiciones de pago (4), términos (3), categorías (3).
Todo idempotente (`WHERE NOT EXISTS` / columnas UNIQUE). Se aplica con `pnpm db:deploy`.

---

## 3. Campos corregidos (eran texto/ID libre, ahora son catálogo)

### Catálogos (`frontend/src/modules/compras/catalogPages.tsx`)

| Pantalla · campo | Antes | Ahora |
|---|---|---|
| Centros de costo · Departamento | `integer` (ID a mano) | `select` desde `/api/com/ref/departamentos` |
| Acuerdos marco · Artículo | `integer` (ID a mano) | `select` desde `/api/com/ref/articulos` (código — nombre) |
| Proveedores · Calificación | texto libre `VARCHAR2(20)` | `select` estático (A+, A, B, C, Nuevo) |

### Comparativo de cotizaciones (`ComparativoView.tsx`)

| Campo | Antes | Ahora |
|---|---|---|
| Criterio de evaluación | texto libre | `select` estático (Precio, Plazo de entrega, Calidad, Condiciones de pago, Garantía, Servicio posventa, Experiencia previa, Capacidad de suministro) |

### Formularios de captura (`documentForms.ts`) — selects DEPENDIENTES

Los renglones de detalle referenciaban una línea por ID a mano. Ahora se eligen
de una lista que depende de un campo de la cabecera:

| Documento · campo de línea | Depende de | Endpoint | Etiqueta mostrada |
|---|---|---|---|
| Cotización · Renglón de la solicitud | `idRfq` | `GET /api/com/ref/rfq/{id}/lineas-solicitud` | `#id · descripción · cantidad unidad` |
| Orden de compra · Cotización adjudicada | `idSolicitud` | `GET /api/com/ref/cotizaciones-adjudicadas?idSolicitud=` | `proveedor · descripción · Q precio` |
| Recepción · Renglón de la orden | `idOrdenCompra` | `GET /api/com/ordenes-compra/{id}` (`pick: details`) | `#id · descripción · cant N` |
| Devolución · Renglón de la recepción | `idRecepcion` | `GET /api/com/recepciones/{id}` (`pick: details`) | `#id · OC-renglón M · recibido N` |

Mecánica: `formSupport.ts` → `useOptions(fields, values)` resuelve placeholders
`{campo}` en la ruta con el valor actual del formulario y vuelve a pedir cuando
cambia el campo del que depende.

---

## 4. Campos que quedan como texto libre (correcto)

- `COM_SOLICITUD_COMPRA.JUSTIFICACION`, `COM_SEGUIMIENTO_ORDEN.NOTAS`,
  `COM_EXCEPCION_ORDEN.DESCRIPCION`, `COM_COMPARATIVO_COTIZACIONES.NOTAS`,
  `COM_*_DETALLE.DESCRIPCION` — descripciones y notas libres por naturaleza.
- `COM_PROVEEDOR.DIRECCION / TELEFONO / EMAIL / NIT / CUENTA_BANCARIA / BANCO` —
  datos propios del proveedor.
- `COM_ORDEN_COMPRA.NUMERO_REFERENCIA` — referencia externa del proveedor.

## 5. Pendiente (catálogos estáticos ya definidos, faltan sus pantallas)

`COM_EXCEPCION_ORDEN.TIPO` y `COM_SEGUIMIENTO_ORDEN.ESTADO_REPORTE` deberían usar
`TIPO_EXCEPCION_ORDEN` / `ESTADO_SEGUIMIENTO_ORDEN` (ya en `catalogosEstaticos.ts`),
pero esas entidades solo tienen CRUD genérico por API, sin formulario de captura
en la UI todavía. `COM_DEVOLUCION.MOTIVO` → `MOTIVO_DEVOLUCION` (listo para
cablear cuando el form de devolución use `select` para el motivo).

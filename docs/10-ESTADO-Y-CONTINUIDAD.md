# Avance 10 — Auditoría exhaustiva, alineación visual con imágenes de referencia y reset de datos

> Reporte de avance sobre `docs/01-ESTADO-Y-CONTINUIDAD.md` (documento vivo,
> ya actualizado con el estado final — este archivo es el registro narrativo
> de **cómo** se llegó a ese estado en esta sesión). Fecha: **2026-09-12**.
> Sin cambios de DDL.

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| Validación real, no solo lectura de código: verificar backend/frontend arriba, login funcional | ✅ |
| Matriz de autorización rol×recurso×operación por HTTP real (968 checks) | ✅ 968/968 |
| Flujo de negocio real de punta a punta, con roles reales (88 + 14 checks) | ✅ 102/102 |
| Bug real corregido: Bodega no podía recibir una OC en estado `EMITIDA` | ✅ |
| 2 bugs reales corregidos en el propio arnés de QA (Playwright) | ✅ |
| Análisis de 3 imágenes de referencia + identificación de 7 capacidades faltantes | ✅ |
| Paquete completo de mejoras visuales/UX aplicado | ✅ |
| Aislamiento de raíz de las 2 últimas fallas conocidas de `test:int` | ✅ **171/171 — primera vez** |
| Vista previa de Orden de Compra en pantalla (hueco señalado por el usuario) | ✅ |
| Botón de envío por correo: agregado y luego retirado (decisión explícita del usuario) | ✅ |
| Limpieza de contaminación de pruebas en catálogos (113 filas) | ✅ |
| Reset completo de la data transaccional + 5 ciclos de negocio reales | ✅ |
| `graphify update .` + `tsc` backend y frontend, tras cada cambio | ✅ verdes |

**Estado final**: módulo funcionalmente validado de extremo a extremo,
visualmente alineado a las imágenes de referencia que el usuario compartió, y
con datos de demostración limpios y con sentido de negocio.

---

## 1. Cómo se llegó aquí (cronología de la sesión)

1. **"Necesito que la validación sea rol por rol, cada una de las
   verificaciones CRUD... determina qué mejoras... pueden aplicarse"** —
   arranca la sesión pidiendo ir más allá de la auditoría de la sesión
   anterior. Se construyó una matriz de autorización completa (rol × recurso
   × operación, 968 checks) y un flujo de negocio real de punta a punta con
   sesión real de cada rol (102 checks entre dos scripts). Se encontró un bug
   real: Bodega elegía una Orden de Compra que el propio sistema le ofrecía
   como receptible (estado `EMITIDA`) y el backend la rechazaba con un 409 —
   la máquina de estados no permitía recibir directo desde `EMITIDA`.
   Corregido. Se encontraron y corrigieron además 2 bugs en el propio arnés
   de QA (Playwright), no en la aplicación — ver `docs/01-` §5.-34.

2. **"Analiza las imágenes en la carpeta skills... necesito que el sistema
   sea así... hay cosas que no tengo consideradas... se pueden aplicar??"**
   — el usuario compartió 3 imágenes (`skills/*.jpg`: directorio de
   proveedores, seguimiento de despachos, vista previa de orden de compra).
   Se analizaron contra el código real y una captura real de la pantalla
   equivalente (no contra suposiciones): el patrón visual ya coincidía en
   ~90%; se identificaron 7 capacidades puntuales faltantes, cada una
   verificada contra el DDL congelado antes de prometerla como viable. Vía
   `AskUserQuestion` el usuario eligió el "Paquete completo" y dio el nombre
   real de la empresa ("Clavos S.A.", NIT/dirección/teléfono genéricos).

3. **Implementación del paquete completo**, en varias rondas dentro de la
   misma sesión, cada una verificada con captura real y regresión completa:
   mensajes de error en lenguaje de negocio, RFQ que previene el error en vez
   de rechazarlo, código HTTP de Eliminar unificado, aislamiento de 2 fallas
   de test conocidas (**171/171 por primera vez**), calificación de proveedor
   con estrellas, familias de producto derivadas, tarjetas KPI, marca real de
   la empresa en sidebar/login/PDF. Ver `docs/01-` §5.-35 para el detalle
   completo de cada pieza.

4. **"Por que ahora ya no hay filtros, necesito que se incluyan"** — el
   paquete inicial cubrió buscador y exportar pero no el botón "Filtrar" de
   la imagen. Se agregó como panel genérico en `DataTable` (reutilizable) y
   se aplicó donde tiene sentido de negocio (Estado/Activa).

5. **"Me refiero a que no hay una vista preliminar de la orden de compra"**
   — el usuario aclaró el hueco pendiente de "el formato de las imágenes no
   está": faltaba la tercera imagen (documento en pantalla antes de emitir).
   Se construyó `OrdenCompraPreview.tsx` + endpoint dedicado, reutilizando
   exactamente los mismos datos resueltos que el PDF.

6. **"No habra correo habilitado por ahora"** — el botón "Emitir vía correo"
   (agregado deshabilitado, a la espera de credenciales SMTP que nunca se
   dieron) se retiró de la vista previa a pedido explícito, en vez de dejarlo
   como un elemento muerto sin plan cercano de activarlo.

7. **"Necesito que borres toda la data de la db... cotizaciones de valor,
   data de valor, para ver ya el funcionamiento"** — antes de ejecutar una
   operación destructiva sobre la Oracle real, se investigó el alcance
   exacto: se encontraron 113 filas de contaminación de pruebas automatizadas
   en 4 catálogos (Condiciones de pago, Centros de costo, Monedas, un
   proveedor con NIT falso) y se limpiaron. Luego se usó una herramienta ya
   existente en el repo (`pnpm db:seed:flujo`) para vaciar toda la data
   transaccional (+4700 filas acumuladas) y generar 5 ciclos de negocio
   reales y completos, parados en distintas etapas del flujo.

---

## 2. Estado final verificado

- **968/968** checks de autorización (rol × recurso × operación, HTTP real).
- **102/102** checks de flujo de negocio real de punta a punta, roles reales.
- **171/171** integración backend — sin fallas conocidas, primera vez en el
  historial del proyecto (las 2 fallas que venían arrastrándose se aislaron
  de raíz, no se silenciaron).
- **29/29** frontend, `tsc` limpio en ambos proyectos.
- Base de datos: catálogos limpios, 5 solicitudes / 4 RFQ / 12 cotizaciones /
  3 OC / 2 recepciones / 1 devolución — todo real y trazable, sin residuos de
  pruebas.
- `graphify update .` corrido tras cada ronda de cambios (último: 2114 nodos).

## 3. Qué NO cambió (deliberadamente)

- El DDL (`SCRIPT_DDL.sql`) — ninguna capacidad nueva requirió tocarlo; las
  que parecían necesitarlo (familias de producto) se resolvieron derivando
  de relaciones ya existentes.
- RBAC, catálogo de permisos, usuarios demo, maestros (`NOM_`/`INV_` base).
- El principio "un rol solo ve lo que gestiona" (bloque §5.-33) — no se tocó.
- El envío de OC por correo — explícitamente fuera de alcance por ahora.

## 4. Sin pendientes de alcance

No hay tareas abiertas de esta sesión. El siguiente trabajo (envío de OC por
correo vía SMTP corporativo) requiere que el usuario provea credenciales
reales cuando decida retomarlo — ver `docs/01-` §5.-35 para el detalle
técnico de lo que falta (host/puerto/usuario/remitente en el chat, contraseña
directo en `.env`).

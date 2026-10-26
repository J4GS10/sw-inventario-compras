# Compras e Inventario · Módulo ERP

## Diseño UI/UX y arquitectura del mockup de alta fidelidad

Sistema de diseño, patrones de interacción y lineamientos visuales del módulo. Este diseño integra directrices formales de UI/UX y principios centrados en el usuario para garantizar una experiencia clara, consistente, accesible e intuitiva.

---

## 1. Agenda

1. Objetivo y principios de diseño
2. Sistema de diseño
3. Arquitectura de la interfaz
4. Arquitectura de software
5. Componentes reutilizables
6. Pantallas clave
7. Experiencia interactiva y accesibilidad

---

## 2. Objetivo y principios de diseño

El módulo de Compras e Inventario debe presentar una interfaz limpia, profesional y consistente con el resto de la suite ERP (Nómina, Cuentas por Cobrar y Cuentas por Pagar). La interfaz debe manejar una cantidad considerable de información sin resultar abrumadora, priorizando la claridad, la jerarquía visual y la facilidad de uso.

El diseño toma como referencia principios de **Material Design 3**, **Apple Human Interface Guidelines** y **Fluent Design**, adaptados al sistema visual definido para el proyecto.
/patrondienemo.md
### Material Design 3
- Elevación mediante superficies y sombras suaves.
- Radios consistentes entre 8 y 14 px según el componente.
- Uso de colores semánticos para éxito, advertencia y error.
- Estados visuales claros para botones, campos, navegación y acciones.
- Retroalimentación inmediata ante las interacciones del usuario.

### Apple Human Interface Guidelines
- Jerarquía tipográfica clara.
- Espaciado suficiente para facilitar la lectura.
- Interfaz limpia y enfocada en la tarea.
- Uso consistente de iconografía de línea.
- Reducción de elementos visuales innecesarios.

### Fluent Design
- Sombras suaves para establecer jerarquía entre superficies.
- Transiciones breves y naturales.
- Componentes con respuesta visual inmediata.
- Separación clara entre navegación, contenido y acciones.

---

## 3. Sistema de diseño — Paleta de color

**Principio fundamental:** Los colores se utilizan para establecer jerarquía, comunicar estados y destacar acciones importantes sin generar una carga cognitiva innecesaria.

### Colores oficiales

| Token | Color | Uso |
|---|---|---|
| `bg` | `#e8f0fe` | Fondo principal de la aplicación |
| `surface` | `#ffffff` | Tarjetas, formularios, tablas y superficies principales |
| `sidebar` | `#0b1a38` | Barra lateral y navegación principal |
| `sidebarHover` | `rgba(255,255,255,0.06)` | Estado hover de elementos del sidebar |
| `sidebarActive` | `rgba(255,255,255,0.10)` | Estado activo de navegación |
| `text` | `#1d1d1f` | Texto principal |
| `textSub` | `#6e6e73` | Texto secundario y descripciones |
| `textMuted` | `#aeaeb2` | Texto auxiliar y etiquetas de baja prioridad |
| `border` | `rgba(0,0,0,0.06)` | Bordes y separadores |
| `accent` | `#0071e3` | Acciones principales, enlaces y elementos activos |
| `accentSub` | `#e8f1fb` | Fondos suaves asociados al color principal |
| `teal` | `#00a693` | Estados o indicadores asociados a información complementaria |
| `danger` | `#ff3b30` | Errores, eliminación y alertas críticas |
| `warn` | `#ff9500` | Advertencias y situaciones que requieren atención |
| `success` | `#34c759` | Confirmaciones y estados exitosos |

**Regla:** el azul `#0071e3` funciona como color dominante de la interfaz. Los colores semánticos (`success`, `warn` y `danger`) se utilizan únicamente cuando representan un estado o acción real del sistema.

---

## 4. Tipografía e iconografía

### Tipografía

La tipografía principal del sistema utiliza la siguiente familia:

`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`

- La interfaz, navegación, títulos, etiquetas y componentes utilizan la tipografía principal del sistema.
- Los datos tabulares, códigos, identificadores y valores monetarios utilizan una tipografía monoespaciada.
- Familia monoespaciada: `'JetBrains Mono', 'SF Mono', monospace`.
- El texto principal utiliza `#1d1d1f`.
- El texto secundario utiliza `#6e6e73`.
- El texto auxiliar utiliza `#aeaeb2`.
- Se utiliza suavizado tipográfico mediante `-webkit-font-smoothing: antialiased`.

### Iconografía

- Se utiliza **Lucide React** como biblioteca de iconos.
- Los iconos utilizan un estilo lineal/outline.
- Grosor de línea aproximado de 2 px.
- Tamaño habitual de 16-18 px para acciones y navegación.
- El color del icono debe relacionarse con la acción o texto al que acompaña.
- Los iconos utilizados dentro de KPI y alertas se presentan dentro de contenedores de color suave.
- No se mezclan estilos de iconografía diferentes dentro de la misma interfaz.

---

## 5. Arquitectura de la interfaz

La interfaz mantiene una estructura consistente entre las diferentes pantallas del sistema: **sidebar contextual, contenido principal y elementos de navegación y acción claramente diferenciados**.

### Sidebar

- Fondo: `#0b1a38`.
- Navegación lateral contextual.
- Ancho de referencia: 264 px en estado expandido.
- Estado colapsado: aproximadamente 76 px.
- Elementos con radio de 8 px.
- Estado hover: `rgba(255,255,255,0.06)`.
- Estado activo: `rgba(255,255,255,0.10)`.

Dentro del módulo de Gestión de Compras, la navegación se organiza por procesos:

- Solicitudes
- Cotizaciones
- Proveedores
- Catálogo
- Órdenes de Compra
- Recepción
- Facturación / CxP

La navegación conserva el contexto del módulo y permite regresar al **Dashboard General**.

### Barra superior

La barra superior contextual puede contener:

- Identificación de la empresa.
- Contexto del módulo.
- Búsqueda.
- Notificaciones.
- Usuario.
- Acciones relacionadas con la pantalla actual.

### Contenido

El área principal utiliza una distribución organizada mediante:

- Tarjetas KPI.
- Formularios.
- Tablas de información.
- Filtros.
- Acciones primarias y secundarias.
- Mensajes de ayuda.
- Estados de carga y confirmación.

Los elementos se distribuyen priorizando la jerarquía visual y evitando saturar la pantalla.

---

## 6. Arquitectura de software

El sistema se implementará utilizando una arquitectura orientada a servicios y separando las responsabilidades entre frontend, backend y base de datos.

### Presentación — Frontend

Implementada con **React**.

Responsabilidades:

- Sidebar y navegación.
- Barra superior.
- Vistas y formularios.
- Tarjetas KPI.
- Tablas.
- Modales.
- Validaciones visuales.
- Mensajes de estado.
- Interacción con las API.

### Aplicación — Backend

Implementada con **Node.js**.

Responsabilidades:

- Procesamiento de solicitudes.
- Reglas de aplicación.
- Validaciones.
- Autenticación y autorización.
- Gestión de sesiones mediante JWT.
- Paginación y filtros.
- Comunicación con la base de datos.
- Exposición de API REST.

### Servicios

- API REST.
- Contratos de intercambio de datos mediante JSON.
- Endpoints organizados por dominio funcional.
- Autenticación y autorización mediante JWT cuando corresponda.
- Comunicación entre módulos mediante contratos definidos.

### Dominio

El dominio contempla las principales entidades relacionadas con el proceso de compras e inventario, entre ellas:

- Producto.
- Proveedor.
- Solicitud de compra.
- Cotización.
- Propuesta de proveedor.
- Orden de compra.
- Recepción de mercadería.
- Factura.
- Movimiento de inventario.

### Lógica de negocio

Incluye:

- Validación de solicitudes.
- Reglas de aprobación.
- Gestión y comparación de cotizaciones.
- Selección de propuestas.
- Validaciones de productos y proveedores.
- Reglas de recepción.
- Validaciones relacionadas con inventario.
- Validaciones de facturación y Cuentas por Pagar.

### Persistencia

La persistencia se realizará mediante una capa de acceso a datos que mantenga separada la lógica de negocio de las operaciones directas sobre la base de datos.

### Base de datos

Se utilizará **Oracle Database** como sistema gestor de base de datos.

El modelo debe contemplar:

- Integridad referencial.
- Restricciones de datos.
- Relaciones entre entidades.
- Auditoría cuando sea requerida.
- Persistencia de la información de compras e inventario.

---

## 7. Componentes reutilizables

- **Botones:** acciones claramente diferenciadas mediante botones primarios, secundarios, ghost y de peligro.
- **Tarjeta KPI:** icono dentro de un contenedor suave + valor principal + indicador de variación o estado.
- **Tabla de datos:** encabezados claros, separación entre filas, hover y acciones en línea.
- **Formulario:** campos agrupados por contexto, etiquetas visibles, validación y mensajes de ayuda.
- **Modal:** utilizado para acciones que requieren atención o confirmación sin abandonar la pantalla actual.
- **Notificación toast:** confirmaciones y mensajes no bloqueantes.
- **Chip / badge:** representación compacta de estados como activo, pendiente, aprobado, rechazado o agotado.
- **Hints y tooltips:** información contextual para aclarar acciones o campos.
- **Loading skeleton:** representación de carga que conserva la estructura visual del contenido.
- **Breadcrumb:** ubicación contextual dentro del módulo.
- **Selector de contexto:** permite identificar el módulo o sección actual.
- **Filtros:** controles para facilitar la búsqueda y exploración de información.

### Botones

Los botones siguen las siguientes reglas:

- Sin borde adicional.
- Radio de 8 px.
- Transición: `opacity .15s, background .15s`.
- Botón primario: fondo `#0071e3` y texto blanco.
- Botón ghost: fondo `rgba(0,0,0,0.05)`.
- Botón de peligro: fondo de `#ff3b30` con baja opacidad y texto `#ff3b30`.
- Las acciones principales deben destacar visualmente sobre las secundarias.

### Inputs

Los campos de entrada utilizan:

- Fondo: `rgba(0,0,0,0.03)`.
- Borde: `1.5px solid rgba(0,0,0,0.06)`.
- Radio: 8 px.
- Padding: `7px 12px`.
- Tamaño de texto: 13 px.
- Estado de foco: borde con el color `#0071e3`.

### Chips y badges

- Forma tipo pill.
- Altura visual compacta.
- Radio aproximado de 20 px.
- Padding: `2px 9px`.
- Tamaño de texto: 11 px.
- Peso: 500.
- El color debe corresponder al estado representado.

### Tablas

- Encabezado con fondo `rgba(0,0,0,0.015)`.
- Encabezados en tamaño aproximado de 11 px.
- Filas separadas mediante bordes sutiles.
- Hover visual sobre la fila.
- Columnas numéricas alineadas a la derecha.
- Identificadores y códigos con tipografía monoespaciada.
- Acciones disponibles en línea cuando sea apropiado.

### Moneda

Los valores monetarios se presentan utilizando el formato regional de Guatemala:

`Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 })`

---

## 8. Pantallas clave — Gestión de Compras

El módulo de Gestión de Compras se organiza alrededor del flujo:

**Solicitud de compra → Aprobación → Cotizaciones → Comparación de propuestas → Selección de proveedor → Orden de compra → Recepción de mercadería → Facturación / CxP**

Las 15 vistas del módulo se distribuyen de la siguiente manera:

### Solicitudes

- Nueva Solicitud de Compra.
- Revisión de Solicitud de Compra.
- Bandeja de Aprobaciones.
- Detalle de Solicitud de Compra.

### Cotizaciones

- Gestión de Cotizaciones.
- Registro de Propuestas de Proveedores.
- Cuadro Comparativo de Cotizaciones.

### Proveedores

- Directorio de Proveedores.

### Catálogo

- Nuevo Producto en el Catálogo Permanente.

### Órdenes de Compra

- Vista Previa de Orden de Compra.

### Recepción

- Recepción de Mercadería.
- Seguimiento de Despachos.

### Facturación / CxP

- Ingreso de Factura (DTE).
- Conciliación Tripartita.
- Integración a Cuentas por Pagar.

---

## 9. Pantallas de Catálogos y Productos

**Objetivo del Catálogo:** Mantener una información consistente de los productos utilizados durante el proceso de compras e inventario.

La interfaz debe priorizar la búsqueda, consulta y registro de productos sin introducir campos innecesarios.

### Catálogo

- Búsqueda y filtros.
- Información organizada en tablas.
- Identificación mediante SKU o código.
- Familia y unidad de medida.
- Información de proveedores cuando corresponda.
- Precios y datos relevantes del producto.
- Estado del producto.
- Última actualización cuando sea necesaria.

### Nuevo Producto en el Catálogo Permanente

La pantalla solicita únicamente la información necesaria para registrar el producto, incluyendo:

- Nombre del producto.
- Familia.
- Unidad de medida.
- Ubicación.
- Descripción.
- Especificaciones técnicas.

El sistema puede generar automáticamente el SKU o código correspondiente después de validar la información requerida.

---

## 10. Pantallas de formularios

**Objetivo de los formularios:** Solicitar y estructurar la información necesaria para el negocio de manera clara y progresiva, evitando campos superfluos.

### Organización

Los formularios deben agrupar información relacionada y permitir que el usuario identifique rápidamente:

- Qué información debe ingresar.
- Qué campos son obligatorios.
- Qué formato debe utilizar.
- Qué acción puede realizar después.

### Validación

- Validación en tiempo real cuando sea apropiado.
- Campos obligatorios identificados claramente.
- Mensajes de ayuda próximos al campo.
- Mensajes de error específicos.
- El borde y estado visual del campo cambia cuando existe un error o validación exitosa.
- No se depende únicamente del color para comunicar un error.

### Campos automáticos

Cuando corresponda, el sistema puede generar automáticamente:

- SKU.
- Código de producto.
- Código de barras.
- Código QR.

Estos valores deben diferenciarse visualmente de los campos que requieren ingreso manual.

---

## 11. Experiencia interactiva y accesibilidad (UX Intuitivo)

Para garantizar que el módulo sea fácil de aprender, eficiente y accesible, se integran los siguientes patrones:

### Asistente y guiado

- Onboarding cuando sea necesario para usuarios nuevos.
- Hints y mensajes contextuales.
- Indicaciones breves durante procesos complejos.
- Retroalimentación inmediata después de una acción.

### Hints y Tooltips

Los hints y tooltips se utilizan para:

- Explicar iconos de acción.
- Aclarar campos.
- Mostrar información adicional sin saturar la pantalla.
- Reducir la incertidumbre durante el llenado de formularios.

### Confirmación explícita

Las acciones destructivas o de impacto importante deben solicitar confirmación.

Ejemplos:

- Eliminación de registros.
- Eliminación masiva.
- Cancelación de una operación.
- Acciones que modifiquen información crítica.

### Loading skeletons

Los estados de carga deben utilizar skeletons cuando sea conveniente para conservar la estructura visual de la pantalla y proporcionar retroalimentación inmediata.

### Contraste y accesibilidad

- Objetivo de conformidad **WCAG 2.2 AA**.
- Contraste suficiente entre texto y fondo.
- Foco visible en elementos interactivos.
- No depender únicamente del color para comunicar estados.
- Etiquetas y mensajes comprensibles.

### Navegación por teclado

Los elementos interactivos deben poder utilizarse mediante teclado y mantener un indicador de foco visible.

### Responsive

- Sidebar adaptable.
- Contenido reorganizable en pantallas pequeñas.
- Tablas y formularios adaptables.
- Ocultamiento o colapso de elementos secundarios cuando el espacio sea limitado.

### Atajos rápidos

Cuando se implemente búsqueda global, se puede utilizar:

`Ctrl + K`

para acceder rápidamente a la búsqueda de productos, órdenes, proveedores u otros registros.

---

## 12. Reglas generales de consistencia visual

- Mantener la misma paleta de colores en todas las vistas.
- Utilizar `#0071e3` como color principal de interacción.
- Utilizar `#0b1a38` para la navegación lateral.
- Utilizar `#ffffff` para superficies principales.
- Mantener radios consistentes: 14 px para tarjetas y superficies principales, 10 px para elementos secundarios y 8 px para botones e inputs.
- Utilizar sombras suaves:
  - `0 2px 16px rgba(0,0,0,0.06)`
  - `0 4px 24px rgba(0,0,0,0.09)`
- Evitar colores arbitrarios o valores diferentes a los tokens oficiales.
- Mantener iconografía Lucide React en estilo outline.
- Mantener jerarquía visual clara entre acciones primarias y secundarias.
- Utilizar colores semánticos únicamente cuando representen estados reales.
- Mantener consistencia entre todas las vistas del módulo.
- Los títulos y nombres de las vistas deben mantenerse alineados con el flujo funcional definido para el proyecto.

---

## 13. Principios de interacción aplicados

El diseño debe considerar los siguientes principios de UX:

- **Usabilidad:** el usuario debe poder aprender, utilizar y recordar las funciones del sistema con facilidad.
- **Utilidad:** cada elemento de la interfaz debe aportar a una tarea concreta.
- **Accesibilidad:** la información y las acciones deben poder ser percibidas, operadas, comprendidas y utilizadas de forma robusta.
- **Arquitectura de información:** la información se organiza de acuerdo con el proceso de compras y el contexto de cada pantalla.
- **Modelo mental:** la interfaz debe representar conceptos que sean familiares para el usuario del proceso de compras.
- **Affordance:** los elementos interactivos deben comunicar visualmente que pueden ser utilizados.
- **Retroalimentación:** toda acción relevante debe producir una respuesta visible del sistema.
- **Reducción de carga cognitiva:** se muestran únicamente las opciones y datos necesarios para la tarea actual.
- **Búsqueda y navegación:** el usuario puede encontrar información mediante filtros, búsqueda y navegación contextual.

---

## 14. Flujo visual y respuesta del sistema

Cada interacción debe seguir un ciclo claro:

**Objetivo del usuario → Acción → Respuesta del sistema → Evaluación del resultado**

La interfaz debe minimizar la distancia entre la intención del usuario y la respuesta del sistema.

Ejemplos:

- Al guardar un registro, mostrar una confirmación.
- Al existir un error, indicar el campo y explicar cómo corregirlo.
- Al cargar información, mostrar un estado de carga.
- Al completar una operación, actualizar la información visible.
- Al realizar una acción destructiva, solicitar confirmación antes de ejecutarla.

---

## 15. Criterio final de diseño

El diseño visual y funcional del módulo debe mantenerse consistente con el sistema de diseño oficial definido para el proyecto.

La prioridad de diseño es:

1. **Claridad**
2. **Consistencia**
3. **Usabilidad**
4. **Accesibilidad**
5. **Retroalimentación inmediata**
6. **Jerarquía visual**
7. **Eficiencia en las tareas**

Todas las vistas del módulo de Compras e Inventario deben utilizar estos lineamientos como referencia para mantener una experiencia uniforme entre **Gestión de Compras, Catálogo, Proveedores, Recepción, Órdenes de Compra y Facturación / CxP**.

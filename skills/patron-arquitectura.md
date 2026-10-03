# Skill: Arquitectura de 6 Capas, Análisis y Patrones de Diseño (`sw-inventario`)

Este documento establece el marco de referencia formal para el análisis, diseño de software, patrones arquitectónicos y buenas prácticas de desarrollo orientadas a objetos para el sistema `sw-inventario`. Aplica a todas las implementaciones generadas por Claude Code y Gemini CLI.

---

## 1. Fundamentos de Análisis y Diseño de Sistemas

El proceso de diseño traduce los requerimientos funcionales y no funcionales en un plano técnico detallado para la construcción del software.

### 1.1 Diseño Lógico frente a Diseño Físico
* **Diseño Lógico:** Modela qué debe hacer el sistema desde la perspectiva del dominio del negocio, independientemente de la tecnología[cite: 2].
* **Diseño Físico:** Modela cómo se implementa la solución en una plataforma concreta (estructuras de disco, lenguajes, frameworks y SGBD específicos)[cite: 2].
* **Etapas de Diseño de la Base de Datos:**
  1. *Diseño Conceptual:* Modelo Entidad-Relación independiente del motor[cite: 2].
  2. *Diseño Lógico:* Modelo Relacional estructurado para un SGBD relacional[cite: 2].
  3. *Diseño Físico:* Especificación DDL (Oracle 21c) definiendo tipos de datos de almacenamiento, índices, constraints y secuencias[cite: 2].

### 1.2 Principios Fundamentales de POO
* **Abstracción:** Se aplica abstracción de datos para modelar los atributos esenciales de los objetos del inventario y abstracción de procedimientos para exponer métodos con interfaces limpias[cite: 2].
* **Generalización:** Extracción de características y contratos comunes hacia clases base e interfaces, reduciendo la redundancia de código y maximizando la reutilización[cite: 2].
* **División de Problemas y Modularidad:** Fragmentación del software en módulos con responsabilidades acotadas, abordables y testeables por separado[cite: 2].
* **Alta Cohesión y Bajo Acoplamiento:** Los módulos deben concentrarse en una función única y específica (alta cohesión) y minimizar las dependencias directas entre sí (bajo acoplamiento)[cite: 2].

---

## 2. Calidades Sistémicas (QoS) y Rol Arquitectónico

La arquitectura define la estructura general de la solución y las reglas que gobiernan su evolución. El sistema debe equilibrar tres familias de calidades sistémicas:

* **Calidades Manifiestas (Observables por el usuario):**
  * *Performance:* Tiempos de respuesta reducidos mediante indexación en Oracle y optimización de bundles en Vite.
  * *Reliability & Availability:* Continuidad operativa y tolerancia ante fallas de infraestructura.
* **Calidades Operacionales (Observables en producción):**
  * *Throughput:* Capacidad de atender altas tasas de transacciones concurrentes de inventario mediante connection pooling.
  * *Security:* Controles de identidad, autorización por roles, auditabilidad de movimientos y confidencialidad en capas.
  * *Testability:* Desacoplamiento que permite pruebas unitarias aisladas por capa.
* **Calidades Evolutivas (Comportamiento ante cambios):**
  * *Reusability:* Reutilización obligatoria de componentes comunes, interfaces y servicios base.
  * *Scalability:* Capacidad de escalar horizontalmente en contenedores Docker independientes.
  * *Maintainability:* Mantenimiento simplificado derivado de la separación estricta de capas.

---

## 3. Modelo de Arquitectura de 6 Capas

La arquitectura del sistema se estructura en 6 capas horizontales.

```text
┌─────────────────────────────────────────────────────────────┐
│ 4. PRESENTACIÓN (React 19 UI / Controladores REST API)      │
└──────────────────────────────┬──────────────────────────────┘
│ (Llamada unidireccional descendente)                        │
┌──────────────────────────────▼──────────────────────────────┐ ┌───────────────────────────┐
│ 3. LÓGICA DE NEGOCIO (Casos de uso / Servicios de Dominio)  │ │                           │
└──────────────────────────────┬──────────────────────────────┘ │ 5. ENTIDADES              │
│ (Llamada unidireccional descendente)                        │ │    (Modelos del Dominio,  │
┌──────────────────────────────▼──────────────────────────────┐ │     DTOs, Tipos de Datos) │
│ 2. ACCESO A DATOS (Repositorios / DAL / Mappers)            │ │                           │
└──────────────────────────────┬──────────────────────────────┘ │ [Transversal a las capas] │
│ (SQL parametrizado / Pool)                                  │ │                           │
┌──────────────────────────────▼──────────────────────────────┐ │ 6. COMPONENTES COMUNES    │
│ 1. BASE DE DATOS (Oracle 21c / Tablas / Índices / DDL)      │ │    (Logger, Errores,      │
└─────────────────────────────────────────────────────────────┘ │     Validadores, Crypto)  │
                                                                └───────────────────────────┘  
```

### Reglas de Interacción entre Capas
1. **Flujo Unidireccional:** Una capa superior puede consumir servicios de la capa inmediatamente inferior, pero nunca en sentido inverso.
2. **Abstracción por Contratos:** Las capas se comunican mediante interfaces abstractas, permitiendo reemplazar componentes de una capa sin afectar a las demás.
3. **Especialización:** Los componentes de una capa solo deben ejecutar tareas inherentes a su propósito.

---

### Descripción de las 6 Capas

#### Capa 1: Base de Datos (Persistencia Física)
- **Ubicación:** `sw-inventario/database/`
- **Responsabilidad:** Motor Oracle Database 21c. Almacenamiento transaccional, integridad referencial, constraints, secuencias e índices.
- **Regla:** No delegar reglas de negocio críticas a triggers complejos; priorizar SQL declarativo[cite: 2].

#### Capa 2: Acceso a Datos (DAL - Data Access Layer)
- **Ubicación:** `sw-inventario/backend/src/dal/`
- **Responsabilidad:** Implementa el patrón Repository. Consume la conexión de `oracledb`, ejecuta sentencias SQL parametrizadas y mapea registros relacionales a objetos tipados[cite: 1].
- **Regla:** No contiene reglas de validación de negocio ni maneja formatos HTTP.

#### Capa 3: Lógica de Negocio (BLL - Business Logic Layer)
- **Ubicación:** `sw-inventario/backend/src/bll/`
- **Responsabilidad:** Casos de uso del inventario (ej. registro de movimientos, cálculo de saldo en kardex, verificación de stock de seguridad, aplicación de políticas de costo)[cite: 2].
- **Regla:** Es agnóstica a la base de datos y al protocolo de transporte (no manipula objetos `req`/`res` ni sentencias SQL).

#### Capa 4: Presentación (Presentation Layer)
- **Ubicación:** 
  - Backend: `sw-inventario/backend/src/presentation/` (Controladores y Routers REST).
  - Frontend: `sw-inventario/frontend/src/` (Componentes React 19 y Vistas).
- **Responsabilidad:** 
  - El backend recibe peticiones HTTP, valida esquemas de entrada (DTOs) y orquesta la respuesta.
  - El frontend gestiona la experiencia de usuario, estados visuales y llamadas asíncronas hacia la API.
- **Regla:** La presentación no contiene cálculos de inventario ni ejecuta lógica de persistencia directa.

#### Capa 5: Entidades (Domain Entities - Transversal)
- **Ubicación:** Reflejada en `backend/src/entities/` y `frontend/src/entities/`
- **Responsabilidad:** Modelos de datos del negocio (`Producto`, `MovimientoInventario`, `Bodega`), definiciones de DTOs y tipos del dominio.
- **Regla:** Son estructuras puras, desacopladas de frameworks y sin dependencias de base de datos o librerías externas.

#### Capa 6: Componentes Comunes (Cross-Cutting Concerns - Transversal)
- **Ubicación:** Reflejada en `backend/src/common/` y `frontend/src/common/`
- **Responsabilidad:** Utilidades reutilizables por cualquier capa: sistema de logging, clases de excepciones personalizadas, middlewares de autenticación, formateadores numéricos y validadores genéricos.
- **Regla:** Cero dependencia con el negocio específico del inventario; deben ser 100% reutilizables en cualquier otro sistema.

---

## 4. Patrones de Diseño (GoF) y Reutilización en POO

Para estructurar la solución y evitar duplicidad de código, se implementan los patrones de diseño clásicos[cite: 1]:

### 4.1 Patrones Creacionales (Abstracción de Creación)
- **Singleton:** Empleado para la instancia única del Connection Pool de Oracle 21c y el cargador de variables de entorno[cite: 1].
- **Factory Method:** Instanciación dinámica de repositorios o emisores de reportes según el contexto[cite: 1].
- **Object Pool:** Manejo y reutilización eficiente de conexiones a la base de datos[cite: 1].

### 4.2 Patrones Estructurales (Composición de Clases)
- **Adapter:** Adapta la interfaz técnica de `oracledb` a los contratos abstractos definidos en la DAL[cite: 1].
- **Facade:** Provee un punto de acceso simplificado a operaciones de inventario multifacéticas (ej. un servicio que coordina la validación de crédito, reserva de producto y descuento en inventario)[cite: 1].
- **Decorator:** Envoltorios sobre llamadas a servicios para incorporar logging transversal o telemetría de rendimiento sin alterar el código del servicio[cite: 1].

### 4.3 Patrones de Comportamiento (Algoritmos y Asignación)
- **Strategy:** Permite intercambiar dinámicamente métodos de valuación de inventario (FIFO/PEPS, Promedio Ponderado) mediante una interfaz común[cite: 1].
- **Template Method:** Define la estructura base invariable de ejecución de transacciones (abrir conexión -> procesar -> commit/rollback -> cerrar conexión), permitiendo que cada servicio defina solo el algoritmo interno[cite: 1].
- **Observer:** Dispara eventos desacoplados (ej. emisión de alerta por stock mínimo o registro de auditoría) al completarse una transacción de negocio[cite: 1].

---

## 5. Mapeo Canónico de Carpetas del Proyecto

```text
sw-inventario/
├── database/                                # CAPA 1: BASE DE DATOS
│   ├── ddl/                                 # Tablas, PK, FK, Checks, Secuencias, Índices
│   └── dml/                                 # Datos iniciales, fixtures y catálogos
│
├── backend/                                 # CAPAS 2, 3, 4 (API), 5 y 6
│   └── src/
│       ├── entities/                        # CAPA 5: ENTIDADES (Modelos del dominio y DTOs)
│       ├── common/                          # CAPA 6: COMPONENTES COMUNES (Logger, Exceptions)
│       ├── dal/                             # CAPA 2: ACCESO A DATOS
│       │   ├── contracts/                   # Interfaces abstractas de repositorios
│       │   └── repositories/                # Implementaciones oracledb + SQL parametrizado
│       ├── bll/                             # CAPA 3: LÓGICA DE NEGOCIO
│       │   └── services/                    # Servicios de dominio y reglas de inventario
│       └── presentation/                    # CAPA 4: PRESENTACIÓN (BACKEND)
│           ├── controllers/                 # Controladores HTTP
│           ├── routes/                      # Definición de rutas Express/Fastify
│           └── middlewares/                 # Validación de esquemas y autenticación
│
└── frontend/                                # CAPAS 4 (UI), 5 y 6
    └── src/
        ├── entities/                        # CAPA 5: Interfaces y contratos espejo del dominio
        ├── common/                          # CAPA 6: Cliente HTTP, formateadores y utilidades
        ├── components/                      # Componentes reutilizables UI
        ├── modules/                         # Vistas por módulo funcional de inventario
        ├── App.tsx                          # Componente raíz
        ├── main.tsx                         # Entrypoint React 19
        └── index.css                        # Estilos Tailwind v4 (@import "tailwindcss";)
```

---

## 6. Directivas Estrictas de Programación para Agentes

- **Tipado Obligatorio:** Queda prohibido el uso del tipo `any` en TypeScript. Todas las funciones, parámetros y retornos deben tiparse explícitamente[cite: 2].
- **Prohibido SQL en Capas Superiores:** Ni la capa de Presentación ni la de Lógica de Negocio pueden ejecutar sentencias SQL ni importar `oracledb`.
- **Manejo Estricto de Errores:** Los errores de base de datos deben ser capturados en la DAL, mapeados a excepciones semánticas de Componentes Comunes y procesados por un middleware centralizado en la capa de Presentación.
- **Exportaciones Limpias:** Componentes React con `default export`, código desacoplado de dependencias circulares y estricto respeto a la jerarquía de las 6 capas[cite: 2].
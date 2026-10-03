# Skill: Stack Tecnológico y Entorno de Ejecución (`sw-inventario`)

Este documento establece de manera taxativa las tecnologías, versiones, configuraciones de infraestructura y herramientas operativas para el proyecto `sw-inventario`. Su cumplimiento es obligatorio para Claude Code y Gemini CLI.

---

## 1. División Estructural del Repositorio

El proyecto se organiza estrictamente en tres directorios raíz independientes:

```text
sw-inventario/
├── database/    # Esquemas relacionales, scripts DDL, DML y migraciones
├── backend/     # API REST, capas de acceso a datos, negocio y servicios
└── frontend/    # Aplicación cliente SPA (React 19 + Vite + Tailwind v4)
└── skills/      # habilidades oficiales de como se ejecuta y desarrolla el sistema. Backend, Frontend, Dabatabase
```

## 2. Definición del Stack Tecnológico

| Dominio | Tecnología | Versión / Especificación | Propósito |
| :--- | :--- | :--- | :--- |
| **Frontend Runtime** | React | 19.x (con React DOM 19) | Renderizado de interfaz de usuario |
| **Frontend Tooling** | Vite | 8.x + @vitejs/plugin-react | Entorno de desarrollo, HMR y bundler |
| **Lenguaje Frontend** | TypeScript | 5.7.x | Tipado estático estricto |
| **Motor de Estilos** | Tailwind CSS | v4 (@tailwindcss/vite) | Sistema de diseño basado en utilidades |
| **Backend Runtime** | Node.js | v20+ LTS | Entorno de ejecución del servidor |
| **Lenguaje Backend** | TypeScript | 5.7.x | Tipado estático estricto en el servidor |
| **Conector BD** | oracledb | Driver oficial Node.js para Oracle | Manejo de pools y ejecución SQL |
| **Motor de Base de Datos** | Oracle Database | 21c | Motor relacional transaccional |
| **Contenedores** | Docker | Engine v24+ / Compose v2+ | Aislamiento, paridad dev/prod y despliegue |
| **Gestor de Paquetes** | pnpm | v9+ | Instalación eficiente y monorepos |
| **Control de Runtime** | Mise | .mise.toml | Fijación de versiones de Node.js y pnpm |

## 3. Especificaciones de la Base de Datos (Oracle 21c)

**Gestión Obligatoria de Pools de Conexión:**
- Queda prohibido abrir y cerrar conexiones individuales por cada solicitud HTTP.
- Toda interacción con la base de datos debe originarse a través de un pool inicializado al arrancar el backend (`oracledb.createPool()`).
- Parámetros obligatorios en la configuración del pool:
  - `poolMin`: Conexiones mínimas activas.
  - `poolMax`: Límite máximo de conexiones concurrentes.
  - `poolIncrement`: Factor de crecimiento ante picos de demanda.
  - `poolTimeout`: Tiempo de inactividad antes de liberar conexiones.

**Seguridad y Parámetros en Consultas:**
- Prohibida la concatenación de variables en sentencias SQL bajo cualquier circunstancia.
- Toda consulta debe ejecutarse con bind variables (ejemplo: `:idProducto`, `:cantidad`).

**Manejo Transaccional y Ciclo de Vida:**
- La adquisición de conexión, la transacción y el cierre deben estructurarse en bloques `try / catch / finally`.
- Si la operación falla, invocar `await connection.rollback()`.
- Si la operación es exitosa, invocar `await connection.commit()`.
- La conexión debe liberarse al pool obligatoriamente en el bloque `finally` con `await connection.close()`.

## 4. Arquitectura y Escalabilidad con Docker

El sistema debe ser 100% contenerizable y garantizar independencia entre entornos:

- **Backend (`backend/Dockerfile`):**
  - Construcción multi-stage (etapa de compilación TypeScript y etapa de producción limpia).
  - Exclusión de dependencias de desarrollo (`devDependencies`) en la imagen final.
  - Inyección de credenciales (`ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING`) mediante variables de entorno en el archivo `.env`.

- **Frontend (`frontend/Dockerfile`):**
  - Construcción multi-stage: transpilación de estáticos con Vite y servicio final mediante un servidor Nginx Alpine ultraligero.
  - Configuración de proxy inverso para redirigir peticiones `/api/*` hacia el contenedor del backend.

- **Orquestación (`docker-compose.yml`):**
  - Definición de red privada (`inventory-net`) para interconectar los contenedores.
  - Definición de volúmenes persistentes para la data de Oracle 21c (cuando se ejecute de forma local).

## 5. Reglas Técnicas de Frontend (React + Vite + Tailwind v4)

- **Servidor de Desarrollo:** En entornos Figma Make / WebContainers, el servidor Vite corre por defecto en el puerto 8443. No forzar reinicios ni alterar puertos sin indicación previa.
- **Tailwind CSS v4:** No generar archivos `tailwind.config.js` ni `postcss.config.js`. La configuración reside íntegramente en `frontend/src/index.css` mediante la directiva `@import "tailwindcss";`.
- **Componentes React:**
  - Exportación estandarizada mediante exportación por defecto (`export default function Component()`).
  - Etiquetas JSX siempre cerradas y llaves balanceadas.
  - Para cadenas con apóstrofes o comillas simples, utilizar delimitación con comillas dobles (`"We're updating stock"`) o caracteres escapados para prevenir errores de transpilación.
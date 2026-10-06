# syntax=docker/dockerfile:1
# Backend — build multi-stage (skills/stack-tecnologico.md 4).
# Contexto de build: RAIZ del monorepo (docker build -f backend/Dockerfile .).
# Etapa de compilacion TS + etapa de produccion sin devDependencies.
# `oracledb` 6.7 corre en modo Thin: no requiere Oracle Instant Client.

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# ---- Dependencias del workspace (incluye dev, para poder compilar) --------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@sw-inventario/backend..."

# ---- Compilacion + extraccion de deps de produccion ---------------------
FROM deps AS build
COPY backend ./backend
RUN pnpm --filter @sw-inventario/backend build \
 && pnpm --filter @sw-inventario/backend --prod deploy /prod

# ---- Imagen final de produccion ---------------------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/node_modules ./node_modules
COPY --from=build /repo/backend/dist ./dist
COPY --from=build /repo/backend/package.json ./package.json
EXPOSE 3000
# Credenciales por variables de entorno (.env / docker-compose):
#   DB_USER  DB_PASSWORD  DB_CONNECT_STRING  JWT_SECRET  HTTP_PORT
USER node
CMD ["node", "dist/src/server.js"]

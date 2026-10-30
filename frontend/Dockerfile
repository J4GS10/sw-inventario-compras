# syntax=docker/dockerfile:1
# Frontend — build multi-stage (skills/stack-tecnologico.md 4).
# Contexto de build: RAIZ del monorepo (docker build -f frontend/Dockerfile .).
# Vite transpila los estaticos; Nginx Alpine los sirve y hace de proxy /api.

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter "@sw-inventario/frontend..."
COPY frontend ./frontend
RUN pnpm --filter @sw-inventario/frontend build

# ---- Servidor estatico + proxy inverso ------------------------------
FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 80

/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4: sin tailwind.config.js ni postcss.config.js (skills/stack-tecnologico.md 5).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8443,
    host: true, // escucha en 0.0.0.0 para compartir en LAN
    proxy: {
      "/api": {
        target: process.env["API_PROXY_TARGET"] ?? "http://localhost:3000",
        changeOrigin: true,
        // Agrega X-Forwarded-For: el backend asi distingue una peticion proxeada (de la red)
        // de una local y NO honra el atajo X-Dev-User ni el limitador por IP engañado.
        xfwd: true,
      },
    },
  },
  // Servidor "oficial" (build de produccion servido por `vite preview`, igual que nginx: SPA + proxy /api).
  preview: {
    port: 8443,
    // Sin cache en ningun recurso: el navegador siempre pide la version vigente.
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", Expires: "0" },
    host: true,
    proxy: {
      "/api": {
        target: process.env["API_PROXY_TARGET"] ?? "http://localhost:3000",
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/testSetup.ts"],
    globals: false,
  },
});

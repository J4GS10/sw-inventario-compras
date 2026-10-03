/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4: sin tailwind.config.js ni postcss.config.js (skills/stack-tecnologico.md 5).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8443,
    proxy: {
      "/api": {
        target: process.env["API_PROXY_TARGET"] ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/testSetup.ts"],
    globals: false,
  },
});

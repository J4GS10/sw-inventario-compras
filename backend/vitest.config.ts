import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Los tests de integracion contra Oracle se marcan con .int.test.ts y se
    // ejecutan aparte cuando hay base de datos disponible.
    exclude: ["tests/**/*.int.test.ts", "node_modules/**"],
  },
});

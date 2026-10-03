import { defineConfig } from "vitest/config";

/** Config para tests de integracion contra Oracle local. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.int.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
    // Integration tests share one Postgres database; run files serially so
    // fixtures created by one file can't race another's cleanup.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    globalSetup: "./server/__tests__/global-setup.ts",
  },
});

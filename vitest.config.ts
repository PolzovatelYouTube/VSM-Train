import { defineConfig } from "vitest/config";
import path from "node:path";

// Отдельный конфиг: vite.config.ts указывает root на client/, а тесты движка лежат в tests/
export default defineConfig({
  resolve: { alias: { "@shared": path.resolve(import.meta.dirname, "shared") } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});

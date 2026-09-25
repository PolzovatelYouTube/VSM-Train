import { defineConfig } from "vitest/config";

// Отдельный конфиг: vite.config.ts указывает root на client/, а тесты движка лежат в tests/
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});

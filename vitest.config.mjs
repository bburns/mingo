import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // Optional: enables global `describe`, `it`, etc.
    environment: "node",
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      enabled: true,
      lines: 100,
    },
  }
});

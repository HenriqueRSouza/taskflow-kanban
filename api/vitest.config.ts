import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      include: ["src/**"],
      exclude: ["src/server.ts"],
      reporter: ["text", "html"],
    },
  },
});

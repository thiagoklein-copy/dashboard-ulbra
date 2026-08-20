import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve os apelos "@/..." pelo tsconfig, sem precisar do plugin externo.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    // The Prisma singleton (src/lib/prisma.ts) now hard-fails at construction
    // if DATABASE_URL is unset. Unit tests never hit a real DB (Prisma is
    // mocked), but the client is still instantiated on import — give it a
    // dummy URL so the guard is satisfied.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["node_modules", "e2e/**", ".claude/**", ".claire/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/lib/**", "src/components/**"],
      exclude: ["src/lib/prisma.ts"],
      thresholds: {
        "src/lib/**": {
          statements: 80,
        },
        "src/components/**": {
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

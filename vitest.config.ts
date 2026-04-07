import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["node_modules", "e2e/**", ".claude/**"],
    env: {
      SHAREPOINT_SITE_ID: "test-site-id-for-vitest",
      SHAREPOINT_TENANT_ID: "test-tenant-id-for-vitest",
      SHAREPOINT_CLIENT_ID: "test-client-id-for-vitest",
      SHAREPOINT_CLIENT_SECRET: "test-client-secret-for-vitest",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/lib/**", "src/components/**"],
      exclude: ["src/lib/graph-client.ts"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

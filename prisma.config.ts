import path from "node:path";
import { defineConfig } from "prisma/config";
import { config as loadDotenv } from "dotenv";

// Prisma 6+ with a config file no longer auto-loads .env — do it ourselves.
// .env.local takes precedence over .env (same order Next.js uses).
loadDotenv({ path: path.join(__dirname, ".env") });
loadDotenv({ path: path.join(__dirname, ".env.local"), override: true });

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

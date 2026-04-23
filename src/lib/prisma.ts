import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const raw = process.env.DATABASE_URL!;
  let connectionString = raw;
  try {
    const url = new URL(raw);
    const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(url.hostname);
    // Managed Postgres (Render, Heroku, Supabase, etc.) ships self-signed
    // certs on an internal CA. Force `sslmode=no-verify` for any non-local
    // DB so TLS is used but the self-signed chain is accepted. Previous
    // sniff-for-"render.com" + verify-full combo (a) missed Render's
    // internal dpg-* hostnames and (b) would reject self-signed certs
    // even when it did match — both paths produced runtime TLS errors.
    if (!isLocal) {
      url.searchParams.set("sslmode", "no-verify");
      connectionString = url.toString();
    }
  } catch {
    // fall back to the raw string if URL parsing fails
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

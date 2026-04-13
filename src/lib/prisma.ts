import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL!;
  if (connectionString?.includes("render.com") && !connectionString.includes("sslmode")) {
    const sep = connectionString.includes("?") ? "&" : "?";
    connectionString = `${connectionString}${sep}sslmode=require`;
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

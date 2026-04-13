import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log("Connected to database");

  // Create Role enum (idempotent)
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Create User table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id"           TEXT        NOT NULL,
      "email"        TEXT        NOT NULL,
      "name"         TEXT,
      "passwordHash" TEXT,
      "role"         "Role"      NOT NULL DEFAULT 'EMPLOYEE',
      "avatar"       TEXT,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
  `);

  console.log("Migration complete");
  await client.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

import "dotenv/config";
import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

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

  // Create CourseStatus enum (idempotent)
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Create Course table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Course" (
      "id"          TEXT           NOT NULL,
      "title"       TEXT           NOT NULL,
      "description" TEXT,
      "thumbnail"   TEXT,
      "status"      "CourseStatus" NOT NULL DEFAULT 'DRAFT',
      "createdById" TEXT           NOT NULL,
      "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Course_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);

  // Create LessonType enum (idempotent)
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "LessonType" AS ENUM ('TEXT', 'VIDEO', 'QUIZ');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Create Module table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Module" (
      "id"        TEXT         NOT NULL,
      "title"     TEXT         NOT NULL,
      "order"     INTEGER      NOT NULL,
      "courseId"   TEXT         NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Module_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Module_courseId_order_key" ON "Module"("courseId", "order");
  `);

  // Create Lesson table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Lesson" (
      "id"        TEXT          NOT NULL,
      "title"     TEXT          NOT NULL,
      "type"      "LessonType"  NOT NULL DEFAULT 'TEXT',
      "content"   TEXT,
      "order"     INTEGER       NOT NULL,
      "moduleId"  TEXT          NOT NULL,
      "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Lesson_moduleId_order_key" ON "Lesson"("moduleId", "order");
  `);

  // Add DOCUMENT value to LessonType enum (idempotent)
  await client.query(`
    ALTER TYPE "LessonType" ADD VALUE IF NOT EXISTS 'DOCUMENT';
  `);

  // Create SharePointCache table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "SharePointCache" (
      "id"        TEXT         NOT NULL,
      "cacheKey"  TEXT         NOT NULL,
      "data"      TEXT         NOT NULL,
      "etag"      TEXT,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SharePointCache_pkey" PRIMARY KEY ("id")
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "SharePointCache_cacheKey_key" ON "SharePointCache"("cacheKey");
  `);

  // Create Enrollment table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Enrollment" (
      "id"         TEXT         NOT NULL,
      "userId"     TEXT         NOT NULL,
      "courseId"   TEXT         NOT NULL,
      "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Enrollment_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Enrollment_courseId_fkey"
        FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Enrollment_userId_courseId_key"
      ON "Enrollment"("userId", "courseId");
  `);

  // Create LessonProgress table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "LessonProgress" (
      "id"          TEXT         NOT NULL,
      "userId"      TEXT         NOT NULL,
      "lessonId"    TEXT         NOT NULL,
      "startedAt"   TIMESTAMP(3),
      "completedAt" TIMESTAMP(3),
      CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "LessonProgress_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "LessonProgress_lessonId_fkey"
        FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "LessonProgress_userId_lessonId_key"
      ON "LessonProgress"("userId", "lessonId");
  `);

  console.log("Migration complete");
  await client.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

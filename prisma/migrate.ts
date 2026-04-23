import { config as loadEnv } from "dotenv";
import { Client } from "pg";

// Load Next.js-style env chain: .env.local overrides .env. Next.js loads these
// automatically at runtime; standalone scripts need explicit config. Render's
// build env provides DATABASE_URL directly, so both files being absent is fine.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// Render Postgres uses a self-signed cert. Match on both the public
// (`*.render.com`) and internal (`dpg-*`) hostnames — internal connections
// within Render don't carry `render.com` in the URL.
const dbUrl = process.env.DATABASE_URL ?? "";
const isRender = /render\.com|(?:^|@)dpg-/.test(dbUrl);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: isRender ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await client.connect();
  console.log("Connected to database");

  // Create Role enum (idempotent).
  // NOTE: Initial value set uses the legacy values so fresh-DB bootstrapping
  // works; the role-restructure block below migrates them to the current set.
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

  // Add HTML value to LessonType enum (idempotent)
  await client.query(`
    ALTER TYPE "LessonType" ADD VALUE IF NOT EXISTS 'HTML';
  `);
  // Must commit before using a newly added enum value in DML
  await client.query(`COMMIT`);
  await client.query(`BEGIN`);

  // Role restructure: add COURSE_MANAGER, migrate legacy rows, then drop old values
  await client.query(`
    ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COURSE_MANAGER';
  `);
  // Must commit before using a newly added enum value in DML
  await client.query(`COMMIT`);
  await client.query(`BEGIN`);
  // Cast through text so the comparison works even after 'MANAGER'/'INSTRUCTOR'
  // have been removed from the enum (idempotent no-op when rows are gone).
  await client.query(`
    UPDATE "User" SET "role" = 'COURSE_MANAGER' WHERE "role"::text = 'MANAGER';
  `);
  await client.query(`
    UPDATE "User" SET "role" = 'EMPLOYEE' WHERE "role"::text = 'INSTRUCTOR';
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

  // Create QuizQuestion table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "QuizQuestion" (
      "id"        TEXT         NOT NULL,
      "lessonId"  TEXT         NOT NULL,
      "text"      TEXT         NOT NULL,
      "order"     INTEGER      NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "QuizQuestion_lessonId_fkey"
        FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "QuizQuestion_lessonId_order_key"
      ON "QuizQuestion"("lessonId", "order");
  `);

  // Create QuizOption table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "QuizOption" (
      "id"         TEXT         NOT NULL,
      "questionId" TEXT         NOT NULL,
      "text"       TEXT         NOT NULL,
      "isCorrect"  BOOLEAN      NOT NULL DEFAULT false,
      "order"      INTEGER      NOT NULL,
      "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "QuizOption_questionId_fkey"
        FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "QuizOption_questionId_order_key"
      ON "QuizOption"("questionId", "order");
  `);

  // Create QuizAttempt table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "QuizAttempt" (
      "id"             TEXT         NOT NULL,
      "userId"         TEXT         NOT NULL,
      "lessonId"       TEXT         NOT NULL,
      "score"          INTEGER      NOT NULL,
      "totalQuestions" INTEGER      NOT NULL,
      "passed"         BOOLEAN      NOT NULL,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "QuizAttempt_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "QuizAttempt_lessonId_fkey"
        FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // Create QuizAnswer table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "QuizAnswer" (
      "id"               TEXT NOT NULL,
      "attemptId"        TEXT NOT NULL,
      "questionId"       TEXT NOT NULL,
      "selectedOptionId" TEXT NOT NULL,
      CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "QuizAnswer_attemptId_fkey"
        FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "QuizAnswer_questionId_fkey"
        FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "QuizAnswer_selectedOptionId_fkey"
        FOREIGN KEY ("selectedOptionId") REFERENCES "QuizOption"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // Create Assignment table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Assignment" (
      "id"           TEXT         NOT NULL,
      "courseId"     TEXT         NOT NULL,
      "userId"       TEXT         NOT NULL,
      "assignedById" TEXT         NOT NULL,
      "assignedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Assignment_courseId_fkey"
        FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Assignment_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Assignment_assignedById_fkey"
        FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Assignment_courseId_userId_key"
      ON "Assignment"("courseId", "userId");
  `);

  // Create Notification table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id"        TEXT         NOT NULL,
      "userId"    TEXT         NOT NULL,
      "type"      TEXT         NOT NULL,
      "message"   TEXT         NOT NULL,
      "read"      BOOLEAN      NOT NULL DEFAULT false,
      "courseId"  TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Notification_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // Add invite-tracking audit fields to User (idempotent)
  await client.query(`
    ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "invitedAt"   TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
  `);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE "User"
        ADD CONSTRAINT "User_invitedById_fkey"
        FOREIGN KEY ("invitedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "User_invitedById_idx" ON "User"("invitedById");
  `);

  // Create DeadlineReminderLog table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "DeadlineReminderLog" (
      "id"       TEXT         NOT NULL,
      "userId"   TEXT         NOT NULL,
      "lessonId" TEXT         NOT NULL,
      "kind"     TEXT         NOT NULL,
      "sentAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DeadlineReminderLog_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "DeadlineReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
      CONSTRAINT "DeadlineReminderLog_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DeadlineReminderLog_user_lesson_kind_key"
      ON "DeadlineReminderLog"("userId","lessonId","kind");
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "DeadlineReminderLog_lessonId_idx" ON "DeadlineReminderLog"("lessonId");
  `);

  // Add completedAt to Enrollment for first-ever course completion tracking (idempotent)
  await client.query(`
    ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
  `);

  // Commit the transaction opened on line 142 (BEGIN after the Role enum
  // restructure). Without this, client.end() closes the connection with an
  // open transaction and Postgres rolls back EVERY statement after the BEGIN
  // — including all subsequent CREATE TABLE / ALTER TABLE migrations. This
  // bug silently swallowed the DeadlineReminderLog table and the
  // Enrollment.completedAt column on prod until it broke the dashboard.
  await client.query(`COMMIT`);

  console.log("Migration complete");
  await client.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

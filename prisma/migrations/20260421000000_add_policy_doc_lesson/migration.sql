-- Adds the POLICY_DOC lesson type + PolicyDocLesson body table + audit
-- snapshot fields on LessonProgress.
--
-- Additive only: existing lessons / progress rows are untouched. The new
-- audit fields are nullable; they're only populated for POLICY_DOC lessons
-- when a learner acknowledges them.

-- 1. Extend LessonType enum + add the new render-mode enum.
ALTER TYPE "LessonType" ADD VALUE IF NOT EXISTS 'POLICY_DOC';

DO $$ BEGIN
  CREATE TYPE "PolicyDocRenderMode" AS ENUM ('PARSED', 'EMBED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Audit snapshot columns on LessonProgress.
ALTER TABLE "LessonProgress"
  ADD COLUMN IF NOT EXISTS "acknowledgedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acknowledgedVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "acknowledgedETag"    TEXT,
  ADD COLUMN IF NOT EXISTS "acknowledgedHash"    TEXT;

-- 3. PolicyDocLesson — one row per Lesson where type = POLICY_DOC.
CREATE TABLE IF NOT EXISTS "PolicyDocLesson" (
  "id"                  TEXT                  NOT NULL,
  "lessonId"            TEXT                  NOT NULL,

  -- SharePoint source pointer
  "sharePointDriveId"   TEXT                  NOT NULL,
  "sharePointItemId"    TEXT                  NOT NULL,
  "sharePointWebUrl"    TEXT                  NOT NULL,

  -- Snapshot from last sync
  "documentTitle"       TEXT                  NOT NULL,
  "documentCode"        TEXT,
  "sourceVersion"       TEXT                  NOT NULL,
  "sourceETag"          TEXT                  NOT NULL,
  "sourceLastModified"  TIMESTAMP(3)          NOT NULL,
  "approver"            TEXT,
  "approvedOn"          TIMESTAMP(3),
  "lastReviewedOn"      TIMESTAMP(3),
  "reviewHistory"       JSONB                 NOT NULL,
  "revisionHistory"     JSONB                 NOT NULL,

  -- Rendered output
  "renderMode"          "PolicyDocRenderMode" NOT NULL DEFAULT 'PARSED',
  "renderedHTML"        TEXT                  NOT NULL,
  "renderedHTMLHash"    TEXT                  NOT NULL,

  -- Sync bookkeeping
  "lastSyncedAt"        TIMESTAMP(3)          NOT NULL,
  "lastSyncedById"      TEXT                  NOT NULL,

  "createdAt"           TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)          NOT NULL,

  CONSTRAINT "PolicyDocLesson_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PolicyDocLesson_lessonId_key"
  ON "PolicyDocLesson"("lessonId");

CREATE INDEX IF NOT EXISTS "PolicyDocLesson_documentCode_idx"
  ON "PolicyDocLesson"("documentCode");

DO $$ BEGIN
  ALTER TABLE "PolicyDocLesson"
    ADD CONSTRAINT "PolicyDocLesson_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PolicyDocLesson"
    ADD CONSTRAINT "PolicyDocLesson_lastSyncedById_fkey"
    FOREIGN KEY ("lastSyncedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

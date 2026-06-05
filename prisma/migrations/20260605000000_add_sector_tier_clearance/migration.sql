-- Reworks the dead free-text clearance feature into a sector+tier compartment
-- model, and adds the internal-documentation repository that is gated by it.
--
-- Clearance v1 (free-text UserClearance.clearance + Course.requiredClearance)
-- was never wired to any course-side UI, so it holds no data in any
-- environment — this migration is therefore effectively greenfield and the
-- column drops below are lossless.
--
-- Model:
--   * Sector                       — managed compartment list
--   * UserClearance(sectorId,tier) — one tier per (user,sector); lower = more protected
--   * ResourceClearanceRequirement — polymorphic (course XOR internalDoc), ANY-satisfies
--   * InternalDoc / InternalDocView — docs repo (reuses LessonType) + read audit

-- ── Sector ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Sector" (
  "id"          TEXT         NOT NULL,
  "key"         TEXT         NOT NULL,
  "label"       TEXT         NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Sector_key_key" ON "Sector"("key");

-- ── InternalDoc ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InternalDoc" (
  "id"          TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "type"        "LessonType" NOT NULL DEFAULT 'TEXT',
  "content"     TEXT,
  "category"    TEXT,
  "sortOrder"   INTEGER      NOT NULL DEFAULT 0,
  "createdById" TEXT         NOT NULL,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalDoc_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InternalDoc_sortOrder_idx" ON "InternalDoc"("sortOrder");

DO $$ BEGIN
  ALTER TABLE "InternalDoc"
    ADD CONSTRAINT "InternalDoc_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── InternalDocView (read audit) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InternalDocView" (
  "id"            TEXT         NOT NULL,
  "internalDocId" TEXT         NOT NULL,
  "userId"        TEXT         NOT NULL,
  "viewedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalDocView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InternalDocView_internalDocId_viewedAt_idx"
  ON "InternalDocView"("internalDocId", "viewedAt");
CREATE INDEX IF NOT EXISTS "InternalDocView_userId_viewedAt_idx"
  ON "InternalDocView"("userId", "viewedAt");

DO $$ BEGIN
  ALTER TABLE "InternalDocView"
    ADD CONSTRAINT "InternalDocView_internalDocId_fkey"
    FOREIGN KEY ("internalDocId") REFERENCES "InternalDoc"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InternalDocView"
    ADD CONSTRAINT "InternalDocView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ResourceClearanceRequirement (course XOR internalDoc; ANY-satisfies) ──────
CREATE TABLE IF NOT EXISTS "ResourceClearanceRequirement" (
  "id"            TEXT    NOT NULL,
  "sectorId"      TEXT    NOT NULL,
  "tier"          INTEGER NOT NULL,
  "courseId"      TEXT,
  "internalDocId" TEXT,
  CONSTRAINT "ResourceClearanceRequirement_pkey" PRIMARY KEY ("id"),
  -- Exactly one owner (course or internal doc), never both / neither.
  CONSTRAINT "ResourceClearanceRequirement_owner_xor"
    CHECK (("courseId" IS NOT NULL) <> ("internalDocId" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResourceClearanceRequirement_courseId_sectorId_key"
  ON "ResourceClearanceRequirement"("courseId", "sectorId");
CREATE UNIQUE INDEX IF NOT EXISTS "ResourceClearanceRequirement_internalDocId_sectorId_key"
  ON "ResourceClearanceRequirement"("internalDocId", "sectorId");
CREATE INDEX IF NOT EXISTS "ResourceClearanceRequirement_courseId_idx"
  ON "ResourceClearanceRequirement"("courseId");
CREATE INDEX IF NOT EXISTS "ResourceClearanceRequirement_internalDocId_idx"
  ON "ResourceClearanceRequirement"("internalDocId");
CREATE INDEX IF NOT EXISTS "ResourceClearanceRequirement_sectorId_idx"
  ON "ResourceClearanceRequirement"("sectorId");

DO $$ BEGIN
  ALTER TABLE "ResourceClearanceRequirement"
    ADD CONSTRAINT "ResourceClearanceRequirement_sectorId_fkey"
    FOREIGN KEY ("sectorId") REFERENCES "Sector"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ResourceClearanceRequirement"
    ADD CONSTRAINT "ResourceClearanceRequirement_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ResourceClearanceRequirement"
    ADD CONSTRAINT "ResourceClearanceRequirement_internalDocId_fkey"
    FOREIGN KEY ("internalDocId") REFERENCES "InternalDoc"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── UserClearance: free-text → sector+tier ────────────────────────────────────
-- Empty in all environments; no backfill.
DROP INDEX IF EXISTS "UserClearance_userId_clearance_key";

ALTER TABLE "UserClearance" DROP COLUMN IF EXISTS "clearance";
ALTER TABLE "UserClearance" ADD  COLUMN IF NOT EXISTS "sectorId" TEXT NOT NULL;
ALTER TABLE "UserClearance" ADD  COLUMN IF NOT EXISTS "tier"     INTEGER NOT NULL;

DO $$ BEGIN
  ALTER TABLE "UserClearance"
    ADD CONSTRAINT "UserClearance_tier_nonneg" CHECK ("tier" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "UserClearance_userId_sectorId_key"
  ON "UserClearance"("userId", "sectorId");
CREATE INDEX IF NOT EXISTS "UserClearance_sectorId_idx"
  ON "UserClearance"("sectorId");

DO $$ BEGIN
  ALTER TABLE "UserClearance"
    ADD CONSTRAINT "UserClearance_sectorId_fkey"
    FOREIGN KEY ("sectorId") REFERENCES "Sector"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Course: drop the dead free-text requiredClearance ─────────────────────────
ALTER TABLE "Course" DROP COLUMN IF EXISTS "requiredClearance";

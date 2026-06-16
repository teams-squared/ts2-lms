-- Assessment variants: a lesson holds N interchangeable variants, each with its
-- own question set (time limit + pass threshold stay lesson-level). Questions
-- move from hanging off the Lesson to hanging off a Variant; submissions record
-- which variant the student was administered.
--
-- The assessment tables are brand-new and empty in every environment, but the
-- restructure is written defensively (backfills a "Variant 1" for any lesson
-- that already has questions) so it is correct even if rows exist.

-- 1. Variant table ----------------------------------------------------------
CREATE TABLE "AssessmentVariant" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentVariant_lessonId_order_key" ON "AssessmentVariant"("lessonId", "order");

ALTER TABLE "AssessmentVariant" ADD CONSTRAINT "AssessmentVariant_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Backfill a default variant for any lesson that already has questions ----
INSERT INTO "AssessmentVariant" ("id", "lessonId", "label", "order", "createdAt", "updatedAt")
SELECT 'var_' || "lessonId", "lessonId", 'Variant 1', 0, now(), now()
FROM (SELECT DISTINCT "lessonId" FROM "AssessmentQuestion") AS q;

-- 3. Re-parent AssessmentQuestion from lesson -> variant ---------------------
ALTER TABLE "AssessmentQuestion" ADD COLUMN "variantId" TEXT;
UPDATE "AssessmentQuestion" SET "variantId" = 'var_' || "lessonId";

ALTER TABLE "AssessmentQuestion" DROP CONSTRAINT "AssessmentQuestion_lessonId_fkey";
DROP INDEX "AssessmentQuestion_lessonId_order_key";
ALTER TABLE "AssessmentQuestion" DROP COLUMN "lessonId";

ALTER TABLE "AssessmentQuestion" ALTER COLUMN "variantId" SET NOT NULL;
CREATE UNIQUE INDEX "AssessmentQuestion_variantId_order_key" ON "AssessmentQuestion"("variantId", "order");
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "AssessmentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Record the administered variant on each submission ----------------------
ALTER TABLE "AssessmentSubmission" ADD COLUMN "variantId" TEXT;
CREATE INDEX "AssessmentSubmission_variantId_idx" ON "AssessmentSubmission"("variantId");
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "AssessmentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

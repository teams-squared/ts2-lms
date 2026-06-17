-- Multi-select (checkbox) assessment question type.
-- Like MULTIPLE_CHOICE but allows >= 1 correct option; marked manually (never
-- auto-scored). Student picks stored in AssessmentAnswer.selectedOptionIds.
--
-- PG 12+ permits ALTER TYPE ... ADD VALUE inside the migration transaction as
-- long as the new value is not USED in the same transaction. The column add
-- below does not reference the new enum value, so this is safe.

ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'MULTI_SELECT';

ALTER TABLE "AssessmentAnswer"
    ADD COLUMN "selectedOptionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

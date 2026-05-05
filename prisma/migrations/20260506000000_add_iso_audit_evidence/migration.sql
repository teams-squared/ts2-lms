-- Strengthen the ISO 27001 audit-evidence captured per acknowledgement:
--   * acknowledgedAttestationText  — exact legal statement learner ticked,
--     so a wording change in PolicyDocViewer never reaches back and
--     rewrites historical records.
--   * acknowledgedDwellSeconds    — focused-tab seconds elapsed before
--     ack. Strengthens the "reasonable opportunity to read" claim.
--   * acknowledgedSharePointItemId — SharePoint item id snapshot, so an
--     auditor can trace any CSV row back to the exact source DOCX even
--     if the lesson is later re-pointed at a different file.
--
-- All nullable: legacy rows pre-dating this change keep NULL and are
-- treated as legacy evidence by the export.

ALTER TABLE "LessonProgress"
  ADD COLUMN IF NOT EXISTS "acknowledgedAttestationText"  TEXT,
  ADD COLUMN IF NOT EXISTS "acknowledgedDwellSeconds"     INTEGER,
  ADD COLUMN IF NOT EXISTS "acknowledgedSharePointItemId" TEXT;

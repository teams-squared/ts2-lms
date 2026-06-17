-- Fractional (half-)marks for manually-graded assessment questions.
-- Widen the awarded/derived mark columns from integer to DECIMAL(6,2) so a
-- marker can give e.g. 4.5/5. Existing integer values cast losslessly.
-- autoScore / maxMarks / passThreshold stay integer (MC is whole-mark only;
-- a question's max and the pass threshold are whole numbers).

ALTER TABLE "AssessmentAnswer"
    ALTER COLUMN "awardedMarks" TYPE DECIMAL(6, 2);

ALTER TABLE "AssessmentSubmission"
    ALTER COLUMN "manualScore" TYPE DECIMAL(6, 2);

ALTER TABLE "AssessmentSubmission"
    ALTER COLUMN "totalScore" TYPE DECIMAL(6, 2);

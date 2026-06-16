-- Add ASSESSMENT to LessonType so course managers can create timed exams with
-- mixed multiple-choice + free-text questions that are manually marked. Kept as
-- its own migration (single ALTER) because Postgres forbids using a freshly
-- added enum value in the same transaction that adds it — same pattern as
-- 20260507000000_add_lesson_type_link.
ALTER TYPE "LessonType" ADD VALUE IF NOT EXISTS 'ASSESSMENT';

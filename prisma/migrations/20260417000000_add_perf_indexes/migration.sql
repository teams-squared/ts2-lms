-- Performance indexes on commonly-filtered/sorted columns.
-- All use IF NOT EXISTS so this migration is idempotent and safe to re-apply.

CREATE INDEX IF NOT EXISTS "Enrollment_courseId_idx" ON "Enrollment"("courseId");

CREATE INDEX IF NOT EXISTS "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");
CREATE INDEX IF NOT EXISTS "LessonProgress_userId_completedAt_idx" ON "LessonProgress"("userId", "completedAt");

CREATE INDEX IF NOT EXISTS "QuizAttempt_lessonId_idx" ON "QuizAttempt"("lessonId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Lesson_deadlineDays_idx" ON "Lesson"("deadlineDays");

CREATE INDEX IF NOT EXISTS "UserStats_lastActivityDate_idx" ON "UserStats"("lastActivityDate");
CREATE INDEX IF NOT EXISTS "UserStats_xp_idx" ON "UserStats"("xp" DESC);

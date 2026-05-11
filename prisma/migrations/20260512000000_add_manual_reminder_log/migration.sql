-- Manual overdue reminders dispatched by admins / course_managers from
-- /admin/progress. Separate from DeadlineReminderLog (cron, dedupe-keyed):
-- no unique constraint, so re-sends are permitted and audited.
CREATE TABLE "ManualReminderLog" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sentById" TEXT,
    "sentAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualReminderLog_userId_lessonId_idx"
    ON "ManualReminderLog"("userId", "lessonId");

CREATE INDEX "ManualReminderLog_sentById_idx"
    ON "ManualReminderLog"("sentById");

ALTER TABLE "ManualReminderLog"
    ADD CONSTRAINT "ManualReminderLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManualReminderLog"
    ADD CONSTRAINT "ManualReminderLog_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManualReminderLog"
    ADD CONSTRAINT "ManualReminderLog_sentById_fkey"
    FOREIGN KEY ("sentById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

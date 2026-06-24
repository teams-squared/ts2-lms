-- Add the offboarding marker to User.
-- Null = active. Set = offboarded (M365/Entra account disabled or deleted, or
-- a manual admin offboard). Nullable, so existing rows need no backfill — every
-- current user is treated as active until a sync or admin action says otherwise.
-- History (enrollments, progress) is retained; the flag only gates "active"
-- treatment across lists, counts, reminders, and compliance.
ALTER TABLE "User" ADD COLUMN "offboardedAt" TIMESTAMP(3);

-- The active-user filter (offboardedAt IS NULL) hits every user list/count and
-- enrollment-by-user query, so index the column.
CREATE INDEX "User_offboardedAt_idx" ON "User"("offboardedAt");

-- One-time cleanup: purge the demo accounts that the old prisma/seed.ts
-- script planted into prod on every Render deploy.
--
-- These five accounts had hardcoded passwords (e.g. admin@teamssquared.com /
-- admin123). The credentials provider is gated on NODE_ENV !== 'production'
-- so they couldn't actually log in via password in prod, but the rows still
-- existed with role=ADMIN — orphaned backdoors waiting on any misconfig.
--
-- The seed step has been removed from render.yaml's startCommand and
-- prisma/seed.ts is now a no-op stub, so they will not be re-created.
-- This script just removes the existing rows.
--
-- HOW TO RUN (against prod, once):
--   1. Open Render → ts2-lms-db → "Connect" → copy External Connection String
--   2. psql "<connection-string>" -f scripts/delete-demo-users.sql
--      (or paste the script into Render's database "Shell" tab)
--   3. Verify: SELECT email FROM "User" WHERE email LIKE '%@teamssquared.com';
--      Should return 0 rows.
--
-- SAFETY:
-- - Only deletes accounts whose email matches the typo'd seed domain
--   (@teamssquared.com — note the double-s, not the real @teamsquared.io
--   tenant domain). Real users on @teamsquared.io are NOT touched.
-- - User row deletion cascades to: Enrollment, LessonProgress, QuizAttempt,
--   QuizAnswer, Notification, DeadlineReminderLog, UserStats, UserAchievement.
--   The first SELECT below previews any associated data so you can sanity-
--   check before running the DELETE.

-- ── 1. Preview what will be deleted ────────────────────────────────────────
\echo '── Demo accounts that will be deleted ───────────────────────────'
SELECT id, email, name, role, "createdAt"
FROM "User"
WHERE email IN (
  'admin@teamssquared.com',
  'manager@teamssquared.com',
  'employee@teamssquared.com',
  'sarah@teamssquared.com',
  'carol@teamssquared.com'
)
ORDER BY email;

\echo '── Cascading rows that will be removed ──────────────────────────'
SELECT
  (SELECT COUNT(*) FROM "Enrollment" WHERE "userId" IN (
    SELECT id FROM "User" WHERE email LIKE '%@teamssquared.com'
  )) AS enrollments,
  (SELECT COUNT(*) FROM "LessonProgress" WHERE "userId" IN (
    SELECT id FROM "User" WHERE email LIKE '%@teamssquared.com'
  )) AS lesson_progress,
  (SELECT COUNT(*) FROM "QuizAttempt" WHERE "userId" IN (
    SELECT id FROM "User" WHERE email LIKE '%@teamssquared.com'
  )) AS quiz_attempts,
  (SELECT COUNT(*) FROM "Notification" WHERE "userId" IN (
    SELECT id FROM "User" WHERE email LIKE '%@teamssquared.com'
  )) AS notifications;

-- ── 2. Delete ──────────────────────────────────────────────────────────────
\echo '── Deleting demo accounts… ──────────────────────────────────────'
DELETE FROM "User"
WHERE email IN (
  'admin@teamssquared.com',
  'manager@teamssquared.com',
  'employee@teamssquared.com',
  'sarah@teamssquared.com',
  'carol@teamssquared.com'
);

-- ── 3. Verify ──────────────────────────────────────────────────────────────
\echo '── Verifying (should be 0 rows) ─────────────────────────────────'
SELECT COUNT(*) AS remaining_demo_accounts
FROM "User"
WHERE email LIKE '%@teamssquared.com';

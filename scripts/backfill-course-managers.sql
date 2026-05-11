-- One-shot backfill: link course creators into the CourseManagers m2m
-- for any course created AFTER the 20260508000000_add_course_managers
-- migration ran. The original migration only covered courses that existed
-- at migration time; courses created by CMs after that date have no
-- manager row and their creator gets a 404 on the Edit button.
--
-- Safe to run multiple times — ON CONFLICT DO NOTHING is a no-op for
-- courses already correctly linked.
--
-- Run from the Render Shell:
--   npx prisma db execute --stdin < scripts/backfill-course-managers.sql
-- OR:
--   npx prisma db execute --file scripts/backfill-course-managers.sql

INSERT INTO "_CourseManagers" ("A", "B")
SELECT c."id", c."createdById"
  FROM "Course" c
  JOIN "User" u ON u."id" = c."createdById"
 WHERE u."role" IN ('ADMIN', 'COURSE_MANAGER')
ON CONFLICT DO NOTHING;

-- Verify: show how many courses now have at least one manager.
SELECT
  COUNT(DISTINCT "A") AS courses_with_manager,
  COUNT(*)            AS total_manager_links
FROM "_CourseManagers";

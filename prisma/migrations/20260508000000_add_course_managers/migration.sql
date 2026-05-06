-- Adds the implicit many-to-many "CourseManagers" relation between
-- User and Course. Used by the role-aware authorization helpers in
-- src/lib/courseAccess.ts to scope COURSE_MANAGER access to courses
-- they manage. ADMIN bypasses the relation (sees all).
--
-- The Prisma client expects the implicit join table to be named
-- "_CourseManagers" with columns A (Course.id) and B (User.id), keyed
-- alphabetically by the related model names (Course < User).
CREATE TABLE "_CourseManagers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CourseManagers_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_CourseManagers_B_index" ON "_CourseManagers"("B");

ALTER TABLE "_CourseManagers"
    ADD CONSTRAINT "_CourseManagers_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_CourseManagers"
    ADD CONSTRAINT "_CourseManagers_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: each existing course's creator becomes a manager, but only
-- if that user is ADMIN or COURSE_MANAGER. Courses created by an
-- EMPLOYEE (e.g. someone whose role was later demoted) get no manager
-- and are then ADMIN-only-editable until reassigned via the manager
-- assignment UI.
INSERT INTO "_CourseManagers" ("A", "B")
SELECT c."id", c."createdById"
  FROM "Course" c
  JOIN "User" u ON u."id" = c."createdById"
 WHERE u."role" IN ('ADMIN', 'COURSE_MANAGER')
ON CONFLICT DO NOTHING;

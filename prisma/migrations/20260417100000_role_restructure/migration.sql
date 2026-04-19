-- Drop CourseInstructor table
DROP TABLE IF EXISTS "CourseInstructor";

-- Migrate any remaining non-target role values to safe defaults before recreating the enum
-- (Dev-only data; production has no INSTRUCTOR users per plan.)
-- Recreate the Role enum with the new set of values.

-- 1. Create new enum type
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'COURSE_MANAGER', 'EMPLOYEE');

-- 2. Update any MANAGER rows to COURSE_MANAGER and INSTRUCTOR rows to EMPLOYEE
--    using a temporary text cast, then switch the column type.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::text;

UPDATE "User" SET "role" = 'COURSE_MANAGER' WHERE "role" = 'MANAGER';
UPDATE "User" SET "role" = 'EMPLOYEE' WHERE "role" = 'INSTRUCTOR';

ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING "role"::"Role_new";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';

-- 3. Drop old enum and rename new one into place
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

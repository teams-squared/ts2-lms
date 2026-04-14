-- AlterTable: add category and requiredClearance to Course
ALTER TABLE "Course" ADD COLUMN "category" TEXT;
ALTER TABLE "Course" ADD COLUMN "requiredClearance" TEXT;

-- CreateTable
CREATE TABLE "UserClearance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clearance" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "courseId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("courseId","prerequisiteId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserClearance_userId_clearance_key" ON "UserClearance"("userId", "clearance");

-- AddForeignKey
ALTER TABLE "UserClearance" ADD CONSTRAINT "UserClearance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

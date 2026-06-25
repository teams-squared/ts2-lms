-- Module-scoped enrollment + first-class module completion.
-- All-additive (two new tables, indexes, FKs) — safe under
-- `prisma migrate deploy` on the shared prod DB. No drops, no backfill:
-- existing enrollments get zero EnrollmentModule rows = whole course.

-- CreateTable
CREATE TABLE "EnrollmentModule" (
    "enrollmentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,

    CONSTRAINT "EnrollmentModule_pkey" PRIMARY KEY ("enrollmentId", "moduleId")
);

-- CreateTable
CREATE TABLE "ModuleCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentModule_moduleId_idx" ON "EnrollmentModule"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleCompletion_moduleId_idx" ON "ModuleCompletion"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleCompletion_userId_idx" ON "ModuleCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleCompletion_userId_moduleId_key" ON "ModuleCompletion"("userId", "moduleId");

-- AddForeignKey
ALTER TABLE "EnrollmentModule" ADD CONSTRAINT "EnrollmentModule_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentModule" ADD CONSTRAINT "EnrollmentModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleCompletion" ADD CONSTRAINT "ModuleCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleCompletion" ADD CONSTRAINT "ModuleCompletion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

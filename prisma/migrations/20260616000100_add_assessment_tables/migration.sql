-- Assessment lesson type: config + questions/options + submissions/answers.
-- All-additive (new enums, new tables, new indexes) — safe under
-- `prisma migrate deploy` on the shared prod DB. No drops, no backfill.

-- CreateEnum
CREATE TYPE "AssessmentQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'FREE_TEXT');

-- CreateEnum
CREATE TYPE "AssessmentSubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'MARKED_PASS', 'MARKED_FAIL');

-- CreateTable
CREATE TABLE "AssessmentLesson" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "timeLimitMinutes" INTEGER NOT NULL,
    "passThreshold" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionType" "AssessmentQuestionType" NOT NULL,
    "maxMarks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssessmentSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "autoScore" INTEGER NOT NULL DEFAULT 0,
    "manualScore" INTEGER,
    "totalScore" INTEGER,
    "passThreshold" INTEGER NOT NULL,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "responseText" TEXT,
    "awardedMarks" INTEGER,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentLesson_lessonId_key" ON "AssessmentLesson"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentQuestion_lessonId_order_key" ON "AssessmentQuestion"("lessonId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentOption_questionId_order_key" ON "AssessmentOption"("questionId", "order");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_lessonId_idx" ON "AssessmentSubmission"("lessonId");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_userId_idx" ON "AssessmentSubmission"("userId");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_status_idx" ON "AssessmentSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_submissionId_questionId_key" ON "AssessmentAnswer"("submissionId", "questionId");

-- Enforce "one open submission per (user, lesson)" — the reattempt lock.
-- A student may not start a new attempt while one is IN_PROGRESS or SUBMITTED
-- (awaiting marking). MARKED_FAIL/MARKED_PASS rows are excluded so a failed
-- attempt unlocks a retake. Hand-written because Prisma @@unique can't express
-- a partial (WHERE) index.
CREATE UNIQUE INDEX "AssessmentSubmission_one_open_per_user_lesson"
    ON "AssessmentSubmission"("userId", "lessonId")
    WHERE "status" IN ('IN_PROGRESS', 'SUBMITTED');

-- AddForeignKey
ALTER TABLE "AssessmentLesson" ADD CONSTRAINT "AssessmentLesson_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentOption" ADD CONSTRAINT "AssessmentOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssessmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "AssessmentOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "InviteEmailTemplate" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "subject" TEXT NOT NULL DEFAULT 'You''ve been added to Teams Squared LMS',
    "bodyText" TEXT NOT NULL DEFAULT '',
    "ccEmails" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "InviteEmailTemplate_pkey" PRIMARY KEY ("id")
);

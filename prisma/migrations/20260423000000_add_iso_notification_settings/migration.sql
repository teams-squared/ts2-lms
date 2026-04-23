-- CreateTable
CREATE TABLE "IsoNotificationSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "toEmails" TEXT[],
    "ccEmails" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "IsoNotificationSettings_pkey" PRIMARY KEY ("id")
);

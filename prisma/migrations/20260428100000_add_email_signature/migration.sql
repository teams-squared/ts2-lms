-- CreateTable
CREATE TABLE "EmailSignature" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "signOff" TEXT NOT NULL DEFAULT 'Best regards,',
    "name" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "websiteLabel" TEXT NOT NULL DEFAULT '',
    "addressLine" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "EmailSignature_pkey" PRIMARY KEY ("id")
);

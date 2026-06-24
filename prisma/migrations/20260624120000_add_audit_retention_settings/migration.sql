-- AuditRetentionSettings: singleton legal-hold switch for audit-log retention.
-- When prunePaused = true, the prune-audit-logs cron skips deletion entirely so
-- logs tied to an open investigation / active ISO audit are preserved past the
-- retention window (ISO 27001 A.5.33 / A.8.15).
--
-- IF NOT EXISTS: staging and prod share one database but apply schema via two
-- different mechanisms (staging prisma/migrate.ts, prod prisma migrate deploy).
-- Idempotent so whichever path runs first wins and the other is a no-op.
CREATE TABLE IF NOT EXISTS "AuditRetentionSettings" (
    "id"          TEXT NOT NULL,
    "prunePaused" BOOLEAN NOT NULL DEFAULT false,
    "pauseReason" TEXT,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "updatedBy"   TEXT,
    CONSTRAINT "AuditRetentionSettings_pkey" PRIMARY KEY ("id")
);

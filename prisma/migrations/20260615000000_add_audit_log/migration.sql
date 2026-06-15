-- Centralised security audit trail (ISO 27001 A.8.15 / A.5.28 evidence).
-- One append-only row per sensitive action: login, role change, user delete,
-- clearance grant/revoke, enrollment create/delete.
--
-- actorId is SetNull (NOT cascade): deleting the actor must never erase their
-- audit history. actorEmail snapshots the actor email at write time so the
-- trail stays readable after the actor row is gone. targetId carries no FK
-- because targets are routinely deleted (that is the audited event itself).

CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "actorId"    TEXT,
    "actorEmail" TEXT,
    "targetType" TEXT,
    "targetId"   TEXT,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_action_createdAt_idx"
    ON "AuditLog"("action", "createdAt");

CREATE INDEX "AuditLog_actorId_createdAt_idx"
    ON "AuditLog"("actorId", "createdAt");

CREATE INDEX "AuditLog_targetType_targetId_idx"
    ON "AuditLog"("targetType", "targetId");

CREATE INDEX "AuditLog_createdAt_idx"
    ON "AuditLog"("createdAt");

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

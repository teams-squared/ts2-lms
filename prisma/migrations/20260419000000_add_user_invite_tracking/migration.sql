-- Add invite-tracking audit fields to User.
-- Both are nullable so existing rows require no backfill. `invitedById` is a
-- self-referencing FK that nulls out if the inviting user is deleted, so an
-- invite record is preserved even if the inviter's account is later removed.

ALTER TABLE "User"
  ADD COLUMN "invitedAt" TIMESTAMP(3),
  ADD COLUMN "invitedById" TEXT;

ALTER TABLE "User"
  ADD CONSTRAINT "User_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_invitedById_idx" ON "User"("invitedById");

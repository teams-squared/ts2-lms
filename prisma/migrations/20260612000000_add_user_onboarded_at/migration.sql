-- Add the first-login onboarding marker to User.
-- Null = the onboarding modal hasn't been seen yet. Nullable, so existing rows
-- need no backfill (they simply see the modal once on next login).
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Add enabled toggle for the ISO acknowledgement email so admins can
-- disable the email without dropping all recipients (Resend quota was
-- being eaten by per-ack notifications).

ALTER TABLE "IsoNotificationSettings"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

-- One-shot data fix: stop the email bleed by disabling the existing prod
-- singleton on deploy. Admin re-enables explicitly via /admin/emails when
-- the email volume is back under the quota budget. Fresh installs (no
-- singleton row yet) are unaffected and inherit the column default.
UPDATE "IsoNotificationSettings"
   SET "enabled" = false
 WHERE "id" = 'singleton';

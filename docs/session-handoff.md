# Session handoff

> Read this after `CLAUDE.md`. Regenerate via the `/prep` slash command
> (or "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates, regenerate.

## Last sync

- **When:** 2026-05-05
- **Branch:** `dev`
- **HEAD:** `34deb78` — `feat(iso): harden audit evidence + add coverage view`
- **Working tree:** clean for handoff purposes. Two non-deliverable
  local files present and intentionally ignored:
  - `.claude/settings.local.json` (modified — local IDE prefs, not for commit)
  - `.claire/` (untracked — local-only directory)
- **Open PRs (`dev → main`):** none. PR #30 (ISO tab restructure) merged
  earlier today. Commit `34deb78` (audit-evidence hardening) is on `dev`
  but **not yet on main** — needs a fresh `dev → main` PR to reach prod.

## What just shipped

Last six meaningful commits on `dev`:

1. `34deb78` `feat(iso): harden audit evidence + add coverage view` —
   ISO 27001 Stage-2 gaps closed: attestation-text snapshot via shared
   `formatPolicyAttestation` util, focused-tab dwell seconds recorded,
   SharePoint item id snapshot, new `/admin/iso?tab=coverage` view +
   CSV export. Schema adds three nullable cols on `LessonProgress`
   (migration `20260506000000_add_iso_audit_evidence`). Not in main yet.
2. `78c30e4` `feat(iso): move ack log + CSV export to dedicated /admin/iso top-level tab`
   — separated compliance evidence (`/admin/iso`) from email config
   (`/admin/emails`). Merged to main via PR #30.
3. `1c9e03b` `docs(handoff): regenerate post-PR-29 merge` — handoff doc.
4. `061b67c` `docs(handoff): regenerate for 2026-05-05 session` — handoff.
5. `bdca0a2` `fix(policy-doc): make dwell-timer gate visible to learners`
   — operator-reported confusion: timer banner now reads "Acknowledge
   unlocks in m:ss"; attestation row says "Locked for m:ss more".
   Shipped via PR #29.
6. `2651670` `feat(iso-ack): in-app audit log + CSV export for ISO auditors`
   — original ISO ack log surface. Shipped via PR #29.

## In-flight

_None._ Working tree clean.

## Pending external actions

Checkbox list — items waiting on the operator before / around the first
employee onboarding launch.

- [ ] **Open `dev → main` PR for `34deb78` (audit-evidence hardening)
  when ready to ship.** Per `CLAUDE.md`, only when explicitly asked.
  PR will carry the new migration and three new audit columns. Title
  suggestion: `Release: ISO 27001 audit-evidence hardening`.

- [ ] **Apply migration `20260506000000_add_iso_audit_evidence` on prod
  AFTER the dev→main PR merges and Render redeploys.** Adds
  `acknowledgedAttestationText TEXT`, `acknowledgedDwellSeconds INTEGER`,
  `acknowledgedSharePointItemId TEXT` to `LessonProgress`. All nullable;
  legacy rows stay NULL (treated as pre-evidence-hardening).

  ```sh
  npx prisma migrate deploy
  # OR run migration.sql directly from the migration dir
  ```

  Verify:
  ```sql
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'LessonProgress'
     AND column_name IN ('acknowledgedAttestationText','acknowledgedDwellSeconds','acknowledgedSharePointItemId');
  -- expect 3 rows
  ```

- [ ] **Confirm migration `20260504000000_add_iso_settings_enabled`
  applied on prod.** Status uncertain at last handoff. If unapplied, the
  ISO-ack toggle UI exists but the underlying column does not, and the
  email keeps firing on every acknowledgement.

  ```sql
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'IsoNotificationSettings' AND column_name = 'enabled';
  SELECT enabled FROM "IsoNotificationSettings";
  ```

- [ ] **Confirm earlier migrations applied to prod** (`InviteEmailTemplate`,
  `EmailSignature`, `EmailSignature.disclaimer`).

  ```sql
  SELECT to_regclass('"InviteEmailTemplate"'), to_regclass('"EmailSignature"');
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'EmailSignature' AND column_name = 'disclaimer';
  ```

- [ ] **Confirm `EMAIL_FROM` on Render** is either unset (code default:
  `Teams Squared LMS <lms-noreply@teamsquared.io>`) OR set to exactly
  that value.

- [ ] **Confirm `CRON_SECRET` is set on Render.** Wired in `render.yaml`
  as `sync: false` — must be populated from the dashboard manually.
  Without it, deadline-reminder cron returns 500 (silent daily fail).

- [ ] **Customize invite email + signature at `/admin/emails`.** Without
  an explicit save, system falls back to built-in default body. A draft
  was discussed: `Hi {{firstName}},\n\nWe're glad to have you on board…`
  and a signature for Akil Fernando · IT Systems & Cybersecurity Lead.

- [ ] **Send a test batch invite end-to-end.** Invite 3+ personal
  addresses from `/admin/users`. Confirm: emails arrive, no 429s in
  Resend, subject + body + signature reflect saved template, sign-in
  button works, SSO completes, course assignments visible. Then
  complete one non-policy lesson, take a quiz, acknowledge a policy
  doc — verify XP increments by 10 once, ISO ack audit row written
  (with new attestation/dwell/itemId columns), no console errors.

- [ ] **Smoke-test new `/admin/iso?tab=coverage` view on prod after
  deploy.** Coverage table loads, percentages match seed data, drill-
  down works, "Download CSV" emits one row per outstanding (user ×
  policy). Confirm `/admin/iso` (no `?tab=`) still defaults to the
  Acknowledgements tab and shows the three new columns.

- [ ] **Smoke-test dwell-time recording.** Open a policy lesson as a
  non-admin, wait the 6-min dwell, tick the checkbox, click Acknowledge.
  Then in `/admin/iso` confirm the new row's Dwell column shows ~6m 0s
  and the attestation cell shows the rendered legal statement.

- [ ] **Post-launch — npm vulns.** Two moderate-severity vulns called
  out by GitHub on push (down from three at last sync). Fixes require
  framework version bumps (Next, Prisma). Plan a dedicated upgrade
  cycle within 6–8 weeks of launch.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Cleaner, would auto-apply migrations folder
  (avoiding the manual apply step that has now bitten us twice — ISO
  toggle + audit-evidence). Gated on a non-launch deploy window where
  regression can be observed.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Declined for now (subdomain verification more comfortable
  on a paid Resend plan). Gated on tier upgrade or deliverability
  incident on apex domain.

- **Server-side dwell enforcement for POLICY_DOC.** Dwell + attestation
  gate is client-side only (bypassable via DevTools). The new server-
  recorded `acknowledgedDwellSeconds` only captures what the client
  reports — defangs garbage values via `[0, 86400]` clamp but does not
  prevent a determined client from sending exactly 360. Audit trail
  (version / eTag / hash / attestation text / item id) remains the
  authoritative ack record. Gated on auditor pushback or compliance
  incident.

- **Tamper-evidence (append-only / signed audit records).** Postgres
  rows currently mutable by admin. ISO 27001 doesn't mandate
  cryptographic ledger for ack records; mitigation is operational
  (restricted admin role, DB audit log, backups). Gated on auditor ask.

- **Per-policy override of attestation text.** Currently the wording is
  hardcoded in `src/lib/policy-doc/attestation.ts`. Snapshotting via
  shared util is sufficient evidence of what was shown. Gated on a
  business need to vary wording per policy (e.g. legal review of
  specific high-risk policies).

- **Quiz double-submit idempotency token.** Theoretical race in
  `quiz/attempt`. Client disables button while submitting (small
  practical window). Gated on observed prod incident.

- **Email retry / dead-letter queue.** All sends fire-and-forget (single
  429 retry on invites only). Gated on first observed Resend outage
  causing noticeable invite or ISO ack drop.

## Pickup pointer

The natural next move is **operational, not code**: open and merge a
`dev → main` PR carrying `34deb78` (audit-evidence hardening) so it
reaches Render, then apply migration `20260506000000_add_iso_audit_evidence`
on Render Shell. Until that runs, the new columns exist in code but not
in prod schema and the audit fields will fail to write.

After that, remaining items in **Pending external actions** are
operational (env-var checks, template customization, smoke tests) and
need the operator's hands more than a session's.

If continuing without operator input: there is no material code task
pending. Do NOT start the npm-vulns upgrade cycle without explicit
go-ahead — multi-PR effort with regression risk.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Outbound email + signature renderer | `src/lib/email.ts` |
| Admin email surface (Invite / Signature / ISO Ack Email tabs) | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx`, `src/components/admin/EmailsTabs.tsx` |
| ISO notification email settings (To/Cc + enabled toggle) | `src/app/api/admin/settings/iso-notifications/route.ts`, `src/components/admin/IsoNotificationSettingsForm.tsx` |
| ISO compliance surface (Acknowledgements + Coverage tabs) | `src/app/admin/iso/page.tsx`, `src/components/admin/IsoTabs.tsx`, `IsoAckLog.tsx`, `IsoCoverage.tsx` |
| ISO ack list / export API | `src/app/api/admin/iso-acks/route.ts`, `src/app/api/admin/iso-acks/export/route.ts` |
| ISO coverage list / export API | `src/app/api/admin/iso-coverage/route.ts`, `src/app/api/admin/iso-coverage/export/route.ts` |
| Policy attestation template (shared util) | `src/lib/policy-doc/attestation.ts` |
| Invite UI (single + batch, sequential throttle) | `src/components/admin/InviteUserForm.tsx`, `src/components/admin/CourseNodeTree.tsx` |
| Invite API (user create + enroll + email) | `src/app/api/admin/users/invite/route.ts` |
| Lesson complete API (race-safe, ISO audit snapshot, dwell record) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Quiz attempt API (no answer-key leak) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/attempt/route.ts` |
| Policy-doc viewer (PDF embed + dwell + attestation) | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| Lesson footer (Acknowledge gating + dwell POST forwarding) | `src/components/courses/LessonFooter.tsx` |
| App shell sidebar | `src/components/layout/Sidebar.tsx` |
| Course sidebar | `src/components/courses/CourseSidebar.tsx` |
| Lesson viewer dispatch | `src/components/courses/LessonViewer.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied — see Pending) | `prisma/migrations/`, custom `prisma/migrate.ts` |
| Render deploy config | `render.yaml` |
| CI workflows | `.github/workflows/ci.yml`, `dependency-review.yml`, `deadline-reminders.yml` |
| Tests (vitest, 703 passing) | `src/__tests__/` |
| E2E (Playwright, NOT in CI) | `e2e/` |
| Design system reference | `docs/teams-squared-lms-design-system.mdx` |

## Hard-earned conventions worth re-reading

- `dev` is integration; `main` is branch-protected production. Reach
  prod only via explicit `dev → main` PR per `CLAUDE.md`.
- Custom `prisma/migrate.ts` is hand-rolled idempotent SQL. New
  migrations need explicit application — has now bitten us **three**
  times (ISO toggle, ISO log, audit-evidence). Switching to
  `prisma migrate deploy` is open in Decisions.
- Resend SDK v6 returns `{data, error}` — does NOT throw on failure.
  Always destructure and check `error`.
- `react-markdown` v10 default escapes raw HTML and strips
  `javascript:` / `data:` URLs — don't add `rehype-raw` to admin-authored
  markdown.
- `lessonProgress` create-then-conditional-update is the reference race-
  safe pattern. Reuse for any "fire side effects exactly once" surface.
- Credentials provider gated on `NODE_ENV !== "production"`. Local-dev
  bootstrap = SSO sign-in then SQL-promote per `prisma/seed.ts` header.
- Policy-doc dwell timer is client-side only (bypassable). `LessonProgress`
  audit trail (version + eTag + hash + attestation text + item id) is
  the authoritative ack record; dwell + attestation are UX, not security.
- The `LessonProgress` Prisma relation on `Lesson` is named `progress`,
  not `lessonProgress`. Easy to typo.

# Session handoff

> Read this after `CLAUDE.md`. Regenerate via the `/prep` slash command
> (or "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates, regenerate.

## Last sync

- **When:** 2026-05-05
- **Branch:** `dev`
- **HEAD:** `061b67c` — `docs(handoff): regenerate for 2026-05-05 session`
- **Working tree:** clean for handoff purposes. Two non-deliverable local
  files present and intentionally ignored:
  - `.claude/settings.local.json` (modified — local IDE prefs, not for commit)
  - `.claire/` (untracked — local-only directory)
- **Open PRs (`dev → main`):** none. PR #29 merged 2026-05-05; `dev`
  and `origin/main` are in sync. Render is redeploying (or already
  redeployed) from `main`.

## What just shipped

Last six meaningful commits on `dev`, all now in `main` via PR #29:

1. `bdca0a2` `fix(policy-doc): make dwell-timer gate visible to learners`
   — operator-reported confusion: learners didn't know why Acknowledge
   was disabled. LessonFooter button tooltip replaced stale "Scroll to
   bottom" text with the real gate; timer banner headline now
   "Acknowledge unlocks in m:ss"; attestation row says "Locked for m:ss
   more" when greyed.
2. `2651670` `feat(iso-ack): in-app audit log + CSV export for ISO auditors`
   — audit-evidence surface inside `/admin/emails` so auditors don't
   depend on the email path. Reads from `LessonProgress` snapshots.
3. `0c8bb82` `feat(iso-ack): make notification email disable-able via toggle`
   — per-ack email was eating Resend free-tier quota. Adds
   `IsoNotificationSettings.enabled` (default true). Migration
   `20260504000000_add_iso_settings_enabled` ALSO disables the existing
   prod singleton on apply — see Pending Actions.
4. `216f900` `fix(invite): also match rate_limit_exceeded by name in 429 retry`
   — belt fix on top of #5: also match `error.name === "rate_limit_exceeded"`.
5. `4387065` `fix(invite): prevent 429 rate-limit drops in batch invite email sends`
   — root cause: Resend SDK v6 returns `{data, error}` without throwing.
   Client now sequential at 600 ms; server retries once on 429.
6. `c2048a5` `chore(email): revert sender default to lms-noreply@teamsquared.io`
   — paid Resend tier not wanted yet; sender stays on apex domain.

## In-flight

_None._ Working tree is clean.

## Pending external actions

Checkbox list — items waiting on the operator before / around the first
employee onboarding launch.

- [ ] **Confirm Render deploy of PR #29 succeeded.** Merged 2026-05-05.
  Check the Render dashboard to confirm the deploy completed without
  errors before applying the new migration.

- [ ] **Apply migration `20260504000000_add_iso_settings_enabled` on
  prod.** ⚠️ HIGH PRIORITY — until applied, the ISO-ack toggle UI
  exists in code but the underlying column does NOT exist in prod and
  the email keeps firing on every acknowledgement (and burning Resend
  free-tier quota). On apply, the migration also disables the existing
  prod singleton in the same step, so the email stops the moment SQL
  lands.

  Apply via Render Shell:
  ```sh
  npx prisma migrate deploy
  # OR run the SQL directly from prisma/migrations/20260504000000_add_iso_settings_enabled/migration.sql
  ```

  Verify:
  ```sql
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'IsoNotificationSettings' AND column_name = 'enabled';
  -- and that the row is disabled:
  SELECT enabled FROM "IsoNotificationSettings";
  ```

- [ ] **Confirm earlier migrations are applied to prod.** The custom
  `prisma/migrate.ts` does NOT auto-apply `prisma/migrations/` files.
  Three older migrations from the PR #28 wave should already be applied
  but are worth re-verifying:
  - `InviteEmailTemplate` (`20260428000000_add_invite_email_template`)
  - `EmailSignature` (`20260428100000_add_email_signature`)
  - `EmailSignature.disclaimer` (`20260430000000_add_signature_disclaimer`)

  ```sql
  SELECT to_regclass('"InviteEmailTemplate"'), to_regclass('"EmailSignature"');
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'EmailSignature' AND column_name = 'disclaimer';
  ```

- [ ] **Confirm `EMAIL_FROM` on Render** is either unset (code default:
  `Teams Squared LMS <lms-noreply@teamsquared.io>`) OR set to exactly
  that value.

- [ ] **Confirm `CRON_SECRET` is set on Render.** Wired in `render.yaml`
  as `sync: false` — must be populated from the Render dashboard manually.
  Without it, the deadline-reminder cron returns 500 on every invocation
  (silent daily fail).

- [ ] **Customize invite email + signature at `/admin/emails`.** Without
  an explicit save, the system falls back to the built-in default body.
  A draft was discussed: `Hi {{firstName}},\n\nWe're glad to have you on
  board…` and a signature for Akil Fernando · IT Systems & Cybersecurity
  Lead. Both should be saved before the first invite goes out.

- [ ] **Send a test batch invite end-to-end.** Invite 3+ personal
  addresses from `/admin/users`. Confirm: all emails arrive (no 429s in
  Resend dashboard), subject + body + signature reflect the saved
  template, sign-in button works, SSO flow completes, course assignments
  visible. Then complete one non-policy lesson, take a quiz, acknowledge
  a policy doc — verify XP increments by 10 once (not twice), ISO ack
  audit row written (email may or may not send depending on toggle), no
  console errors.

- [ ] **Smoke-test the dwell-timer UX fix on prod.** Open a policy-doc
  lesson as a non-admin; verify (a) timer banner reads "Acknowledge
  unlocks in 5:59 — keep this tab open while you read", (b) attestation
  checkbox is greyed and reads "Locked for m:ss more", (c) Acknowledge
  button tooltip reads "Finish the required reading time and tick the
  attestation checkbox to enable" (NOT "Scroll to the bottom"). Origin:
  a real user complained they couldn't tell why the button was disabled.

- [ ] **Post-launch — npm vulns.** Two moderate-severity vulns called
  out by GitHub on push (down from three at last sync — one resolved
  upstream). Fixes require framework version bumps (Next, Prisma). Plan
  a dedicated upgrade cycle within 6–8 weeks of launch.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Cleaner, would auto-apply migrations folder
  (and avoid the manual apply step that just bit us with the ISO
  toggle), but switching right before launch is risky if prod schema
  has drifted. Gated on a non-launch deploy window where regression can
  be observed.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Declined for now (Resend subdomain verification is more
  comfortable on a paid plan). Gated on Resend tier upgrade or a
  deliverability incident on the apex domain.

- **Server-side dwell enforcement for POLICY_DOC.** The 6-minute dwell
  + attestation gate is client-side only — bypassable via DevTools. The
  UX fix in `bdca0a2` is purely cosmetic; it does not change the threat
  model. Audit trail (version / eTag / hash) is server-side and
  authoritative. Gated on auditor pushback or compliance incident.

- **Quiz double-submit idempotency token.** Theoretical race in
  `quiz/attempt` if a learner double-clicks Submit within one round-trip.
  Client disables the button while submitting (practical window is small).
  Gated on observed prod incident.

- **Email retry / dead-letter queue.** All email sends are fire-and-forget
  (with a single 429 retry now). Gated on first observed Resend outage
  causing a noticeable invite or ISO ack drop.

## Pickup pointer

The natural next move is **operational**: apply migration
`20260504000000_add_iso_settings_enabled` on Render so the ISO-ack
toggle actually takes effect in prod. Until that happens, the code is
deployed but the email keeps sending on every acknowledgement.

After that, the remaining items in **Pending external actions** are
operational (env-var checks, template customization, smoke tests) and
need the operator's hands more than a session's.

If you continue without operator input: there is no material code task
pending. Do NOT start the npm-vulns upgrade cycle without an explicit
go-ahead — multi-PR effort with regression risk.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Outbound email + signature renderer | `src/lib/email.ts` |
| Admin email surface (Invite / Signature / ISO ack tabs) | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx`, `src/components/admin/EmailsTabs.tsx` |
| ISO notification settings (To/Cc + enabled toggle) | `src/app/api/admin/settings/iso-notifications/route.ts`, `src/components/admin/IsoNotificationSettingsForm.tsx` |
| ISO ack audit log + CSV export | inside `/admin/emails` (ISO-ack tab) |
| Invite UI (single + batch, sequential throttle) | `src/components/admin/InviteUserForm.tsx`, `src/components/admin/CourseNodeTree.tsx` |
| Invite API (user create + enroll + email) | `src/app/api/admin/users/invite/route.ts` |
| Lesson complete API (race-safe, ISO email gated on settings.enabled) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Quiz attempt API (no answer-key leak) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/attempt/route.ts` |
| Policy-doc viewer (PDF embed + dwell + attestation, explicit lock messaging) | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| Lesson footer (Acknowledge button gating + tooltip) | `src/components/courses/LessonFooter.tsx` |
| App shell sidebar (auto-collapsing rail) | `src/components/layout/Sidebar.tsx` |
| Course sidebar (auto-collapsing rail on lesson pages) | `src/components/courses/CourseSidebar.tsx` |
| Lesson viewer (text/video/document/html dispatch) | `src/components/courses/LessonViewer.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied — see Pending) | `prisma/migrations/`, custom `prisma/migrate.ts` |
| Demo-user cleanup (one-shot) | `scripts/delete-demo-users.{sql,ts}` |
| Render deploy config | `render.yaml` |
| CI workflows | `.github/workflows/ci.yml`, `dependency-review.yml`, `deadline-reminders.yml` |
| Tests (vitest) | `src/__tests__/` |
| E2E (Playwright, NOT in CI) | `e2e/` |
| Design system reference | `docs/teams-squared-lms-design-system.mdx` |

## Hard-earned conventions worth re-reading

- `dev` is the integration branch; every meaningful unit of work is
  committed and pushed there. `main` is branch-protected; reach prod
  only via an explicit `dev → main` PR per `CLAUDE.md`.
- The custom `prisma/migrate.ts` is hand-rolled idempotent SQL. New
  migrations in `prisma/migrations/` need explicit application to prod
  — this has now bitten us once (ISO toggle migration on PR #29).
- Resend SDK v6 returns `{data, error}` — it does NOT throw on failure.
  Always destructure and check `error`; never assume `await resend.emails.send()` throws.
- `react-markdown` v10 default behaviour escapes raw HTML and strips
  `javascript:` / `data:` / `vbscript:` URLs — don't add `rehype-raw`
  to admin-authored markdown surfaces.
- The `lessonProgress` create-then-conditional-update pattern in the
  lesson-complete route is the reference for race-safe transition
  detection. Reuse the same shape for any other "fire side effects
  exactly once" surface.
- The credentials provider is gated on `NODE_ENV !== "production"`.
  Demo seed users are gone. Local-dev bootstrap = SSO sign-in then
  SQL-promote per the file header in `prisma/seed.ts`.
- The policy-doc dwell timer is client-side only (bypassable). Treat
  the audit trail in `LessonProgress` (version + eTag + hash) as the
  authoritative ack record; the dwell + attestation checkbox are UX,
  not security.

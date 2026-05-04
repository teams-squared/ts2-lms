# Session handoff

> Read this after `CLAUDE.md`. Regenerate via the `/prep` slash command
> (or "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates, regenerate.

## Last sync

- **When:** 2026-05-04
- **Branch:** `dev`
- **HEAD:** `216f900` — `fix(invite): also match rate_limit_exceeded by name in 429 retry`
- **Working tree:** clean for handoff purposes. Two non-deliverable local
  files present and intentionally ignored:
  - `.claude/settings.local.json` (modified — local IDE prefs, not for commit)
  - `.claire/` (untracked — local-only directory)
- **Open PRs (`dev → main`):** none. PR #28 (big release merge) merged
  2026-05-01 and is live on prod.

## What just shipped

Last six meaningful commits on `dev` (all in main / prod via PR #28):

1. `216f900` `fix(invite): also match rate_limit_exceeded by name in 429 retry`
   — belt fix: Resend SDK types `statusCode` as `number | null`; also
   match on `error.name === "rate_limit_exceeded"` so the server-side
   retry fires even if `statusCode` is null.
2. `4387065` `fix(invite): prevent 429 rate-limit drops in batch invite email sends`
   — root cause: Resend SDK v6 returns `{data, error}` without throwing,
   so 429s were silently ignored and reported as `emailSent: true`.
   Client now dispatches sequentially at 600 ms intervals; server checks
   the error object and retries once on 429 after 1 100 ms sleep.
3. `2c4e7f6` `docs(handoff): add session-handoff.md + /prep convention`
4. `c2048a5` `chore(email): revert sender default to lms-noreply@teamsquared.io`
   — paid Resend tier not wanted yet; sender stays on apex domain. PR #27.
5. `101e9fc` `fix(admin/users delete): also reassign PolicyDocLesson.lastSyncedById`
   — RESTRICT-FK fix for deleting admin users who had synced policy docs.
   PR #26.
6. `02a554a` `chore(security/launch): remove demo seed accounts (PR B)` /
   `52ff175` `fix(security/launch): pre-launch hardening` — race-safe
   lesson complete, course-completion enrollment race fix, role gate on
   `/admin/nodes`, `rel="noopener noreferrer nofollow"` on outbound links.
   PR #24 / #25.

## In-flight

_None._ Working tree is clean.

## Pending external actions

Checkbox list — items waiting on the operator before / around the first
employee onboarding launch.

- [ ] **Confirm Render deployed PR #28.** PR merged 2026-05-01. Check
  the Render dashboard to confirm the deploy completed without errors.

- [ ] **Confirm Prisma migrations are applied to prod.** The custom
  `prisma/migrate.ts` does NOT auto-apply `prisma/migrations/` files.
  Three migrations need to exist as tables in prod:
  - `InviteEmailTemplate` (migration `20260428000000_add_invite_email_template`)
  - `EmailSignature` (migration `20260428100000_add_email_signature`)
  - `EmailSignature.disclaimer` column (migration `20260430000000_add_signature_disclaimer`)

  Quick verify (via `psql` or Render Shell):
  ```sql
  SELECT to_regclass('"InviteEmailTemplate"'), to_regclass('"EmailSignature"');
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'EmailSignature' AND column_name = 'disclaimer';
  ```
  All three must return non-NULL. Until applied, the email editor at
  `/admin/emails` falls back to defaults silently.

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
  email fires, no console errors.

- [ ] **Post-launch — npm vulns.** Three moderate-severity vulns
  outstanding (`uuid`, `postcss`, `@hono/node-server`). Fixes require
  framework version bumps (Next, Prisma). Plan a dedicated upgrade cycle
  within 6–8 weeks of launch.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Cleaner, would auto-apply migrations folder,
  but switching right before launch is risky if prod schema has drifted.
  Gated on a non-launch deploy window where regression can be observed.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Declined for now (Resend subdomain verification is more
  comfortable on a paid plan). Gated on Resend tier upgrade or a
  deliverability incident on the apex domain.

- **Server-side dwell enforcement for POLICY_DOC.** The 6-minute dwell
  + attestation gate is client-side only — bypassable via DevTools. Audit
  trail (version / eTag / hash) is server-side and authoritative. Gated
  on auditor pushback or compliance incident.

- **Quiz double-submit idempotency token.** Theoretical race in
  `quiz/attempt` if a learner double-clicks Submit within one round-trip.
  Client disables the button while submitting (practical window is small).
  Gated on observed prod incident.

- **Email retry / dead-letter queue.** All email sends are fire-and-forget
  (with a single 429 retry now). Gated on first observed Resend outage
  causing a noticeable invite or ISO ack drop.

## Pickup pointer

The natural next move is **operational**: run the test batch invite
(3+ recipients) from `/admin/users` against prod to verify the 429 fix
works end-to-end. Watch the Resend dashboard — you should see all emails
succeed with 200s, no 429s.

If the smoke test passes, the remaining items in **Pending external
actions** are operational (migrations, env vars, template customization)
and need the operator's hands more than a session's.

If you continue without operator input: the only material code task left
is post-launch cleanup — the npm-vulns upgrade cycle (Next, Prisma, etc.).
Do not start that without an explicit go-ahead; it's a multi-PR effort
with regression risk.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Outbound email + signature renderer | `src/lib/email.ts` |
| Admin email surface (Invite / Signature / ISO ack tabs) | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx`, `src/components/admin/EmailsTabs.tsx` |
| Invite UI (single + batch, sequential throttle) | `src/components/admin/InviteUserForm.tsx`, `src/components/admin/CourseNodeTree.tsx` |
| Invite API (user create + enroll + email) | `src/app/api/admin/users/invite/route.ts` |
| Lesson complete API (race-safe) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Quiz attempt API (no answer-key leak) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/attempt/route.ts` |
| Policy-doc viewer (PDF embed + dwell + attestation) | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| App shell sidebar (auto-collapsing rail) | `src/components/layout/Sidebar.tsx` |
| Course sidebar (auto-collapsing rail on lesson pages) | `src/components/courses/CourseSidebar.tsx` |
| Lesson viewer (text/video/document/html dispatch) | `src/components/courses/LessonViewer.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied — see Pending) | `prisma/migrations/`, custom `prisma/migrate.ts` |
| ISO notification settings (To/Cc recipients) | `src/app/api/admin/settings/iso-notifications/route.ts` |
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
  migrations in `prisma/migrations/` need explicit application to prod.
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

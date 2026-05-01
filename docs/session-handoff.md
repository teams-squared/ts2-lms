# Session handoff

> Read this after `CLAUDE.md`. Regenerate via the `/prep` slash command
> (or "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates, regenerate.

## Last sync

- **When:** 2026-05-01
- **Branch:** `dev`
- **HEAD:** `c2048a5` — `chore(email): revert sender default to lms-noreply@teamsquared.io`
- **Working tree:** clean for handoff purposes. Two non-deliverable local
  files present and intentionally ignored by the handoff:
  - `.claude/settings.local.json` (modified — local IDE prefs, not for commit)
  - `scripts/check-akil-progress.ts` (untracked — local one-off dev script)
- **Open PRs (`dev → main`):** none.

## What just shipped

Last ten commits on `dev`, newest first. All have already merged to `main`
and shipped to prod via Render unless flagged otherwise.

1. `c2048a5` `chore(email): revert sender default to lms-noreply@teamsquared.io`
   — paid-tier Resend not wanted; sender stays on the apex
   `@teamsquared.io` domain. PR #27.
2. `101e9fc` `fix(admin/users delete): also reassign PolicyDocLesson.lastSyncedById`
   — same RESTRICT-FK pattern as `Course.createdById`. Unblocked deletion
   of demo admins who had synced policy docs. PR #26.
3. `38bc2ae` `chore(scripts): handle Course/PolicyDocLesson RESTRICT FKs in cleanup`
   — script-level fallback for the same RESTRICT issue.
4. `d190148` `chore(scripts): TypeScript variant of delete-demo-users for non-psql users`
   — ergonomic alternative to the SQL script for admins without `psql`.
5. `02a554a` `chore(security/launch): remove demo seed accounts (PR B)`
   — dropped seed.ts demo-user upserts from Render `startCommand`,
   stubbed `prisma/seed.ts`, removed inline demo creds from `/login`,
   added `scripts/delete-demo-users.{sql,ts}` for one-shot prod cleanup.
   PR #25.
6. `52ff175` `fix(security/launch): pre-launch hardening — race-safe completion, role gate, link rel`
   — central pre-launch fix. Race-safe lesson-complete (create-then-
   conditional-update pattern → no double XP / double email on rapid
   click), course-completion enrollment race fix via conditional
   `updateMany`, explicit role gate on `/admin/nodes`,
   `rel="noopener noreferrer nofollow"` on outbound markdown links.
   3 new race-detection tests. PR #24.
7. `5947ff5` `fix(sidebar): app sidebar expansion no longer occluded by course sidebar`
   — z-index bump on app shell sidebar.
8. `6704fd3` `feat(admin/users): batch invite + course search in invite form`
   — multi-recipient invite UI + course-tree filter input.
9. `424b995` `fix(admin/emails): preview shows built-in default when body is blank`
   — preview pane now mirrors the server fallback.
10. `ecf7ad4` `feat(email-signature): confidentiality disclaimer fine-print block`
    — signature gained an optional `disclaimer` field with a
    "Use standard disclaimer" canned-text shortcut.

(Audit-blocker findings tracked in PR #24's body if you need the
provenance.)

## In-flight

_None._ The working tree's modified `.claude/settings.local.json` and
untracked `scripts/check-akil-progress.ts` are local-only cruft, not
WIP. No `wip/*` branch is open.

## Pending external actions

Things waiting on the operator (Akil) before / around the first
employee onboarding launch.

- [ ] **Confirm Prisma migrations are applied to prod.** The custom
  `prisma/migrate.ts` script does NOT apply files in
  `prisma/migrations/`; it's a hand-rolled idempotent SQL bootstrap
  that lags the migration folder. Three recent migrations need to
  exist as tables in prod:
  - `InviteEmailTemplate` (migration `20260428000000_add_invite_email_template`)
  - `EmailSignature` (migration `20260428100000_add_email_signature`)
  - `EmailSignature.disclaimer` column (migration `20260430000000_add_signature_disclaimer`)

  Quick verify (against prod via `psql` or the Render Shell):
  ```sql
  SELECT to_regclass('"InviteEmailTemplate"'), to_regclass('"EmailSignature"');
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'EmailSignature' AND column_name = 'disclaimer';
  ```
  All three must return non-NULL. Until applied, the editor at
  `/admin/emails` falls back to defaults silently (errors are caught;
  saves no-op).

- [ ] **Confirm `EMAIL_FROM` on Render** is either unset (code default
  kicks in: `Teams Squared LMS <lms-noreply@teamsquared.io>`) OR set to
  exactly that value.

- [ ] **Confirm `CRON_SECRET` is set on Render.** It's wired in
  `render.yaml` as `sync: false`, so the operator must populate it from
  the dashboard. Without it, the deadline-reminder cron returns 500 on
  every invocation (silent daily fail).

- [ ] **Customize the invite email + signature at `/admin/emails`.**
  Without an explicit save, the system falls back to the built-in
  default body. Earlier in the session we drafted copy starting
  `Hi {{firstName}},\n\nWe're glad to have you on board…` and a
  signature for Akil Fernando · IT Systems & Cybersecurity Lead.
  Both should be saved before the first invite goes out.

- [ ] **Send a test invite end-to-end.** Invite a personal Gmail (or
  any address you control). Confirm: email arrives, subject + body +
  signature reflect the saved template, logo renders, sign-in button
  works, SSO flow completes, course assignments visible to the test
  user. Then complete one non-policy lesson, take a quiz, acknowledge
  a policy doc — verify progress persists, XP increments by 10 once
  (not twice), no console errors.

- [ ] **Post-launch — npm vulns.** Three moderate-severity vulns are
  outstanding (`uuid`, `postcss`, `@hono/node-server`). Fixes need
  framework version bumps (Next, Prisma); plan a dedicated upgrade
  cycle within 6–8 weeks of launch.

## Open questions / decisions

Items that came up but aren't blockers. Each line: the question, then
what it's gated on.

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Cleaner, would auto-apply migrations folder,
  but switching the deploy migration mechanism right before launch is
  risky if the prod schema is drifted from what `prisma migrate deploy`
  expects. Gated on a non-launch deploy window where regression can be
  observed.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Argued for during the email-from work; declined for now
  because Resend's subdomain verification is more comfortable on a paid
  plan. Gated on Resend tier upgrade or a deliverability incident on
  the apex domain.

- **Server-side dwell enforcement for POLICY_DOC.** Currently the
  6-minute dwell + attestation gate is client-side only — bypassable
  via DevTools. Audit trail (version / eTag / hash) is server-side and
  authoritative; client gate is UX. Gated on auditor pushback or
  observed compliance incident.

- **Quiz double-submit Promise lock / idempotency token.** Theoretical
  race in `quiz/attempt` if a learner double-clicks Submit within one
  request round-trip. Client disables the button while submitting, so
  the practical window is small. Gated on observed prod incident.

- **Email retry / dead-letter queue.** All email sends are
  fire-and-forget today. Gated on first observed Resend outage that
  causes a noticeable invite or ISO ack drop.

## Pickup pointer

The natural next move is **operational, not coding**: send a test
invite to a personal address from `/admin/users`, walk through the
flow end-to-end as the invited test user, and confirm the saved
invite-email template + signature render correctly in the inbox.
That's the first item that can break the launch.

If anything in that smoke-test exposes a bug, fix it on a fresh
feature branch off `dev`. If the smoke test passes cleanly, the
remaining items in **Pending external actions** are operational
(env vars, migrations) and need the operator's hands more than a
session's.

If you continue without operator input: the only material code task
left is post-launch cleanup — the npm-vulns upgrade cycle (Next,
Prisma, etc.). Do not start that without an explicit go-ahead; it's
a multi-PR effort with regression risk.

---

## Where things live

Quick orientation for a fresh session.

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Outbound email + signature renderer | `src/lib/email.ts` |
| Admin email surface (Invite / Signature / ISO ack tabs) | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx`, `src/components/admin/EmailsTabs.tsx` |
| Invite UI (single + batch) | `src/components/admin/InviteUserForm.tsx`, `src/components/admin/CourseNodeTree.tsx` |
| Lesson complete API (race-safe) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Quiz attempt API (no answer-key leak) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/attempt/route.ts` |
| Policy-doc viewer (PDF embed + dwell + attestation) | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
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
  migrations in `prisma/migrations/` need explicit application.
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

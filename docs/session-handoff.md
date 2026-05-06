# Session handoff

> Read this after `CLAUDE.md`. Regenerate via the `/prep` slash command
> (or "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates, regenerate.

## Last sync

- **When:** 2026-05-06
- **Branch:** `dev`
- **HEAD:** `54c83b4` — `chore(scripts): add verify-prod-migrations.ts`
- **Working tree:** clean for handoff purposes. Two non-deliverable
  local files present and intentionally ignored:
  - `.claude/settings.local.json` (modified — local IDE prefs)
  - `scripts/check-akil-progress.ts` (untracked — local one-off script)
- **Open PRs (`dev → main`):** none.

## What just shipped

Newest first. All on `dev`; not yet merged to `main` (no release this
session).

1. `54c83b4` `chore(scripts): add verify-prod-migrations.ts`
   — TypeScript verifier that pings every migration in
   `prisma/migrations/` against `$DATABASE_URL` (tables, columns, enum
   values). Exit 1 on missing. Runs via `npx tsx`. Used this session
   to confirm prod was up-to-date — found `LessonType.LINK` enum value
   missing, applied it via `npx prisma db execute`, verified 8/8 PASS.
2. `140a1c2` `fix(admin/courses): hide delete control on courses CM does not own`
   — `CourseDeleteZone` now takes `canDelete`. Edit page passes
   `role === "admin" || course.createdById === session.user.id`.
   Mirrors the API guard at `src/app/api/admin/courses/[id]/route.ts:34`
   in the UI so non-owner CMs do not see a button that 403s on click.
3. `192ee9d` `feat(admin/cm): rename admin tab to "Course Management" for course managers`
   — Sidebar entry + admin layout heading now role-conditional.
   COURSE_MANAGER sees "Course Management" with `BookOpenCheck` icon
   and "Manage courses, nodes, and enrollments" subheading. ADMIN
   unchanged (still "Admin" / `Shield`). URL stays `/admin/*`.
4. `19d2e1a` `docs(handoff): regenerate for 2026-05-04 session`
   — Previous handoff snapshot.
5. `d173a9e` `feat(lessons): add LINK lesson type for external articles`
   — Adds `LessonType.LINK` (Postgres enum value) for "Open article" lessons.
   Migration `20260507000000_add_lesson_type_link`.
6. `d343a7f` `chore(copy): purge em-dashes from user-facing strings`
7. `b7b1672` `docs(design): forbid em-dashes in user-facing copy`
8. `8d71b57` `docs(handoff): regenerate after audit-evidence hardening commit`

## In-flight

_None._ Working tree only contains local-only cruft listed under
"Last sync." No `wip/*` branch is open.

A non-trivial multi-phase plan for **Phase 3 of the COURSE_MANAGER
gating effort** (per-course ownership scoping via `CourseManagers`
m2m + scoping API/pages + admin assign UI) lives at
`C:\Users\AkilFernando\.claude\plans\why-auto-mode-unavailbale-jolly-glade.md`.
Not started — handoff regen happened first per operator
direction. See "Pickup pointer."

## Pending external actions

Pre-launch operator items from the prior handoff have all cleared
this session:

- ✅ Migrations 8/8 applied to prod (verified by
  `scripts/verify-prod-migrations.ts`). `LessonType.LINK` was the one
  outstanding gap, applied via
  `npx prisma db execute --file prisma/migrations/20260507000000_add_lesson_type_link/migration.sql`.
- ✅ `EMAIL_FROM` confirmed correct on Render.
- ✅ `CRON_SECRET` set on both Render env and GitHub repo secrets;
  values verified to match. Cron lives at
  `.github/workflows/deadline-reminders.yml` (03:30 UTC daily, hits
  `https://learn.teamsquared.io/api/cron/deadline-reminders` with
  Bearer auth) — **not** a Render Cron Job.
- ✅ Invite email template + signature saved at `/admin/emails`.
- ✅ End-to-end test invite walked end-to-end (email render, SSO,
  course assignment, lesson complete, XP, policy ack).

Currently open:

- [ ] **Apply pending migrations going forward.** Custom
  `prisma/migrate.ts` still does NOT auto-apply files in
  `prisma/migrations/`. Re-run `scripts/verify-prod-migrations.ts`
  after every new migration commit (it is the canonical check now).
  Add a new check entry to the script for any newly-introduced
  migration so future runs catch drift.
- [ ] **Phase 3 of CM gating** (deferred during this session, plan
  approved). Will introduce a new migration for the
  `CourseManagers` m2m — operator must apply it manually after the
  schema commit lands. See `Pickup pointer`.
- [ ] **Post-launch — npm vulns.** Three moderate-severity
  (`uuid`, `postcss`, `@hono/node-server`). Fixes need framework
  bumps (Next, Prisma). Plan a dedicated upgrade cycle 6-8 weeks
  post-launch.

## Open questions / decisions

Items raised but not blockers. Each line: question, gated on what.

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Cleaner, would auto-apply migrations
  folder. Risky right at launch if prod schema is drifted. Gated on a
  non-launch deploy window where regression can be observed. Becomes
  more attractive now that `verify-prod-migrations.ts` makes drift
  detection cheap.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Argued for during email-from work; declined for now
  because Resend's subdomain verification is more comfortable on a
  paid plan. Gated on Resend tier upgrade or a deliverability
  incident on the apex domain.

- **Server-side dwell enforcement for POLICY_DOC.** Currently the
  6-minute dwell + attestation gate is client-side only; bypassable
  via DevTools. Audit trail (version / eTag / hash / attestation
  text / dwell seconds / SP itemId) is server-side and authoritative.
  Gated on auditor pushback or observed compliance incident.

- **Quiz double-submit Promise lock / idempotency token.**
  Theoretical race in `quiz/attempt` if a learner double-clicks
  Submit within one round-trip. Client disables button while
  submitting, so the practical window is small. Gated on observed
  prod incident.

- **Email retry / dead-letter queue.** All sends are fire-and-forget.
  Gated on first observed Resend outage causing noticeable invite or
  ISO-ack drop.

## Pickup pointer

Two reasonable next moves:

**A. Resume Phase 3 of the COURSE_MANAGER gating effort.** The plan
is fully scoped at
`C:\Users\AkilFernando\.claude\plans\why-auto-mode-unavailbale-jolly-glade.md`.
Phases 1 and 2 are merged on `dev` (commits `192ee9d` and `140a1c2`).
Phase 3 is three commits:

1. **3a — schema + migration.** Add `Course.managers User[]` m2m to
   `prisma/schema.prisma` (relation name `CourseManagers`), generate
   a new migration with backfill SQL that promotes each existing
   `Course.createdById` to a manager when that user has role
   `admin` or `course_manager`. Run `npx prisma generate` after.
2. **3b — scope CM access.** Update `src/lib/courseAccess.ts`
   (currently a role-only stub at `:3-8`) to query the `managers`
   relation. Add `listManagedCourseIds(userId, role)` helper. Filter
   `/admin/courses`, `/admin/courses/[id]/edit`,
   `/admin/assignments`, `/admin/analytics`, and the matching
   `/api/admin/courses` and `/api/admin/enrollments` routes by
   managed scope for CMs. ADMIN bypasses (returns sentinel).
3. **3c — ADMIN-only manager-assignment UI.** Add a Managers panel
   on `/admin/courses/[id]/edit` (visible to ADMIN only). New API:
   `POST/DELETE /api/admin/courses/[id]/managers` gated
   `requireRole("admin")`.

After 3a, the new migration must be applied to prod via the same
`npx prisma db execute --file ...` flow used this session, then
`scripts/verify-prod-migrations.ts` updated with a new check entry.

**B. Treat Phase 1+2 as ship-ready and pause coding.** Phase 1+2 are
benign on their own — they only narrow CM authority. If the operator
wants to soak them in production for a few days before touching the
schema, this is fine. Resume Phase 3 in a later session.

If you continue without operator input: **option A** is the natural
next move; the plan file is fully briefed.

---

## Where things live

Quick orientation for a fresh session.

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Outbound email + signature renderer | `src/lib/email.ts` |
| Admin email surface (Invite / Signature / ISO ack tabs) | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx`, `src/components/admin/EmailsTabs.tsx` |
| Admin section root + role gate | `src/app/admin/layout.tsx`, `src/components/admin/AdminTabs.tsx` |
| Sidebar (role-conditional Course Management label) | `src/components/layout/Sidebar.tsx` |
| Course access helper (role-only today; Phase 3 will scope) | `src/lib/courseAccess.ts`, `src/lib/courseEditData.ts` |
| Course delete UI (gated on creator for CM) | `src/components/courses/CourseDeleteZone.tsx` |
| Invite UI (single + batch) | `src/components/admin/InviteUserForm.tsx`, `src/components/admin/CourseNodeTree.tsx` |
| Lesson complete API (race-safe) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Quiz attempt API | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/attempt/route.ts` |
| Policy-doc viewer | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| Lesson viewer (text/video/document/html/link dispatch) | `src/components/courses/LessonViewer.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied — see Pending) | `prisma/migrations/`, custom `prisma/migrate.ts` |
| Prod-migration verifier | `scripts/verify-prod-migrations.ts` |
| Demo-user cleanup (one-shot) | `scripts/delete-demo-users.{sql,ts}` |
| Render deploy config | `render.yaml` |
| GitHub Actions cron (deadline reminders) | `.github/workflows/deadline-reminders.yml` |
| Other CI workflows | `.github/workflows/ci.yml`, `dependency-review.yml` |
| Tests (vitest) | `src/__tests__/` |
| E2E (Playwright, NOT in CI) | `e2e/` |
| Design system reference | `docs/teams-squared-lms-design-system.mdx` |

## Hard-earned conventions worth re-reading

- `dev` is the integration branch; every meaningful unit of work is
  committed and pushed there. `main` is branch-protected; reach prod
  only via an explicit `dev → main` PR per `CLAUDE.md`.
- The custom `prisma/migrate.ts` is hand-rolled idempotent SQL. New
  migrations in `prisma/migrations/` need explicit application — use
  `scripts/verify-prod-migrations.ts` to detect drift, then apply via
  `npx prisma db execute --file <path>` (no `--schema` / `--url`
  flags on the current Prisma version).
- `react-markdown` v10 default behaviour escapes raw HTML and strips
  `javascript:` / `data:` / `vbscript:` URLs — don't add `rehype-raw`
  to admin-authored markdown surfaces.
- The `lessonProgress` create-then-conditional-update pattern in the
  lesson-complete route is the reference for race-safe transition
  detection. Reuse the same shape for "fire side effects exactly
  once" surfaces.
- The credentials provider is gated on `NODE_ENV !== "production"`.
  Demo seed users are gone. Local-dev bootstrap = SSO sign-in then
  SQL-promote per the file header in `prisma/seed.ts`.
- Em-dashes are forbidden in user-facing copy (design system
  §8.13). Use commas or sentence breaks.
- For COURSE_MANAGER role: sidebar reads "Course Management" with
  `BookOpenCheck` icon; admin layout heading swaps to match. URL
  stays `/admin/*`. Only ADMIN sees Users + Emails tabs (already
  enforced via `AdminTabs.tsx` `adminOnly` flag + page-level
  redirects). Course delete control hidden when CM is not the
  creator.

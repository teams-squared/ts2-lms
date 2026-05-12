# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler. Code, paths, URLs preserved exactly.

## Last sync

- **When:** 2026-05-12
- **Branch:** `dev`
- **HEAD:** `6df6090` — `chore(scripts): add backfill-course-managers.sql for post-migration CM fix`
- **`main`:** `52fd3f9` — merge of PR #32 (Course Manager scoping). Render serving this.
- **`dev` ahead of `main`:** 10 commits. Substantive: per-course progress section, dedicated `/admin/progress` tab, manual overdue reminders, route-param hotfix, CM-creator auto-link fix, backfill SQL.
- **Working tree:** clean. Local-only cruft only:
  - `.claire/` (untracked — local-only directory)
- **Open PRs (`dev → main`):** none.

## What just shipped

Newest first.

1. `6df6090` `chore(scripts): add backfill-course-managers.sql for post-migration CM fix`
   — idempotent SQL to link CMs as managers of courses they created
   between the 20260508 migration and the auto-connect fix below.
2. `4825473` `fix(courses): auto-link creator into CourseManagers m2m on create`
   — CM-created courses now get `managers: { connect: creatorId }`
   in `course.create`. Was 404'ing on Edit because
   `canManageCourse()` checks m2m only, no `createdById` fallback,
   and migration backfill only covered pre-existing rows. Regression
   test asserts connect payload present for `course_manager` session.
3. `4d62224` `fix(api): rename reminders route param to [id]`
   — Hotfix. `/api/admin/courses/[id]/*` already existed; adding
   `[courseId]/reminders` crashed Next.js at runtime ("cannot use
   different slug names for same dynamic path"). Prod was 500'ing on
   every request post-deploy.
4. `048cc0d` `feat(admin/progress): manual overdue reminders by managers`
   — Inline "Send reminder" on `/admin/progress` expanded student
   rows. One consolidated email per `(student, course)` listing all
   overdue lessons + optional 500-char note. New `ManualReminderLog`
   table (separate from cron's `DeadlineReminderLog` so re-sends
   aren't dedupe-blocked; managers self-police). `POST
   /api/admin/courses/[id]/reminders` gated by
   `canManageCourse(callerId, role, courseId)`. New
   `sendManualOverdueReminderEmail()` in `src/lib/email.ts`.
   `verify-prod-migrations.ts` gets `ManualReminderLog` check.
5. `c04f583` `feat(admin/progress): dedicated tab w/ searchable course table`
   — Per-course progress moved off `/admin` home to new
   `/admin/progress` tab. Master table of courses with
   enrolled/completed/overdue counts; row click expands inline to
   show student progress. Search filters by course title + student
   name/email; matches auto-expand.
6. `78fb5c2` `feat(admin): per-course student progress section`
   — Replaced flat top-10 overdue table with one card per course
   showing enrolled students, % complete, overdue lessons. ADMIN
   sees all; CM sees managed only via `listManagedCourseIds`. Sort:
   overdue-desc then percent-asc (struggling students first).

## In-flight

_None._ Working tree clean except untracked `.claire/`. No `wip/*`
branch open.

## Pending external actions

- [ ] **Apply migration `20260512000000_add_manual_reminder_log` to
  prod.** Adds `ManualReminderLog` table for manager-triggered
  overdue nudges. Not auto-applied — custom `prisma/migrate.ts` is
  hand-rolled. Run `scripts/verify-prod-migrations.ts` first (drift
  detection, table now in check list), then
  `npx prisma db execute --file prisma/migrations/20260512000000_add_manual_reminder_log/migration.sql`.

- [ ] **Run `scripts/backfill-course-managers.sql` on prod.** Links
  any CM-created courses from the gap window (between 20260508
  migration and `4825473` auto-connect fix) into `_CourseManagers`.
  Idempotent — safe to re-run. Without it, those creators can't
  edit their own courses (404 on Edit).

- [ ] **Confirm `4d62224` hotfix landed on prod.** Commit body says
  prod was returning 500 on every request post-deploy from the
  `[id]` / `[courseId]` slug collision. `main` is still at
  `52fd3f9` (pre-hotfix); hotfix lives on `dev`. Either ship `dev
  → main` PR or confirm hotfix already deployed via separate path.
  **Highest priority — prod may still be 500'ing.**

- [ ] **Smoke-test live CourseManagers wiring on prod** (carried
  from prior handoff). Migration `20260508000000_add_course_managers`
  confirmed applied via `scripts/verify-prod-migrations.ts` (9 / 9
  PASS at last check). End-to-end pass:
  - Sign in as ADMIN: sidebar = "Admin", layout heading =
    "Admin Dashboard". `/admin/courses/<id>/edit` shows
    CourseManagers panel; add + remove a CM works.
  - SQL-promote test user to `course_manager`. Sign in: sidebar =
    "Course Management" with `BookOpenCheck` icon.
  - As CM with no managed courses: `/admin/courses` empty,
    `/admin/assignments` empty, `/admin/analytics` zeroed.
  - As CM after ADMIN assigns Course X: `/admin/courses` lists X
    only; direct GET `/admin/courses/<other>/edit` redirects / 404s.
  - `POST /api/admin/enrollments` to non-managed course → 403.
  - **New:** CM creates a course → Edit button works (no 404).
  - **New:** CM expands a student row on `/admin/progress` → "Send
    reminder" composes + sends consolidated overdue email.
  - Learner SSO unchanged: sign-in, complete lesson, take quiz,
    ack policy doc.

- [ ] **Post-launch — npm vulns.** Three moderate-severity
  (`uuid`, `postcss`, `@hono/node-server`). Fixes need framework
  bumps (Next, Prisma). Dedicated upgrade cycle 6–8 weeks
  post-launch. Dependabot still flagging at least one moderate on
  default branch.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Cleaner, would auto-apply migrations
  folder. Gated on non-launch deploy window. More attractive now
  `verify-prod-migrations.ts` makes drift detection cheap.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Declined for now — verification more comfortable on
  paid plan. Gated on Resend tier upgrade or deliverability incident
  on apex.

- **Server-side dwell enforcement for POLICY_DOC.** 6-minute dwell
  + attestation gate is client-side; bypassable via DevTools. Audit
  trail (version / eTag / hash / attestation text / dwell seconds /
  SP itemId) server-side and authoritative. Gated on auditor
  pushback or compliance incident.

- **Quiz double-submit Promise lock / idempotency token.**
  Theoretical race in `quiz/attempt` on double-click. Client
  disables Submit while in-flight; window small. Gated on observed
  prod incident.

- **Email retry / dead-letter queue.** All sends fire-and-forget,
  including new `ManualReminderLog` flow. Gated on first observed
  Resend outage causing noticeable invite / ISO-ack / reminder drop.

- **Drop now-redundant `createdById` fallback in
  `/api/courses/[id]` PATCH.** Lets creator edit even without
  management rights. Could tighten to "must be a manager". Less
  urgent now `4825473` ensures creators are auto-linked. Gated on
  whether non-manager legacy creators expected to mutate old courses.

- **Manual-reminder cooldown / abuse guard.** `ManualReminderLog`
  has no dedupe constraint by design (managers self-police). If
  reminder spam becomes a thing, add soft cooldown (e.g. 24h per
  `(student, course)`) before send. Gated on user complaint.

## Pickup pointer

**`4d62224` hotfix verification is the natural next move.** Commit
body says prod was 500'ing on every request. `main` still pre-hotfix.
Either confirm hotfix already deployed (out-of-band) or open `dev →
main` PR to ship it. **Do this first** — everything else assumes
prod is up.

Once prod is verified up:

1. Apply migration `20260512000000_add_manual_reminder_log` + run
   `scripts/backfill-course-managers.sql` on prod (Pending #1 + #2).
2. Smoke-test (Pending #4) — covers both old CM scoping + new
   manager-reminder flow.

After that, no in-flight feature work. Reasonable next moves:

- **Tighten `/api/courses/[id]` PATCH** per Open question.
- **Render deploy switch** per Open question.

If continuing without operator input: verify prod-up first. Do not
assume hotfix landed.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Outbound email + signature renderer | `src/lib/email.ts` |
| Admin email surface | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx`, `src/components/admin/EmailsTabs.tsx` |
| Admin section root + role gate | `src/app/admin/layout.tsx`, `src/components/admin/AdminTabs.tsx` |
| Sidebar (role-conditional Course Management label) | `src/components/layout/Sidebar.tsx` |
| Course access helpers (ownership-aware) | `src/lib/courseAccess.ts`, `src/lib/courseEditData.ts` |
| Course delete UI | `src/components/courses/CourseDeleteZone.tsx` |
| Course managers panel (admin-only) | `src/components/admin/CourseManagersPanel.tsx` |
| Course managers API | `src/app/api/admin/courses/[id]/managers/route.ts`, `src/app/api/admin/courses/[id]/managers/[userId]/route.ts` |
| Per-course progress tab | `src/app/admin/progress/page.tsx`, `src/components/admin/ProgressCoursesTable.tsx` |
| Manual reminders API | `src/app/api/admin/courses/[id]/reminders/route.ts` |
| Manual reminder email render | `sendManualOverdueReminderEmail()` in `src/lib/email.ts` |
| Invite UI | `src/components/admin/InviteUserForm.tsx`, `src/components/admin/CourseNodeTree.tsx` |
| Lesson complete API (race-safe) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Quiz attempt API | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/attempt/route.ts` |
| Policy-doc viewer | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| Lesson viewer | `src/components/courses/LessonViewer.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied) | `prisma/migrations/`, custom `prisma/migrate.ts` |
| Prod-migration verifier | `scripts/verify-prod-migrations.ts` |
| CM backfill SQL | `scripts/backfill-course-managers.sql` |
| Demo-user cleanup (one-shot) | `scripts/delete-demo-users.{sql,ts}` |
| Render deploy config | `render.yaml` |
| GitHub Actions cron (deadline reminders) | `.github/workflows/deadline-reminders.yml` |
| Other CI workflows | `.github/workflows/ci.yml`, `dependency-review.yml` |
| Tests (vitest) | `src/__tests__/` |
| E2E (Playwright, NOT in CI) | `e2e/` |
| Design system reference | `docs/teams-squared-lms-design-system.mdx` |

## Reminders

- `prisma/migrate.ts` = hand-rolled idempotent SQL. New migrations
  in `prisma/migrations/` need explicit application — use
  `scripts/verify-prod-migrations.ts` for drift detection, then
  `npx prisma db execute --file <path>` (no `--schema` / `--url`
  flags on current Prisma version).
- `react-markdown` v10 escapes raw HTML + strips `javascript:` /
  `data:` / `vbscript:` URLs. Don't add `rehype-raw` to
  admin-authored markdown.
- `lessonProgress` create-then-conditional-update pattern in
  lesson-complete route = reference for race-safe transitions.
- Credentials provider gated on `NODE_ENV !== "production"`. Demo
  seed users gone. Local-dev = SSO sign-in then SQL-promote per
  `prisma/seed.ts` header.
- Em-dashes forbidden in user-facing copy (design system §8.13).
- COURSE_MANAGER ownership = `CourseManagers` m2m. ADMIN bypasses;
  CM must be linked. `listManagedCourseIds` returns `null` for
  ADMIN. New courses auto-connect creator into m2m via
  `course.create`. Add new check entries to
  `verify-prod-migrations.ts` for every new migration.
- Next.js: sibling dynamic segments under same path MUST use same
  slug name. `[id]` and `[courseId]` as siblings = runtime crash.
- `ManualReminderLog` is separate from cron's `DeadlineReminderLog`
  on purpose — no dedupe constraint, managers self-police.
- Render MCP connected to Teams Squared workspace
  (`tea-d28ti5euk2gs73fppeng`). Strict allowlist: only `ts2-lms`
  web service + `ts2-lms-db` postgres. Refuse calls targeting
  other resources.
- Commits go through `caveman:caveman-commit` skill — never
  hand-write commit messages.

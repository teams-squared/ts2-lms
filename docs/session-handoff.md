# Session handoff

> Read this after `CLAUDE.md`. Regenerate via the `/prep` slash command
> (or "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates, regenerate.

## Last sync

- **When:** 2026-05-06 (post-release)
- **Branch:** `dev`
- **HEAD:** `44e6626` — `fix(tests): mock course.findMany for course_manager enrollment list`
- **`main`:** `52fd3f9` — merge commit for PR #32 (`Course Manager scoping + admin handoff updates`). Render is deploying this.
- **Working tree:** clean for handoff purposes. Only local-only cruft:
  - `.claude/settings.local.json` (modified — local IDE prefs)
  - `scripts/check-akil-progress.ts` (untracked — local one-off script)
- **Open PRs (`dev → main`):** none. PR #32 merged at 2026-05-06 07:00 UTC.

## What just shipped

PR #32 just merged — full Course Manager scoping pass plus operator
tooling. Newest commits on `dev`:

1. `44e6626` `fix(tests): mock course.findMany for course_manager enrollment list`
   — admin-enrollments test was failing in CI because the new CM path
   through `GET /api/admin/enrollments` calls `listManagedCourseIds`
   which queries `course.findMany`. Mock added; suite back to 734/734.
2. `f2041ed` `feat(admin/courses): ADMIN UI to assign managers to a course`
   — Phase 3c. New `CourseManagersPanel` on the course edit page
   (admin-only). Three new admin-only API routes:
   `GET/POST /api/admin/courses/[id]/managers` and
   `DELETE /api/admin/courses/[id]/managers/[userId]`.
3. `5e3fefe` `feat(admin/courses): scope CM access to managed courses (API + pages)`
   — Phase 3b. `canManageCourse` now actually queries the m2m relation;
   ADMIN bypasses, CM must be linked. New `listManagedCourseIds(userId, role)`
   helper (returns `null` for ADMIN as the "no scope filter" sentinel).
   Twelve files touched: course list/edit/delete, enrollment list +
   batch + delete, analytics, assignments. Module/lesson/quiz routes
   already gate on `canManageCourse`, so they pick up the new
   ownership semantics for free.
4. `1538176` `feat(admin/courses): add CourseManagers m2m + backfill migration`
   — Phase 3a. Adds `Course.managers` ↔ `User.managedCourses` implicit
   m2m. Migration `20260508000000_add_course_managers` includes a
   backfill that promotes each existing `Course.createdById` to a
   manager iff that user has role ADMIN or COURSE_MANAGER.
5. `510bef1` `docs(handoff): regenerate for 2026-05-06 session`
6. `54c83b4` `chore(scripts): add verify-prod-migrations.ts`
   — TypeScript verifier that pings every migration in
   `prisma/migrations/` against `$DATABASE_URL`. Used this session to
   catch a missing `LessonType.LINK` enum and apply it via
   `prisma db execute`.
7. `140a1c2` `fix(admin/courses): hide delete control on courses CM does not own`
   — Phase 2 (later superseded by Phase 3b — the `canDelete` prop was
   removed in `5e3fefe`).
8. `192ee9d` `feat(admin/cm): rename admin tab to "Course Management" for course managers`
   — Phase 1. Sidebar entry + admin-layout heading swap to
   "Course Management" with `BookOpenCheck` icon for CM. Admins
   unchanged. URL stays `/admin/*`.

## In-flight

_None._ Working tree only contains local-only cruft listed under
"Last sync." No `wip/*` branch is open.

## Pending external actions

- [ ] **Apply the new CourseManagers migration to prod and verify.**
  Render is now deploying `main` (= `52fd3f9`). The new code calls
  `prisma.course.findMany({ where: { managers: { some: ... } } })` —
  unless `_CourseManagers` exists in the prod DB, every page that hits
  `canManageCourse` (anything under `/admin`) will 500. Apply
  immediately:
  ```powershell
  $env:DATABASE_URL = "<external url from Render>"
  npx prisma db execute --file prisma/migrations/20260508000000_add_course_managers/migration.sql
  npx tsx scripts/verify-prod-migrations.ts
  Remove-Item Env:DATABASE_URL
  ```
  Verifier should report 9 / 9 PASS, including `_CourseManagers`. As
  of this handoff write, application status is **not yet confirmed**.
- [ ] **Smoke-test post-migration.**
  - Sign in as ADMIN: `/admin/courses/<id>/edit` shows the new
    CourseManagers panel. Adding and removing a CM works. Sidebar
    still reads "Admin", layout heading "Admin Dashboard".
  - Promote a test user to `course_manager` via SQL. Sign in as that
    user: sidebar reads "Course Management" with `BookOpenCheck` icon.
  - As CM with no managed courses: `/admin/courses` empty;
    `/admin/assignments` empty; `/admin/analytics` shows zeroed course
    + leaderboard sections.
  - As CM after ADMIN assigns Course X: `/admin/courses` lists X only;
    direct GET `/admin/courses/<other>/edit` redirects / 404s.
  - `POST /api/admin/enrollments` for a non-managed course → 403.
- [ ] **Post-launch — npm vulns.** Three moderate-severity
  (`uuid`, `postcss`, `@hono/node-server`). Fixes need framework bumps
  (Next, Prisma). Plan a dedicated upgrade cycle 6-8 weeks post-launch.
  Dependabot is still flagging at least one moderate on default branch.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Cleaner, would auto-apply migrations
  folder. Risky on a busy deploy window if prod schema is drifted.
  Gated on a non-launch deploy window. More attractive now that
  `verify-prod-migrations.ts` makes drift detection cheap.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Declined for now — Resend's subdomain verification is
  more comfortable on a paid plan. Gated on Resend tier upgrade or a
  deliverability incident on the apex domain.

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

The first item on the list is **migration application + smoke test**
for the just-merged PR #32. Do that before anything else — Render's
build is in progress and any 500s on `/admin/*` will be from the
unapplied migration. Steps verbatim in "Pending external actions" #1.

After that, no in-flight feature work. Reasonable next moves:

- **Backlog cleanup of CM scoping edge cases.** Module/lesson/quiz
  sub-routes inherit ownership through `canManageCourse`, but the
  user-facing learner pages (`canViewCourse`) now also flip to
  ownership-aware behavior. Worth a careful pass to confirm a CM
  who is NOT a manager of a course sees it as a learner (not a
  privileged user) — i.e. enrollment + published-status apply. The
  semantics are correct but exercise a CM-as-learner flow at least
  once.
- **Drop now-redundant `createdById` fallback in
  `/api/courses/[id]` PATCH.** Currently it allows the creator to
  edit even without management rights. Could be tightened to "must
  be a manager"; gated on whether non-manager creators are still
  expected to mutate their old courses.
- **Render deploy switch (open question above).**

If you continue without operator input: the next *correct* move is to
verify the migration. Do not assume it has been applied.

---

## Where things live

Quick orientation for a fresh session.

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Outbound email + signature renderer | `src/lib/email.ts` |
| Admin email surface | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx`, `src/components/admin/EmailsTabs.tsx` |
| Admin section root + role gate | `src/app/admin/layout.tsx`, `src/components/admin/AdminTabs.tsx` |
| Sidebar (role-conditional Course Management label) | `src/components/layout/Sidebar.tsx` |
| Course access helpers (now ownership-aware) | `src/lib/courseAccess.ts`, `src/lib/courseEditData.ts` |
| Course delete UI | `src/components/courses/CourseDeleteZone.tsx` |
| Course managers panel (admin-only) | `src/components/admin/CourseManagersPanel.tsx` |
| Course managers API | `src/app/api/admin/courses/[id]/managers/route.ts`, `src/app/api/admin/courses/[id]/managers/[userId]/route.ts` |
| Invite UI | `src/components/admin/InviteUserForm.tsx`, `src/components/admin/CourseNodeTree.tsx` |
| Lesson complete API (race-safe) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Quiz attempt API | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/attempt/route.ts` |
| Policy-doc viewer | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| Lesson viewer | `src/components/courses/LessonViewer.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied) | `prisma/migrations/`, custom `prisma/migrate.ts` |
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
- COURSE_MANAGER ownership is the `CourseManagers` m2m on `Course`.
  ADMIN bypasses; CM must be linked. New `listManagedCourseIds`
  helper returns `null` for ADMIN (sentinel). Add new check entries
  to `scripts/verify-prod-migrations.ts` for every new migration —
  it is the canonical drift detector.

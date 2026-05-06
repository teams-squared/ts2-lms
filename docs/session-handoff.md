# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler. Code, paths, URLs preserved exactly.

## Last sync

- **When:** 2026-05-06 (post-release, post-CourseManagers-migration)
- **Branch:** `dev`
- **HEAD:** `c7193c2` — `docs: compress CLAUDE.md, AGENTS.md, and /prep into caveman style`
- **`main`:** `52fd3f9` — merge of PR #32 (Course Manager scoping). Render serving this.
- **Working tree:** clean for handoff. Local-only cruft only:
  - `.claude/settings.local.json` (modified — local IDE prefs)
  - `scripts/check-akil-progress.ts` (untracked — local one-off script)
- **Open PRs (`dev → main`):** none. PR #32 merged 07:00 UTC.

## What just shipped

Newest first. PR #32 merged earlier this session. Subsequent commits
are post-release polish.

1. `c7193c2` `docs: compress CLAUDE.md, AGENTS.md, and /prep into caveman style`
   — ~35% input-token cut on memory files future sessions read on
   cold start. `/prep` directive now writes handoff in caveman by
   default. Backups `*.original.md` gitignored.
2. `ca04d00` `docs(handoff): regenerate post-PR-32 merge`
   — handoff updated to flag CourseManagers migration as pending
   prod application (subsequently applied — see below).
3. `44e6626` `fix(tests): mock course.findMany for course_manager enrollment list`
   — admin-enrollments test mock updated for new `listManagedCourseIds`
   call. Suite back to 734 / 734.
4. `f2041ed` `feat(admin/courses): ADMIN UI to assign managers to a course`
   — Phase 3c. `CourseManagersPanel` on edit page (admin-only). Three
   new admin-only API routes:
   `GET/POST /api/admin/courses/[id]/managers` and
   `DELETE /api/admin/courses/[id]/managers/[userId]`.
5. `5e3fefe` `feat(admin/courses): scope CM access to managed courses (API + pages)`
   — Phase 3b. `canManageCourse` queries the m2m. ADMIN bypasses; CM
   must be linked. `listManagedCourseIds` returns `null` for ADMIN
   (sentinel). Twelve files: course list / edit / delete, enrollment
   list + batch + delete, analytics, assignments. Module/lesson/quiz
   sub-routes inherit ownership via `canManageCourse`.
6. `1538176` `feat(admin/courses): add CourseManagers m2m + backfill migration`
   — Phase 3a. Implicit Prisma m2m
   `Course.managers` ↔ `User.managedCourses`. Migration
   `20260508000000_add_course_managers` includes backfill: each
   `Course.createdById` promoted to manager iff role is ADMIN or
   COURSE_MANAGER.
7. `510bef1` `docs(handoff): regenerate for 2026-05-06 session`
8. `54c83b4` `chore(scripts): add verify-prod-migrations.ts`

## In-flight

_None._ Working tree only contains local-only cruft (see Last sync).
No `wip/*` branch open.

## Pending external actions

- [ ] **Smoke-test the live CourseManagers wiring on prod.** Migration
  `20260508000000_add_course_managers` confirmed applied via
  `scripts/verify-prod-migrations.ts` (9 / 9 PASS). Render is
  serving `main` = `52fd3f9`. Do this end-to-end pass:
  - Sign in as ADMIN: sidebar = "Admin", layout heading =
    "Admin Dashboard". `/admin/courses/<id>/edit` shows
    CourseManagers panel; add + remove a CM works.
  - SQL-promote test user to `course_manager`. Sign in: sidebar =
    "Course Management" with `BookOpenCheck` icon. Layout heading =
    "Course Management".
  - As CM with no managed courses: `/admin/courses` empty,
    `/admin/assignments` empty, `/admin/analytics` shows zeroed
    course / leaderboard sections.
  - As CM after ADMIN assigns Course X: `/admin/courses` lists X
    only; direct GET `/admin/courses/<other>/edit` redirects / 404s.
  - `POST /api/admin/enrollments` to non-managed course → 403.
  - Smoke-test learner SSO unchanged: employee signs in, completes
    a lesson, takes a quiz, acknowledges a policy doc.

- [ ] **Post-launch — npm vulns.** Three moderate-severity
  (`uuid`, `postcss`, `@hono/node-server`). Fixes need framework
  bumps (Next, Prisma). Plan dedicated upgrade cycle 6–8 weeks
  post-launch. Dependabot still flagging at least one moderate on
  default branch.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Cleaner, would auto-apply migrations
  folder. Risky on busy deploy window if prod schema is drifted.
  Gated on non-launch deploy window. More attractive now that
  `verify-prod-migrations.ts` makes drift detection cheap.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Declined for now — Resend's subdomain verification
  more comfortable on paid plan. Gated on Resend tier upgrade or a
  deliverability incident on apex.

- **Server-side dwell enforcement for POLICY_DOC.** 6-minute dwell +
  attestation gate is client-side; bypassable via DevTools. Audit
  trail (version / eTag / hash / attestation text / dwell seconds /
  SP itemId) is server-side and authoritative. Gated on auditor
  pushback or compliance incident.

- **Quiz double-submit Promise lock / idempotency token.**
  Theoretical race in `quiz/attempt` if learner double-clicks Submit
  inside one round-trip. Client disables button while submitting;
  practical window small. Gated on observed prod incident.

- **Email retry / dead-letter queue.** All sends fire-and-forget.
  Gated on first observed Resend outage causing noticeable invite or
  ISO-ack drop.

- **Drop now-redundant `createdById` fallback in
  `/api/courses/[id]` PATCH.** Currently lets the creator edit even
  without management rights. Could tighten to "must be a manager".
  Gated on whether non-manager creators are still expected to mutate
  their old courses.

## Pickup pointer

Smoke-test (Pending #1) is the natural next move. Migration is live
on prod, but no end-to-end verification ran in-session. Do that
before any new feature work.

After smoke-test passes, no in-flight feature work. Reasonable next
moves:

- **CM-as-learner audit.** Confirm a course_manager who is NOT a
  manager of a course sees it as a learner (enrollment + published
  status apply, not privileged). Semantics correct; want one
  manual run to be sure.
- **Tighten `/api/courses/[id]` PATCH** per Open question above.
- **Render deploy switch** per Open question above.

If you continue without operator input: smoke-test first. Don't
assume the migration deploy is bug-free without exercise.

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

## Reminders

- `prisma/migrate.ts` = hand-rolled idempotent SQL. New migrations
  in `prisma/migrations/` need explicit application — use
  `scripts/verify-prod-migrations.ts` for drift detection, then
  `npx prisma db execute --file <path>` (no `--schema` / `--url`
  flags on current Prisma version).
- `react-markdown` v10 escapes raw HTML + strips `javascript:` /
  `data:` / `vbscript:` URLs. Don't add `rehype-raw` to
  admin-authored markdown.
- `lessonProgress` create-then-conditional-update pattern in the
  lesson-complete route = reference for race-safe transitions.
- Credentials provider gated on `NODE_ENV !== "production"`. Demo
  seed users gone. Local-dev = SSO sign-in then SQL-promote per
  `prisma/seed.ts` header.
- Em-dashes forbidden in user-facing copy (design system §8.13).
- COURSE_MANAGER ownership = `CourseManagers` m2m. ADMIN bypasses;
  CM must be linked. `listManagedCourseIds` returns `null` for
  ADMIN. Add new check entries to `verify-prod-migrations.ts` for
  every new migration.

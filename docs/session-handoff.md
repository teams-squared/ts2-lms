# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler. Code, paths, URLs preserved exactly.

## Last sync

- **When:** 2026-05-12
- **Branch:** `dev`
- **HEAD:** `223a66a` — `docs(handoff): regenerate for 2026-05-12 session`
- **`main`:** `1bc0e6e` — merge of PR #37 (CM auto-link fix + backfill script). Render serving this.
- **`dev` ahead of `main`:** 1 commit (handoff doc only). No code delta.
- **Working tree:** clean. Only `.claire/` untracked (local-only).
- **Open PRs:** none.

## What just shipped

Newest first. All in `main` via PR #37 except handoff doc.

1. `223a66a` `docs(handoff): regenerate for 2026-05-12 session` — handoff doc only.
2. `6df6090` `chore(scripts): add backfill-course-managers.sql` — idempotent SQL links CM-created courses into `_CourseManagers`. Run confirmed on prod this session.
3. `4825473` `fix(courses): auto-link creator into CourseManagers m2m on create` — CM-created courses now get `managers: { connect: { id: creatorId } }` in `course.create`. Fixes 404 on Edit for new courses. Regression test added.
4. `4d62224` `fix(api): rename reminders route param to [id]` — hotfix. `[courseId]` slug collided with `[id]` in same dir → Next.js 500 on every request post-deploy. Merged via PR #37.
5. `048cc0d` `feat(admin/progress): manual overdue reminders by managers` — "Send reminder" on `/admin/progress` student rows. Consolidated overdue email per `(student, course)` + optional note. `ManualReminderLog` model. `POST /api/admin/courses/[id]/reminders` gated by `canManageCourse`. Migration `20260512000000_add_manual_reminder_log`.
6. `c04f583` `feat(admin/progress): dedicated tab w/ searchable course table` — `/admin/progress` page. Course table with enrolled/completed/overdue counts; click row expands inline student list.
7. `78fb5c2` `feat(admin): per-course student progress section` — per-course student cards on admin. ADMIN sees all; CM sees managed only via `listManagedCourseIds`.

## In-flight

_None._ Tree clean. No `wip/*` branch open.

## Pending external actions

- [ ] **Apply migration `20260512000000_add_manual_reminder_log` to prod.**
  `ManualReminderLog` table not yet confirmed on prod. Without it, "Send reminder" on `/admin/progress` throws 500.

  ```sh
  npx prisma db execute --file prisma/migrations/20260512000000_add_manual_reminder_log/migration.sql
  ```

  Verify all migrations current:
  ```sh
  DATABASE_URL="<prod url>" npx tsx scripts/verify-prod-migrations.ts
  # expect all PASS
  ```

- [ ] **Smoke-test `/admin/progress` on prod after migration applied.**
  - Sign in as ADMIN: see all courses in progress table, counts correct.
  - Sign in as CM: see managed courses only.
  - Expand student row → overdue lessons listed → "Send reminder" fires email.
  - Check Resend dashboard: consolidated overdue email received.

- [ ] **Smoke-test CM course-create fix on prod.**
  CM creates course → Edit button works (no 404). Confirmed backfill ran (user executed `backfill-course-managers.sql` this session).

- [ ] **Post-launch — npm vulns.** Dependabot flagging 2 high + 4 moderate + 1 low on default branch. Fixes need Next/Prisma version bumps. Dedicated upgrade cycle 6–8 weeks post-launch.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to `prisma migrate deploy`.** Auto-applies migrations folder. Gated on non-launch deploy window.
- **Resend subdomain (`lms.teamsquared.io`) for sender isolation.** Gated on paid plan or deliverability incident.
- **Server-side dwell enforcement for POLICY_DOC.** Client-side gate bypassable via DevTools. Gated on auditor pushback.
- **Quiz double-submit idempotency token.** Gated on observed prod incident.
- **Email retry / dead-letter queue.** All sends fire-and-forget. Gated on first Resend outage.
- **Drop `createdById` fallback in `/api/courses/[id]` PATCH.** Less urgent now creators auto-linked. Gated on whether legacy non-manager creators expected to mutate old courses.
- **Manual-reminder cooldown / abuse guard.** `ManualReminderLog` has no dedupe by design. Gated on user complaint.

## Pickup pointer

Natural next move: apply `20260512000000_add_manual_reminder_log` migration to prod, then smoke-test `/admin/progress` (reminder send flow). Migration is blocking — "Send reminder" 500s without it.

After that: no active feature work. Options:
- Npm vulns upgrade cycle (need explicit go-ahead — multi-PR, regression risk).
- Tighten `/api/courses/[id]` PATCH `createdById` fallback (small, low-risk).

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Course access + CM scoping | `src/lib/courseAccess.ts` |
| Outbound email | `src/lib/email.ts` |
| Admin email surface | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx` |
| ISO compliance (ack log + coverage) | `src/app/admin/iso/page.tsx`, `src/components/admin/IsoAckLog.tsx` |
| ISO ack API | `src/app/api/admin/iso-acks/route.ts`, `.../export/route.ts` |
| Admin progress view | `src/app/admin/progress/page.tsx`, `src/components/admin/CourseProgressTable.tsx` |
| Manual reminder API | `src/app/api/admin/courses/[id]/reminders/route.ts` |
| Course progress helpers | `src/lib/courseProgress.ts` |
| Course managers panel + API | `src/components/admin/CourseManagersPanel.tsx`, `src/app/api/admin/courses/[id]/managers/` |
| Invite UI + API | `src/components/admin/InviteUserForm.tsx`, `src/app/api/admin/users/invite/route.ts` |
| Lesson complete API (race-safe) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Policy-doc viewer | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| Lesson viewer | `src/components/courses/LessonViewer.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied) | `prisma/migrations/`, `scripts/verify-prod-migrations.ts` |
| One-shot scripts | `scripts/backfill-course-managers.sql`, `scripts/delete-demo-users.{sql,ts}` |
| Render deploy config | `render.yaml` |
| GitHub Actions cron | `.github/workflows/deadline-reminders.yml` |
| Tests (vitest) | `src/__tests__/` |
| E2E (Playwright, not in CI) | `e2e/` |
| Design system | `docs/teams-squared-lms-design-system.mdx` |

## Reminders

- `canManageCourse(userId, role, courseId)` = single gate for course-edit authority. ADMIN bypasses m2m; CM must be in `Course.managers`. `listManagedCourseIds` returns `null` for ADMIN (sentinel = no scope filter).
- `course.create` now connects creator into `managers` — no more orphan courses.
- `prisma/migrate.ts` = hand-rolled idempotent SQL. New migrations in `prisma/migrations/` apply manually. Use `scripts/verify-prod-migrations.ts` for drift detection.
- Resend SDK v6 returns `{data, error}` — never throws. Always destructure + check `error`.
- No em-dashes in user-facing copy (design-system §8.13). Code comments exempt.

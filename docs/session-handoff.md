# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler. Code, paths, URLs preserved exactly.

## Last sync

- **When:** 2026-05-12
- **Branch:** `dev`
- **HEAD:** `4fdf27f` — `docs(handoff): regenerate for 2026-05-12 session`
- **`main`:** `1bc0e6e` — merge of PR #37 (CM auto-link fix + backfill script).
- **`dev` ahead of `main`:** 2 commits (both handoff docs). No code delta.
- **Working tree:** clean. Only `.claire/` untracked (local-only).
- **Open PRs:** none.

## What just shipped

All in `main` via PR #37.

1. `6df6090` `chore(scripts): add backfill-course-managers.sql` — idempotent SQL backfills CM-created courses into `_CourseManagers` join table. **Run confirmed on prod this session.**
2. `4825473` `fix(courses): auto-link creator into CourseManagers m2m on create` — CM-created courses now get `managers: { connect: { id: creatorId } }` in `course.create`. Fixes 404 on Edit. Regression test added.
3. `4d62224` `fix(api): rename reminders route param to [id]` — hotfix. `[courseId]` slug collided with existing `[id]` in same dir → Next.js 500 on every request. PR #37.
4. `048cc0d` `feat(admin/progress): manual overdue reminders by managers` — "Send reminder" on `/admin/progress` student rows. Consolidated overdue email + optional 500-char note. `ManualReminderLog` model. Migration `20260512000000_add_manual_reminder_log`.
5. `c04f583` `feat(admin/progress): dedicated tab w/ searchable course table` — `/admin/progress` page; course table with enrolled/completed/overdue counts; click expands inline student list.
6. `78fb5c2` `feat(admin): per-course student progress section` — per-course student cards. ADMIN sees all; CM sees managed courses via `listManagedCourseIds`.

## In-flight

_None._ Tree clean. No `wip/*` branch open.

## Pending external actions

- [ ] **Apply migration `20260512000000_add_manual_reminder_log` to prod.**
  Adds `ManualReminderLog` table. Without it, "Send reminder" on `/admin/progress` throws 500 on every click.

  ```sh
  npx prisma db execute --file prisma/migrations/20260512000000_add_manual_reminder_log/migration.sql
  ```

  Verify all current:
  ```sh
  DATABASE_URL="<prod url>" npx tsx scripts/verify-prod-migrations.ts
  ```

- [ ] **Smoke-test `/admin/progress` + "Send reminder" on prod** after migration applied.
  - ADMIN: all courses visible, counts correct.
  - CM: managed courses only.
  - Expand student row → overdue lessons listed → "Send reminder" fires email → Resend dashboard shows delivery.

- [ ] **Address Dependabot vulns.** Jumped to 33 (16 high, 12 moderate, 5 low) this session. High-severity warrants looking at soon. Fixes likely need Next/Prisma version bumps — multi-PR effort, needs explicit go-ahead.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to `prisma migrate deploy`.** Auto-applies migrations folder. Gated on non-launch deploy window.
- **Resend subdomain (`lms.teamsquared.io`) for sender isolation.** Gated on paid plan or deliverability incident.
- **Server-side dwell enforcement for POLICY_DOC.** Client gate bypassable via DevTools. Gated on auditor pushback.
- **Quiz double-submit idempotency token.** Gated on observed prod incident.
- **Email retry / dead-letter queue.** All sends fire-and-forget. Gated on first Resend outage.
- **Drop `createdById` fallback in `/api/courses/[id]` PATCH.** Lets creator edit without manager rights. Less urgent now creators auto-linked. Gated on whether legacy non-manager creators expected to mutate old courses.
- **Manual-reminder cooldown / abuse guard.** `ManualReminderLog` no dedupe by design. Gated on user complaint.

## Pickup pointer

Apply `20260512000000_add_manual_reminder_log` migration to prod, then smoke-test "Send reminder" flow. Blocking — 500 without it.

After that, triage Dependabot high-severity vulns. 16 high is unusual — likely a transitive dep that updated. Worth checking which packages before committing to upgrade cycle.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Course access + CM scoping | `src/lib/courseAccess.ts` |
| Course progress helpers | `src/lib/courseProgress.ts` |
| Outbound email | `src/lib/email.ts` |
| Admin email surface | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx` |
| ISO compliance (ack log + coverage) | `src/app/admin/iso/page.tsx`, `src/components/admin/IsoAckLog.tsx` |
| ISO ack API | `src/app/api/admin/iso-acks/route.ts`, `.../export/route.ts` |
| Admin progress view | `src/app/admin/progress/page.tsx`, `src/components/admin/CourseProgressTable.tsx` |
| Manual reminder API | `src/app/api/admin/courses/[id]/reminders/route.ts` |
| Course managers panel + API | `src/components/admin/CourseManagersPanel.tsx`, `src/app/api/admin/courses/[id]/managers/` |
| Invite UI + API | `src/components/admin/InviteUserForm.tsx`, `src/app/api/admin/users/invite/route.ts` |
| Lesson complete API (race-safe) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Policy-doc viewer | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| Lesson viewer | `src/components/courses/LessonViewer.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied) | `prisma/migrations/`, `scripts/verify-prod-migrations.ts` |
| One-shot scripts | `scripts/backfill-course-managers.sql`, `scripts/delete-demo-users.{sql,ts}` |
| Render deploy config | `render.yaml` |
| GitHub Actions cron (deadline reminders) | `.github/workflows/deadline-reminders.yml` |
| Tests (vitest) | `src/__tests__/` |
| E2E (Playwright, not in CI) | `e2e/` |
| Design system | `docs/teams-squared-lms-design-system.mdx` |

## Reminders

- `canManageCourse(userId, role, courseId)` = single gate for course-edit authority. ADMIN bypasses m2m; CM must be in `Course.managers`. `listManagedCourseIds` returns `null` for ADMIN.
- `course.create` now connects creator into `managers` — no more orphan courses.
- `prisma/migrate.ts` = hand-rolled idempotent SQL. New migrations apply manually. Use `scripts/verify-prod-migrations.ts` for drift detection.
- Resend SDK v6 returns `{data, error}` — never throws. Always destructure + check `error`.
- No em-dashes in user-facing copy (design-system §8.13). Code comments exempt.

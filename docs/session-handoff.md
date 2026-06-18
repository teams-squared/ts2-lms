# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep`. Last write wins — never
> hand-edit for substantive updates. Caveman style: drop articles + filler;
> preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-18
- Branch: `dev`
- HEAD: `b257e4b` — feat(assessment): half-mark (fractional) grading for manual questions
- Tree: clean (only gitignored `.claude/settings.local.json` + `graphify-out/` on disk)
- **All code released to prod.** `dev` == `origin/main` (`0ba4db0`, PR #61) — 0 ahead.

## What just shipped
Six prod releases this session — assessment feature hardening + an authz fix. All deploys live + DB-verified where schema changed.
- `b257e4b` **half-mark grading** (PR #61) — markers award e.g. 4.5/5 on free-text + multi-select; 0.5 steps. `awardedMarks`/`manualScore`/`totalScore` `Int→Decimal(6,2)`; `autoScore`/`maxMarks`/`passThreshold` stay Int. Migration `20260617120000_fractional_marks`.
- `d17b840` **authz fix** (PR #61) — `GET /api/courses/[id]` now needs published AND enrolled (or privileged), else 404. Closed metadata-enumeration leak. No in-app caller; content was already gated.
- `230694a` **multi-select (checkbox) question type** (PR #60) — like MC but ≥1 correct; marked manually like free-text (never auto-scored). `MULTI_SELECT` enum + `AssessmentAnswer.selectedOptionIds[]`. Migration `20260617000000_add_multi_select`.
- `06b87c8` **assessment builder path** (PR #59) — "Edit questions →" button on assessment lessons in `ModuleManager` → routes to lesson detail page where `AssessmentBuilder` lives.
- `ebc5920` **lesson-create fix** (PR #58) — lesson POST/PATCH whitelist omitted `assessment`+`link` → 400. Now map-derived `isAppLessonType()` guard.

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Confirm ISO cron + env live on prod** — `prune-audit-logs` GitHub Action (`.github/workflows/prune-audit-logs.yml`, weekly Sun 04:00 UTC, uses `CRON_SECRET`); `AUDIT_LOG_RETENTION_DAYS` / `SESSION_MAX_AGE_SECONDS` set on `ts2-lms` (else defaults 365 / 8h).
- [ ] **Do NOT switch staging startCommand to `migrate deploy` while it shares prod DB.** Staging runs `npx tsx prisma/migrate.ts` (frozen legacy bootstrap, ignores `prisma/migrations/`) — GUARD so `dev` pushes never mutate prod schema. Only PROD (`main`) deploy migrates the shared DB.
- [ ] **Staging = prod data.** No separate staging DB (free tier expired, paid not approved). Staging + local `npm run dev` both write PROD DB `dpg-d7eb259f9bms738jscig-a`. Careful with destructive/test-data ops.
- [ ] **Before pushing feature/migration work, run `npm run lint` + `npx vitest run`** — CI gate ("Lint · Type-check · Test · Build") runs both; local `tsc --noEmit` + `npm run build` do NOT. (Local prod build needs `AUTH_SECRET=<any>`.)
- [ ] **Triage Dependabot** — 3 moderate + 1 low. `https://github.com/teams-squared/ts2-lms/security/dependabot`
- [ ] **(Deferred, gated on budget)** separate staging Postgres + switch staging to `migrate deploy` + retire `migrate.ts` + author catch-up migration (creates what `migrate.ts` makes but `prisma/migrations/` lacks: DeadlineReminderLog, `Enrollment.completedAt`, `User.onboardedAt`, SharePointCache, COURSE_MANAGER role restructure) so a FRESH DB via `migrate deploy` is complete.

## Open questions / decisions
- Assessment scoring: MC auto-scored (whole marks); FREE_TEXT + MULTI_SELECT manually marked, half-mark granularity. Settled.
- Run e2e assessment smoke test? Gated on: operator pick — write-path `e2e/assessment.spec.ts` (writes prod data) vs read-only checks. `npx playwright install chromium` first (binary not cached).
- Partial-credit per-option auto-scoring for MULTI_SELECT. Gated on: declined — manual marking chosen instead.

## Pickup pointer
Nothing in-flight; all code live in prod. Next natural step: confirm ISO cron + retention env on Render (`prune-audit-logs`, `AUDIT_LOG_RETENTION_DAYS`/`SESSION_MAX_AGE_SECONDS`), then triage 3 moderate + 1 low Dependabot alerts. Revisit deferred staging-DB infra when budget approved.

---

## Where things live
| Concern | Location |
|---|---|
| Assessment schema | `prisma/schema.prisma` — AssessmentLesson, AssessmentVariant, AssessmentQuestion (`questionType`: MULTIPLE_CHOICE / FREE_TEXT / MULTI_SELECT), AssessmentOption, AssessmentSubmission (scores Decimal where manual), AssessmentAnswer (`selectedOptionId` / `selectedOptionIds[]` / `responseText`) |
| Assessment logic | `src/lib/assessment.ts` — pickVariantForUser, finalizeSubmission (MC auto-score only), getStudentState, loadSanitizedQuestionsForVariant, `answerDataFor()` (per-type answer channel) |
| Marking | `src/lib/marking.ts`; API `src/app/api/admin/marking/[submissionId]/route.ts` (manual = FREE_TEXT + MULTI_SELECT, half-mark steps); UI `src/components/admin/MarkingDetail.tsx` |
| Assessment UI | builder `src/components/courses/AssessmentBuilder.tsx`; viewer `src/components/courses/AssessmentViewer.tsx`; dispatch `src/app/courses/[id]/lessons/[lessonId]/page.tsx` |
| Lesson-type guard | `src/lib/types.ts` `isAppLessonType()` / `APP_LESSON_TYPES` — derived from map, used by lesson create/update routes |
| Course access | `src/lib/courseAccess.ts` — canManageCourse (admin/manager), canViewLesson (enrolled), canViewCourse. Course/lesson pages + `GET /api/courses/[id]` gate on published+enrolled for non-privileged |
| Audit log | `prisma/schema.prisma` (AuditLog); `src/lib/audit.ts writeAuditLog`; admin list+CSV `src/app/api/admin/audit-logs/`; cron `src/app/api/cron/prune-audit-logs/` |
| Migrations | hand-write idempotent SQL `prisma/migrations/<ts>_<name>/migration.sql`. Applied by PROD `prisma migrate deploy` only. Verify post-release: read-only Render MCP `query_render_postgres`, postgresId `dpg-d7eb259f9bms738jscig-a` |
| Deploy | Render (Teams Squared workspace, LMS services only). PROD `ts2-lms` (`srv-d7eb0npj2pic73841ra0`) ← `main`, start `npx prisma migrate deploy && npm start`. STAGING `ts2-lms-staging` (`srv-d83bv5btqb8s73dihi60`) ← `dev`, start `npx tsx prisma/migrate.ts && npm start`. SHARED DB |
| Release | `dev`→`main` PR only on explicit ask. main branch-protected (review + CI); admin-bypass only when CI green |

# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep`. Last write wins — never
> hand-edit for substantive updates. Caveman style: drop articles + filler;
> preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-17
- Branch: `dev`
- HEAD: `2e7c3e0` — docs(handoff): regenerate snapshot at c94e689
- Tree: clean (only gitignored `.claude/settings.local.json` on disk)
- **All runtime code released to prod.** Latest code tip `c94e689` == `origin/main` (`6c8e07a`, PR #57). `dev` ahead of `main` only by handoff-doc commits — zero unreleased code.

## What just shipped
**Assessment feature — built + released to PROD (PR #57, `dev`→`main`).** Deploy `dep-d8onkcm8bjmc73c45f1g` **live**. Prod DB migrated + verified (6 assessment tables, `variantId` cols, reattempt-lock index; latest migration `20260616010000_add_assessment_variants`). Prod + staging health 200/200.
- `c94e689` test fix (icon mock + 8th lesson-type option) · `a615090` lint fix — both caught by CI, not local tsc/build
- `7baa61d` exam **variants** (random unseen-variant assignment, recycle when exhausted) — schema re-parents questions lesson→variant
- `9835060` base ASSESSMENT type (timed exam, MC auto-score + free-text manual mark, `/admin/marking`, marked-pass gates completion)
- `58f992c` `0056016` intermediate variant commits — build_failed standalone, SUPERSEDED by `7baa61d`+
- Feature: lesson holds N variants (questions only differ; shared time/threshold). Quiz untouched. Course-completion side-effects → `src/lib/enrollments.ts maybeCompleteCourse`.
- Earlier this cycle (PR #55/#56): ISO AuditLog (A.8.15), weekly `prune-audit-logs` cron (`AUDIT_LOG_RETENTION_DAYS` default 365), sliding JWT (`SESSION_MAX_AGE_SECONDS` default 8h); leaked-cred incident RESOLVED (`.claude/settings.local.json` untracked + gitignored, prod DB password rotated).

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Do NOT switch staging startCommand to `migrate deploy` while it shares prod DB.** Staging runs `npx tsx prisma/migrate.ts` (frozen legacy bootstrap, ignores `prisma/migrations/`) — GUARD so `dev` pushes never mutate prod schema. Only PROD (`main`) deploy migrates the shared DB.
- [ ] **Staging = prod data.** No separate staging DB (free tier expired, paid not approved). Staging + local `npm run dev` both write PROD DB `dpg-d7eb259f9bms738jscig-a`. Careful with destructive/test-data ops.
- [ ] **Before pushing feature/migration work, run `npm run lint` + `npx vitest run`** — CI gate ("Lint · Type-check · Test · Build") runs both; local `tsc --noEmit` + `npm run build` do NOT. (Local prod build needs `AUTH_SECRET=<any>` or page-data collection fails.)
- [ ] **Confirm ISO cron + env live on prod** — `prune-audit-logs` GitHub Action (`.github/workflows/prune-audit-logs.yml`, weekly Sun 04:00 UTC, uses `CRON_SECRET`); `AUDIT_LOG_RETENTION_DAYS` / `SESSION_MAX_AGE_SECONDS` set on `ts2-lms` (else defaults 365/8h).
- [ ] **Triage Dependabot** — 3 moderate + 1 low. `https://github.com/teams-squared/ts2-lms/security/dependabot`
- [ ] **(Deferred, gated on budget)** separate staging Postgres + switch staging to `migrate deploy` + retire `migrate.ts` + author catch-up migration (creates what `migrate.ts` makes but `prisma/migrations/` lacks: DeadlineReminderLog, `Enrollment.completedAt`, `User.onboardedAt`, SharePointCache, COURSE_MANAGER role restructure) so a FRESH DB via `migrate deploy` is complete.

## Open questions / decisions
- Run e2e assessment smoke test? Gated on: operator pick — (a) full write-path `e2e/assessment.spec.ts` w/ throwaway-user cleanup (writes prod data), or (b) read-only render checks. Playwright installed (`@playwright/test` 1.59.1, `e2e/`, baseURL localhost:3000); browser binary not cached → `npx playwright install chromium` first.
- Assessment pass/fail: marker decides explicitly (PATCH `pass` bool); `passThreshold` guidance only. Settled.
- Git-history scrub of leaked cred. Gated on: decided SKIP — rotation killed the string.

## Pickup pointer
Nothing in-flight; all code live in prod. Next natural step: confirm ISO cron + retention env on Render (`prune-audit-logs`, `AUDIT_LOG_RETENTION_DAYS`/`SESSION_MAX_AGE_SECONDS`), then operator picks e2e assessment smoke test (a/b above) or moves on. Revisit deferred staging-DB infra when budget approved.

---

## Where things live
| Concern | Location |
|---|---|
| Assessment schema | `prisma/schema.prisma` — AssessmentLesson (timeLimit, passThreshold), AssessmentVariant, AssessmentQuestion (under variant), AssessmentOption, AssessmentSubmission (`variantId`, status IN_PROGRESS/SUBMITTED/MARKED_PASS/MARKED_FAIL), AssessmentAnswer |
| Assessment logic | `src/lib/assessment.ts` — pickVariantForUser (unseen-first+recycle), finalizeSubmission (MC auto-score), finalizeIfExpired, getStudentState, loadSanitizedQuestionsForVariant |
| Marking queue | `src/lib/marking.ts loadMarkingQueue`; `/admin/marking` + `src/components/admin/MarkingQueueTable.tsx` + `MarkingDetail.tsx`; API `src/app/api/admin/marking/` |
| Student/author UI | `src/components/courses/AssessmentViewer.tsx` (timer/autosave/auto-submit), `AssessmentBuilder.tsx`; dispatch `src/app/courses/[id]/lessons/[lessonId]/page.tsx` |
| Assessment API | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/assessment/` — route(GET), start, answers(PUT autosave), submit, config, variants/** |
| Audit log | `prisma/schema.prisma` (AuditLog); `src/lib/audit.ts writeAuditLog`; admin list+CSV `src/app/api/admin/audit-logs/`; cron `src/app/api/cron/prune-audit-logs/` |
| Migrations | hand-write idempotent SQL `prisma/migrations/<ts>_<name>/migration.sql`. Applied by PROD `prisma migrate deploy` only. Verify post-release: read-only Render MCP `query_render_postgres`, postgresId `dpg-d7eb259f9bms738jscig-a`. |
| Deploy | Render (Teams Squared workspace, LMS services only). PROD `ts2-lms` (`srv-d7eb0npj2pic73841ra0`) ← `main`, start `npx prisma migrate deploy && npm start`. STAGING `ts2-lms-staging` (`srv-d83bv5btqb8s73dihi60`) ← `dev`, start `npx tsx prisma/migrate.ts && npm start`. SHARED DB. |
| DB creds | `DATABASE_URL` = hardcoded literal env on BOTH services (NOT `fromDatabase`). Password rotation does NOT auto-propagate — manually edit env + redeploy each service. |
| Release | `dev`→`main` PR only on explicit ask. main branch-protected (review + CI); admin-bypass only when CI green. |

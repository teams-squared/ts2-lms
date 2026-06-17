# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep`. Last write wins — never
> hand-edit for substantive updates. Caveman style: drop articles + filler;
> preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-17
- Branch: `dev`
- HEAD: `c94e689` — test(assessment): update lesson-type tests for ASSESSMENT type
- Tree: clean
- **dev fully merged to `origin/main` (`6c8e07a`, PR #57) — 0 ahead.** Local `main` ref stale (`7db3b13`); use `origin/main`.

## What just shipped
**Assessment feature — built + released to PROD this session.** PR #57 (`dev`→`main`) merged (admin-bypass past review gate, CI green) → prod deploy `dep-d8onkcm8bjmc73c45f1g` **live**. Prod DB migrated + verified (6 assessment tables, `variantId` cols, reattempt-lock index; latest migration `20260616010000_add_assessment_variants`). Prod + staging health 200/200.
- `c94e689` test fix (icon mock + 8th lesson-type option) · `a615090` lint fix — both caught by CI, not local tsc/build
- `7baa61d` exam **variants** (random unseen-variant assignment, recycle when exhausted) — schema re-parents questions lesson→variant
- `9835060` base ASSESSMENT type (timed exam, MC auto-score + free-text manual mark, `/admin/marking`, marked-pass gates completion)
- `58f992c` `0056016` intermediate variant commits — build_failed standalone, SUPERSEDED by `7baa61d`+ (a worker auto-pushed them mid-build; fixed forward)
- Feature: lesson holds N variants (questions only differ; shared time/threshold). Quiz untouched. Course-completion side-effects extracted → `src/lib/enrollments.ts maybeCompleteCourse`.

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Do NOT switch staging startCommand to `migrate deploy` while it shares prod DB.** Staging runs `npx tsx prisma/migrate.ts` (frozen legacy bootstrap, ignores `prisma/migrations/`) — this is a GUARD so `dev` pushes never mutate prod schema. Only PROD (`main`) deploy migrates the shared DB.
- [ ] **Staging = prod data.** No separate staging DB (free tier expired, paid not approved). Staging + local `npm run dev` both write the PROD DB `dpg-d7eb259f9bms738jscig-a`. Careful with destructive/test-data ops.
- [ ] **Before pushing feature/migration work, run `npm run lint` + `npx vitest run`** — CI gate ("Lint · Type-check · Test · Build") runs both; local `tsc --noEmit` + `npm run build` do NOT. (Local prod build needs `AUTH_SECRET=<any>` or page-data collection fails.)
- [ ] **Triage Dependabot** — 3 moderate + 1 low on push. `https://github.com/teams-squared/ts2-lms/security/dependabot`
- [ ] **(Deferred, gated on budget)** separate staging Postgres + switch staging to `migrate deploy` + retire `migrate.ts` + author catch-up migration (creates what `migrate.ts` makes but `prisma/migrations/` lacks: DeadlineReminderLog, `Enrollment.completedAt`, `User.onboardedAt`, SharePointCache, Assignment, COURSE_MANAGER role restructure) so a FRESH DB via `migrate deploy` is complete.

## Open questions / decisions
- Run e2e assessment smoke test? Gated on: operator pick — (a) full write-path `e2e/assessment.spec.ts` w/ throwaway user cleanup (writes prod data), or (b) read-only render checks. Playwright installed (`@playwright/test` 1.59.1, `e2e/`, `playwright.config.ts` baseURL localhost:3000) but browser binary not cached here → `npx playwright install chromium` first.
- Assessment pass/fail: marker decides explicitly (PATCH `pass` bool); `passThreshold` is guidance only. Settled.

## Pickup pointer
Assessment + variants + marking SHIPPED + live in prod, DB verified. Nothing in-flight. Next natural step: operator chooses e2e smoke test (a/b above) or moves on; revisit deferred staging-DB infra when budget approved.

---

## Where things live
| Concern | Location |
|---|---|
| Assessment schema | `prisma/schema.prisma` — AssessmentLesson (config: timeLimit, passThreshold), AssessmentVariant, AssessmentQuestion (under variant), AssessmentOption, AssessmentSubmission (`variantId`, status IN_PROGRESS/SUBMITTED/MARKED_PASS/MARKED_FAIL), AssessmentAnswer |
| Assessment logic | `src/lib/assessment.ts` — pickVariantForUser (unseen-first+recycle), finalizeSubmission (MC auto-score), finalizeIfExpired, getStudentState, loadSanitizedQuestionsForVariant |
| Marking queue | `src/lib/marking.ts loadMarkingQueue`; `/admin/marking` page + `src/components/admin/MarkingQueueTable.tsx` + `MarkingDetail.tsx`; API `src/app/api/admin/marking/` |
| Student/author UI | `src/components/courses/AssessmentViewer.tsx` (timer/autosave/auto-submit, preview), `AssessmentBuilder.tsx` (variants+questions); dispatch in `src/app/courses/[id]/lessons/[lessonId]/page.tsx` |
| Assessment API | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/assessment/` — route(GET), start, answers(PUT autosave), submit, config, variants/** (CRUD + questions) |
| Migrations | hand-write idempotent SQL `prisma/migrations/<ts>_<name>/migration.sql`. Applied by PROD `prisma migrate deploy` only. Verify: query DB after `main` release (read-only via Render MCP `query_render_postgres`, postgresId `dpg-d7eb259f9bms738jscig-a`). |
| Deploy | Render. PROD `ts2-lms` (`srv-d7eb0npj2pic73841ra0`) ← `main`, start `npx prisma migrate deploy && npm start`. STAGING `ts2-lms-staging` (`srv-d83bv5btqb8s73dihi60`) ← `dev`, start `npx tsx prisma/migrate.ts && npm start`. SHARED DB. |
| Release | `dev`→`main` PR only on explicit ask. main branch-protected (review + CI required); admin-bypass acceptable only when CI green. |

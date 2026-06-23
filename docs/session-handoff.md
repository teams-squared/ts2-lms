# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep`. Last write wins — never
> hand-edit for substantive updates. Caveman style: drop articles + filler;
> preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-23
- Branch: `dev`
- HEAD: `e73477a` — docs(polish): mark Tier 1A + Tier 2 shipped
- Tree: clean
- **`dev` 7 ahead of `main`.** All this-session work on `dev`/staging only — NOT released to prod.

## What just shipped
Polish-backlog execution + two audit docs. No prod release. All polish commits gate-verified: `tsc` clean, `eslint` 0 errors, `vitest` 1356/1356; `f3e175b` also `next build` green.
- `e73477a` **backlog status** — mark Tier 1A + Tier 2 done in `docs/polish-backlog.md`.
- `ba3fa64` **microcopy** (Tier 2 Q7) — sentence-case CTAs ("Create course", "Start/Retake/Review quiz", "Continue to next lesson"); em-dashes dropped from button/status labels. Test fixtures updated.
- `dcc5d5b` **ConfirmDialog + skeletons** (Q4/Q5) — native `confirm()` → `ConfirmDialog` in `PublicIsoLibraryManager`; 6 admin `loading.tsx` (assignments, marking, clearance, nodes, settings, users/[userId]).
- `be3d278` **a11y + hygiene** (Q2/Q3/Q6/Q8/Q9) — `focus:`→`focus-visible:` sweep (17 files); `aria-live` on AchievementToast; `DATABASE_URL` startup guard (+ vitest dummy env); `hover:bg-primary/90` bug fix; console gating; error-boundary copy.
- `f3e175b` **metadata/SEO** (Tier 1A) — `robots` noindex + `src/app/robots.ts`, `metadataBase`, title template + per-page titles (`generateMetadata` for course/lesson/policy), OpenGraph, viewport `themeColor`.
- `a43d837` **polish backlog** — `docs/polish-backlog.md`, 5-dimension audit, ~45 findings in Tier 1/2/3.
- `6f6059f` **graph Q&A** — `docs/graph-insights.md`. Verified 35/35 inferred authz `calls` edges accurate vs source.

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Release polish to prod** — `dev` 7 ahead of `main`. Open `dev → main` PR + merge when operator wants release (incl. `robots` noindex now on staging only). Only on explicit ask.
- [ ] **Tier 1B B4 — `Notification` `@@index([userId, read])` migration** — DEFERRED, needs operator sign-off. Staging+local share PROD DB; migrations apply only on `main` deploy. Details `docs/polish-backlog.md`.
- [ ] **Deps** — session ran `npm ci` (node_modules was empty at start). Fresh session: `npm ci` before lint/test/build.
- [ ] **Triage Dependabot** (carry-forward) — was 3 moderate + 1 low. `https://github.com/teams-squared/ts2-lms/security/dependabot`
- [ ] **Confirm ISO cron + env on prod** (carry-forward) — `prune-audit-logs` Action (weekly Sun 04:00 UTC, `CRON_SECRET`); `AUDIT_LOG_RETENTION_DAYS` / `SESSION_MAX_AGE_SECONDS` on `ts2-lms`.
- [ ] **(Deferred, budget-gated)** separate staging Postgres + switch staging to `migrate deploy` + retire `migrate.ts`.

## Open questions / decisions
- Polish backlog next tier. Gated on: operator pick — Tier 1B perf (code-only N+1s, no schema) / 1C a11y modals / Tier 3 (Button adoption, `cn()` sweep, zod hardening, `formatDate()`). Operator paused after Tier 1A + Tier 2.
- Em-dash purge scope. Gated on: decided — fixed button/status LABELS only; empty-cell `—` placeholders + admin prose left as-is (subjective, out of scope).

## Pickup pointer
Resume `docs/polish-backlog.md`. Next natural (no schema change, no sign-off): **Tier 1B perf code-only** — `GET /api/courses` swap to `checkCourseEligibilityBatch`; admin analytics `getCourseMetrics` per-user×course `lessonProgress.count` → single `groupBy`; `achievements.countCompletedCourses` 1+2E queries → 2 aggregates. Else operator-picked tier.

---

## Where things live
| Concern | Location |
|---|---|
| Polish backlog (Tier 1/2/3, shipped status) | `docs/polish-backlog.md` |
| Knowledge-graph Q&A / authz verification | `docs/graph-insights.md`; graph in `graphify-out/` (gitignored) |
| Metadata / SEO | `src/app/layout.tsx` (metadataBase, title template, robots, OG, viewport themeColor); `src/app/robots.ts`; per-page `metadata`/`generateMetadata` |
| Authz | `src/lib/roles.ts` `requireRole` (returns 401/403, not throw); `src/lib/courseAccess.ts` `canManageCourse` (admin OR CourseManagers join) |
| DB client | `src/lib/prisma.ts` — now throws if `DATABASE_URL` unset; vitest supplies dummy via `vitest.config.ts` `test.env` |
| Assessment | schema `prisma/schema.prisma` (AssessmentLesson/Variant/Question/Option/Submission/Answer); logic `src/lib/assessment.ts`; marking `src/lib/marking.ts` + `MarkingDetail.tsx` |
| Migrations | hand-write idempotent SQL `prisma/migrations/<ts>_<name>/migration.sql`. PROD `prisma migrate deploy` only. Verify via Render MCP `query_render_postgres`, postgresId `dpg-d7eb259f9bms738jscig-a` |
| Deploy | Render. PROD `ts2-lms` ← `main` (`migrate deploy && start`). STAGING `ts2-lms-staging` ← `dev` (`npx tsx prisma/migrate.ts && start`). SHARED DB |
| CI gate | "Lint · Type-check · Test · Build". Pre-push: `npm run lint` + `npx vitest run`. Local build needs `AUTH_SECRET=<any>` |
| Release | `dev`→`main` PR only on explicit ask. `main` branch-protected |

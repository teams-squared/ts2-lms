# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep`. Last write wins — never
> hand-edit for substantive updates. Caveman style: drop articles + filler;
> preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-24
- Branch: `dev`
- HEAD: `551d62e` — chore(deps): npm audit fix — resolve 15 transitive vulns
- Tree: clean
- **`dev` == `main`** after release PR #70. All work released PROD.

## What just shipped
Dep-vuln cleanup + markdown-in-assessments + offboarding + Tier 1B perf, all released PROD same day. All CI-green.
- `551d62e` **deps** — `npm audit fix`, 15 transitive vulns resolved (undici, uuid, @opentelemetry/posthog-js, js-yaml, dompurify, babel). Lockfile-only. 22→7 alerts. Released PROD via PR #70.
- `b7116eb` **handoff** — prior regenerate.
- `5f729e1` **docs** — Notion canonical-docs pointers in `CLAUDE.md`. Released PROD via PR #70.
- `b3a1624` **assessment markdown** — question prompts + answer options render markdown (react-markdown + remark-gfm, no new dep, no schema). New: `QuestionMarkdown.tsx`, `MarkdownHint.tsx`. **Released PROD via PR #69 → `main` `2d31825`, deploy `dep-d8to89740ujc739d96k0` live 07:18 UTC.**
- `9ef52ff` **offboarding** — soft-offboard users (`User.offboardedAt`), retain history, Entra auto-sync. Migration `20260624000000_add_user_offboarded_at`. Released PROD via PR #68 → `main` `f5de8a5`, deploy live 05:47 UTC.
- `a23289d` **offboarding filter** — exclude offboarded users from active surfaces.
- `d08ab7c` **perf B8** — lazy-load course editors, defer dnd-kit (Tier 1B).
- `680cc6e` **perf N+1** — analytics `getCourseMetrics` groupBy + achievements aggregates.
- `d3b3265` **perf N+1** — `GET /api/courses` eligibility batch, notifications, dashboard.

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Dependabot remaining 7** (1 high, 6 moderate) — ALL `hono` via `@prisma/dev` → `prisma`. Dev/CLI-only, NOT prod runtime. Fix needs `npm audit fix --force` → `prisma@6.19.3` (breaking). DEFERRED, needs operator sign-off before prisma bump. `https://github.com/teams-squared/ts2-lms/security/dependabot`
- [ ] **Confirm ISO cron + env on prod** (carry-forward) — `prune-audit-logs` Action (weekly Sun 04:00 UTC, `CRON_SECRET`); `AUDIT_LOG_RETENTION_DAYS` / `SESSION_MAX_AGE_SECONDS` on `ts2-lms`.
- [ ] **Tier 1B B4 — `Notification` `@@index([userId, read])` migration** — DEFERRED, needs operator sign-off. Staging+local share PROD DB. Details `docs/polish-backlog.md`.
- [ ] **(Deferred, budget-gated)** separate staging Postgres + switch staging to `migrate deploy` + retire `migrate.ts`.
- [ ] **Deps** — fresh session: `npm ci` before lint/test/build if `node_modules` empty.

## Open questions / decisions
- Polish backlog next tier. Gated on: operator pick — 1C a11y modals / Tier 3 (Button adoption, `cn()` sweep, zod hardening, `formatDate()`). Tier 1A/1B/2 done.
- Notion "For engineers" section sync. Gated on: update only when stack/architecture changes (per new `CLAUDE.md` block).

## Pickup pointer
No active WIP. All work released PROD (`dev` == `main`). Next natural: operator-picked polish tier (1C a11y modals or Tier 3) from `docs/polish-backlog.md`. Dependabot 7-remaining gated on prisma-bump sign-off. Nothing forces a move.

---

## Where things live
| Concern | Location |
|---|---|
| Product docs (canonical) | Notion Teams Squared Tech wiki — product page `https://app.notion.com/p/37b1b16362b381379a75d8acb45653d0`; tech hub `https://app.notion.com/p/37b1b16362b38149b508fa12e51fe635` |
| Polish backlog (Tier 1/2/3, shipped status) | `docs/polish-backlog.md` |
| Assessment markdown | `src/components/courses/QuestionMarkdown.tsx` (lazy md wrapper), `MarkdownHint.tsx` (author cheatsheet); used by `AssessmentBuilder.tsx` + `AssessmentViewer.tsx` |
| Offboarding | `User.offboardedAt` in `prisma/schema.prisma`; offboarded users filtered from active surfaces; Entra auto-sync |
| Authz | `src/lib/roles.ts` `requireRole` (returns 401/403, not throw); `src/lib/courseAccess.ts` `canManageCourse` (admin OR CourseManagers join) |
| DB client | `src/lib/prisma.ts` — throws if `DATABASE_URL` unset; vitest dummy via `vitest.config.ts` `test.env` |
| Migrations | hand-write idempotent SQL `prisma/migrations/<ts>_<name>/migration.sql`. PROD `prisma migrate deploy` only. Verify via Render MCP `query_render_postgres`, postgresId `dpg-d7eb259f9bms738jscig-a` |
| Deploy | Render. PROD `ts2-lms` `srv-d7eb0npj2pic73841ra0` ← `main` (`migrate deploy && start`). STAGING `ts2-lms-staging` `srv-d83bv5btqb8s73dihi60` ← `dev` (`npx tsx prisma/migrate.ts && start`). SHARED DB. Workspace `Teams Squared` |
| CI gate | "Lint · Type-check · Test · Build". Pre-push: `npm run lint` + `npx vitest run`. Local build needs `AUTH_SECRET=<any>` |
| Release | `dev`→`main` PR only on explicit ask. `main` branch-protected. May `gh pr merge --admin` when CI green |

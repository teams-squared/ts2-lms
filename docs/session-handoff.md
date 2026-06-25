# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep`. Last write wins — never
> hand-edit for substantive updates. Caveman style: drop articles + filler;
> preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-24
- Branch: `dev`
- HEAD: `8be0f86` — feat(enrollments): course managers can invite + enroll from Enrollments tab
- Tree: clean
- **`dev` == `main`.** All work released PROD (PR #71, deploy live 10:17 UTC).

## What just shipped
Audit-log ISO hardening + viewer UI + course-manager invite, all released PROD via PR #71 → `main` `be1ca31`. Earlier same day: dep-vuln cleanup (#70), markdown-in-assessments (#69), offboarding (#68). All CI-green.
- `8be0f86` **CM invite UI + security fix** — "Invite user" panel on Enrollments tab (`/admin/assignments`), scoped to managed courses + employee-only for course managers. Fixed: `/api/admin/users/invite` now scopes enroll-on-invite `courseIds` to managed courses (was a latent escalation — course_manager could enroll into ANY course).
- `ce0d87b` **audit viewer UI** — `/admin/audit-logs` (admin-only tab): filter (date/action/actor), paginated table, Download CSV + Manifest, legal-hold toggle panel.
- `235bd8d` **audit ISO hardening** — export integrity (`X-Content-SHA256` header + `?format=manifest`), legal-hold (`AuditRetentionSettings` singleton; prune cron skips when paused). Migration `20260624120000_add_audit_retention_settings` — applied + recorded on prod, verified.
- `551d62e` **deps** — `npm audit fix`, 15 transitive vulns (#70).
- `b3a1624` **assessment markdown** (#69).

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Dependabot remaining 7** (1 high, 6 moderate) — ALL `hono` via `@prisma/dev` → `prisma`. Dev/CLI-only, NOT prod runtime. Fix needs `npm audit fix --force` → `prisma@6.19.3` (breaking). DEFERRED, needs operator sign-off. `https://github.com/teams-squared/ts2-lms/security/dependabot`
- [ ] **Confirm ISO cron + env on prod** (carry-forward) — `prune-audit-logs` Action (weekly Sun 04:00 UTC, `CRON_SECRET`); `AUDIT_LOG_RETENTION_DAYS` / `SESSION_MAX_AGE_SECONDS` on `ts2-lms`.
- [ ] **Tier 1B B4 — `Notification` `@@index([userId, read])` migration** — DEFERRED, needs operator sign-off. Staging+local share PROD DB. Details `docs/polish-backlog.md`.
- [ ] **Deps** — fresh session: `npm ci` before lint/test/build if `node_modules` empty.

## Open questions / decisions
- Audit tamper-evidence depth. Gated on: decided — manifest hash (evidence-handoff) shipped; storage hash-chain deliberately skipped (overkill for ISO expectations).
- Invite placement for course managers. Gated on: decided — Enrollments tab, NOT unhiding admin-only Users tab (which leaks full user list + role mgmt).
- Polish backlog next tier. Gated on: operator pick — 1C a11y modals / Tier 3 (Button adoption, `cn()` sweep, zod hardening, `formatDate()`). 1A/1B/2 done.

## Pickup pointer
No active WIP. All work released PROD (`dev` == `main`). Next natural: operator-picked polish tier from `docs/polish-backlog.md`, OR Dependabot prisma-bump (sign-off gated). Nothing forces a move.

---

## Where things live
| Concern | Location |
|---|---|
| Product docs (canonical) | Notion Teams Squared Tech wiki — product page `https://app.notion.com/p/37b1b16362b381379a75d8acb45653d0` |
| Audit trail | model `AuditLog` + `AuditRetentionSettings` in `prisma/schema.prisma`; write helper `src/lib/audit.ts`; action consts (server-free, for client) `src/lib/auditActions.ts` |
| Audit export + integrity | `src/app/api/admin/audit-logs/export/route.ts` (CSV + `X-Content-SHA256` + `?format=manifest`); list `src/app/api/admin/audit-logs/route.ts` |
| Audit legal-hold | `src/app/api/admin/settings/audit-retention/route.ts` (toggle); prune cron `src/app/api/cron/prune-audit-logs/route.ts` (skips when `prunePaused`); UI `src/components/admin/AuditRetentionControl.tsx` |
| Audit UI | tab `/admin/audit-logs` (`src/app/admin/audit-logs/page.tsx`); explorer `src/components/admin/AuditLogExplorer.tsx` |
| Invite / enroll | invite `src/app/api/admin/users/invite/route.ts` (scoped to managed courses); CM invite UI `src/components/admin/InviteUserPanel.tsx` on `src/components/shared/AssignmentsPageContent.tsx`; enroll scope `src/lib/courseAccess.ts` `listManagedCourseIds` / `canManageCourse` |
| Authz | `src/lib/roles.ts` `requireRole` (401/403, hierarchical: admin>course_manager>employee); enroll/invite gated `course_manager`, scoped per-course |
| Migrations | hand-write idempotent SQL `prisma/migrations/<ts>_<name>/migration.sql` (CREATE ... IF NOT EXISTS). PROD `prisma migrate deploy`; STAGING `prisma/migrate.ts` (mirror the block). SHARED DB. Verify via Render MCP `query_render_postgres`, postgresId `dpg-d7eb259f9bms738jscig-a` |
| Deploy | Render. PROD `ts2-lms` `srv-d7eb0npj2pic73841ra0` ← `main`. STAGING `ts2-lms-staging` `srv-d83bv5btqb8s73dihi60` ← `dev`. SHARED DB. Workspace `Teams Squared` |
| CI gate | "Lint · Type-check · Test · Build". Pre-push: `npm run lint` + `npx vitest run`. Local build needs `AUTH_SECRET` + `DATABASE_URL` |
| Release | `dev`→`main` PR only on explicit ask. `main` branch-protected. May `gh pr merge --admin` when CI green |

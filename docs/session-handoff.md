# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler; preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-16
- Branch: `dev`
- HEAD: `a450eba` — chore(security): untrack .claude/settings.local.json (leaked prod DB creds)
- Tree: clean
- Ahead of `origin/main` (`8bc4bfa`): **1** — only `a450eba` (untrack file, no runtime change)

## What just shipped
**PR #56 (`8bc4bfa`) merged dev→main + deployed prod 2026-06-16 ~13:24** (deploy `dep-d8oks058nd3s73aj26eg` live). Audit-log coverage + dep security fixes:
- `cb757bc` feat(audit): wire audit logging into 19 admin mutation routes
- `7db3b13` feat(iso): central audit log, retention cron, session timeout (#55) — AuditLog table (A.8.15), weekly `prune-audit-logs` cron (A.5.33, `AUDIT_LOG_RETENTION_DAYS` default 365), sliding-window JWT (A.8.5, `SESSION_MAX_AGE_SECONDS` default 8h)
- `852c516` chore(deps): override transitive deps to patched — **clears all 8 high Dependabot alerts** (protobufjs/esbuild/postcss/vite/hono/fast-uri/ws)
- `1a1f4d4` chore(deps): override dompurify to 3.4.10
- `3c9c476` chore(deps): reconcile package-lock; `a256407` chore: gitignore graphify-out

**SECURITY INCIDENT — RESOLVED.** Prod DB connection string (password in a PowerShell permission rule) found committed to PUBLIC repo in `.claude/settings.local.json` since `c32fd42`. Fix:
- `a450eba` untracked file (already matched `.claude/*` gitignore, predated rule). Local on-disk copy stays, gitignored.
- Prod DB password **rotated** in Render dashboard — old leaked string now dead.
- `DATABASE_URL` manually updated on BOTH services (it is a hardcoded literal, NOT `fromDatabase`) + redeployed: prod `dep-d8oltj9kh4rs7391gbs0` live 14:36, staging `dep-d8oluchkh4rs7391h2n0` live 14:37. Both reconnected clean via `prisma migrate deploy`.
- History scrub **skipped** (operator decision) — rotation makes leaked string useless.

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Release `a450eba` to prod** — security untrack sits on `dev` only. No runtime impact (file untrack), rides next `dev→main` PR. No urgency.
- [ ] **Triage remaining Dependabot alerts** — 3 medium + 1 low, zero high. `@opentelemetry/core`<2.8.0 (runtime), `js-yaml`<=4.1.1 (dev), `uuid`<11.1.1 (runtime, svix→resend — deferred, needs svix-risky major bump), `@babel/core`<=7.29.0 (dev, low). `https://github.com/teams-squared/ts2-lms/security/dependabot`
- [ ] **Confirm ISO cron + env on prod** — verify `prune-audit-logs` cron job exists on Render + `AUDIT_LOG_RETENTION_DAYS` / `SESSION_MAX_AGE_SECONDS` set (else defaults 365/8h apply).
- [ ] **Seed clearance + internal-docs — feature DORMANT until done** (unverified this session). ADMIN: create Sectors `/admin/clearance` → grant clearances `/admin/users/[id]` → set per-resource reqs → add docs `/internal-docs/new`. Existing logged-in users re-login to refresh JWT `internal` flag.
- [ ] **Sync or delete `render.yaml`** — detached from live. Claims `fromDatabase` wiring + DB name `ts2-lms-db`/`ts2_lms_user`; LIVE is hardcoded `DATABASE_URL` literal + DB `ts_lms_postgresql`. Footgun. Update to match dashboard or drop.
- [ ] **Backfill catch-up migration before any fresh DB.** `prisma/migrations/` does NOT create `DeadlineReminderLog` table + `Enrollment.completedAt` col (old `migrate.ts` made them). Fine for persistent prod; fresh DB via `migrate deploy` alone breaks. Bites if staging ever gets own DB (shares prod now).

## Open questions / decisions
- Git-history scrub of leaked cred. Gated on: decided SKIP — rotation killed the string; cosmetic only.
- `uuid` 10→11 bump. Gated on: svix compat risk — deferred.
- More entry points to `/policies`? Gated on: product call.
- React `<ViewTransition>` course-card morph. Gated on: React 19.x exporting `ViewTransition` (undefined in 19.2.4).

## Pickup pointer
No urgent work. Tree clean. Next natural step: triage 3 medium + 1 low Dependabot alerts (uuid deferred), and/or open `dev→main` PR to release `a450eba`. Optionally confirm ISO cron + retention env vars live on prod.

---

## Where things live
| Concern | Location |
|---|---|
| Clearance model (sector+tier) | `prisma/schema.prisma` (Sector, UserClearance, ResourceClearanceRequirement, InternalDoc, InternalDocView) |
| Clearance logic | `src/lib/clearance.ts` (ANY-satisfies read, ALL-satisfies author) |
| Audit log | `prisma/schema.prisma` (AuditLog), admin list + CSV export endpoints; weekly `prune-audit-logs` cron |
| Internal-docs API / UI | `src/app/api/internal-docs/`, `src/app/internal-docs/`, `src/components/internal-docs/InternalDocEditor.tsx` |
| Auth `internal` flag | `src/lib/auth.ts` (jwt), `src/lib/auth.config.ts` (session); nav `src/components/layout/navItems.tsx` |
| Tier semantics | Lower tier = MORE protected. 0 = most restricted. Tier N grants N + all higher numbers in sector. |
| Migrations | hand-write SQL `prisma/migrations/<ts>_<name>/migration.sql` (idempotent). Auto-applied via `prisma migrate deploy` on prod deploy. Verify clean: `npx prisma migrate status` |
| Deploy | Render from `main` only. startCommand `npx prisma migrate deploy && npm start` (DASHBOARD-set, NOT render.yaml). Prod `ts2-lms` (`srv-d7eb0npj2pic73841ra0`), staging `ts2-lms-staging` (`srv-d83bv5btqb8s73dihi60`) tracks `dev`, **shares prod DB** `dpg-d7eb259f9bms738jscig-a` |
| DB creds | `DATABASE_URL` = hardcoded literal env var on BOTH services (NOT `fromDatabase`). Password rotation does NOT auto-propagate — must manually edit env + redeploy each service. |

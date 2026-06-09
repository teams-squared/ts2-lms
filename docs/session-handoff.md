# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler; preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-09
- Branch: `dev` (up to date with `origin/dev`)
- HEAD: `b848be3` — docs(handoff): regenerate snapshot at e16ae5f
- Tree: clean (only untracked local-only `.agents/`, `.claire/`, `.claude/settings.local.json`)
- Ahead of `origin/main`: 0 — release PR #47 merged + deployed

## What just shipped
**Sector+tier clearance + internal documentation repository — SHIPPED TO PROD.** Release PR #47 (`9c1ac5a`) merged dev→main, deploy `dep-d8js3ftckfvc73cmco30` live 2026-06-09 07:35.
- `e16ae5f` feat(internal-docs): gate /internal-docs to internal members (route 404 + nav `internal` flag)
- `bb227a5` refactor(courses): ModuleManager → shared `LessonContentEditor` (−237 lines)
- `a0b5ba3` feat(internal-docs): clearance-gated docs repo (CRUD API, video proxy, list/viewer/new/edit, audit)
- `47f20c2` feat(clearance): set sector+tier requirements on courses
- `3eff134` feat(clearance): rework free-text → sector+tier compartment model (schema, migration, lib)
- `ac787c9` feat(clearance): Sector admin API + manager UI

**Deploy mechanism changed.** Prod startCommand now `npx prisma migrate deploy && npm start` (was hand-rolled `prisma/migrate.ts && seed.ts`). Changed in Render **dashboard** (blueprint `render.yaml` detached/stale — editing it does NOTHING; change live command in dashboard). Migrations now AUTO-APPLY on deploy. Migration `20260605000000_add_sector_tier_clearance` applied + verified: Sector/InternalDoc/InternalDocView/ResourceClearanceRequirement tables present, UserClearance.tier+sectorId present, dead Course.requiredClearance + UserClearance.clearance dropped. `_prisma_migrations` clean (pre-merge orphan row `20260527000000_add_iso_library_is_hidden` deleted).

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Seed clearance + internal-docs — feature DORMANT until done.** Sign in as ADMIN:
  1. Create Sectors at `/admin/clearance`
  2. Grant clearances at `/admin/users/[id]`
  3. Set per-resource requirements (course edit + internal-doc edit)
  4. Add first docs at `/internal-docs/new`
- [ ] **Existing logged-in users re-login** to refresh JWT `internal` flag (nav "Internal docs" link hidden until then; route works regardless).
- [ ] **Backfill catch-up migration before any fresh DB.** `prisma/migrations/` folders do NOT create `DeadlineReminderLog` table + `Enrollment.completedAt` column (old `migrate.ts` made them). Fine for persistent prod DB; a fresh DB built by `migrate deploy` alone breaks. Bites if `ts2-lms-staging` ever gets own DB (shares prod now).
- [ ] **Sync or delete `render.yaml`.** Detached from live service — startCommand/buildCommand differ. Stale blueprint = footgun. Either update to match dashboard (`migrate deploy`, no seed) or drop it.
- [ ] **Triage Dependabot vulns** (~6 high) — `https://github.com/teams-squared/ts2-lms/security/dependabot`.
- [ ] **Curate first docs into `/policies` library** — `PublicIsoDoc` count still 0. `/admin/iso` → Public library tab.
- [ ] **Eyeball mobile on real S24** — PR #43 (prior release) never got live 360px pass.

## Open questions / decisions
- Cosmetic stale row remains: `20260512000000_add_manual_reminder_log` rolled_back (has successful sibling; `migrate deploy` ignores it, harmless). Gated on: nobody — leave or clean cosmetically.
- More entry points to `/policies`? Gated on: product call.
- Wire React `<ViewTransition>` course-card morph. Gated on: React 19.x exporting `ViewTransition` (undefined in 19.2.4).
- Right-rail on lesson player (notes/transcript/resources). Gated on: product call.
- Resend subdomain `lms.teamsquared.io`. Gated on: paid plan or deliverability incident.

## Pickup pointer
Internal-docs LIVE but dormant — seed it: ADMIN creates Sectors at `/admin/clearance`, grants clearances at `/admin/users/[id]`, sets resource requirements, adds first docs at `/internal-docs/new`. Then re-login to surface nav link.

---

## Where things live
| Concern | Location |
|---|---|
| Clearance model (sector+tier) | `prisma/schema.prisma` (Sector, UserClearance, ResourceClearanceRequirement, InternalDoc, InternalDocView) |
| Clearance logic | `src/lib/clearance.ts` (ANY-satisfies read, ALL-satisfies author) |
| Course gate | `src/lib/course-eligibility.ts` (`clearanceLocked`/`clearanceHint`) |
| Internal-docs API | `src/app/api/internal-docs/` (route, [id], [id]/video proxy) |
| Internal-docs UI | `src/app/internal-docs/`, `src/components/internal-docs/InternalDocEditor.tsx` |
| Shared content editor | `src/components/courses/LessonContentEditor.tsx` (courses + internal-docs) |
| Shared req editor | `src/components/courses/ClearanceRequirementEditor.tsx` |
| Sector admin | `/admin/clearance`, `src/app/api/admin/sectors/`, `src/components/admin/SectorManager.tsx` |
| Auth `internal` flag | `src/lib/auth.ts` (jwt callback), `src/lib/auth.config.ts` (session) |
| Nav config | `src/components/layout/navItems.tsx` (`getVisibleNavItems(role, internal)`) |
| Tier semantics | Lower tier = MORE protected. 0 = most restricted. Tier N grants N + all higher numbers in that sector. |
| Migrations | hand-write SQL in `prisma/migrations/<ts>_<name>/migration.sql` (idempotent). NOW auto-applied via `prisma migrate deploy` on prod deploy. Verify clean history pre-release: `npx prisma migrate status` |
| Deploy | Render, from `main` only. startCommand `npx prisma migrate deploy && npm start` (dashboard-set, NOT render.yaml). `ts2-lms` (`srv-d7eb0npj2pic73841ra0`), DB `dpg-d7eb259f9bms738jscig-a` |
| Staging | `ts2-lms-staging` (`srv-d83bv5btqb8s73dihi60`) tracks `dev`, shares prod DB |

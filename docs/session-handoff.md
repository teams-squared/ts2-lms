# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler; preserve paths, SHAs, commands exact.

## Last sync
- Date: 2026-06-05
- Branch: `dev` (up to date with `origin/dev`)
- HEAD: `e16ae5f` — feat(internal-docs): gate library to internal members only
- Tree: clean (only untracked `scripts/check-akil-progress.ts`, operator-owned local script)
- Ahead of `main`: 63 commits

## What just shipped
Session built **sector+tier clearance rework** + **internal documentation repository**. 6 commits:
- `e16ae5f` — gate /internal-docs to internal members (route 404 + nav `internal` flag)
- `bb227a5` — refactor ModuleManager to shared `LessonContentEditor` (−237 lines)
- `a0b5ba3` — clearance-gated internal-docs repo (CRUD API, video proxy, list/viewer/new/edit, audit)
- `47f20c2` — set sector+tier requirements on courses (revives dormant gate)
- `3eff134` — clearance reworked free-text → sector+tier compartment model (schema, migration, lib, eligibility)
- `ac787c9` — Sector admin API + manager UI
All green: 1314 tests, lint + tsc clean. No PRs opened.

## In-flight
Working tree clean.

## Pending external actions
- [ ] **Apply migration — via `dev → main` release ONLY.** Migration `prisma/migrations/20260605000000_add_sector_tier_clearance` written but NOT applied. Drops `Course.requiredClearance` + `UserClearance.clearance`, which the currently-deployed `main` app still reads — applying standalone breaks prod. Deploy from `main` runs `prisma migrate deploy` with the new code together. **Do NOT run `prisma migrate dev` locally** — `DATABASE_URL` points at the Render **prod** Postgres.
- [ ] **Seed after deploy:** feature dormant until an admin creates Sectors at `/admin/clearance`, then grants clearances at `/admin/users/[id]` and/or sets course/doc requirements. No sectors = nothing usable.
- [ ] **Existing logged-in users re-login** post-deploy to refresh JWT `internal` flag (nav "Internal docs" link hidden until then; route works live regardless).
- [ ] **New-machine setup:** `git clone` → `npm install` (postinstall runs `prisma generate`) → populate `.env` / `.env.local` (`DATABASE_URL`=Render prod, `AZURE_AD_*`, `AUTH_SECRET`; `ALLOW_PASSWORD_LOGIN=true` for local sign-in). Verify: `npm test`, `npx tsc --noEmit`, `npm run lint`.

## Open questions / decisions
- Ship clearance + internal-docs to prod. Gated on: operator explicit ask to open `dev → main` release PR.
- ModuleManager refactor manual visual pass (course lesson editor, all types). Gated on: migration applied (course edit page now queries `Sector` + `ResourceClearanceRequirement`, absent in live DB until deploy).

## Pickup pointer
When operator says ship: open `dev → main` release PR — that deploy applies the migration AND ships clearance + internal-docs together (only safe ordering). Then seed Sectors + grants.

## Where things live
| Concern | Location |
|---|---|
| Clearance model (sector+tier) | `prisma/schema.prisma` (Sector, UserClearance, ResourceClearanceRequirement, InternalDoc, InternalDocView) |
| Clearance logic | `src/lib/clearance.ts` (satisfies/author/filter; ANY-satisfies read, ALL-satisfies author) |
| Course gate | `src/lib/course-eligibility.ts` (`clearanceLocked`/`clearanceHint`) |
| Internal-docs API | `src/app/api/internal-docs/` (route, [id], [id]/video proxy) |
| Internal-docs UI | `src/app/internal-docs/`, `src/components/internal-docs/InternalDocEditor.tsx` |
| Shared content editor | `src/components/courses/LessonContentEditor.tsx` (courses + internal-docs) |
| Shared req editor | `src/components/courses/ClearanceRequirementEditor.tsx` |
| Sector admin | `/admin/clearance`, `src/app/api/admin/sectors/`, `src/components/admin/SectorManager.tsx` |
| Auth `internal` flag | `src/lib/auth.ts` (jwt callback), `src/lib/auth.config.ts` (session) |
| Nav config | `src/components/layout/navItems.tsx` (`getVisibleNavItems(role, internal)`) |
| Tier semantics | Lower tier = MORE protected. 0 = most restricted. Holding tier N grants N + all higher numbers in that sector. |
| Migrations | hand-write SQL in `prisma/migrations/<ts>_<name>/migration.sql` (idempotent); never `migrate dev` vs prod DB |
| Deploy | Render, from `main` only. `dev` = integration branch |

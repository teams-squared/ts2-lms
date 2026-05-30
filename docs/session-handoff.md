# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler. Code blocks, paths, URLs preserved exactly.

## Last sync

- **When:** 2026-05-30
- **Branch:** `dev`
- **HEAD:** `347b498` — `chore: gitignore local mobile-verification screenshots`
- **`main`:** `36a35e6` — merge of PR #43. Auto-deployed to learn.teamsquared.io via Render (deploy `dep-d8d20nflk1mc73d9lg50`, live 2026-05-29 23:27).
- **`dev` vs `main`:** 0 commits ahead. Just-merged release.
- **Working tree:** clean. `.agents/`, `.claire/` untracked, local-only.
- **Open PRs:** none.

## What just shipped

Three prod releases since last sync, all schema-free (no migrations).

**PR #43 — mobile responsive pass (S24-ready).** `36a35e6`.
- `50b2751` `feat(mobile): hamburger nav drawer for touch devices` — app sidebar was hover-to-expand (dead on touch). Hidden below `md`, replaced by tap-friendly hamburger + slide-in drawer (`MobileNav`) in top bar. Nav config extracted to shared `src/components/layout/navItems.tsx` so desktop `Sidebar` + mobile drawer can't drift.
- `4a8fe00` `feat(mobile): responsive pass across pages, tables, and components` (19 files) — scrollable admin tabs, viewport-capped dropdowns/notifications, stacked headers/CTAs/forms/filters, clamped lesson-viewer heights, larger touch targets. Mobile-first only; desktop unchanged at breakpoints.
- `6e89938` `test(mobile): add 360px screenshot spec` — `e2e/mobile-screenshots.spec.ts`. NOT in CI (needs non-prod DB + password login).
- `347b498` `chore: gitignore local mobile-verification screenshots`.

**PR #42 — invite improvements.** `a2f3e05` (live 2026-05-29 17:49).
- `e51ac05` `feat(invite): autofill org domain for bare usernames` — `akil` -> `akil@teamsquared.io`; full addresses pass through. Shared `src/lib/inviteEmail.ts` `normalizeInviteEmail` keeps client display + server validation in sync.
- `ca4e4b6` `feat(invite): advisory Entra directory check before sending` — invite form looks up address in tenant via Graph app-only token, shows inline in-directory/not-found/disabled hint on email blur. Fail-open: warns, never blocks; silent if Graph unconfigured. Matches members by mail/UPN, guests by otherMails. Code: `src/lib/entra/graph.ts`, `src/app/api/admin/users/lookup/route.ts`.

## In-flight

_None._ Working tree clean. No `wip/*` branch open.

## Pending external actions

- [ ] **Eyeball mobile on real S24.** Releases #43 shipped on green CI + static review only — live 360px screenshot pass NOT run (only configured local DB is prod; project forbids seeding password users there). Open `https://learn.teamsquared.io` on actual phone (or `https://ts2-lms-staging.onrender.com`, or Chrome DevTools device mode @ 360px). Check nav drawer + couple admin pages. To run committed spec: needs non-prod DB seeded w/ `e2e/helpers.ts` USERS + `ALLOW_PASSWORD_LOGIN=true`.
- [ ] **Curate first docs into `/policies` library.** Library serves but `PublicIsoDoc` row count = 0. Sign in as ADMIN -> `/admin/iso` -> **Public library** tab -> add via paste-link, browse SP picker, or **From lesson…**.
- [ ] **Clean 2 stale `_prisma_migrations` rows.** Both `rolled_back`, both cosmetic — underlying schema verified present, hand-rolled `prisma/migrate.ts` ignores them:
  - `20260512000000_add_manual_reminder_log` (2026-05-11) — `ManualReminderLog` table exists.
  - `20260527000000_add_iso_library_is_hidden` (2026-05-27) — `PublicIsoDoc.isHidden` column exists.
  ```sh
  DATABASE_URL="<prod url>" npx prisma migrate resolve --applied 20260512000000_add_manual_reminder_log
  DATABASE_URL="<prod url>" npx prisma migrate resolve --applied 20260527000000_add_iso_library_is_hidden
  ```
  Both cleared automatically by the open "switch `render.yaml` to `prisma migrate deploy`" item below.
- [ ] **Triage Dependabot vulns.** Recent pushes report ~17 vulnerabilities (6 high, 10 moderate, 1 low) on default branch. Check `https://github.com/teams-squared/ts2-lms/security/dependabot`.

## Open questions / decisions

- **Release merges use admin-bypass.** PRs #41/#42/#43 all admin-merged past the required-review gate (no second reviewer available). If a reviewer joins, drop the bypass.
- **More entry points to `/policies`?** Today only sidebar. Gated on: product call.
- **Wire React `<ViewTransition>` shared-element morph (course card -> detail).** `experimental.viewTransition: true` set in `next.config.ts`. Gated on: React 19.x exporting `ViewTransition` (currently `undefined` in 19.2.4).
- **Right-rail on lesson player (notes / transcript / resources).** `LessonPlayerShell` reserves slot via `side` prop; no consumer wires it. NOTE: real lesson page uses `CourseSidebar` (has own mobile overlay), NOT `LessonPlayerShell` (currently unused). Gated on: product call.
- **Custom PDF toolbar (`react-pdf`).** Today iframe with `#toolbar=0&navpanes=0&scrollbar=0&view=FitH` is §8.12 acceptable fallback. Gated on: someone caring enough to swap.
- **Switch `render.yaml` from custom `prisma/migrate.ts` to `prisma migrate deploy`.** Auto-applies migrations folder. Gated on: non-launch deploy window. Would also fix the stale-row issue above.
- **Resend subdomain (`lms.teamsquared.io`) for sender isolation.** Gated on: paid plan or deliverability incident.
- **Server-side dwell enforcement for POLICY_DOC.** Client gate bypassable via DevTools. Gated on: auditor pushback.
- **Email retry / dead-letter queue.** All sends fire-and-forget. Gated on: first Resend outage.
- **Manual-reminder cooldown / abuse guard.** `ManualReminderLog` no dedupe by design. Gated on: user complaint.

## Pickup pointer

Eyeball mobile pass on a real S24 (or staging / DevTools @ 360px) — releases #43 shipped without live visual verification. Check nav drawer opens + closes on route change, and that no admin page (users, analytics, progress) forces full-page horizontal scroll. Any breakage = fast Tailwind follow-up. Then triage 6 high-severity Dependabot vulns.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Design system | `docs/teams-squared-lms-design-system.mdx` |
| Motion tokens + utilities | `src/app/globals.css` (`--duration-*`, `--ease-*`, `.surface-interactive`, `.hover-lift`, `.skeleton-shimmer`, `.animate-progress-affirm`) |
| Motion primitives | `src/components/ui/RevealOnView.tsx`, `src/components/ui/AnimatedNumber.tsx`, `src/components/ui/FormButton.tsx` |
| App shell (desktop sidebar + topbar + main) | `src/components/layout/DashboardShell.tsx`, `Sidebar.tsx`, `TopBar.tsx` |
| Mobile nav | `src/components/layout/MobileNav.tsx` (hamburger drawer, `md:hidden`), shared config `navItems.tsx` |
| Lesson page shell | real page uses `src/components/courses/CourseSidebar.tsx` (own mobile overlay); `LessonPlayerShell.tsx` unused |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Entra directory lookup (app-only Graph) | `src/lib/entra/graph.ts`, `src/app/api/admin/users/lookup/route.ts` |
| Invite email normalize | `src/lib/inviteEmail.ts`, `src/app/api/admin/users/invite/route.ts`, `src/components/admin/InviteUserForm.tsx` |
| Course access + CM scoping | `src/lib/courseAccess.ts` |
| Outbound email | `src/lib/email.ts` |
| Admin ISO surface | `src/app/admin/iso/page.tsx`, `src/components/admin/IsoAckLog.tsx`, `IsoCoverage.tsx`, `PublicIsoLibraryManager.tsx` |
| Public policies library | `src/app/policies/page.tsx`, `src/app/policies/[id]/page.tsx` |
| Policy-doc viewer (lesson + public) | `src/components/courses/PolicyDocViewer.tsx` — `acknowledgementMode` prop switches dwell/ack on/off |
| SharePoint allowlist (IDOR gate) | `src/lib/sharepoint/allowlist.ts` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied) | `prisma/migrations/`, `scripts/verify-prod-migrations.ts` |
| Render deploy config | `render.yaml`. Services: `ts2-lms` (`main` -> prod, `srv-d7eb0npj2pic73841ra0`), `ts2-lms-staging` (`dev` -> staging, shared DB, `srv-d83bv5btqb8s73dihi60`) |
| LMS prod DB | `dpg-d7eb259f9bms738jscig-a` (`ts2-lms-db`) — Render MCP, Teams Squared workspace |
| Mobile verification spec | `e2e/mobile-screenshots.spec.ts` (not in CI) |
| Tests (vitest) | `src/__tests__/` — 145 files, 1259 tests |
| Coverage thresholds | `vitest.config.ts` (lib ≥80%, components ≥70%) |

## Reminders

- `canManageCourse(userId, role, courseId)` = single gate for course-edit authority. ADMIN bypasses m2m; CM must be in `Course.managers`.
- `prisma/migrate.ts` = hand-rolled idempotent SQL bootstrap. New `prisma/migrations/*` folders apply manually via `npx prisma db execute --file <path>`. Use `scripts/verify-prod-migrations.ts` for drift detection.
- After rebasing onto a parallel push that added a dep or schema field: `npm install && npx prisma generate` to clear phantom local `tsc` errors. CI does this automatically.
- Entra directory check (`User.Read.All` Application grant) is LIVE + verified — invite badges active in prod.
- `PolicyDocViewer` `acknowledgementMode`: `"required"` (default, lesson flow w/ dwell + ack) vs `"none"` (public library, metadata + iframe).
- Resend SDK v6 returns `{data, error}` — never throws. Always destructure + check `error`.
- No em-dashes in user-facing copy (design-system §8.13). Code comments exempt.
- `.hover-lift` is the canonical card-hover class. Don't roll bespoke hover patterns.
- Mobile-first responsive rule: base classes target 360px, add `sm:`/`md:`/`lg:` for larger. Desktop must stay identical at its breakpoints.
- Reduced-motion must short-circuit JS event handlers in addition to the CSS kill-switch (RevealOnView + AnimatedNumber show the pattern).
- `git fetch --all` before any "check remote" question — local refs go stale, parallel agents may have pushed.

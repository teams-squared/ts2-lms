# Polish backlog

Refinement work for the **feature-complete** LMS. Nothing here is a missing
feature — these are polish, hardening, and consistency items surfaced by a
five-dimension audit (accessibility, performance, UX/design-system, robustness,
metadata/SEO + hygiene).

- **Generated:** 2026-06-23 · against `cb5d865` (audit run on `dev`)
- **Method:** parallel audit agents reading actual source + grep sweeps; every
  finding cites `file:line`. Confirm at implementation time (line numbers drift).
- **Legend:** Effort **S/M/L** · Impact **H/M/L** · `[BUG]` = actual defect, not
  just a nicety.

> The design-system rules cited (§x.y) live in
> `docs/teams-squared-lms-design-system.mdx`.

---

## Shipped

Tier 1A + all of Tier 2 are done (each verified: tsc clean, eslint 0 errors,
vitest 1356/1356; metadata commit also `next build` green).

- **`f3e175b`** — Tier 1A metadata: `robots` noindex + `robots.ts`,
  `metadataBase`, title template + per-page titles (`generateMetadata` for
  course/lesson/policy), OpenGraph, viewport `themeColor` (covers A1–A4, Q1).
- **`be3d278`** — Q2 `focus:`→`focus-visible:` sweep (17 files), Q3 aria-live
  on AchievementToast, Q6 `DATABASE_URL` startup guard (+ vitest dummy env),
  Q8 `hover:bg-primary/90` bug, Q9 console gating, error-boundary copy.
- **`dcc5d5b`** — Q4 native `confirm()` → `ConfirmDialog`, Q5 six admin
  `loading.tsx` skeletons.
- **`ba3fa64`** — Q7 sentence-case CTAs + em-dashes dropped from labels.

**Remaining:** Tier 1B (perf N+1s — B4 needs a DB migration, prod-shared DB so
needs operator sign-off), Tier 1C (a11y modal focus-traps), Tier 3
(Button-primitive adoption, `cn()` sweep, robustness hardening, date helper,
dnd dynamic import, accent-color tokens, etc.).

---

## Tier 1 — High impact, do first

### A. Metadata & SEO foundation (self-contained, big visible win)

| # | Item | File | Eff·Imp |
|---|------|------|---------|
| A1 | **No `robots` directive** — entire authed app (`/admin/*`, lessons, `/profile`, `/internal-docs`) is crawler-indexable. Add `robots:{index:false,follow:false}` to root metadata + a `src/app/robots.ts` returning `disallow: '/'`. | `src/app/layout.tsx:27` | S·H |
| A2 | **Missing `metadataBase`** → relative/broken OG + canonical URLs; Next warns/silently breaks absolute `<meta>` URLs. Use `new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.teamsquared.io')` (env already read in `src/lib/email.ts`). Prerequisite for all OG work. | `src/app/layout.tsx:27` | S·H |
| A3 | **Zero per-page `<title>`** — every tab reads "Teams Squared LMS". Add `generateMetadata` to dynamic pages (course/lesson/policy — the DB call is request-deduped, data already fetched at render) and static `metadata` to the rest; cover admin via `admin/layout.tsx`. | `src/app/courses/[id]/page.tsx:32`, `.../lessons/[lessonId]/page.tsx:40`, `policies/[id]/page.tsx:23`, + all `page.tsx` | M·H |
| A4 | **No OpenGraph anywhere** — link previews in Teams/Slack fall back to scraped text. Add a minimal root `openGraph` block (depends on A2). | `src/app/layout.tsx:27` | S·M |

### B. Performance N+1s (real query-count cost)

| # | Item | File | Eff·Imp |
|---|------|------|---------|
| B1 | `GET /api/courses` calls **unbatched** `checkCourseEligibility` per course in a `Promise.all(map)` → 2N–4N DB round-trips. `checkCourseEligibilityBatch` already exists and is used correctly by the catalog RSC (`courses/page.tsx:177`). Swap it in. | `src/app/api/courses/route.ts:54` | S·H |
| B2 | `/api/admin/analytics` `getCourseMetrics` runs `lessonProgress.count` per **user×course** (O(C×U), potentially hundreds). The RSC version (`admin/analytics/page.tsx`) already batches via `groupBy` — mirror it. | `src/app/api/admin/analytics/route.ts:86` | M·H |
| B3 | `achievements.countCompletedCourses` fires `1 + 2E` queries (module.findMany + lessonProgress.count per enrolled course) — runs **synchronously on every lesson completion** via `checkAndAwardAchievements`. Collapse to 2 aggregate queries. | `src/lib/achievements.ts:111` | M·H |
| B4 | **Missing `@@index([userId, read])`** on `Notification` — `count({where:{userId,read:false}})` is polled every 60s by `NotificationBell`, plus the mark-all-read `updateMany`. Table-scans without it. | `prisma/schema.prisma:508` | S·H |
| B5 | `getUserMetrics` includes full `lessonProgress` rows just to take `.length` (up to ~20k ORM rows). Replace with `_count`. | `src/app/api/admin/analytics/route.ts:127` | S·M |
| B6 | Dashboard enrollment query uses `include` (not `select`) on `modules`, pulling all module scalars per enrollment. Narrow to `select`. | `src/app/page.tsx:62` | S·M |
| B7 | Notification `findMany` + `count` are sequential `await`s — wrap in `Promise.all`. | `src/app/api/notifications/route.ts:12` | S·M |
| B8 | `@dnd-kit/*` (~40KB) statically imported into the course-edit client bundle via `Sortable`. `dynamic(..., {ssr:false})` the editor components. | `Sortable.tsx` ← `ModuleManager.tsx:13`, `QuizBuilder.tsx:7`, `AssessmentBuilder.tsx:7` | M·M |

### C. Accessibility blockers

| # | Item | File | Eff·Imp |
|---|------|------|---------|
| C1 | Hand-rolled lesson-edit modal — raw `div` overlay, no focus trap/restore, no `role="dialog"`/`aria-modal`. Swap to the existing Radix `Dialog`. | `src/components/courses/ModuleManager.tsx:799` | M·H |
| C2 | Form error `<p>`s not linked to inputs via `aria-describedby` (SR users never hear why submit failed). `PolicyDocViewer.tsx:421` shows the correct pattern. | `QuizBuilder.tsx:431`, `ModuleManager.tsx:884`, `InviteUserForm.tsx:455` | S·H |
| C3 | `NotificationBell` popover — no `aria-expanded`/`aria-haspopup` on trigger, no Escape-to-close. | `src/components/layout/NotificationBell.tsx:87` | S·H |
| C4 | QuizBuilder "mark correct" radios labelled only by `title` (not an accessible name). Wrap in `<label>` like QuizViewer/AssessmentViewer already do. | `src/components/courses/QuizBuilder.tsx:396` | S·H |
| C5 | `AdminCourseTable` table has no `overflow-x-auto`/`min-w` wrapper → clips on mobile. `UserTable.tsx:115` is the reference. | `src/components/courses/AdminCourseTable.tsx:385` | S·H |
| C6 | `CourseSidebar` mobile overlay marked `aria-modal` but has no focus trap. Use the `Sheet` primitive. | `src/components/courses/CourseSidebar.tsx:268` | M·M |
| C7 | `InviteUserForm` typeahead has `role="listbox"` but no keyboard nav / `aria-activedescendant` / `role="option"`. Make it spec-compliant or downgrade to a menu. | `src/components/admin/InviteUserForm.tsx:594` | M·M |

---

## Tier 2 — Quick wins (S effort, high polish-per-edit)

| # | Item | File | Eff·Imp |
|---|------|------|---------|
| Q1 | Add `themeColor` to the `viewport` export (mobile browser chrome). | `src/app/layout.tsx:32` | S·L |
| Q2 | `focus:ring` → `focus-visible:ring` (rings currently show on mouse click; rest of app uses `focus-visible`). Batch find/replace. | `SectorManager.tsx:180,200,215,255,271`, `CourseProgressTable.tsx:80`, `MarkingDetail.tsx:378`, `ModuleManager.tsx:509`, `ChangePasswordForm.tsx:108,123,137` | S·M |
| Q3 | `AchievementToast` has no `aria-live` — SR never announces unlocks. Add `role="status" aria-live="polite"` (mirror `Toast.tsx:83`). | `src/components/gamification/AchievementToast.tsx:32` | S·M |
| Q4 | Native `confirm()` for a destructive delete — only outlier; replace with `ConfirmDialog`/`AlertDialog` (§8.3), pattern at `NodeManager.tsx:327`. | `src/components/admin/PublicIsoLibraryManager.tsx:212` | S·H |
| Q5 | 6 admin routes missing `loading.tsx` → blank shell on nav (§16). Reference: `admin/users/loading.tsx`. | `admin/{assignments,clearance,nodes,marking,settings}/`, `admin/users/[userId]/` | M·M |
| Q6 | `DATABASE_URL!` non-null assertion → cryptic crash if unset. Add a startup guard (pattern: `auth.ts:9` for `AUTH_SECRET`). | `src/lib/prisma.ts:7` | S·M |
| Q7 | **Microcopy pass** (§8.13): Title-Case buttons → sentence case (`CourseForm.tsx:34` "Create Course", `QuizViewer.tsx:240,384`); em-dashes in UI strings (`AssessmentViewer.tsx:598,715`, `InternalDocEditor.tsx:82`); "Something went wrong" → actionable copy. **Update the test fixtures that assert these strings.** | see cells | S·M |
| Q8 | **`[BUG]`** `hover:bg-primary/90` (opacity dimming as hover — forbidden §3.4) instead of `hover:bg-primary-hover`. | `src/app/courses/error.tsx:26` | S·M |
| Q9 | Gate `console.info` (email skip paths) and error-boundary `console.error` on `NODE_ENV` (noise + minor info disclosure to browser console). | `src/lib/email.ts:306,384,476,557`; `app/error.tsx:14`, `courses/error.tsx:13`, `admin/error.tsx:13` | S·M |

---

## Tier 3 — Consistency & tech-debt (M effort)

| # | Item | File | Eff·Imp |
|---|------|------|---------|
| T1 | Adopt the shared `<Button>` primitive — ~15 hand-rolled `bg-primary` buttons drift from the CVA def (§8.1). | `QuizViewer.tsx:238,320,382,403`, `AssessmentViewer.tsx:590,692,775`, `AssessmentBuilder.tsx:381,538,837,877`, `CourseEditor.tsx:244,281,317`, `UserDetailManager.tsx:254,325`, … | M·M |
| T2 | Use `cn()` for conditional classes, never template literals (§13) — template literals don't merge conflicting Tailwind utilities. | `CourseStatusBadge.tsx:36`, `AchievementCard.tsx:23,32`, `Toast.tsx:81,85`, `CourseSidebar.tsx`, `lessons/[lessonId]/page.tsx:352,371,381` | M·M |
| T3 | **Robustness hardening** — guard `request.json()` against malformed bodies (~19 routes throw → 500 not 400); return **404 not 500** on update-by-unknown-id (Prisma P2025, e.g. `admin/users/route.ts:44`); standardize on zod (~34 of 48 mutation routes are ad-hoc cast-then-manual-validate, e.g. `admin/users/route.ts:29`). | `src/app/api/**/route.ts` | M·M |
| T4 | Shared `formatDate()` helper — 9 bare `toLocaleDateString()` calls render per-OS-locale (US vs UK vs JP). For feeds use relative time. | `NotificationBell.tsx:135`, `UserTable.tsx:174`, `admin/page.tsx:94,121`, `AchievementCard.tsx:44`, `UserList.tsx:168`, `EnrollmentManager.tsx:230` | S·M |
| T5 | Dashboard category-accent strips use hardcoded hex / Tailwind-default colors as inline `style` (forbidden §3.4). Tokenize or use `bg-primary-subtle`. | `CourseProgressList.tsx:93,107,113`; map in `icons.tsx:366` | M·M |
| T6 | `global-error.tsx` off-brand purple `#7c3aed` (inline styles are architecturally forced here, but use the real `--primary` `#5006E3`) + vague heading. | `src/app/global-error.tsx:25` | S·M |
| T7 | `eslint-disable @typescript-eslint/no-explicit-any` on a Prisma-shaped `normalize(node: any)` — recover the type via `Prisma.CourseNodeGetPayload<...>`. | `src/lib/courseNodes.ts:55` | M·M |
| T8 | Partial Azure-AD env config silently registers a broken NextAuth provider; `entra/graph.ts` reads the same vars unguarded. Add a startup validation block. | `auth.config.ts:46`, `login/page.tsx:11`, `entra/graph.ts:13` | S·L |

---

## Already solid (audited, not invented)

- **Radix `Dialog`/`Sheet`/`AlertDialog`** primitives — focus trap, `sr-only`
  close labels, `focus-visible` rings all correct.
- **`MobileNav` / `Sidebar`** — `aria-label`, `aria-current="page"`,
  `aria-pressed`, ≥44px touch targets.
- **Toast system** — `role="status" aria-live="polite"`, used consistently on
  mutation paths; admin destructive actions use `ConfirmDialog` (one outlier: Q4).
- **DB indexes** — `Enrollment`/`LessonProgress`/`AuditLog`/`QuizAttempt`/
  `AssessmentSubmission` hot paths covered by `20260417000000_add_perf_indexes`
  (gap: Q B4).
- **Error handling** — no empty `catch {}` anywhere; SharePoint proxy already
  DB-cached; only prod `<img>` (`UserAvatar`) is `loading="lazy"`.
- **Semantic color tokens** — learner-facing lesson/quiz UI uses
  `text-success`/`text-danger`/`bg-primary-subtle` correctly.

---

## Suggested execution order

1. **Tier 1A (Metadata/SEO)** — one coherent commit, no behavioural risk, high
   visible win. Start with A1+A2+Q1 (one file) then A3.
2. **Tier 2 quick wins** — batch the S-effort items; each is low-risk. Remember
   Q7 touches test fixtures.
3. **Tier 1B (Performance)** — needs the test suite green (`npx vitest run`) and
   a migration for B4; biggest backend win.
4. **Tier 1C (a11y) + Tier 3** — as capacity allows.

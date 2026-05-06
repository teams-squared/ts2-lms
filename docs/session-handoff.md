# Session handoff

> Read this after `CLAUDE.md`. Regenerate via the `/prep` slash command
> (or "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates, regenerate.

## Last sync

- **When:** 2026-05-04
- **Branch:** `dev`
- **HEAD:** `d173a9e` — `feat(lessons): add LINK lesson type for external articles`
- **Working tree:** clean for handoff purposes. Two non-deliverable local
  files present and intentionally ignored:
  - `.claude/settings.local.json` (modified — local IDE prefs, not for commit)
  - `.claire/` (untracked — local-only directory)
- **Open PRs (`dev → main`):** PR #32 — "Release: LINK lesson type +
  em-dash purge" — covers `d343a7f` + `d173a9e`. Not merged yet.

## What just shipped

Last eight meaningful commits on `dev`:

1. `d173a9e` `feat(lessons): add LINK lesson type for external articles`
   — New `LINK` lesson type. Content: `{url, blurb?}` JSON. Viewer
   renders an "Open article" CTA card; clicking fires the
   `policy-doc-acknowledgeable` event so Mark complete unlocks (same
   pattern as DOCUMENT). URL-validated to `http(s)` only. Admin
   authoring in ModuleManager + edit form; sidebar shows `LinkIcon`.
   Migration `20260507000000_add_lesson_type_link` adds the enum value.
   **In PR #32, not in main yet.**
2. `d343a7f` `chore(copy): purge em-dashes from user-facing strings`
   — 34 edits across 18 files. Rule codified in design-system §8.13.
   **In PR #32, not in main yet.**
3. `b7b1672` `docs(design): forbid em-dashes in user-facing copy (new section 8.13)`
   — Design-system doc update preceding the purge.
4. `34deb78` `feat(iso): harden audit evidence + add coverage view`
   — ISO 27001 gaps closed: attestation-text snapshot, dwell-seconds
   recording, SharePoint item-id snapshot, new `/admin/iso?tab=coverage`
   view + CSV export. Migration `20260506000000_add_iso_audit_evidence`.
   Merged to main via PR #31.
5. `78c30e4` `feat(iso): move ack log + CSV export to dedicated /admin/iso top-level tab`
   — Compliance evidence moved off `/admin/emails` into its own top-level
   admin tab. PR #30.
6. `bdca0a2` `fix(policy-doc): make dwell-timer gate visible to learners`
   — Timer banner now reads "Acknowledge unlocks in m:ss"; attestation
   row says "Locked for m:ss more". PR #29.
7. `2651670` `feat(iso-ack): in-app audit log + CSV export for ISO auditors`
   — Original ISO ack log surface (list + paginated table + CSV endpoint).
   PR #29.
8. `0c8bb82` `feat(iso-ack): make notification email disable-able via toggle`
   — `enabled` bool on `IsoNotificationSettings`; migration disables
   existing singleton on deploy. PR #29.

## In-flight

_None._ Working tree is clean.

## Pending external actions

- [ ] **Merge PR #32 when ready to ship LINK lessons + em-dash purge.**
  After merge, Render deploys from `main` automatically. Do not merge
  without explicitly asking.

- [ ] **Apply migration `20260507000000_add_lesson_type_link` to prod**
  after PR #32 merges. Adds `LINK` as a valid `LessonType` enum value.
  Run on the Render Shell:
  ```sh
  npx prisma migrate deploy
  ```
  Or apply the SQL directly:
  ```sql
  ALTER TYPE "LessonType" ADD VALUE IF NOT EXISTS 'LINK';
  ```
  **Must be applied before any LINK lessons are created in prod** —
  the enum value must exist first or Prisma will reject the write.

- [ ] **Confirm migration `20260506000000_add_iso_audit_evidence` applied
  to prod** (ships in PR #31, merged 2026-05-05). Adds three nullable
  cols to `LessonProgress`:
  ```sql
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'LessonProgress'
     AND column_name IN (
       'acknowledgedAttestationText',
       'acknowledgedDwellSeconds',
       'acknowledgedSharePointItemId'
     );
  -- expect 3 rows
  ```

- [ ] **Confirm migration `20260504000000_add_iso_settings_enabled` applied
  to prod.** Adds the `enabled` bool to `IsoNotificationSettings` and
  sets it to `false` on the existing row (stops quota bleed).
  ```sql
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'IsoNotificationSettings' AND column_name = 'enabled';
  SELECT enabled FROM "IsoNotificationSettings";
  ```

- [ ] **Confirm earlier migrations applied to prod** (`InviteEmailTemplate`,
  `EmailSignature`, `EmailSignature.disclaimer`):
  ```sql
  SELECT to_regclass('"InviteEmailTemplate"'), to_regclass('"EmailSignature"');
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'EmailSignature' AND column_name = 'disclaimer';
  ```

- [ ] **Confirm `EMAIL_FROM` on Render** is either unset (code default:
  `Teams Squared LMS <lms-noreply@teamsquared.io>`) or set to exactly
  that value.

- [ ] **Confirm `CRON_SECRET` is set on Render.** Wired as `sync: false`
  in `render.yaml`; must be set manually from the dashboard. Without it,
  the deadline-reminder cron returns 500 on every invocation.

- [ ] **Customize invite email + signature at `/admin/emails`.** Without
  an explicit save, the system falls back to the built-in default body.

- [ ] **Send a test batch invite end-to-end.** Invite 3+ personal
  addresses from `/admin/users`. Confirm: emails arrive (no 429s in
  Resend), SSO flow completes, course assignments visible, XP increments
  by 10 once, ISO ack audit row written with attestation/dwell/itemId
  columns populated, no console errors.

- [ ] **Smoke-test LINK lessons after PR #32 merges.** Create a LINK
  lesson in a test course, paste an `https://` URL, publish. Confirm:
  sidebar shows link icon, viewer renders the CTA card, clicking the
  link opens a new tab AND unlocks Mark complete, completing the lesson
  awards 10 XP once.

- [ ] **Smoke-test `/admin/iso?tab=coverage` on prod.** Coverage table
  loads, percentages match real enrollment data, "Download CSV" emits
  one row per outstanding (user × policy), drill-down links work.

- [ ] **Post-launch — npm vulns.** Two moderate-severity vulns flagged by
  GitHub Dependabot (`uuid`, `postcss`). Fixes require Next/Prisma version
  bumps. Plan a dedicated upgrade cycle within 6–8 weeks of launch.

## Open questions / decisions

- **Switch `render.yaml` from custom `prisma/migrate.ts` to
  `prisma migrate deploy`.** Would auto-apply migrations and avoid the
  manual apply step that now trails every deploy. Gated on a non-launch
  deploy window to observe regression.

- **Resend subdomain (`lms.teamsquared.io`) for sender reputation
  isolation.** Declined for now (subdomain verification easier on a paid
  Resend plan). Gated on tier upgrade or deliverability incident.

- **Server-side dwell enforcement for POLICY_DOC.** The 6-minute gate is
  client-side only (bypassable via DevTools). The `acknowledgedDwellSeconds`
  field now records what the client reports, clamped to `[0, 86400]`, but
  a determined client can still send exactly 360. Audit trail (hash /
  attestation text / item id) remains authoritative. Gated on auditor
  pushback.

- **Tamper-evidence on audit records.** `LessonProgress` rows are
  currently mutable by admins. ISO 27001 does not mandate a cryptographic
  ledger for ack records; mitigation is operational (restricted admin
  role, DB backups). Gated on auditor ask.

- **Per-policy override of attestation text.** Wording is hardcoded in
  `src/lib/policy-doc/attestation.ts`. Gated on a business need to vary
  wording per policy.

- **Quiz double-submit idempotency token.** Theoretical race in
  `quiz/attempt` on rapid double-click. Client disables button while
  submitting (small practical window). Gated on observed prod incident.

- **Email retry / dead-letter queue.** All sends are fire-and-forget
  (with a single 429 retry). Gated on first observed Resend outage
  causing a noticeable invite or ISO ack drop.

## Pickup pointer

The natural next move is **wait for operator sign-off on PR #32**, then
merge and apply the `20260507000000_add_lesson_type_link` migration.

While waiting: run the outstanding prod smoke tests (ISO coverage view,
dwell recording, batch invite end-to-end) to confirm the three recently
merged PRs are working correctly on prod.

If you continue without operator input: the only material code task left
is the npm-vulns upgrade cycle (Next, Prisma, etc.). Do not start that
without an explicit go-ahead — it is a multi-PR effort with regression
risk.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Outbound email + signature renderer | `src/lib/email.ts` |
| Admin email surface (Invite / Signature / ISO ack settings) | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx` |
| ISO compliance surface (ack log + coverage) | `src/app/admin/iso/page.tsx`, `src/components/admin/IsoAckLog.tsx` |
| ISO ack settings form (email toggle + recipients) | `src/components/admin/IsoNotificationSettingsForm.tsx` |
| Invite UI (single + batch, sequential throttle) | `src/components/admin/InviteUserForm.tsx` |
| Invite API (create user + enroll + email) | `src/app/api/admin/users/invite/route.ts` |
| ISO ack list + CSV export API | `src/app/api/admin/iso-acks/route.ts`, `src/app/api/admin/iso-acks/export/route.ts` |
| Lesson complete API (race-safe + ISO email hook) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Policy attestation text | `src/lib/policy-doc/attestation.ts` |
| Policy-doc viewer (PDF embed + dwell + attestation) | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| Lesson viewer (TEXT/VIDEO/DOCUMENT/HTML/LINK dispatch) | `src/components/courses/LessonViewer.tsx` |
| App shell sidebar (auto-collapsing rail) | `src/components/layout/Sidebar.tsx` |
| Course sidebar (auto-collapsing rail on lesson pages) | `src/components/courses/CourseSidebar.tsx` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied — see Pending) | `prisma/migrations/`, custom `prisma/migrate.ts` |
| Demo-user cleanup (one-shot) | `scripts/delete-demo-users.{sql,ts}` |
| Render deploy config | `render.yaml` |
| CI workflows | `.github/workflows/ci.yml`, `dependency-review.yml`, `deadline-reminders.yml` |
| Tests (vitest) | `src/__tests__/` |
| E2E (Playwright, NOT in CI) | `e2e/` |
| Design system reference | `docs/teams-squared-lms-design-system.mdx` |

## Hard-earned conventions

- `dev` → `main` via explicit PR only. Never push directly to `main`.
- The custom `prisma/migrate.ts` is hand-rolled idempotent SQL. New
  migrations in `prisma/migrations/` must be applied to prod manually.
- Resend SDK v6 returns `{data, error}` — it does NOT throw on failure.
  Always destructure and check `error`; never assume the call succeeds.
- The `lessonProgress` create-then-conditional-update pattern in the
  lesson-complete route is the reference for race-safe transition
  detection. Reuse the same shape for any other "fire side effects
  exactly once" surface.
- `react-markdown` v10 default behaviour escapes raw HTML — don't add
  `rehype-raw` to admin-authored markdown surfaces.
- The credentials provider is gated on `NODE_ENV !== "production"`.
  Demo seed users are gone. Local-dev bootstrap = SSO sign-in then
  SQL-promote per the file header in `prisma/seed.ts`.
- No em-dashes in user-facing copy (design-system §8.13). Exempt:
  code comments, JSDoc, `console.*`, and null-placeholder cells in
  data tables.

# Knowledge-graph insights

Answers to the questions surfaced by the `/graphify` knowledge graph of this
repo. Each answer is grounded against actual source, not just graph structure.

- **Generated:** 2026-06-23 · against `cb5d865`
- **Graph:** 1952 nodes · 4392 edges · 140 communities (513 code files via AST,
  21 docs/images via LLM extraction)
- **Method:** structural (AST) + semantic extraction. Inferred `calls` edges
  were re-verified by reading every cited route handler.
- **Regenerate:** `/graphify` (outputs land in gitignored `graphify-out/`).

---

## Headline

The codebase has a small set of **god nodes** and they tell a coherent story:
the two things every module touches are **authorization** (`requireRole`,
`Role`, `canManageCourse`) and the **Tailwind class helper** (`cn`). Everything
else clusters cleanly by feature. The graph found no architectural surprises —
the load-bearing abstractions are exactly the ones you'd want load-bearing.

| God node | Edges | What it is |
|---|---|---|
| `cn()` | 133 | Tailwind class-merge helper (`clsx` + `tailwind-merge`) |
| `requireRole()` | 99 | Role-gate guard for API routes |
| `Role` | 74 | The `employee` \| `course_manager` \| `admin` type |
| `canManageCourse()` | 63 | Per-course management authorization |
| `mockPrisma` | 62 | Shared Prisma test double |
| `writeAuditLog()` | 54 | Audit-trail writer |

---

## Q1 — Why does `cn()` bridge ~20 UI communities?

**Because it is the single styling primitive every component imports.**

`cn()` (`src/lib/utils.ts`) is three lines — `twMerge(clsx(inputs))` — and the
design system (Section 11.5) mandates it over template-literal class
composition. So every shadcn primitive, every dashboard widget, every admin
table calls it. Its betweenness (0.090, the highest in the graph) is therefore
an artifact of a **convention**, not a coupling problem: `cn` carries no domain
logic and creates no real dependency between the communities it links. It is the
healthiest possible kind of god node — a pure, stateless leaf utility.

**Verdict:** Expected and benign. No action.

## Q2 — Why does `Role` bridge ~30 communities (auth → nearly everything)?

**Because `Role` is the spine of role-based access control, and almost every
route, admin panel, and eligibility check makes a role decision.**

`Role` (`src/lib/types.ts`) is a 3-value union ranked by `ROLE_LEVEL` in
`src/lib/roles.ts`: `employee:1`, `course_manager:3`, `admin:4`. The ranking
powers `hasAccess()`, which powers `requireRole()`, which gates the API; it also
flows into `canManageCourse()`, course eligibility, the invite flow, and admin
UI. With betweenness 0.089 it is the top cross-community *type* in the codebase.

This bridge is **load-bearing by design** — it is the centralization of authz
you want. The risk it flags is the usual one for a god type: a change to the
role model (adding a tier, renaming a value) ripples through ~30 communities, so
it deserves careful test coverage (which it has — see `roles-integration.test.ts`).

**Verdict:** Expected and intentional. Treat `Role` / `roles.ts` as a
high-blast-radius file; keep its tests strong.

## Q3 — Why does `mockPrisma` bridge ~24 test communities?

**Because it is the one shared database double every test imports.**

`mockPrisma` (`src/__tests__/mocks/prisma.ts`) is a hand-maintained `vi.fn()`
mock covering ~40 Prisma models. Every API/lib test imports it instead of hitting
a real DB, which is why it links two dozen otherwise-unrelated test communities.
This bridge lives **entirely in the test layer** — it says nothing about
production coupling. The only maintenance note: the mock must be kept in sync as
Prisma models are added (it already covers assessments, ISO, audit logs, etc.).

**Verdict:** Expected test-infra hub. No action; keep it current with the schema.

## Q4 — Are the 18 inferred `requireRole()` edges correct?

**Yes — 18 / 18 verified TRUE** by reading every cited handler.

Every admin route handler invokes `requireRole(...)` as (effectively) its first
statement and short-circuits on the returned `NextResponse`:

```ts
const authResult = await requireRole("admin");
if (authResult instanceof NextResponse) return authResult; // 401/403
```

`requireRole` enforces by **return value, not by throwing**: `requireAuth()`
yields 401 if unauthenticated, then `hasAccess()` yields 403 if under the tier.

**One nuance the graph flattens:** the gate tier varies. Most are
`requireRole("admin")`, but five lower-privilege endpoints gate at
`requireRole("course_manager")` (e.g. `GET /admin/courses`, `policy-doc/sync`),
and two of those layer `canManageCourse()` on top. So "admin routes" is a slight
over-generalization — the `requireRole` call is always present, but its argument
is not always `"admin"`.

**Verdict:** Inferred edges are accurate. The "admin-only" label is the only
imprecision.

## Q5 — Are the 17 inferred `canManageCourse()` edges correct?

**Yes — 17 / 17 verified TRUE**, including the two `/admin/` routes the graph
flagged as suspicious.

`canManageCourse(userId, role, courseId)` (`src/lib/courseAccess.ts`) decides:
`admin` → always true; non-`course_manager` → false; otherwise a lookup against
the `CourseManagers` m2m join table. It does **not** use ownership/`createdById`
— that fallback (`isPrivilegedCreator`) lives only in the route layer.

Every course-content mutation (lessons, modules, quiz questions, assessment
variants/questions, reorders) gates on it. Two routes layer extra checks:
`DELETE /admin/courses/[id]` and `DELETE /admin/enrollments/[id]` prepend a
coarse `requireRole("course_manager")` then call `canManageCourse` for the
per-course decision; `PATCH /courses/[id]` OR's in the `isPrivilegedCreator`
fallback. In all 17 cases the call is genuinely present.

**Verdict:** Inferred edges are accurate. Course-content authorization is
consistently centralized in `canManageCourse`.

> **Combined Q4+Q5 result: 35 / 35 inferred `calls` edges confirmed against
> source.** The semantic extractor's authorization inferences were 100% precise
> on this sample — a strong signal the graph's INFERRED edges are trustworthy here.

## Q6 — What connects the weakly-connected nodes (`$schema`, `style`, `rsc`, …)?

**Nothing — and that is correct.** They are leaf *keys inside config files*, not
code symbols. `$schema`, `style`, `rsc`, `iconLibrary` are entries in
`components.json` (the shadcn config); they neither call nor import anything, so
degree ≤ 1 is the right answer, not a documentation gap.

The graph counts 5 degree-0 and 803 degree-1 nodes, but the population is
dominated by config primitives and fine-grained AST leaves:

| Source of weakly-connected nodes | count |
|---|---|
| `package.json` (dep/script keys) | 74 |
| `tsconfig.json` (compiler-option keys) | 17 |
| `components.json` (shadcn keys) | 15 |
| `src/components/icons.tsx` (individual icon fns) | 12 |
| component sub-helpers (AssessmentBuilder, QuizViewer, …) | 7–10 each |

So the report's "574 weakly-connected nodes → possible documentation gaps"
framing **overstates the case**. The bulk are config entries (isolated by
nature) and per-symbol AST granularity (every small JSX sub-component / icon is
its own node). There is no real "gap" to close here.

**Verdict:** Benign extraction artifact. Not a signal worth acting on.

## Q7 — Should "SharePoint & Policy Docs" (community 0, cohesion 0.06) be split?

**No — the low cohesion reflects a layered feature vertical, not a tangled
module.** Community 0 (81 nodes) is the SharePoint integration plus its
consumers:

| Layer | dir | nodes |
|---|---|---|
| SharePoint client/cache/allowlist | `src/lib/sharepoint` | 41 |
| SharePoint tests | `src/__tests__/lib/sharepoint` | 13 |
| Policy-doc components | `src/components/courses` | 10 |
| API routes (file streaming, browse, video, share-resolve) | `src/app/api/...` | 11 |
| component tests | `src/__tests__/components` | 5 |

Cohesion is 0.06 because these nodes are glued together by a **shared external
data source** (Microsoft Graph / SharePoint) rather than dense internal calls —
exactly the sparse-but-connected shape you expect from a `lib → routes →
components` stack around one integration. The code is **already physically
separated by directory**, and the `sharepoint` lib being decoupled from its
consumers is a healthy sign, not a smell.

The one real coupling the clusterer surfaced is genuine and intentional:
**policy-doc content is sourced from SharePoint**, so the two concerns travel
together.

**Verdict:** Do not split on this signal alone. Low cohesion here is the
expected fingerprint of an integration vertical, and the directory layout
already provides the modular boundaries.

---

## Bottom line

The graph asked seven pointed questions and the answers all land the same way:
**the codebase's central abstractions are central for good reasons** (authz +
the class helper), the extractor's inferred authorization edges are **100%
accurate** (35/35), and the two "warnings" (weakly-connected nodes, low-cohesion
community) are **expected artifacts**, not debt. No refactors are warranted on
the strength of these findings; the items worth remembering are operational:
`Role`/`roles.ts` and `canManageCourse` are high-blast-radius and should keep
their strong test coverage, and `mockPrisma` must track schema changes.

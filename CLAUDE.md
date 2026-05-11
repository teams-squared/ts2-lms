@AGENTS.md

## Git Workflow

End of meaningful unit of work — feature, fix, refactor, or one logical file change — commit relevant files + push remote. Don't batch unrelated changes.

**Branch model:**
- `dev` = integration branch. All work pushed directly to `dev`.
- `main` = production. Render deploys from `main`. **Never push directly to `main`** — branch-protected.
- Ship to prod = open `dev → main` PR + merge. Don't open PR / merge unless user explicitly asks for release.

**Commit discipline:**
- Stage only files belonging to logical change (never `git add -A` blindly — avoid `.env`, secrets, unrelated changes)
- Short imperative subject (≤72 chars), e.g. `fix: filter /api/search results by user role`
- Brief body (1–3 lines) explaining *why*, not *what*
- Push to `dev` immediately after commit — CI runs on every `dev` push

**When to commit:** end of each coherent task. Not every file write, not held to session end. If change self-contained + working, ship to `dev`.

## Parallel workers

Non-trivial coding + design audits: supervisor spawns subagents (Agent tool) in parallel rather than serial. More ground covered, faster. Supervisor stays focused on coherence + directive coverage, not low-level execution.

**Model selection = supervisor's call.** Cheapest model that does task correctly — not most powerful by default. Goal: **minimize token/compute, maximize accurate output**. Rough guide:

- **Haiku** — mechanical or well-specified: targeted search, reading known files, narrow edit, fact gathering, single-page checklist check.
- **Sonnet** — most coding: feature from clear spec, tests, design-system audit, moderate-judgment refactors.
- **Opus** — reserve for: ambiguous architecture, multi-file refactors with unclear shape, subtle debugging, multi-source synthesis.

**Supervise, don't delegate understanding.** Supervisor briefs workers with self-contained prompts (workers have no session context), verifies actual diff/output (not worker summaries), ensures directive coverage. No "based on your findings, implement the fix" — pushes synthesis onto worker.

**When to parallelize:**
- Multiple independent files / pages → fan out.
- Design audit across many routes → one worker per route cluster.
- Research + implementation overlap → research worker background, plan while it runs.

**When NOT to parallelize:** trivial single-file edits, tightly-coupled changes where workers step on each other, tasks where supervisor's context is load-bearing.

## Session continuity

Fresh Claude session reads in order:

1. **`CLAUDE.md`** — evergreen project conventions (this file).
2. **`docs/session-handoff.md`** — transient state: shipped, in-flight, waiting on operator, next move.

Two files have non-overlapping jobs. Don't restate evergreen rules from `CLAUDE.md` in handoff. Don't smuggle transient state into `CLAUDE.md`. (No durable backlog file today; if added, becomes 3rd in read order.)

### "prep for other sessions" trigger

When operator says **"prep for other sessions"** (or close paraphrase), or runs **`/prep`** slash command, regenerate `docs/session-handoff.md` end-to-end + push. Steps:

1. **Snapshot.** `git log --oneline -10`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`.
2. **Handle in-flight.** Real WIP (substantive uncommitted code, not local-only files like `.claude/settings.local.json`) → commit to fresh `wip/<topic>` branch + push. Don't pollute `dev` deploy branch with half-baked work. Handoff's In-flight section names the branch + gives one paragraph of done / left / next-step. Working tree clean (or only local-only cruft) → leave In-flight empty.
3. **Rewrite from scratch** — last write wins, no merge. Six sections in order: **Last sync** · **What just shipped** · **In-flight** · **Pending external actions** · **Open questions / decisions** · **Pickup pointer**. Cap ~200 lines, scan-friendly. **Write in caveman style** — drop articles, filler, hedging. Preserve code blocks, paths, URLs, commands EXACTLY.
4. **Commit + push** to `dev` with `docs(handoff):` subject prefix. No PR — handoff regenerates often, lives on integration branch.

Read `docs/session-handoff.md` + timestamp looks stale (several days old, or listed HEAD ≠ actual `git rev-parse HEAD`) → say so up front + offer refresh before substantive work.

@AGENTS.md

## Git Workflow

After completing any meaningful unit of work — a feature, a fix, a refactor, or even a single logical file change — commit the relevant files and push to remote. Do not batch unrelated changes into one commit.

**Branch model:**
- `dev` is the integration branch. All work — features, fixes, refactors — is committed and pushed directly to `dev`.
- `main` is production. Render deploys from `main`. **Never push directly to `main`**; it is branch-protected.
- Shipping to prod = opening a `dev → main` PR and merging it. Do not open the PR or merge unless the user explicitly asks for a release.

**Commit discipline:**
- Stage only the files that belong to the logical change (never `git add -A` blindly — avoid committing `.env`, secrets, or unrelated changes)
- Write a short imperative subject line (≤72 chars), e.g. `fix: filter /api/search results by user role`
- Add a brief body (1–3 lines) explaining *why*, not just *what*
- Push to `dev` immediately after committing — CI runs on every push to `dev`

**When to commit:** at the end of each coherent task — not after every single file write, but not by holding everything until the very end of a session either. Use judgment: if the change is self-contained and working, ship it to `dev`.

## Parallel workers

For non-trivial coding tasks and design audits, the supervising agent should spawn subagents (Agent tool) to work in parallel rather than doing everything serially. This capitalizes on parallelization: more ground covered, faster, and the supervisor stays focused on coherence + directive coverage rather than low-level execution.

**Model selection is the supervisor's call.** Pick the cheapest model that can do the task correctly — not the most powerful by default. The goal is to **minimize token/compute usage while maximizing accurate output**. Rough guide:

- **Haiku** — mechanical or well-specified work: running a specific search, reading known files, applying a narrowly-scoped edit, gathering facts, checking one page against a checklist.
- **Sonnet** — most coding work: implementing a feature from a clear spec, writing tests, auditing a page for design-system compliance, refactors with moderate judgment.
- **Opus** — reserve for tasks that actually need it: ambiguous architecture calls, multi-file refactors where the right shape isn't obvious, debugging something subtle, synthesizing across many sources.

**Supervise, don't delegate understanding.** The supervisor stays responsible for: briefing workers with self-contained prompts (workers have no session context), verifying the actual diff/output (not just trusting the worker's summary), and ensuring all directives are met. Don't write prompts like "based on your findings, implement the fix" — that pushes synthesis onto the worker.

**When to parallelize:**
- Multiple independent files or pages to touch → fan out.
- Design audit across many routes → one worker per route cluster.
- Research + implementation that can overlap → research worker in background, start planning while it runs.

**When NOT to parallelize:** trivial single-file edits, tightly-coupled changes where workers would step on each other, or tasks where the supervisor's context is load-bearing.

## Session continuity

A fresh Claude session reads in this order:

1. **`CLAUDE.md`** — evergreen project conventions (this file).
2. **`docs/session-handoff.md`** — transient state: what just shipped, what's in flight, what's waiting on the operator, what the next move looks like.

The two files have non-overlapping jobs. Don't restate evergreen rules from `CLAUDE.md` in the handoff, and don't smuggle transient state into `CLAUDE.md`. (No durable backlog file exists in this repo today; if one is added, it becomes the third entry in the read order.)

### "prep for other sessions" trigger

When the operator says **"prep for other sessions"** (or close paraphrase), or runs the **`/prep`** slash command, regenerate `docs/session-handoff.md` end-to-end and push. Steps:

1. **Snapshot.** `git log --oneline -10`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`.
2. **Handle in-flight.** If the working tree has real WIP (substantive uncommitted code, not local-only files like `.claude/settings.local.json`), commit it onto a fresh `wip/<topic>` branch and push. Don't pollute the `dev` deploy branch with half-baked work. The handoff's In-flight section names the branch and gives one paragraph of done / left / next-step. If the working tree is clean (or only contains local-only cruft), leave In-flight empty.
3. **Rewrite from scratch** — last write wins, no merge. Six sections in order: **Last sync** · **What just shipped** · **In-flight** · **Pending external actions** · **Open questions / decisions** · **Pickup pointer**. Cap around 200 lines, scan-friendly.
4. **Commit + push** to `dev` with a `docs(handoff):` subject prefix. (No PR needed — handoff regenerates frequently and lives on the integration branch.)

When you read `docs/session-handoff.md` and the timestamp looks stale (e.g. several days old, or the listed HEAD doesn't match the actual `git rev-parse HEAD`), say so up front and offer to refresh before proceeding with substantive work.

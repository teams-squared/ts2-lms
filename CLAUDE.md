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

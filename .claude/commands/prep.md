---
description: Regenerate docs/session-handoff.md so a future session can pick up cleanly.
---

Regenerate `docs/session-handoff.md` end-to-end so fresh Claude session picks up project work without cold-start. Push to `dev` when done. **Write handoff in caveman style** — drop articles, filler, hedging. Preserve code blocks, paths, URLs, commands EXACTLY.

## Steps

1. **Snapshot.** Run:
   - `git log --oneline -10`
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse HEAD`

2. **Handle in-flight.** Real WIP (substantive uncommitted code, not local-only files like `.claude/settings.local.json` or untracked one-off scripts) → commit to fresh `wip/<topic>` branch + push. Do **not** pollute `dev` with half-baked work. Working tree clean (or only local-only cruft) → leave In-flight section empty.

3. **Rewrite `docs/session-handoff.md` from scratch.** Last write wins, no merge. Six sections in order, capped ~200 lines:

   1. **Last sync** — today's date, current branch, HEAD short SHA + subject, working-tree status.
   2. **What just shipped** — last 3–8 commits, one line each. Cite backlog IDs when applicable.
   3. **In-flight** — empty when working tree clean. Populated only when WIP exists on `wip/<topic>` branch.
   4. **Pending external actions** — checkbox list of items waiting on operator (migrations to apply, env vars to set, manual ops, smoke tests). Each item specific enough to act on without further context.
   5. **Open questions / decisions** — discussed-but-unresolved items. Each line summarises question + what it's gated on.
   6. **Pickup pointer** — explicit "natural next step if you continue right now." Zero cold-start ambiguity.

   Plus short **Where things live** cheatsheet at bottom pointing at key files / conventions specific to this repo. Use existing codebase to populate; don't invent.

4. **Commit + push** to `dev` with `docs(handoff):` subject prefix. No PR.

## Inferring "Pending external actions"

When you can't infer something definitively, say so explicitly (`(none known to this session)`) rather than leaving section blank. Signals to scan for:

- Recent migration files in `prisma/migrations/` whose application to prod is unconfirmed.
- Recent commits whose body mentions something operator needs to do manually (env var changes, DNS, SQL cleanup, dashboard config).
- Open PRs from `dev → main` not merged yet.
- TODO/FIXME in files touched in last few commits.
- Scheduled tasks or cron secrets needing set on deploy platform (Render).

## Read order context (from CLAUDE.md)

Fresh sessions read in order: `CLAUDE.md` → `docs/session-handoff.md`. Two files have non-overlapping jobs — don't restate `CLAUDE.md`'s evergreen conventions in handoff. (No durable backlog file in this repo today; if later added, read order grows by one.)

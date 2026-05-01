---
description: Regenerate docs/session-handoff.md so a future session can pick up cleanly.
---

Regenerate `docs/session-handoff.md` end-to-end so a fresh Claude session
can pick up project work without cold-starting. Push to `dev` when done.

## Steps

1. **Snapshot.** Run:
   - `git log --oneline -10`
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse HEAD`

2. **Handle in-flight.** If the working tree has real WIP (substantive
   uncommitted code, not local-only files like
   `.claude/settings.local.json` or untracked one-off scripts), commit it
   onto a fresh `wip/<topic>` branch and push. Do **not** pollute `dev`
   with half-baked work. If the working tree is clean (or only contains
   local-only cruft), leave the In-flight section empty.

3. **Rewrite `docs/session-handoff.md` from scratch.** Last write wins,
   no merge. Six sections, in this order, capped around 200 lines:

   1. **Last sync** — today's date, current branch, HEAD short SHA +
      subject, working-tree status.
   2. **What just shipped** — last 3–8 commits, one line each. Cite
      backlog IDs when applicable.
   3. **In-flight** — empty when working tree is clean; populated only
      when WIP exists on a `wip/<topic>` branch.
   4. **Pending external actions** — checkbox list of items waiting on
      the operator (migrations to apply, env vars to set, manual ops,
      smoke tests). Each item specific enough to act on without further
      context.
   5. **Open questions / decisions** — discussed-but-unresolved items,
      each line summarising the question and what it's gated on.
   6. **Pickup pointer** — explicit "natural next step if you continue
      right now." Zero cold-start ambiguity.

   Plus a short **Where things live** cheatsheet at the bottom pointing
   at key files / conventions specific to this repo. Use the existing
   codebase to populate it; don't invent.

4. **Commit + push** to `dev` with a `docs(handoff):` subject prefix.
   No PR.

## Inferring "Pending external actions"

When you can't infer something definitively, say so explicitly in the
file (`(none known to this session)`) rather than leaving the section
blank. Signals to scan for:

- Recent migration files in `prisma/migrations/` whose application to
  prod is unconfirmed.
- Recent commits whose body mentions something the operator needs to do
  manually (env var changes, DNS, SQL cleanup, dashboard config).
- Open PRs from `dev → main` that haven't merged yet.
- TODO/FIXME in files touched in the last few commits.
- Scheduled tasks or cron secrets that need to be set on the deploy
  platform (Render, in this repo's case).

## Read order context (from CLAUDE.md)

Fresh sessions read in this order: `CLAUDE.md` → `docs/session-handoff.md`.
The two files have non-overlapping jobs — don't restate `CLAUDE.md`'s
evergreen conventions in the handoff. (No durable backlog file exists in
this repo today; if one is later added, the read order grows by one.)

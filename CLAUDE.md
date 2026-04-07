@AGENTS.md

## Git Workflow

After completing any meaningful unit of work — a feature, a fix, a refactor, or even a single logical file change — commit the relevant files and push to remote. Do not batch unrelated changes into one commit.

**Commit discipline:**
- Stage only the files that belong to the logical change (never `git add -A` blindly — avoid committing `.env`, secrets, or unrelated changes)
- Write a short imperative subject line (≤72 chars), e.g. `fix: filter /api/search results by user role`
- Add a brief body (1–3 lines) explaining *why*, not just *what*
- Push immediately after committing so production on Render advances frequently

**When to commit:** at the end of each coherent task — not after every single file write, but not by holding everything until the very end of a session either. Use judgment: if the change is self-contained and working, ship it.

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

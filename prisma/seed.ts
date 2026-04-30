/**
 * Database seed — intentionally a no-op.
 *
 * Historically this file upserted five demo users with hardcoded
 * passwords (admin@teamssquared.com / admin123 etc.) so a fresh dev DB
 * had something to log in with. That seed was running in production on
 * every Render deploy and planting backdoor admin accounts in the prod
 * `User` table — not great. The render.yaml `startCommand` no longer
 * invokes this file, and the file itself is now empty so a future
 * misconfigured deploy can't re-introduce demo creds.
 *
 * For local dev: invite yourself via /admin/users (or, on a fresh
 * empty DB, sign in via SSO — the first user is auto-provisioned as
 * EMPLOYEE; promote yourself in the DB via:
 *   `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@…';`
 * That's the documented bootstrap path; we deliberately don't keep a
 * "seed an admin" shortcut around because it inevitably ends up shipping
 * to production).
 *
 * The Prisma `db:seed` script in package.json still points here; this
 * stub keeps the npm script working without doing anything risky.
 */

async function main() {
  console.log("[seed] No demo data to seed. See file header for bootstrap notes.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

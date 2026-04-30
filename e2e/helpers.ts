import type { Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/**
 * E2E test users.
 *
 * The auto-seeding step that used to create these accounts on every
 * Render deploy was removed (it was planting backdoor admin rows in
 * prod). E2E tests are NOT in CI; if you need to run them locally
 * you must first seed these three users yourself against a dev DB —
 * via the admin/users invite flow, or a one-off insert with bcrypt-
 * hashed passwords. NEVER seed credential-login users against a
 * shared/prod database.
 *
 * If the e2e suite ever moves into CI, replace this block with
 * fixture-style per-run setup/teardown that targets a disposable DB.
 */
export const USERS = {
  admin:         { email: "admin@teamssquared.com",    password: "admin123" },
  courseManager: { email: "manager@teamssquared.com",  password: "manager123" },
  employee:      { email: "employee@teamssquared.com", password: "employee123" },
};

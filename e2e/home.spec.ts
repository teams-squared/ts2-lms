import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Home page", () => {
  test("logged-out landing page shows Sign in button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("employee sees welcome and profile card, no admin card", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await expect(page.getByText(/welcome back/i)).toBeVisible();
    await expect(page.getByText(/my profile/i)).toBeVisible();
    await expect(page.getByText(/admin dashboard/i)).not.toBeVisible();
  });

  test("admin sees welcome, profile card, and admin card", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await expect(page.getByText(/welcome back/i)).toBeVisible();
    await expect(page.getByText(/my profile/i)).toBeVisible();
    await expect(page.getByText(/admin dashboard/i)).toBeVisible();
  });
});

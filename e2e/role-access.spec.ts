import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Role-based access — Employee", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
  });

  test("Admin link is NOT visible in sidebar", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Admin/i })).not.toBeVisible();
  });

  test("visiting /admin directly is redirected", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  });
});

test.describe("Role-based access — Admin", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
  });

  test("Admin link IS visible in sidebar", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Admin/i })).toBeVisible();
  });

  test("/admin renders the dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /Admin Dashboard/i })).toBeVisible();
  });
});

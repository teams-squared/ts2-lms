import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Admin page", () => {
  test("non-admin is redirected away from /admin", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/admin");
    // Should redirect to home or show forbidden
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test("admin sees stats cards and user table", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/admin");

    // Stats cards
    await expect(page.getByText(/total users/i)).toBeVisible();
    await expect(page.getByText(/admins/i)).toBeVisible();

    // User table
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("admin can change a user role", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/admin");

    // Wait for table to load
    await expect(page.locator("table tbody tr").first()).toBeVisible();

    // Find a select dropdown and change it
    const select = page.locator("table select").first();
    const currentValue = await select.inputValue();
    const newRole = currentValue === "admin" ? "manager" : "admin";
    await select.selectOption(newRole);

    // Verify the select updated (role change happened without page reload)
    await expect(select).toHaveValue(newRole);

    // Restore original role
    await select.selectOption(currentValue);
  });
});

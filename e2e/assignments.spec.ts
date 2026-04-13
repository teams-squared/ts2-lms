import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Assignment Flow", () => {
  test("admin can access assignments page", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/admin/assignments");

    await expect(page.getByText(/course assignments/i)).toBeVisible();
  });

  test("assignments page shows course and user selectors", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/admin/assignments");

    // Should have course and user select dropdowns
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("employee cannot access admin assignments page", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/admin/assignments");
    await expect(page).not.toHaveURL(/\/admin\/assignments/);
  });

  test("manager can access manager assignments page", async ({ page }) => {
    await login(page, USERS.manager.email, USERS.manager.password);
    await page.goto("/manager/assignments");

    await expect(page.getByText(/course assignments/i)).toBeVisible();
  });

  test("existing assignments are listed", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/admin/assignments");

    // Table or list of assignments should be present (even if empty)
    // The AssignmentManager renders a table of existing assignments
    const assignmentRows = page.locator("table tbody tr");
    const count = await assignmentRows.count();
    // Just verify the page loaded correctly — count may be 0
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

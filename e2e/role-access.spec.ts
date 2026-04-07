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

test.describe("Role-based access — Manager", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.manager.email, USERS.manager.password);
  });

  test("Manager can log in and reach /docs", async ({ page }) => {
    await page.goto("/docs");
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole("link", { name: /Documentation/i }).first()).toBeVisible();
  });

  test("Manager sees management-guides category", async ({ page }) => {
    await page.goto("/docs");
    const response = await page.request.get("/api/search");
    const docs = await response.json();
    const managerDocs = docs.filter((d: { minRole: string }) => d.minRole === "manager");
    expect(managerDocs.length).toBeGreaterThan(0);
  });

  test("Manager does not see admin-only docs in search", async ({ page }) => {
    await page.goto("/docs");
    const response = await page.request.get("/api/search");
    const docs = await response.json();
    const adminOnlyDocs = docs.filter((d: { minRole: string }) => d.minRole === "admin");
    expect(adminOnlyDocs).toHaveLength(0);
  });

  test("Manager cannot access /admin and is redirected", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test("Admin link is NOT visible in sidebar for manager", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Admin/i })).not.toBeVisible();
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

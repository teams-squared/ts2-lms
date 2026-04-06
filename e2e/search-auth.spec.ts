import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Search API authentication", () => {
  test("unauthenticated request returns 401", async ({ page }) => {
    const response = await page.request.get("/api/search");
    expect(response.status()).toBe(401);
  });

  test("authenticated request returns docs array", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    const response = await page.request.get("/api/search");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("employee search does not include admin-only docs", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    const response = await page.request.get("/api/search");
    const docs = await response.json();
    const adminOnlyDocs = docs.filter(
      (d: { minRole: string }) => d.minRole === "admin"
    );
    expect(adminOnlyDocs).toHaveLength(0);
  });

  test("admin search includes all docs", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    const employeeResponse = await page.request.get("/api/search");
    const employeeDocs = await employeeResponse.json();

    // Admin should get at least as many docs as employee
    await login(page, USERS.employee.email, USERS.employee.password);
    const adminResponse = await page.request.get("/api/search");
    const adminDocs = await adminResponse.json();

    expect(employeeDocs.length).toBeGreaterThanOrEqual(adminDocs.length);
  });
});

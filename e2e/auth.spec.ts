import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Authentication", () => {
  test("unauthenticated visit to /docs redirects to /login", async ({ page }) => {
    await page.goto("/docs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visit to /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with valid credentials navigates away from /login", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("login with invalid password shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@teamssquared.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("sign-out returns to home or login", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/(login)?$/);
  });
});

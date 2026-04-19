import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Authentication", () => {
  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /profile redirects to /login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("valid login redirects to home", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await expect(page).toHaveURL("/");
  });

  test("invalid password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@teamssquared.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("sign out returns to login", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);

    // Open user menu and click Sign out
    const avatar = page.locator("nav button").filter({ hasText: /^[A-Z?]$/ }).first();
    await avatar.click();
    await page.getByText("Sign out").click();

    await expect(page).toHaveURL(/\/login/);
  });
});

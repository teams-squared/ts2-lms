import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Profile page", () => {
  test("user sees their name, email, role badge, and dates", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/profile");

    // User info
    await expect(page.getByText("Admin")).toBeVisible();
    await expect(page.getByText(USERS.admin.email)).toBeVisible();

    // Role badge
    await expect(page.getByText("admin")).toBeVisible();

    // Account dates
    await expect(page.getByText(/account created/i)).toBeVisible();
    await expect(page.getByText(/last updated/i)).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Mobile navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 dimensions
  });

  test("hamburger button is visible on mobile", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    const hamburger = page.getByRole("button", { name: /open navigation menu/i });
    await expect(hamburger).toBeVisible();
  });

  test("desktop sidebar is not visible on mobile", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    // The aside (desktop sidebar) should not be visible on mobile
    const desktopSidebar = page.locator("aside");
    await expect(desktopSidebar).not.toBeVisible();
  });

  test("drawer opens when hamburger is clicked", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    const drawer = page.getByRole("navigation", { name: /mobile navigation/i });
    await expect(drawer).toBeVisible();
  });

  test("drawer contains navigation links", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    const drawer = page.getByRole("navigation", { name: /mobile navigation/i });
    await expect(drawer.getByRole("link", { name: /home/i })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /documentation/i })).toBeVisible();
  });

  test("clicking a link in the drawer closes it and navigates", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    const drawer = page.getByRole("navigation", { name: /mobile navigation/i });
    await drawer.getByRole("link", { name: /documentation/i }).click();
    await expect(drawer).not.toBeVisible();
    await expect(page).toHaveURL(/\/docs/);
  });

  test("drawer closes on Escape key", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    await page.keyboard.press("Escape");
    const drawer = page.getByRole("navigation", { name: /mobile navigation/i });
    await expect(drawer).not.toBeVisible();
  });

  test("admin link visible in drawer for admin user", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    const drawer = page.getByRole("navigation", { name: /mobile navigation/i });
    await expect(drawer.getByRole("link", { name: /admin/i })).toBeVisible();
  });

  test("admin link not visible in drawer for employee user", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    const drawer = page.getByRole("navigation", { name: /mobile navigation/i });
    await expect(drawer.getByRole("link", { name: /admin/i })).not.toBeVisible();
  });
});

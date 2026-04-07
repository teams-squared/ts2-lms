import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
  });

  test("sidebar shows Home and Documentation links when signed in", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Home/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Documentation/i }).first()).toBeVisible();
  });

  test("/docs page renders category cards", async ({ page }) => {
    await page.goto("/docs");
    // At least one category card link should appear
    const cards = page.locator("a[href^='/docs/']");
    await expect(cards.first()).toBeVisible();
  });

  test("clicking a category card navigates to that category", async ({ page }) => {
    await page.goto("/docs");
    const firstCard = page.locator("a[href^='/docs/']").first();
    const href = await firstCard.getAttribute("href");
    await firstCard.click();
    await expect(page).toHaveURL(href!);
  });

  test("doc page renders article content", async ({ page }) => {
    await page.goto("/docs");
    // Navigate into a category
    await page.locator("a[href^='/docs/']").first().click();
    // Look for either a category listing or an article
    const content = page.locator("article, [class*='grid']").first();
    await expect(content).toBeVisible();
  });
});

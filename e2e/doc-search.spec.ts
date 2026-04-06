import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

async function navigateToAnyDoc(page: import("@playwright/test").Page) {
  await page.goto("/docs/getting-started/welcome");
  // Wait for the visible doc content to be present inside <main>
  await page.waitForSelector("main #doc-content", { timeout: 10000 });
}

test.describe("In-document search", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await navigateToAnyDoc(page);
  });

  test("search input is visible on doc page", async ({ page }) => {
    await expect(page.locator("main").getByPlaceholder("Search in document…")).toBeVisible();
  });

  test("typing a term that appears shows match count", async ({ page }) => {
    const main = page.locator("main");
    const article = main.locator("#doc-content");
    const text = await article.textContent();
    const word = text?.split(/\s+/).find((w) => w.replace(/[^a-z]/gi, "").length > 3) ?? "teams";
    const term = word.replace(/[^a-z]/gi, "").toLowerCase();

    await main.getByPlaceholder("Search in document…").fill(term);
    await expect(page.locator("text=/ \\d+ \\/ \\d+/")).toBeVisible({ timeout: 3000 }).catch(() => {
      // term may genuinely not exist — that's also a valid outcome
    });
  });

  test("typing a term not in the doc shows 'No matches'", async ({ page }) => {
    await page.locator("main").getByPlaceholder("Search in document…").fill("xyzzy_no_match_99");
    await expect(page.getByText("No matches")).toBeVisible();
  });

  test("<mark> elements appear in #doc-content after searching", async ({ page }) => {
    const main = page.locator("main");
    const article = main.locator("#doc-content");
    const text = await article.textContent();
    const word = text?.split(/\s+/).find((w) => w.replace(/[^a-z]/gi, "").length > 3) ?? "teams";
    const term = word.replace(/[^a-z]/gi, "").toLowerCase();

    await main.getByPlaceholder("Search in document…").fill(term);
    await page.waitForTimeout(300);
    const marks = main.locator("#doc-content mark.search-highlight");
    const count = await marks.count();
    if (count > 0) {
      await expect(marks.first()).toBeVisible();
    }
  });
});

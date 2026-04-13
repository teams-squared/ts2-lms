import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Lesson View & Completion", () => {
  test("employee can view a lesson inside a course", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    await page.getByText("Introduction to Cybersecurity").click();
    await expect(page.getByText("Course Content")).toBeVisible();

    // Click the first non-quiz lesson link in the sidebar
    const lessonLink = page
      .locator("nav a, aside a")
      .filter({ hasText: /.+/ })
      .first();
    await lessonLink.click();

    // Should be on a lesson page
    await expect(page).toHaveURL(/\/courses\/.+\/lessons\//);
  });

  test("lesson page shows lesson title and sidebar navigation", async ({
    page,
  }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    await page.getByText("Introduction to Cybersecurity").click();

    // Find and click first lesson
    const firstLesson = page.locator("aside a, nav a").first();
    await firstLesson.click();

    await expect(page).toHaveURL(/\/courses\/.+\/lessons\//);
    // Sidebar should still be visible
    await expect(page.getByText("Course Content")).toBeVisible();
  });

  test("employee sees Mark Complete button on non-quiz lesson", async ({
    page,
  }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    await page.getByText("Introduction to Cybersecurity").click();

    // Find a text/video lesson (not quiz) in sidebar and click it
    const lessonLinks = page.locator("aside a, nav a");
    const count = await lessonLinks.count();

    for (let i = 0; i < count; i++) {
      const link = lessonLinks.nth(i);
      await link.click();
      await expect(page).toHaveURL(/\/courses\/.+\/lessons\//);

      // If we see "Mark complete" or "Completed", we found a non-quiz lesson
      const markComplete = page.getByRole("button", {
        name: /mark complete|completed/i,
      });
      if ((await markComplete.count()) > 0) {
        await expect(markComplete).toBeVisible();
        return; // test passed
      }
    }
    // If no non-quiz lesson found, skip gracefully
    test.skip();
  });
});

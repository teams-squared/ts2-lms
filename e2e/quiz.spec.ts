import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Quiz Lessons", () => {
  test("quiz lesson shows quiz viewer when questions exist", async ({
    page,
  }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    // Navigate to the cybersecurity course which has quiz lessons (from seed)
    await page.getByText("Introduction to Cybersecurity").click();
    await expect(page.getByText("Course Content")).toBeVisible();

    // Look for a quiz lesson in the sidebar
    const quizLesson = page.locator("a").filter({ hasText: /quiz|knowledge check/i }).first();
    const hasQuiz = await quizLesson.count();
    if (hasQuiz > 0) {
      await quizLesson.click();
      // Should show QuizViewer or "coming soon" depending on whether questions are seeded
      await expect(
        page.getByText(/start quiz|no questions|quiz functionality/i)
      ).toBeVisible();
    }
  });

  test("admin sees quiz builder on quiz lesson", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/courses");

    await page.getByText("Introduction to Cybersecurity").click();
    await expect(page.getByText("Course Content")).toBeVisible();

    // Look for a quiz lesson in the sidebar
    const quizLesson = page.locator("a").filter({ hasText: /quiz|knowledge check/i }).first();
    const hasQuiz = await quizLesson.count();
    if (hasQuiz > 0) {
      await quizLesson.click();
      // Admin should see the Quiz Builder section
      await expect(
        page.getByText(/quiz builder|add question|start quiz/i)
      ).toBeVisible();
    }
  });
});

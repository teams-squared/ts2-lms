import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Course Catalog", () => {
  test("employee sees course catalog with published courses", async ({
    page,
  }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    await expect(page.getByText("Course Catalog")).toBeVisible();
    // Should see seeded published courses
    await expect(
      page.getByText("Introduction to Cybersecurity")
    ).toBeVisible();
    await expect(
      page.getByText("Cloud Infrastructure Essentials")
    ).toBeVisible();
  });

  test("employee cannot access admin course management", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/admin/courses");
    // Should be redirected away from admin
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("admin sees all courses including drafts in admin page", async ({
    page,
  }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/admin/courses");

    // Should see the draft course
    await expect(
      page.getByText("Advanced Networking (Draft)")
    ).toBeVisible();
  });

  test("course detail page shows course info", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    // Click on a course
    await page.getByText("Introduction to Cybersecurity").click();

    // Should see course detail
    await expect(
      page.getByRole("heading", { name: "Introduction to Cybersecurity" })
    ).toBeVisible();
    await expect(page.getByText("Course Content")).toBeVisible();
  });
});

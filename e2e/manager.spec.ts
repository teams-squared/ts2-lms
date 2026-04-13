import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Manager Dashboard", () => {
  test("manager can access /manager", async ({ page }) => {
    await login(page, USERS.manager.email, USERS.manager.password);
    await page.goto("/manager");

    await expect(page.getByText(/my courses/i)).toBeVisible();
  });

  test("manager dashboard shows stats cards", async ({ page }) => {
    await login(page, USERS.manager.email, USERS.manager.password);
    await page.goto("/manager");

    await expect(page.getByText(/total lessons/i)).toBeVisible();
    await expect(page.getByText(/enrolled users/i)).toBeVisible();
  });

  test("employee cannot access /manager", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/manager");
    await expect(page).not.toHaveURL(/\/manager/);
  });

  test("admin can access /manager", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/manager");
    await expect(page.getByText(/my courses/i)).toBeVisible();
  });

  test("manager dashboard has Create new course and Manage assignments links", async ({
    page,
  }) => {
    await login(page, USERS.manager.email, USERS.manager.password);
    await page.goto("/manager");

    await expect(
      page.getByRole("link", { name: /create new course/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /manage assignments/i })
    ).toBeVisible();
  });
});

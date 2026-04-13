import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Course Catalog Search", () => {
  test("search bar is visible on course catalog", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    await expect(page.getByPlaceholder("Search courses…")).toBeVisible();
  });

  test("searching for a course filters results", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    const searchInput = page.getByPlaceholder("Search courses…");
    await searchInput.fill("Cybersecurity");
    await searchInput.press("Enter");

    // URL should contain query param
    await expect(page).toHaveURL(/q=Cybersecurity/);
    await expect(page.getByText("Introduction to Cybersecurity")).toBeVisible();
  });

  test("searching for non-existent course shows empty state", async ({
    page,
  }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses?q=xyznonexistent12345");

    await expect(
      page.getByText(/no courses found/i)
    ).toBeVisible();
  });

  test("admin sees status filter buttons", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/courses");

    await expect(page.getByRole("link", { name: "published" })).toBeVisible();
    await expect(page.getByRole("link", { name: "draft" })).toBeVisible();
    await expect(page.getByRole("link", { name: "archived" })).toBeVisible();
  });

  test("employee does not see status filter", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/courses");

    await expect(page.getByRole("link", { name: "draft" })).not.toBeVisible();
  });
});

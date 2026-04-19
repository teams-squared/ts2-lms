import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Profile Edit", () => {
  test("profile page shows Change password link for local accounts", async ({
    page,
  }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/profile");

    await expect(
      page.getByTestId("change-password-trigger")
    ).toBeVisible();
  });

  test("clicking Change password reveals the password form", async ({
    page,
  }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/profile");

    await page.getByTestId("change-password-trigger").click();
    await expect(page.getByTestId("change-password-form")).toBeVisible();
    await expect(page.getByTestId("current-password-input")).toBeVisible();
    await expect(page.getByTestId("new-password-input")).toBeVisible();
    await expect(page.getByTestId("confirm-password-input")).toBeVisible();
  });

  test("password mismatch shows inline error", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/profile");

    await page.getByTestId("change-password-trigger").click();
    await page.getByTestId("current-password-input").fill("employee123");
    await page.getByTestId("new-password-input").fill("newpass123");
    await page.getByTestId("confirm-password-input").fill("different123");
    await page.getByTestId("save-password-button").click();

    await expect(page.getByTestId("password-error")).toBeVisible();
    await expect(page.getByTestId("password-error")).toContainText(
      "Passwords do not match"
    );
  });

  test("cancel button hides the password form", async ({ page }) => {
    await login(page, USERS.employee.email, USERS.employee.password);
    await page.goto("/profile");

    await page.getByTestId("change-password-trigger").click();
    await expect(page.getByTestId("change-password-form")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("change-password-form")).not.toBeAttached();
  });
});

import type { Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export const USERS = {
  admin:    { email: "admin@teamssquared.com",    password: "admin123" },
  manager:  { email: "manager@teamssquared.com",  password: "manager123" },
  employee: { email: "employee@teamssquared.com", password: "employee123" },
};

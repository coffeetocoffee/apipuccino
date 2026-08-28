import { test, expect } from "@playwright/test";
test("directory -> renders + docs link + search", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  // Page title contains Apipuccino
  await expect(page).toHaveTitle(/Apipuccino/);
  // Brand says Apipuccino
  await expect(page.locator(".brand b")).toContainText("Apipuccino");
  // Hero h1 present
  await expect(page.locator("h1")).toContainText("list");
  // API table renders rows
  const rows = page.locator("#tbody tr");
  await expect(rows.first()).toBeVisible();
});

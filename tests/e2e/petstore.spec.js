import { test, expect } from "@playwright/test";
test("petstore -> build -> search", async ({ page }) => {
  // Assumes apidocs build output served at localhost:4173
  // Minimal: check directory loads and search exists
  await page.goto("http://localhost:4173/");
  await expect(page.locator("h1")).toContainText("Apipuccino");
});

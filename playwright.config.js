import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  webServer: { command: "pnpm --filter @apipuccino/web build && npx serve apps/web/dist -l 4173", port: 4173, reuseExistingServer: true },
});

import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.{js,ts}", "packages/**/__tests__/**"],
    environment: "node",
  },
});

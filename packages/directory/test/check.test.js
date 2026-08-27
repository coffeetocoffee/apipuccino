import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";

describe("apis.json", () => {
  it("is valid & has probes", async () => {
    const apis = JSON.parse(await fs.readFile(new URL("../data/apis.json", import.meta.url), "utf8"));
    expect(apis.length).toBeGreaterThan(10);
    for (const a of apis) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(a.probe.timeoutMs).toBeGreaterThanOrEqual(8000);
    }
  });
});

describe("results.json shape", () => {
  it("has summary", async () => {
    const r = JSON.parse(await fs.readFile(new URL("../data/results.json", import.meta.url), "utf8"));
    expect(r.summary).toHaveProperty("total");
  });
});

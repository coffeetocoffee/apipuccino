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

describe("generated-docs.json shape", () => {
  it("maps slug -> {href, try, pages} with #try-it deep-link", async () => {
    const g = JSON.parse(await fs.readFile(new URL("../data/generated-docs.json", import.meta.url), "utf8"));
    expect(Object.keys(g).length).toBeGreaterThan(0);
    for (const [slug, v] of Object.entries(g)) {
      expect(v.href).toBe(`docs/${slug}/`);
      expect(v.try).toMatch(/^docs\/[a-z0-9-]+\/#try-it$/);
      expect(v.pages).toBeGreaterThanOrEqual(1);
    }
  });
});

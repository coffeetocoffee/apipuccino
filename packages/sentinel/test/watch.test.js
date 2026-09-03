import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { saveConfig, loadCache } from "../src/store.js";
import { runWatch } from "../src/watch.js";

const jsonRes = (obj, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => (k.toLowerCase() === "content-type" ? "application/json" : null) },
  text: async () => JSON.stringify(obj),
});

let cwd;
beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "sentinel-"));
  await saveConfig(cwd, {
    deps: [
      { name: "good", slug: "good", url: "https://good.example.com/", probe: { method: "GET", expectedStatus: 200, timeoutMs: 1000 } },
      { name: "bad", slug: "bad", url: "https://bad.example.com/", probe: { method: "GET", expectedStatus: 200, timeoutMs: 1000 } },
    ],
    alerts: {},
  });
});

const fetchFor = (goodBody) => async (url) =>
  url.includes("good.example.com") ? jsonRes(goodBody) : jsonRes({ error: 1 }, 500);

describe("runWatch", () => {
  it("probes deps, records streaks + cache, emits down event", async () => {
    const report = await runWatch({ cwd, fetchFn: fetchFor({ a: 1 }), quiet: true });
    expect(report.summary).toMatchObject({ total: 2, ok: 1, failed: 1 });
    const bad = report.results.find((r) => r.slug === "bad");
    expect(bad.consecutiveFailures).toBe(1);
    expect(bad.risk.level).toBe("Evolving");
    expect(report.events.map((e) => e.type)).toContain("down");
    const cached = await loadCache(cwd, "good");
    expect(JSON.parse(cached.body)).toEqual({ a: 1 });
  });

  it("escalates to death after 3 consecutive failures", async () => {
    const f = fetchFor({ a: 1 });
    await runWatch({ cwd, fetchFn: f, quiet: true });
    await runWatch({ cwd, fetchFn: f, quiet: true });
    const third = await runWatch({ cwd, fetchFn: f, quiet: true });
    const bad = third.results.find((r) => r.slug === "bad");
    expect(bad.consecutiveFailures).toBe(3);
    expect(bad.risk.level).toBe("Volatile");
    expect(third.events.find((e) => e.type === "death")).toMatchObject({ slug: "bad" });
    expect(third.summary.deaths).toBe(1);
  });

  it("emits drift when schema keys change while live", async () => {
    await runWatch({ cwd, fetchFn: fetchFor({ a: 1 }), quiet: true });
    const second = await runWatch({ cwd, fetchFn: fetchFor({ a: 1, b: 2 }), quiet: true });
    const good = second.results.find((r) => r.slug === "good");
    expect(good.drifted).toBe(true);
    expect(good.risk.level).toBe("Evolving");
    expect(second.events.find((e) => e.type === "drift")).toMatchObject({ slug: "good" });
  });

  it("emits recovered when a failing dep goes live", async () => {
    await runWatch({ cwd, fetchFn: fetchFor({ a: 1 }), quiet: true });
    const allOk = async () => jsonRes({ ok: true });
    const report = await runWatch({ cwd, fetchFn: allOk, quiet: true });
    expect(report.events.find((e) => e.type === "recovered")).toMatchObject({ slug: "bad" });
    expect(report.results.find((r) => r.slug === "bad").consecutiveFailures).toBe(0);
  });

  it("no deps => empty report, no crash", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "sentinel-empty-"));
    const report = await runWatch({ cwd: empty, fetchFn: fetchFor({}), quiet: true });
    expect(report.summary).toMatchObject({ total: 0, ok: 0, failed: 0 });
  });
});

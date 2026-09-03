import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "../src/cli.js";
import { loadConfig } from "../src/store.js";

let cwd;
beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "sentinel-cli-"));
});

describe("sentinel cli", () => {
  it("add stores a watched dep", async () => {
    const res = await run(["add", "https://api.example.com/health", "--name", "Example"], { cwd });
    expect(res.exitCode).toBe(0);
    const cfg = await loadConfig(cwd);
    expect(cfg.deps).toHaveLength(1);
    expect(cfg.deps[0]).toMatchObject({ slug: "example", url: "https://api.example.com/health" });
  });

  it("add rejects invalid URLs and duplicates", async () => {
    expect((await run(["add", "not-a-url"], { cwd })).exitCode).toBe(2);
    await run(["add", "https://api.example.com/health"], { cwd });
    expect((await run(["add", "https://api.example.com/health"], { cwd })).exitCode).toBe(1);
  });

  it("status hints when nothing watched", async () => {
    const res = await run(["status"], { cwd });
    expect(res.exitCode).toBe(0);
    expect(res.output).toMatch(/sentinel add/);
  });

  it("unknown command exits 2", async () => {
    expect((await run(["frobnicate"], { cwd })).exitCode).toBe(2);
  });
});

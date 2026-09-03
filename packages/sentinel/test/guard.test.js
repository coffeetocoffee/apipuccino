import { describe, it, expect } from "vitest";
import { createGuard, UpstreamDeadError, isDeadStatus } from "../src/guard.js";

const okRes = (body = "live") => ({ ok: true, status: 200, text: async () => body });
const errRes = () => ({ ok: false, status: 500, text: async () => "boom" });

describe("createGuard", () => {
  it("passes live responses straight through", async () => {
    const guard = createGuard({ fetchFn: async () => okRes("hello") });
    const res = await guard("x", "https://api.example.com/health");
    expect(res.ok).toBe(true);
    await expect(res.text()).resolves.toBe("hello");
  });

  it("serves stale cache when upstream errors", async () => {
    const guard = createGuard({
      fetchFn: async () => errRes(),
      loadCache: async () => ({ body: '{"cached":true}', contentType: "application/json", savedAt: "2026-01-01T00:00:00.000Z" }),
    });
    const res = await guard("x", "https://api.example.com/data");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-apipuccino-sentinel")).toBe("stale-cache");
    await expect(res.json()).resolves.toEqual({ cached: true });
  });

  it("serves stale cache on network throw", async () => {
    const guard = createGuard({
      fetchFn: async () => {
        throw new Error("socket hang up");
      },
      loadCache: async () => ({ body: "old", contentType: "text/plain" }),
    });
    const res = await guard("x", "https://api.example.com/data");
    await expect(res.text()).resolves.toBe("old");
  });

  it("throws UpstreamDeadError when dead and nothing cached", async () => {
    const guard = createGuard({
      fetchFn: async () => {
        throw new Error("down");
      },
      loadCache: async () => null,
      getStatus: async () => ({ ok: false, consecutiveFailures: 4 }),
    });
    await expect(guard("dead-api", "https://dead.example.com/")).rejects.toBeInstanceOf(UpstreamDeadError);
  });

  it(".for() binds a slug", async () => {
    const guard = createGuard({ fetchFn: async () => okRes("bound") });
    const res = await guard.for("my-api")("https://api.example.com/");
    await expect(res.text()).resolves.toBe("bound");
  });
});

describe("isDeadStatus", () => {
  it("flags 3+ consecutive failures", () => {
    expect(isDeadStatus({ consecutiveFailures: 3 })).toBe(true);
    expect(isDeadStatus({ consecutiveFailures: 1 })).toBe(false);
    expect(isDeadStatus(null)).toBe(false);
  });
});

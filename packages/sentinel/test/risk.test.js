import { describe, it, expect } from "vitest";
import { classifyRisk, summarizeRisk } from "../src/risk.js";

describe("classifyRisk", () => {
  it("live + no drift => Stable", () => {
    expect(classifyRisk({ ok: true, consecutiveFailures: 0, drifted: false, latencyMs: 120 })).toEqual({
      level: "Stable",
      reason: "live, no drift",
    });
  });

  it("3+ consecutive failures => Volatile", () => {
    const r = classifyRisk({ ok: false, consecutiveFailures: 3 });
    expect(r.level).toBe("Volatile");
    expect(r.reason).toMatch(/3 consecutive/);
  });

  it("fresh failure => Evolving, not Volatile", () => {
    expect(classifyRisk({ ok: false, consecutiveFailures: 1 }).level).toBe("Evolving");
    expect(classifyRisk({ ok: false, consecutiveFailures: 2 }).level).toBe("Evolving");
  });

  it("schema drift on a live dep => Evolving", () => {
    const r = classifyRisk({ ok: true, consecutiveFailures: 0, drifted: true });
    expect(r).toEqual({ level: "Evolving", reason: "response schema drifted since last check" });
  });

  it("slow dep => Evolving", () => {
    expect(classifyRisk({ ok: true, latencyMs: 6000 }).level).toBe("Evolving");
  });
});

describe("summarizeRisk", () => {
  it("counts levels", () => {
    const s = summarizeRisk([
      { risk: { level: "Stable" } },
      { risk: { level: "Evolving" } },
      { risk: { level: "Volatile" } },
      {},
    ]);
    expect(s).toEqual({ total: 4, stable: 2, evolving: 1, volatile: 1 });
  });
});

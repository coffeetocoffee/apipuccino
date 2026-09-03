/**
 * Apipuccino Sentinel — risk classification.
 * Pure + deterministic (unit-tested). Mirrors the directory's Stability vocabulary:
 * Stable / Evolving / Volatile — but per YOUR watched dependency, not global.
 */
import { DEATH_THRESHOLD, SLOW_MS } from "./constants.js";

export function classifyRisk({ ok = true, consecutiveFailures = 0, drifted = false, latencyMs = 0 } = {}) {
  if (consecutiveFailures >= DEATH_THRESHOLD) {
    return { level: "Volatile", reason: `dead ${consecutiveFailures} consecutive checks` };
  }
  if (!ok) {
    return { level: "Evolving", reason: `failing (${consecutiveFailures} consecutive)` };
  }
  if (drifted) {
    return { level: "Evolving", reason: "response schema drifted since last check" };
  }
  if (latencyMs > SLOW_MS) {
    return { level: "Evolving", reason: `slow (${latencyMs}ms)` };
  }
  return { level: "Stable", reason: "live, no drift" };
}

export function summarizeRisk(results) {
  const summary = { total: results.length, stable: 0, evolving: 0, volatile: 0 };
  for (const r of results) {
    const level = (r.risk?.level ?? "Stable").toLowerCase();
    if (level in summary && level !== "total") summary[level]++;
  }
  return summary;
}

/**
 * Apipuccino Sentinel — watch orchestrator.
 * Loads watched deps → probes each → compares hashes/streaks → emits events →
 * persists results/history/cache → dispatches alerts. Returns the full report.
 */
import { DEATH_THRESHOLD, MAX_CACHE_BYTES } from "./constants.js";
import { probeOne } from "./prober.js";
import { classifyRisk, summarizeRisk } from "./risk.js";
import { dispatchAlerts } from "./alerts.js";
import { loadConfig, loadResults, saveCache, saveReport, saveResults } from "./store.js";

function detailOf(r) {
  return r.ok ? `HTTP ${r.status} ${r.latencyMs}ms` : (r.error ?? `HTTP ${r.status ?? "ERR"}`);
}

export async function runWatch({ cwd = process.cwd(), fetchFn = fetch, webhook, quiet = false } = {}) {
  const config = await loadConfig(cwd);
  const prev = await loadResults(cwd);
  const prevBySlug = new Map((prev?.results ?? []).map((r) => [r.slug, r]));
  const checkedAt = new Date().toISOString();

  const results = [];
  const events = [];

  for (const dep of config.deps) {
    const p = await probeOne(dep, { fetchFn });
    const before = prevBySlug.get(dep.slug);
    const consecutiveFailures = p.ok ? 0 : (before?.consecutiveFailures ?? 0) + 1;
    const drifted = Boolean(p.ok && before?.schemaHash && p.schemaHash && p.schemaHash !== before.schemaHash);
    const risk = classifyRisk({ ok: p.ok, consecutiveFailures, drifted, latencyMs: p.latencyMs });

    if (!p.ok && consecutiveFailures >= DEATH_THRESHOLD) {
      events.push({ type: "death", slug: dep.slug, consecutiveFailures, detail: detailOf(p), at: checkedAt });
    } else if (!p.ok && consecutiveFailures === 1) {
      events.push({ type: "down", slug: dep.slug, consecutiveFailures, detail: detailOf(p), at: checkedAt });
    }
    if (p.ok && (before?.consecutiveFailures ?? 0) > 0) {
      events.push({ type: "recovered", slug: dep.slug, wasFailing: before.consecutiveFailures, at: checkedAt });
    }
    if (drifted) {
      events.push({ type: "drift", slug: dep.slug, prevHash: before.schemaHash, newHash: p.schemaHash, at: checkedAt });
    }

    // Last-known-good cache for the runtime guard (skip huge bodies — no repo bloat).
    if (p.ok && p.bodyText && Buffer.byteLength(p.bodyText) <= MAX_CACHE_BYTES) {
      await saveCache(cwd, dep.slug, { body: p.bodyText, contentType: p.contentType }).catch(() => {});
    }

    const { bodyText: _drop, ...rest } = p;
    results.push({ ...rest, consecutiveFailures, drifted, risk });
  }

  results.sort((a, b) => a.slug.localeCompare(b.slug));
  const summary = {
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    ...summarizeRisk(results),
    deaths: events.filter((e) => e.type === "death").length,
    drifts: events.filter((e) => e.type === "drift").length,
  };

  const report = { checkedAt, summary, results, events };
  if (results.length > 0) {
    await saveResults(cwd, { checkedAt, summary, results });
    await saveReport(cwd, report);
  }

  const hook = webhook ?? config.alerts?.webhook;
  if (!quiet) {
    if (results.length === 0) console.log("[sentinel] nothing watched — run `sentinel add <url>` first");
    else console.log(`[sentinel] ${summary.ok}/${summary.total} live, ${summary.deaths} deaths, ${summary.drifts} drifts`);
  }
  await dispatchAlerts({ events, summary, webhook: hook }, { fetchFn });
  return report;
}

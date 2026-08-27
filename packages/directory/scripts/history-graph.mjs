#!/usr/bin/env node
/**
 * Build per-slug 30d uptime sparkline from history/*.jsonl
 * Output: packages/directory/data/history-summary.json { slug: {uptime30d, avgLatency, last10: [1,0,1...]} }
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HIST_DIR = path.resolve(__dirname, "../data/history");
const OUT = path.resolve(__dirname, "../data/history-summary.json");

const files = await fs.readdir(HIST_DIR).catch(()=>[]);
const all = [];
for (const f of files.filter(x=>x.endsWith(".jsonl")).sort()) {
  const lines = (await fs.readFile(path.join(HIST_DIR, f), "utf8")).trim().split("\n").filter(Boolean);
  for (const l of lines) try { all.push(JSON.parse(l)); } catch {}
}
// last 30 entries (days)
const last30 = all.slice(-30);
const bySlug = {};
for (const day of last30) {
  for (const r of day.results || []) {
    bySlug[r.slug] ??= { checks: [], latencies: [] };
    bySlug[r.slug].checks.push(r.ok ? 1 : 0);
    if (r.ok) bySlug[r.slug].latencies.push(r.latencyMs);
  }
}
const summary = {};
for (const [slug, v] of Object.entries(bySlug)) {
  const total = v.checks.length, ok = v.checks.filter(Boolean).length;
  summary[slug] = {
    uptime30d: total ?+(ok/total).toFixed(3) : 0,
    avgLatencyMs: v.latencies.length ? Math.round(v.latencies.reduce((a,b)=>a+b,0)/v.latencies.length) : null,
    last30: v.checks,
    sparkline: v.checks.map(c=> c ? "█" : "░").join(""),
  };
}
await fs.writeFile(OUT, JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log(`✓ history-summary.json — ${Object.keys(summary).length} slugs, ${last30.length} days`);

#!/usr/bin/env node
/**
 * Apipuccino Sentinel CLI — `sentinel add|watch|status|risk`
 * Zero dependencies. Also invoked via `npx apidocs sentinel ...`.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { slugify } from "./prober.js";
import { loadConfig, saveConfig, loadResults } from "./store.js";
import { runWatch } from "./watch.js";

const HELP = `Apipuccino Sentinel — dead-API early-warning for YOUR stack

Usage:
  sentinel add <url> [--name <name>] [--slug <slug>] [--openapi-url <u>]
                     [--expected-status <n>] [--json-path <$.path>] [--webhook <url>]
  sentinel watch [--webhook <url>] [--json]      probe all watched deps, emit alerts
  sentinel status [--json]                       show last check per dependency
  sentinel risk [--json]                         dependency risk dashboard (Stable/Evolving/Volatile)

State lives in .sentinel/ (config.json = commit this; results/history/cache = local).
Exit code: 1 when any DEATH event fired (CI-friendly), else 0.
`;

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, opts };
}

async function cmdAdd(cwd, argv) {
  const { positional, opts } = parseArgs(argv);
  const url = positional[0];
  if (!url) return { exitCode: 2, output: "✗ usage: sentinel add <url> [--name <n>] [--slug <s>]" };
  try {
    new URL(url);
  } catch {
    return { exitCode: 2, output: `✗ not a valid URL: ${url}` };
  }
  const config = await loadConfig(cwd);
  const slug = opts.slug ?? slugify(opts.name ?? new URL(url).hostname);
  if (config.deps.find((d) => d.slug === slug)) {
    return { exitCode: 1, output: `✗ slug "${slug}" already watched (use --slug to pick another)` };
  }
  config.deps.push({
    name: opts.name ?? slug,
    slug,
    url,
    probe: {
      method: "GET",
      expectedStatus: Number(opts["expected-status"] ?? 200),
      ...(opts["json-path"] ? { expectedJsonPath: opts["json-path"] } : {}),
      timeoutMs: 8000,
    },
    ...(opts["openapi-url"] ? { openapiUrl: opts["openapi-url"] } : {}),
    added: new Date().toISOString().slice(0, 10),
  });
  if (opts.webhook) config.alerts = { ...config.alerts, webhook: opts.webhook };
  await saveConfig(cwd, config);
  return { exitCode: 0, output: `✓ watching "${slug}" → ${url}\n  next: sentinel watch` };
}

function table(results) {
  const rows = results.map((r) => ({
    slug: r.slug,
    risk: r.risk?.level ?? "?",
    live: r.ok == null ? "pending" : r.ok ? "live" : `dead x${r.consecutiveFailures}`,
    latency: `${r.latencyMs}ms`,
    checked: r.timeChecked,
  }));
  const pad = (s, n) => String(s).padEnd(n);
  const head = `${pad("SLUG", 24)} ${pad("RISK", 10)} ${pad("STATE", 10)} ${pad("LATENCY", 9)} LAST CHECKED`;
  return [head, ...rows.map((r) => `${pad(r.slug, 24)} ${pad(r.risk, 10)} ${pad(r.live, 10)} ${pad(r.latency, 9)} ${r.checked}`)].join("\n");
}

async function cmdStatus(cwd, argv) {
  const { opts } = parseArgs(argv);
  const config = await loadConfig(cwd);
  const prev = await loadResults(cwd);
  if (config.deps.length === 0) return { exitCode: 0, output: "nothing watched yet — run `sentinel add <url>` first" };
  const bySlug = new Map((prev?.results ?? []).map((r) => [r.slug, r]));
  const merged = config.deps.map((d) => bySlug.get(d.slug) ?? { slug: d.slug, url: d.url, ok: null, consecutiveFailures: 0, latencyMs: 0, timeChecked: "never checked", risk: { level: "Unknown", reason: "not checked yet — run `sentinel watch`" } });
  if (opts.json) return { exitCode: 0, output: JSON.stringify({ checkedAt: prev?.checkedAt ?? null, results: merged }, null, 2) };
  return { exitCode: 0, output: table(merged) };
}

async function cmdRisk(cwd, argv) {
  const { opts } = parseArgs(argv);
  const config = await loadConfig(cwd);
  const prev = await loadResults(cwd);
  if (config.deps.length === 0) return { exitCode: 0, output: "nothing watched yet — run `sentinel add <url>` first" };
  const bySlug = new Map((prev?.results ?? []).map((r) => [r.slug, r]));
  const merged = config.deps.map((d) => bySlug.get(d.slug) ?? { slug: d.slug, url: d.url, consecutiveFailures: 0, risk: { level: "Unknown", reason: "not checked yet — run `sentinel watch`" } });
  if (opts.json) return { exitCode: 0, output: JSON.stringify({ checkedAt: prev?.checkedAt ?? null, summary: prev?.summary ?? null, deps: merged.map((r) => ({ slug: r.slug, url: r.url, risk: r.risk, consecutiveFailures: r.consecutiveFailures })) }, null, 2) };
  const lines = merged.map((r) => `${r.risk?.level === "Volatile" ? "☠" : r.risk?.level === "Evolving" ? "●" : r.risk?.level === "Stable" ? "✓" : "?"} ${r.slug} — ${r.risk?.level} (${r.risk?.reason})`);
  const s = prev?.summary;
  const tail = s ? `\n${s.stable} Stable · ${s.evolving} Evolving · ${s.volatile} Volatile — ${s.ok}/${s.total} live` : "";
  return { exitCode: 0, output: [`Dependency risk (${prev?.checkedAt ?? "never checked"}):`, ...lines].join("\n") + tail };
}

async function cmdWatch(cwd, argv) {
  const { opts } = parseArgs(argv);
  const report = await runWatch({ cwd, webhook: opts.webhook, quiet: Boolean(opts.json) });
  if (opts.json) return { exitCode: report.summary.deaths > 0 ? 1 : 0, output: JSON.stringify(report, null, 2) };
  const lines = report.events.length
    ? report.events.map((e) => `  [${e.type}] ${e.slug}`)
    : ["  (no events — all quiet)"];
  return {
    exitCode: report.summary.deaths > 0 ? 1 : 0,
    output: [`watched ${report.summary.total}, ${report.summary.ok} live`, ...lines].join("\n"),
  };
}

export async function run(argv = [], { cwd = process.cwd() } = {}) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "add":
      return cmdAdd(cwd, rest);
    case "watch":
      return cmdWatch(cwd, rest);
    case "status":
      return cmdStatus(cwd, rest);
    case "risk":
      return cmdRisk(cwd, rest);
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return { exitCode: 0, output: HELP };
    default:
      return { exitCode: 2, output: `✗ unknown command "${cmd}"\n\n${HELP}` };
  }
}

async function main() {
  const res = await run(process.argv.slice(2), { cwd: process.cwd() });
  console.log(res.output);
  process.exit(res.exitCode);
}

const invokedDirectly = (() => {
  try {
    return pathToFileURL(path.resolve(process.argv[1] ?? "")).href === import.meta.url;
  } catch {
    return false;
  }
})();
if (invokedDirectly) main().catch((e) => {
  console.error(e);
  process.exit(1);
});

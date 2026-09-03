/**
 * Apipuccino Sentinel — local store.
 * Layout (HISTORY != GIT, same as the directory):
 *   .sentinel/config.json            watched deps + alert settings (COMMIT this)
 *   .sentinel/results.json           latest check only (overwrite)
 *   .sentinel/last-report.json       latest events + summary (overwrite)
 *   .sentinel/history/YYYY-MM-DD.jsonl  append-only runs
 *   .sentinel/cache/<slug>.json      last-known-good bodies (stale-cache guard)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { CACHE_DIR, CONFIG_FILE, HISTORY_DIR, REPORT_FILE, RESULTS_FILE, SENTINEL_DIR } from "./constants.js";

export function sentinelPaths(cwd = process.cwd()) {
  const dir = path.join(cwd, SENTINEL_DIR);
  return {
    dir,
    configPath: path.join(dir, CONFIG_FILE),
    resultsPath: path.join(dir, RESULTS_FILE),
    reportPath: path.join(dir, REPORT_FILE),
    historyDir: path.join(dir, HISTORY_DIR),
    cacheDir: path.join(dir, CACHE_DIR),
  };
}

export async function loadConfig(cwd = process.cwd()) {
  const { configPath } = sentinelPaths(cwd);
  try {
    const raw = JSON.parse(await fs.readFile(configPath, "utf8"));
    return { deps: Array.isArray(raw.deps) ? raw.deps : [], alerts: raw.alerts ?? {} };
  } catch {
    return { deps: [], alerts: {} };
  }
}

export async function saveConfig(cwd, config) {
  const { dir, configPath } = sentinelPaths(cwd);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export async function loadResults(cwd = process.cwd()) {
  const { resultsPath } = sentinelPaths(cwd);
  try {
    return JSON.parse(await fs.readFile(resultsPath, "utf8"));
  } catch {
    return null;
  }
}

export async function saveResults(cwd, payload) {
  const { dir, resultsPath, historyDir } = sentinelPaths(cwd);
  await fs.mkdir(historyDir, { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  const day = payload.checkedAt.slice(0, 10);
  await fs.appendFile(
    path.join(historyDir, `${day}.jsonl`),
    JSON.stringify({ checkedAt: payload.checkedAt, summary: payload.summary, results: payload.results }) + "\n",
    "utf8",
  );
}

export async function saveReport(cwd, report) {
  const { dir, reportPath } = sentinelPaths(cwd);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
}

export async function saveCache(cwd, slug, { body, contentType }) {
  const { cacheDir } = sentinelPaths(cwd);
  await fs.mkdir(cacheDir, { recursive: true });
  const safe = slug.replace(/[^a-z0-9-]+/gi, "-");
  await fs.writeFile(
    path.join(cacheDir, `${safe}.json`),
    JSON.stringify({ slug, savedAt: new Date().toISOString(), contentType, body }),
    "utf8",
  );
}

export async function loadCache(cwd, slug) {
  const { cacheDir } = sentinelPaths(cwd);
  const safe = slug.replace(/[^a-z0-9-]+/gi, "-");
  try {
    return JSON.parse(await fs.readFile(path.join(cacheDir, `${safe}.json`), "utf8"));
  } catch {
    return null;
  }
}

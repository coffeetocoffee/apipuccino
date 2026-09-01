#!/usr/bin/env node
/**
 * diff.mjs — Apipuccino Verified (v3.6 core)
 * For every slug in drift-report.json (spec changed this run), fetch current OpenAPI spec,
 * compare to the previous snapshot, classify each change (breaking | non_breaking | additive),
 * append to data/changelog/<slug>.jsonl, and compute a Stability rating in history-summary.json.
 * Only runs on drifted slugs — cheap, idempotent, no work when nothing drifted (Law #3 ZERO-COST).
 * Run from repo root: node packages/directory/scripts/diff.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const dataDir = path.resolve(__dirname, "../data");
const SNAP_DIR = path.join(dataDir, "specs-snapshot");
const CHANGELOG_DIR = path.join(dataDir, "changelog");
const HISTORY_SUMMARY = path.join(dataDir, "history-summary.json");
const DRIFT = path.join(dataDir, "drift-report.json");
const apis = JSON.parse(await fs.readFile(path.join(dataDir, "apis.json"), "utf8"));
const bySlugApi = Object.fromEntries(apis.map(a => [a.slug, a]));
const UA = "ApipuccinoBot/2.0 (+https://github.com/coffeetocoffee/apipuccino)";
const HTTP = ["get", "post", "put", "delete", "patch", "options", "head"];
const DAY = 864e5;

// ---- spec collection ----
export function collectOps(spec) {
  const ops = {};
  for (const p of Object.keys(spec.paths || {})) {
    const item = spec.paths[p] || {};
    for (const m of HTTP) if (item[m]) ops[`${m.toUpperCase()} ${p}`] = { path: p, method: m.toUpperCase(), op: item[m] };
  }
  return ops;
}
const opKey = (m, p) => `${m.toUpperCase()} ${p}`;

function simplifySecurity(op) {
  try { return op.security ? JSON.stringify(op.security) : "none"; } catch { return "none"; }
}
function paramsById(op) {
  const map = {};
  for (const pr of op.parameters || []) map[`${pr.in}:${pr.name}`] = pr;
  return map;
}
// Conservative structural signature: type + format + required + enum (breaking-relevant fields)
export function schemaSig(s) {
  if (!s) return "";
  const t = s.type;
  const fmt = s.format || "";
  const req = Array.isArray(s.required) ? [...s.required].sort().join(",") : "";
  const en = Array.isArray(s.enum) ? [...s.enum].sort().join(",") : "";
  return `${t}|${fmt}|${req}|${en}`;
}

// Recursive structural schema diff. Detects type/format/enum changes (breaking), required-ness
// changes, and object property add/remove/recurse (additive / non-breaking / breaking).
// Ignores noisy fields (description, example, nullable) to keep false positives low (Law #2).
export function diffSchema(prev, curr, ctx = "") {
  const c = [];
  if (!prev && !curr) return c;
  if (!prev && curr) { c.push({ severity: "additive", change: "schema_added", detail: `${ctx}schema added` }); return c; }
  if (prev && !curr) { c.push({ severity: "breaking", change: "schema_removed", detail: `${ctx}schema removed` }); return c; }
  if (prev.type !== curr.type) c.push({ severity: "breaking", change: "type_changed", detail: `${ctx}type ${prev.type || "?"} -> ${curr.type || "?"}` });
  const pf = prev.format || "", cf = curr.format || "";
  if (pf !== cf) c.push({ severity: "breaking", change: "format_changed", detail: `${ctx}format ${pf || "?"} -> ${cf || "?"}` });
  const pe = (prev.enum || []).slice().sort().join(","), ce = (curr.enum || []).slice().sort().join(",");
  if (pe !== ce) c.push({ severity: "breaking", change: "enum_changed", detail: `${ctx}enum changed` });
  const pr = new Set(prev.required || []), cr = new Set(curr.required || []);
  for (const k of pr) if (!cr.has(k)) c.push({ severity: "breaking", change: "required_removed", detail: `${ctx}required ${k} removed` });
  for (const k of cr) if (!pr.has(k)) c.push({ severity: "additive", change: "required_added", detail: `${ctx}required ${k} added` });
  const pp = prev.properties || {}, cp = curr.properties || {};
  for (const k of Object.keys(pp)) if (!(k in cp)) c.push({ severity: pr.has(k) ? "breaking" : "non_breaking", change: "property_removed", detail: `${ctx}property ${k} removed` });
  for (const k of Object.keys(cp)) {
    if (!(k in pp)) c.push({ severity: cr.has(k) ? "breaking" : "additive", change: "property_added", detail: `${ctx}property ${k} added${cr.has(k) ? " (required)" : ""}` });
    else for (const sc of diffSchema(pp[k], cp[k], `${ctx}${k}.`)) c.push(sc);
  }
  if (prev.items || curr.items) for (const sc of diffSchema(prev.items || null, curr.items || null, `${ctx}items.`)) c.push(sc);
  return c;
}
function bodySchema(op) {
  const rb = op.requestBody || op.requestBody;
  if (!rb) return null;
  return rb.content?.["application/json"]?.schema || rb.schema || null;
}
function respSchema(resp) {
  if (!resp) return null;
  return resp.content?.["application/json"]?.schema || resp.schema || null;
}

// ---- per-operation diff ----
export function diffOp(prevOp, currOp) {
  const c = [];
  const ps = simplifySecurity(prevOp), cs = simplifySecurity(currOp);
  if (ps !== cs) c.push({ severity: "breaking", change: "changed_auth", detail: `security ${ps} -> ${cs}` });
  const pp = paramsById(prevOp), cp = paramsById(currOp);
  for (const k of Object.keys(pp)) if (!cp[k]) c.push({ severity: pp[k].required ? "breaking" : "non_breaking", change: "removed_param", detail: `param ${k} removed` });
  for (const k of Object.keys(cp)) {
    if (!pp[k]) c.push({ severity: cp[k].required ? "breaking" : "additive", change: "added_param", detail: `param ${k} added${cp[k].required ? " (required)" : ""}` });
    else for (const sc of diffSchema(pp[k].schema, cp[k].schema, `param ${k} `)) c.push(sc);
  }
  const pb = bodySchema(prevOp), cb = bodySchema(currOp);
  if (pb && !cb) c.push({ severity: "non_breaking", change: "removed_request_body", detail: "requestBody removed" });
  if (!pb && cb) c.push({ severity: (cb.required !== false) ? "breaking" : "additive", change: "added_request_body", detail: `requestBody added${cb.required !== false ? " (required)" : ""}` });
  if (pb && cb) for (const sc of diffSchema(pb, cb, "requestBody ")) c.push(sc);
  const pr = prevOp.responses || {}, cr = currOp.responses || {};
  for (const code of Object.keys(pr)) if (!cr[code]) c.push({ severity: "breaking", change: "removed_response", detail: `response ${code} removed` });
  for (const code of Object.keys(cr)) {
    if (!pr[code]) c.push({ severity: "additive", change: "added_response", detail: `response ${code} added` });
    else for (const sc of diffSchema(respSchema(pr[code]), respSchema(cr[code]), `response ${code} `)) c.push(sc);
  }
  return c;
}

export function diffSpecs(prev, curr) {
  const changes = [];
  const po = collectOps(prev), co = collectOps(curr);
  for (const k of Object.keys(po)) if (!co[k]) changes.push({ severity: "breaking", change: "removed_operation", detail: `${k} removed` });
  for (const k of Object.keys(co)) if (!po[k]) changes.push({ severity: "additive", change: "added_operation", detail: `${k} added` });
  for (const k of Object.keys(po)) if (co[k]) {
    try { for (const ch of diffOp(po[k].op, co[k].op)) changes.push({ ...ch, path: k }); }
    catch { /* skip malformed op */ }
  }
  return changes;
}

// ---- main ----
async function run() {
let drift = null;
try { drift = JSON.parse(await fs.readFile(DRIFT, "utf8")); } catch {}
if (!drift?.drifts?.length) { console.log("diff: no drift-report.json or no drifts — nothing to do"); return; }

await fs.mkdir(SNAP_DIR, { recursive: true });
await fs.mkdir(CHANGELOG_DIR, { recursive: true });
let historySummary = {};
try { historySummary = JSON.parse(await fs.readFile(HISTORY_SUMMARY, "utf8")); } catch {}
const today = new Date();

for (const d of drift.drifts) {
  const slug = d.slug;
  const api = bySlugApi[slug];
  if (!api?.openapiUrl) { console.log(`diff: ${slug} has no openapiUrl — skip`); continue; }
  try {
    const res = await fetch(api.openapiUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.log(`diff: ${slug} spec HTTP ${res.status} — skip`); continue; }
    const text = await res.text();
    let isJson = false; try { JSON.parse(text); isJson = true; } catch {}
    const normalized = isJson
      ? text.replace(/("openapi"\s*:\s*"3\.1\.\d+")/g, '"openapi":"3.1.1"')
      : text.replace(/^(openapi:\s*["']?3\.1\.\d+["']?)$/m, 'openapi: "3.1.1"');
    const tmp = path.join(root, "dist", "docs", "_specs", `${slug}.${isJson ? "json" : "yaml"}`);
    await fs.mkdir(path.dirname(tmp), { recursive: true });
    await fs.writeFile(tmp, normalized, "utf8");
    const { parseSpec } = await import("../../docs/src/parser/index.js");
    const curr = await parseSpec(tmp);
    await fs.rm(tmp, { force: true });

    const snapFile = path.join(SNAP_DIR, `${slug}.json`);
    let prev = null;
    try { prev = JSON.parse(await fs.readFile(snapFile, "utf8")); } catch {}

    if (!prev) {
      await fs.writeFile(snapFile, JSON.stringify(curr), "utf8");
      console.log(`diff: ${slug} — first spec captured (no changelog yet)`);
      continue;
    }

    const changes = diffSpecs(prev, curr);
    const clogFile = path.join(CHANGELOG_DIR, `${slug}.jsonl`);
    for (const ch of changes) {
      const entry = { date: today.toISOString().slice(0, 10), severity: ch.severity, change: ch.change, path: ch.path || null, detail: ch.detail };
      await fs.appendFile(clogFile, JSON.stringify(entry) + "\n", "utf8");
    }
    await fs.writeFile(snapFile, JSON.stringify(curr), "utf8");

    const lines = (await fs.readFile(clogFile, "utf8")).trim().split("\n").filter(Boolean);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const breaking30d = entries.filter(e => e.severity === "breaking" && (today - new Date(e.date)) <= 30 * DAY).length;
    const breaking90d = entries.filter(e => e.severity === "breaking" && (today - new Date(e.date)) <= 90 * DAY).length;
    const lastBreak = entries.filter(e => e.severity === "breaking").slice(-1)[0]?.date || null;
    const stability = breaking90d === 0 ? "stable" : (breaking30d <= 1 && breaking90d <= 3 ? "evolving" : "volatile");
    historySummary[slug] = { ...(historySummary[slug] || {}), stability, breaking30d, breaking90d, lastBreak, changelogCount: entries.length };

    console.log(`diff: ${slug} — ${changes.length} change(s), stability=${stability} (${breaking30d}/30d, ${breaking90d}/90d)`);
  } catch (e) {
    console.log(`diff: ${slug} — error ${e.message?.slice(0, 120)}`);
  }
}

await fs.writeFile(HISTORY_SUMMARY, JSON.stringify(historySummary, null, 2) + "\n", "utf8");
console.log("✓ diff complete");
}

// Run only when executed directly (not when imported for tests)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) run();

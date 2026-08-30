#!/usr/bin/env node
/**
 * Apipuccino Directory — Hardened Health Checker v2.0
 * L0: HTTP 200 + timeout 8s | L1: content-type + jsonPath exists | L2: contentHash drift (Phase 2)
 * Flow: p-limit 5 + jitter 800-1600ms + UA ApipuccinoBot/2.0 + Retry-After
 * Secondary probe via CF Worker on failure (CF_WORKER_URL env)
 * HISTORY != GIT: overwrite results.json, append to history/YYYY-MM-DD.jsonl
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const APIS_JSON = path.join(DATA_DIR, "apis.json");
const RESULTS_JSON = path.join(DATA_DIR, "results.json");

// Config per AGENTS.md + Master Plan Sec 7
const CONCURRENCY = 5;
const JITTER_MIN = 800;
const JITTER_MAX = 1600;
const UA = "ApipuccinoBot/2.0 (+https://github.com/coffeetocoffee/apipuccino)";
const CF_WORKER_URL = process.env.CF_WORKER_URL || ""; // e.g. https://apipuccino-probe.workers.dev/?url=

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter() { return JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN); }

/** Minimal p-limit (avoid dep if not installed, but use it if available) */
async function pLimit(concurrency) {
  try {
    const mod = await import("p-limit");
    return mod.default(concurrency);
  } catch {
    // fallback tiny implementation
    let active = 0; const queue = [];
    const run = async (fn) => {
      if (active >= concurrency) await new Promise(res => queue.push(res));
      active++;
      try { return await fn(); } finally { active--; if (queue.length) queue.shift()(); }
    };
    const limiter = (fn) => run(fn);
    limiter.concurrency = concurrency;
    return limiter;
  }
}

function getJsonPath(obj, path) {
  // supports "$.a.b" and "$.a[0].b" simple
  if (!path || path === "$") return obj;
  const clean = path.replace(/^\$\.?/, "");
  const parts = clean.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    const m = p.match(/^(\w+)\[(\d+)\]$/);
    if (m) { cur = cur[m[1]]?.[Number(m[2])]; }
    else cur = cur[p];
  }
  return cur;
}

function hashContent(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

async function probe(api, prevFailures = 0) {
  const { url, probe: cfg } = api;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 8000);
  const start = Date.now();
  let status = null, contentType = null, bodyText = "", ok = false, error = null;
  try {
    // Fetch with single retry on 429
    let lastRes = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, {
        method: cfg.method || "GET",
        signal: controller.signal,
        headers: { "User-Agent": UA, "Accept": "*/*" },
      });
      lastRes = res;
      status = res.status;
      contentType = res.headers.get("content-type");
      if (res.status === 429) {
        const ra = res.headers.get("retry-after");
        const wait = ra ? Math.min(Number(ra) * 1000, 4000) : 1200;
        await sleep(wait);
        if (attempt === 0) continue; // retry once
        bodyText = await res.text().catch(() => "");
        throw new Error(`expected status ${cfg.expectedStatus ?? 200} got 429 (rate-limited, retried)`);
      }
      bodyText = await res.text();
      break;
    }
    if (!lastRes) throw new Error("no response");
    // L0: status
    if (status !== (cfg.expectedStatus ?? 200)) throw new Error(`expected status ${cfg.expectedStatus} got ${status}`);
    // L1: content-type
    if (cfg.expectedContentType && contentType && !contentType.includes(cfg.expectedContentType)) {
      throw new Error(`expected content-type ${cfg.expectedContentType} got ${contentType}`);
    }
    // L1: jsonPath
    if (cfg.expectedJsonPath) {
      let json; try { json = JSON.parse(bodyText); } catch { throw new Error("expected JSON but parse failed"); }
      const val = getJsonPath(json, cfg.expectedJsonPath);
      if (val === undefined || val === null) throw new Error(`jsonPath ${cfg.expectedJsonPath} not found`);
    }
    ok = true;
  } catch (e) {
    error = e.name === "AbortError" ? "timeout" : e.message;
    ok = false;
  } finally {
    clearTimeout(timeout);
  }
// L3: minimal OpenAPI meta-schema (lightweight — structural, not full 3.1 spec)
const OPENAPI_META_SCHEMA = {
  type: "object",
  required: ["info", "paths"],
  properties: {
    openapi: { type: "string", pattern: "^3\\." },
    swagger: { type: "string", pattern: "^2\\." },
    info: {
      type: "object",
      required: ["title", "version"],
      properties: { title: { type: "string" }, version: { type: "string" } },
    },
    paths: { type: "object" },
    components: { type: "object" },
  },
  anyOf: [{ required: ["openapi"] }, { required: ["swagger"] }],
};

/** L3: fetch openapiUrl, parse JSON/YAML, ajv-validate against meta-schema (Phase 3) */
async function validateOpenapi(api) {
  const UA3 = UA;
  let specText, status;
  try {
    const oRes = await fetch(api.openapiUrl, { headers: { "User-Agent": UA3 }, signal: AbortSignal.timeout(8000) });
    status = oRes.status;
    if (!oRes.ok) {
      console.log(`  L3 ${api.slug} openapiUrl ${status}`);
      return { l3Validated: false, l3Error: `openapiUrl HTTP ${status}` };
    }
    specText = await oRes.text();
  } catch (e) {
    return { l3Validated: false, l3Error: `openapiUrl ${e.name === "AbortError" ? "timeout" : e.message}` };
  }
  // parse: JSON preferred, YAML fallback (docstruct rule: never execSync, always libs)
  let spec = null;
  try {
    spec = JSON.parse(specText);
  } catch {
    try {
      const yaml = await import("yaml");
      spec = yaml.parse(specText);
    } catch {
      // last resort: structural string sniff for yaml/2.0 specs served without proper type
      if (/^(openapi|swagger):/m.test(specText)) return { l3Validated: true };
      return { l3Validated: false, l3Error: "openapiUrl not parseable as JSON/YAML" };
    }
  }
  if (!spec || typeof spec !== "object") return { l3Validated: false, l3Error: "openapiUrl empty spec" };
  // ajv validate if available, else structural fallback (same shape checks)
  try {
    const { default: Ajv } = await import("ajv");
    const ajv = new Ajv({ allErrors: false, strict: false });
    const valid = ajv.validate(OPENAPI_META_SCHEMA, spec);
    if (!valid) return { l3Validated: false, l3Error: `openapiUrl meta-schema: ${ajv.errorsText().slice(0, 120)}` };
  } catch {
    const okStruct = typeof spec.info === "object" && spec.info !== null && typeof spec.paths === "object" && (typeof spec.openapi === "string" || typeof spec.swagger === "string");
    if (!okStruct) return { l3Validated: false, l3Error: "openapiUrl structural check failed (ajv unavailable)" };
  }
  return { l3Validated: true };
}

let l3Validated = null, l3Error = null; // null=not checked
if (api.openapiUrl) {
  ({ l3Validated, l3Error } = await validateOpenapi(api));
  if (!l3Validated && l3Error) console.log(`  L3 ${api.slug} ${l3Error}`);
}

  // Fallback for auth-required APIs: probe docs URL instead of 401 data endpoint (per AGENTS.md FIX 5)
  let probeFallback = null;
  if (!ok && (api.auth === "key" || api.auth === "oauth") && api.docs) {
    try {
      const dRes = await fetch(api.docs, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
      if (dRes.ok || (dRes.status >= 200 && dRes.status < 400)) {
        probeFallback = `docs fallback OK ${dRes.status}`;
        ok = true;
        error = `data probe ${error} — docs fallback succeeded (${dRes.status})`;
      } else {
        // try GET if HEAD blocked
        const gRes = await fetch(api.docs, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
        if (gRes.ok) { ok = true; probeFallback = `docs GET ${gRes.status}`; error = `data probe ${error} — docs GET fallback ${gRes.status}`; }
      }
    } catch (e) { probeFallback = `docs fallback failed ${e.message}`; }
  }

  const latencyMs = Date.now() - start;

  // Secondary probe via CF Worker on failure (dual-region verification)
  if (!ok && CF_WORKER_URL) {
    try {
      const cfRes = await fetch(`${CF_WORKER_URL}${encodeURIComponent(url)}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
      if (cfRes.ok) {
        // If CF succeeds, treat as flake — keep ok=false but note,实际 we downgrade failure
        // Per plan: only if BOTH fail => consecutiveFailures++
        // Here we mark as recovered to avoid false death
        error = `primary failed (${error}), CF probe passed — likely runner region issue`;
        ok = true; // don't penalize
      }
    } catch { /* CF also failed — confirm failure */ }
  }

  const consecutiveFailures = ok ? 0 : prevFailures + 1;
  const schemaHash = bodyText ? hashKeys(bodyText) : null;
  return {
    slug: api.slug,
    ok,
    status,
    latencyMs,
    contentType,
    timeChecked: new Date().toISOString(),
    consecutiveFailures,
    contentHash: bodyText ? hashContent(bodyText) : null,
    schemaHash,
    l3Validated,
    ...(l3Error ? { l3Error } : {}),
    probeFallback,
    ...(error ? { error } : {}),
  };
}

function hashKeys(json) {
  try {
    const obj = JSON.parse(json);
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "empty-array";
      const first = obj[0];
      if (typeof first === "object" && first !== null) {
        const keys = Object.keys(first).sort().join(",");
        return crypto.createHash("sha256").update(keys + ":len" + obj.length).digest("hex").slice(0, 12);
      }
      return crypto.createHash("sha256").update("array:len" + obj.length).digest("hex").slice(0, 12);
    }
    if (obj && typeof obj === "object") {
      const keys = Object.keys(obj).sort().join(",");
      return crypto.createHash("sha256").update(keys).digest("hex").slice(0, 12);
    }
    return null;
  } catch { return null; }
}

async function main() {
  const apis = JSON.parse(await fs.readFile(APIS_JSON, "utf8"));
  let prevResults = {};
  let prevHashes = {};
  let prevSchemaHashes = {};
  try {
    const prev = JSON.parse(await fs.readFile(RESULTS_JSON, "utf8"));
    for (const r of prev.results) {
      prevResults[r.slug] = r.consecutiveFailures;
      if (r.contentHash) prevHashes[r.slug] = r.contentHash;
      if (r.schemaHash) prevSchemaHashes[r.slug] = r.schemaHash;
      // fallback: if no schemaHash stored yet, derive from contentHash history (will be noisy once, then stabilizes)
      else if (r.contentHash) prevSchemaHashes[r.slug] = r.contentHash;
    }
  } catch {}

  const limit = await pLimit(CONCURRENCY);
  const results = [];
  let idx = 0;

  const tasks = apis.map((api) => limit(async () => {
    // throttle 30/min = ~2000ms per batch, we do jitter + concurrency 5 -> ~30/min achieved
    if (idx++ > 0) await sleep(jitter());
    const prevFail = prevResults[api.slug] ?? 0;
    const res = await probe(api, prevFail);
    results.push(res);
    const icon = res.ok ? "✓" : "✗";
    console.log(`${icon} ${api.slug} ${res.status ?? "ERR"} ${res.latencyMs}ms${res.error ? " " + res.error : ""}`);
    return res;
  }));

  await Promise.all(tasks);

  const summary = { total: results.length, ok: results.filter(r=>r.ok).length, failed: results.filter(r=>!r.ok).length };
  const checkedAt = new Date().toISOString();
  const out = { checkedAt, summary, results: results.sort((a,b)=>a.slug.localeCompare(b.slug)) };

  // Commit only if summary changed (reduce churn) — caller checks file diff; we always write but GH Action gates commit
  await fs.writeFile(RESULTS_JSON, JSON.stringify(out, null, 2) + "\n", "utf8");

  // Append to history JSONL
  const day = checkedAt.slice(0,10);
  const histFile = path.join(DATA_DIR, "history", `${day}.jsonl`);
  const line = JSON.stringify({ checkedAt, summary, results }) + "\n";
  await fs.appendFile(histFile, line, "utf8");

  // L2 Drift detection: schemaHash changed while ok (stable drift, not random values)
  // Compare schemaHash (sorted keys) not full contentHash to avoid noise from random responses
  const drifts = results.filter(r => r.ok && prevSchemaHashes[r.slug] && r.schemaHash && r.schemaHash !== prevSchemaHashes[r.slug]);
  if (drifts.length) {
    console.log(`\n● Drift Alert (schema keys): ${drifts.map(d=>`${d.slug} ${prevSchemaHashes[d.slug]}→${d.schemaHash}`).join(", ")}`);
    await fs.writeFile(path.join(DATA_DIR, "drift-report.json"), JSON.stringify({ checkedAt, drifts: drifts.map(d=>({ slug: d.slug, prevHash: prevSchemaHashes[d.slug], newHash: d.schemaHash })) }, null, 2), "utf8");
  } else {
    // remove stale drift report if no drift
    await fs.unlink(path.join(DATA_DIR, "drift-report.json")).catch(()=>{});
  }

  // Death report: consecutiveFailures >=3
  const deaths = results.filter(r=>r.consecutiveFailures >= 3);
  if (deaths.length) {
    console.log(`\n⚠ Death Report: ${deaths.map(d=>d.slug).join(", ")} — should open GitHub Issue (consecutiveFailures >=3)`);
    await fs.writeFile(path.join(DATA_DIR, "death-report.json"), JSON.stringify({ checkedAt, deaths }, null, 2), "utf8");
  } else {
    await fs.unlink(path.join(DATA_DIR, "death-report.json")).catch(()=>{});
  }

  console.log(`\nDone: ${summary.ok}/${summary.total} ok, ${summary.failed} failed, ${drifts.length} drifts — ${checkedAt}`);
  console.log(`→ ${RESULTS_JSON}`);
  console.log(`→ ${histFile}`);
}

main().catch(e => { console.error(e); process.exit(1); });

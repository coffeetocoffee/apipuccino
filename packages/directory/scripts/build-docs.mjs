#!/usr/bin/env node
/**
 * build-docs.mjs — per-slug offline docs for directory entries with openapiUrl
 * spec URL -> parseSpec -> generatePages -> dist/docs/<slug>/ (+ lunr search data)
 * Writes packages/directory/data/generated-docs.json mapping { slug: "docs/<slug>/" }
 * Run from repo root: node packages/directory/scripts/build-docs.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLunrData, vendorLunr } from "../../docs/src/search/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const dataDir = path.resolve(__dirname, "../data");
const APIS_JSON = path.join(dataDir, "apis.json");

const apis = JSON.parse(await fs.readFile(APIS_JSON, "utf8"));
const targets = apis.filter(a => a.openapiUrl);
console.log(`build-docs: ${targets.length} entries with openapiUrl`);

const results = [];
let done = 0;
async function buildOne(api) {
  const out = path.join(root, "dist", "docs", api.slug);
  try {
    const { parseSpec } = await import("../../docs/src/parser/index.js");
    const { generatePages } = await import("../../docs/src/generator/index.js");
    // fetch spec ourselves (UA + timeout), parseSpec from temp file — avoids URL/ref-parser quirks
    const res = await fetch(api.openapiUrl, { headers: { "User-Agent": "ApipuccinoBot/2.0 (+https://github.com/coffeetocoffee/apipuccino)" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`spec HTTP ${res.status}`);
    const text = await res.text();
    let isJson = false;
    try { JSON.parse(text); isJson = true; } catch {}
    // swagger-parser v10 supports <=3.1.1 — normalize newer patch versions (e.g. weather.gov 3.1.2)
    const normalized = isJson
      ? text.replace(/("openapi"\s*:\s*"3\.1\.\d+")/g, '"openapi":"3.1.1"')
      : text.replace(/^(openapi:\s*["']?3\.1\.\d+["']?)$/m, 'openapi: "3.1.1"');
    const tmp = path.join(root, "dist", "docs", "_specs", api.slug + (isJson ? ".json" : ".yaml"));
    await fs.mkdir(path.dirname(tmp), { recursive: true });
    await fs.writeFile(tmp, normalized, "utf8");
    const spec = await parseSpec(tmp);
    await generatePages(spec, { output: out, theme: "default" });
    const data = await buildLunrData(out);
    await fs.writeFile(path.join(out, "search-index.json"), JSON.stringify(data), "utf8");
    await vendorLunr(out);
    results.push({ slug: api.slug, pages: data.docs.length });
    console.log(`✓ ${api.slug} — ${data.docs.length} pages`);
  } catch (e) {
    console.log(`✗ ${api.slug} — ${e.message?.slice(0, 100)}`);
  } finally {
    done++;
  }
}

// concurrency 4
const queue = [...targets];
const workers = Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const api = queue.shift();
    if (done > 0) await new Promise(r => setTimeout(r, 150));
    await buildOne(api);
  }
});
await Promise.all(workers);

const mapping = {};
for (const r of results) mapping[r.slug] = `docs/${r.slug}/`;
await fs.writeFile(path.join(dataDir, "generated-docs.json"), JSON.stringify(mapping, null, 2) + "\n", "utf8");
await fs.rm(path.join(root, "dist", "docs", "_specs"), { recursive: true, force: true }); // temp spec files
console.log(`\nbuild-docs: ${results.length}/${targets.length} generated → dist/docs/ (mapping: data/generated-docs.json)`);
if (results.length === 0 && targets.length > 0) process.exit(1);

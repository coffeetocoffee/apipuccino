#!/usr/bin/env node
/**
 * Convert public-apis (https://github.com/public-apis/public-apis) JSON to Apipuccino apis.json
 * Usage: node seed-from-public-apis.mjs --input ./public-apis.json --output ../data/apis.json --limit 150
 * Keeps only https, no auth or apiKey where possible — quality > quantity (400-600 alive >1500 stale)
 */
import fs from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr) => a.startsWith("--") ? [a.slice(2), arr[i+1]?.startsWith("--") ? true : arr[i+1]] : []).filter(e=>e.length));
const input = args.input || "./public-apis.json";
const output = args.output || path.resolve("../data/apis.json");
const limit = Number(args.limit || 150);

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48); }
function toCategory(c) { return c.toLowerCase().replace(/\s+/g,"-"); }

// Fetch live if input missing
let entries;
try { entries = JSON.parse(await fs.readFile(input,"utf8")).entries; }
catch {
  console.log("Fetching https://api.publicapis.org/entries …");
  const res = await fetch("https://api.publicapis.org/entries");
  entries = (await res.json()).entries;
}

const picked = entries
  .filter(e => e.Link.startsWith("https://") && e.HTTPS)
  .filter(e => e.Auth === "" || e.Auth === "apiKey") // prefer keyless; drop OAuth bloat per AGENTS.md weak category fix
  .sort((a,b) => (a.Category.localeCompare(b.Category)))
  .slice(0, limit)
  .map(e => ({
    name: e.API,
    slug: slugify(e.API),
    url: e.Link, // will need manual probe tuning — default to GET 200
    probe: { method: "GET", expectedStatus: 200, timeoutMs: 8000 },
    auth: e.Auth === "apiKey" ? "key" : "none",
    category: toCategory(e.Category),
    cors: e.Cors === "yes" ? "yes" : e.Cors === "no" ? "no" : "unknown",
    docs: e.Link,
    added: new Date().toISOString().slice(0,10),
  }));

// Dedupe slugs
const seen = new Set();
for (const p of picked) { let s=p.slug, i=1; while(seen.has(s)) s=`${p.slug}-${i++}`; p.slug=s; seen.add(s); }

await fs.writeFile(output, JSON.stringify(picked, null, 2)+"\n","utf8");
console.log(`✓ wrote ${picked.length} entries to ${output}`);
console.log("Next: manually tune probe.expectedContentType/expectedJsonPath for top 20, then run verify.mjs + check.mjs");

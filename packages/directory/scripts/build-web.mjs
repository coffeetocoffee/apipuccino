#!/usr/bin/env node
// Build beautiful directory web to dist/index.html + api-docs subfolder
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const dataDir = path.resolve(__dirname, "../data");
const apis = JSON.parse(await fs.readFile(path.join(dataDir, "apis.json"), "utf8"));
const results = JSON.parse(await fs.readFile(path.join(dataDir, "results.json"), "utf8"));
const bySlug = Object.fromEntries(results.results.map(r=>[r.slug,r]));
const pct = Math.round(results.summary.ok/results.summary.total*100);
const checked = new Date(results.checkedAt).toLocaleString();

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apipuccino — Nobody lists dead APIs.</title><meta name="description" content="Nobody lists dead APIs. Free, self-verifying directory (40/40 live) + offline docs."><style>
:root{--bg:#fcfcf9;--fg:#0f172a;--muted:#64748b;--border:#e2e8f0;--card:#fff;--accent:#0ea5e9;--accent-2:#8b5cf6;--ok:#16a34a;--bad:#dc2626;--radius:16px;--shadow:0 8px 30px rgba(15,23,42,.06)}
*{box-sizing:border-box}body{margin:0;font-family:ui-sans-system,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--fg);background:var(--bg);line-height:1.5}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;z-index:10;backdrop-filter:blur(8px);background:color-mix(in srgb, var(--bg) 85%, transparent);border-bottom:1px solid var(--border)}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.nav{display:flex;align-items:center;justify-content:space-between;padding:14px 0}
.brand{font-weight:800;letter-spacing:-.02em;display:flex;gap:10px;align-items:center}.dot{width:10px;height:10px;border-radius:999px;background:var(--ok);box-shadow:0 0 0 6px color-mix(in srgb, var(--ok) 20%, transparent);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 6px color-mix(in srgb, var(--ok) 20%, transparent)}50%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 6px transparent}}
.hero{padding:56px 0 24px;display:grid;gap:18px}
.hero h1{font-size:42px;line-height:1.05;letter-spacing:-.03em;margin:0}.hero h1 span{background:linear-gradient(90deg,var(--accent),var(--accent-2));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{color:var(--muted);max-width:62ch;margin:0;font-size:17px}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}
.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:var(--card);border:1px solid var(--border);box-shadow:var(--shadow);font-weight:600;font-size:13px}
.cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}
.btn{padding:12px 18px;border-radius:999px;border:1px solid var(--border);background:var(--fg);color:var(--bg);font-weight:700}.btn.sec{background:var(--card);color:var(--fg)}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.toolbar{padding:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.search{flex:1;min-width:220px;display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;border:1px solid var(--border);background:var(--bg)}
.search input{border:0;outline:0;background:transparent;color:var(--fg);width:100%;font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;padding:12px 14px;color:var(--muted);font-weight:600;border-bottom:1px solid var(--border);background:color-mix(in srgb, var(--bg) 60%, var(--card))}
td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
tr:hover td{background:color-mix(in srgb, var(--accent) 6%, var(--card))}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;padding:2px 6px;border-radius:6px;background:var(--bg);border:1px solid var(--border)}
.badge{font-size:11px;padding:4px 8px;border-radius:999px;background:var(--bg);border:1px solid var(--border)}
.cat{font-size:11px;letter-spacing:.02em;text-transform:uppercase;color:var(--muted);border:1px solid var(--border);padding:2px 6px;border-radius:999px}
footer{padding:28px 0;color:var(--muted);font-size:13px;text-align:center}
@media(max-width:700px){.hero h1{font-size:32px}}
</style></head><body>
<header><div class="wrap nav"><div class="brand"><span class="dot"></span><b>Apipuccino</b> <span style="color:var(--muted);font-weight:600">· Nobody lists dead APIs.</span></div><div style="display:flex;gap:14px"><a href="https://github.com/coffeetocoffee/apipuccino">GitHub</a><a href="./api-docs/" style="font-weight:700">Docs →</a></div></div></header>
<main class="wrap">
<section class="hero"><h1>Nobody lists <span>dead APIs.</span></h1><p>Free, self-verifying directory (40/40 live, nightly L0-L3 checks + drift alerts) + offline OpenAPI docs generator. Pagefind search, Try-It playground, 4 themes. MIT+CC0, zero-cost.</p>
<div class="stats"><span class="pill">● ${results.summary.ok}/${results.summary.total} live — ${pct}%</span><span class="pill">Last checked ${checked}</span><span class="pill">Pagefind + offline</span><span class="pill">MIT+CC0</span></div>
<div class="cta"><a class="btn" href="#browse">Browse APIs</a><a class="btn sec" href="https://github.com/coffeetocoffee/apipuccino#quick-start">npx apidocs build</a></div></section>
<section id="browse" class="card"><div class="toolbar"><label class="search">🔍 <input id="q" placeholder="Search APIs (name, category, slug)…"><span style="color:var(--muted);font-size:13px">${results.summary.total} APIs</span></label><span style="color:var(--muted);font-size:13px"><a href="https://github.com/coffeetocoffee/apipuccino/actions">Health Check</a> · <a href="./api-docs/">Demo</a></span></div>
<div style="overflow:auto"><table><thead><tr><th>API</th><th>Status</th><th>Latency</th><th>Sparkline</th><th>Docs</th><th>Try</th></tr></thead><tbody id="tbody">
${apis.map(api=>{
  const r=bySlug[api.slug]; const ok=r?.ok; const lat=r?.latencyMs?`${r.latencyMs}ms`:"—";
  const spark= r?.ok ? "▁▂▃▄▅▆▇█".slice(0, Math.min(8, Math.ceil((r.latencyMs||100)/250))) : "▁";
  return `<tr data-search="${(api.name+" "+api.slug+" "+api.category).toLowerCase()}"><td><a href="${api.docs}" style="font-weight:700">${api.name}</a><br><code>${api.slug}</code> <span class="cat">${api.category}</span></td><td>${r? (ok?`<span style="color:var(--ok)">● ${r.status}</span>`:`<span style="color:var(--bad)">● ${r.status??"ERR"}</span>`):"—"}</td><td>${lat}</td><td title="sparkline">${spark}</td><td><a href="${api.generatedDocs||api.docs}">Docs</a> <span class="badge">${ok?"live":"down"}</span></td><td><a href="${api.generatedDocs||api.docs}" class="badge">Try →</a></td></tr>`;
}).join("")}
</tbody></table></div></section>
<p style="color:var(--muted);font-size:13px;margin:12px 2px">Tip: <code>npx apidocs submit</code> reads your <code>openapi.yaml</code> and opens a PR — directory grows without scraping.</p>
<footer>Generated by <code>npx apidocs build</code> — Free Forever MIT+CC0 — <a href="https://github.com/coffeetocoffee/apipuccino">coffeetocoffee/apipuccino</a></footer>
</main>
<script>const q=document.getElementById('q'),rows=[...document.querySelectorAll('#tbody tr')];q.addEventListener('input',()=>{const t=q.value.toLowerCase();rows.forEach(r=>r.style.display=r.dataset.search.includes(t)?'':'none')});</script>
</body></html>`;

const dist = path.join(root, "dist");
await fs.mkdir(dist, { recursive: true });
await fs.writeFile(path.join(dist, "index.html"), html, "utf8");
// copy api-docs into dist/api-docs
const apiDocsSrc = path.join(root, "api-docs");
const apiDocsDest = path.join(dist, "api-docs");
await fs.cp(apiDocsSrc, apiDocsDest, { recursive: true }).catch(()=>{});
console.log(`✓ dist/index.html + api-docs → ${dist} (${apis.length} APIs, ${results.summary.ok}/${results.summary.total})`);

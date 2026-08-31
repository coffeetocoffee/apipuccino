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
let historySummary = {};
try { historySummary = JSON.parse(await fs.readFile(path.join(dataDir, "history-summary.json"), "utf8")); } catch {}
let death = null;
try { death = JSON.parse(await fs.readFile(path.join(dataDir, "death-report.json"), "utf8")); } catch {}
let genDocs = {};
try { genDocs = JSON.parse(await fs.readFile(path.join(dataDir, "generated-docs.json"), "utf8")); } catch {}
let drift = null;
try { drift = JSON.parse(await fs.readFile(path.join(dataDir, "drift-report.json"), "utf8")); } catch {}
const pct = Math.round(results.summary.ok/results.summary.total*100);
const checked = new Date(results.checkedAt).toLocaleString();
const byCat = {};
for(const a of apis) byCat[a.category] = (byCat[a.category]||0)+1;
const esc = s => String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const catChips = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<a href="#browse" class="cat" data-cat="${esc(c)}" title="Filter by ${esc(c)}">${c} ${n}</a>`).join(" ");
const topHistory = Object.entries(historySummary).sort((a,b)=>b[1].uptime30d - a[1].uptime30d).slice(0,5);
const docsCount = apis.filter(a => genDocs[a.slug]).length;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apipuccino — Nobody lists dead APIs.</title><meta name="description" content="Nobody lists dead APIs. Free, self-verifying directory (${results.summary.ok}/${results.summary.total} live) + offline docs."><style>
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
.cat{font-size:11px;letter-spacing:.02em;text-transform:uppercase;color:var(--muted);border:1px solid var(--border);padding:2px 6px;border-radius:999px;cursor:pointer;transition:all .15s;background:transparent;font-family:inherit}
.cat:hover{text-decoration:none;color:var(--accent);border-color:var(--accent)}
.cat.on{background:var(--accent);border-color:var(--accent);color:#fff}
footer{padding:28px 0;color:var(--muted);font-size:13px;text-align:center}
@media(max-width:700px){.hero h1{font-size:32px}}
</style></head><body>
<header><div class="wrap nav"><div class="brand"><span class="dot"></span><b>Apipuccino</b> <span style="color:var(--muted);font-weight:600">· Nobody lists dead APIs.</span></div><div style="display:flex;gap:14px"><a href="https://github.com/coffeetocoffee/apipuccino">GitHub</a><a href="./api-docs/" style="font-weight:700">Docs →</a></div></div></header>
<main class="wrap">
<section class="hero"><h1>Nobody lists <span>dead APIs.</span></h1><p>Free, self-verifying directory (${results.summary.ok}/${results.summary.total} live, nightly L0-L3 checks + drift alerts) + offline OpenAPI docs generator. Pagefind search, Try-It playground, 4 themes. MIT+CC0, zero-cost.</p>
<div class="stats"><span class="pill">● ${results.summary.ok}/${results.summary.total} live — ${pct}%</span><span class="pill">Last checked ${checked}</span><span class="pill">Pagefind + offline</span><span class="pill">MIT+CC0</span></div>
<div class="cta"><a class="btn" href="#browse">Browse APIs</a><a class="btn sec" href="https://github.com/coffeetocoffee/apipuccino#quick-start">npx apidocs build</a></div></section>
${death?.deaths?.length ? `<section class="card" style="margin:12px 0;padding:14px;background:#fef2f2;border-color:#dc2626"><b>\u25CF Death Report (${death.deaths.length})</b> — failing \u22653 days: ${death.deaths.map(d=>`<code>${d.slug}</code>`).join(", ")}</section>` : "" }
${drift?.drifts?.length ? `<section class="card" style="margin:12px 0;padding:14px;background:#fffbeb;border-color:#d97706"><b>\u25CF Drift Alert (${drift.drifts.length})</b> — schema changed while live: ${drift.drifts.map(d=>{const g=genDocs[d.slug];const href=typeof g==="string"?g:g?.href;return `${href?`<a href="${href}">${d.slug}</a>`:`<code>${d.slug}</code>`} ${d.prevHash}\u2192${d.newHash}`;}).join(", ")}</section>` : "" }
<section class="card" style="margin:12px 0;padding:14px"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><b>Categories</b> <span style="color:var(--muted);font-size:11px">(click to filter — click again to clear)</span>: ${catChips}</div>${topHistory.length ? `<div style="margin-top:10px;color:var(--muted);font-size:12px">Top 30d uptime: ${topHistory.map(([s,h])=>`<code>${s}</code> ${(h.uptime30d*100).toFixed(0)}% ${h.sparkline}`).join(" · ")}</div>` : ""}<details style="margin-top:8px"><summary style="cursor:pointer;color:var(--accent)">History graph (30d)</summary><pre style="overflow:auto;font-size:11px;background:var(--bg);padding:8px;border-radius:8px">${Object.entries(historySummary).slice(0,12).map(([s,h])=>`${s.padEnd(22)} ${h.sparkline} ${(h.uptime30d*100).toFixed(1)}% avg ${h.avgLatencyMs||0}ms`).join("\n")}</pre><a href="./history-summary.json" style="font-size:12px">→ full history-summary.json</a></details></section>
<section id="browse" class="card"><div class="toolbar"><label class="search">\uD83D\uDD0D <input id="q" placeholder="Search APIs (name, category, slug)…"><span style="color:var(--muted);font-size:13px">${results.summary.total} APIs</span></label><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" id="docs-chip" class="cat" title="Show only entries with generated offline docs">\uD83D\uDCDA docs ${docsCount}</button><span style="color:var(--muted);font-size:13px"><a href="https://github.com/coffeetocoffee/apipuccino/actions">Health Check</a> \u00B7 <a href="./api-docs/">Demo</a> \u00B7 <a href="./history-summary.json">History</a></span></span></div>
<div style="overflow:auto"><table><thead><tr><th>API</th><th>Status</th><th>Latency</th><th>Sparkline</th><th>Docs</th><th>Try</th></tr></thead><tbody id="tbody">
${apis.map(api=>{
  const r=bySlug[api.slug]; const ok=r?.ok; const lat=r?.latencyMs?`${r.latencyMs}ms`:"—";
  const hist = historySummary[api.slug];
  const spark = hist?.sparkline || (r?.ok ? "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588".slice(0, Math.min(8, Math.ceil((r?.latencyMs||100)/250))) : "\u2581");
  const uptime = hist ? `${(hist.uptime30d*100).toFixed(1)}%` : "";
  const gen = genDocs[api.slug]; // {href, try, pages} or legacy "docs/<slug>/"
  const genHref = typeof gen === "string" ? gen : gen?.href;
  const genTry = (typeof gen === "string" ? `${gen}#try-it` : gen?.try) || (genHref ? `${genHref}#try-it` : null);
  const docsCell = genHref
    ? `<a href="${genHref}">View Docs</a> <span class="badge">${ok?"live":"down"}</span>`
    : `<a href="${api.docs}">Docs</a> <span class="badge">${ok?"live":"down"}</span>`;
  const tryCell = genTry ? `<a href="${genTry}" class="badge" title="Try It playground — first endpoint">Try It \u2192</a>` : `<a href="${api.docs}" class="badge">Try \u2192</a>`;
  return `<tr data-cat="${esc(api.category)}" data-search="${esc(api.name+" "+api.slug+" "+api.category).toLowerCase()}"${genHref?` data-docs="1"`:""}><td><a href="${api.docs}" style="font-weight:700">${api.name}</a><br><code>${api.slug}</code> <span class="cat">${api.category}</span>${genHref?` <a href="${genTry}" class="badge" style="color:var(--accent-2)" title="Generated offline docs">\uD83D\uDCDA docs</a>`:""}</td><td>${r? (ok?`<span style="color:var(--ok)">\u25CF ${r.status}</span>`:`<span style="color:var(--bad)">\u25CF ${r.status??"ERR"}</span>`):"—"}</td><td>${lat}</td><td title="${uptime} 30d ${spark}">${spark}</td><td>${docsCell}</td><td>${tryCell}</td></tr>`;
}).join("")}
</tbody></table></div></section>
<p style="color:var(--muted);font-size:13px;margin:12px 2px">Tip: <code>npx apidocs submit</code> reads your <code>openapi.yaml</code> and opens a PR — directory grows without scraping.</p>
<footer>Generated by <code>npx apidocs build</code> — Free Forever MIT+CC0 — <a href="https://github.com/coffeetocoffee/apipuccino">coffeetocoffee/apipuccino</a></footer>
</main>
<script>const q=document.getElementById('q'),rows=[...document.querySelectorAll('#tbody tr')],chips=[...document.querySelectorAll('a.cat[data-cat]')],docsChip=document.getElementById('docs-chip');let activeCat=null,docsOnly=false;function apply(){const t=q.value.trim().toLowerCase();rows.forEach(r=>{const okT=!t||r.dataset.search.includes(t);const okC=!activeCat||r.dataset.cat===activeCat;const okD=!docsOnly||r.dataset.docs==='1';r.style.display=(okT&&okC&&okD)?'':'none'})}q.addEventListener('input',apply);chips.forEach(ch=>ch.addEventListener('click',()=>{const c=ch.dataset.cat;activeCat=(activeCat===c)?null:c;chips.forEach(x=>x.classList.toggle('on',x.dataset.cat===activeCat));apply()}));if(docsChip)docsChip.addEventListener('click',()=>{docsOnly=!docsOnly;docsChip.classList.toggle('on',docsOnly);apply()});</script>
</body></html>`;

const dist = path.join(root, "dist");
await fs.mkdir(dist, { recursive: true });
await fs.writeFile(path.join(dist, "index.html"), html, "utf8");
// copy api-docs into dist/api-docs
const apiDocsSrc = path.join(root, "api-docs");
const apiDocsDest = path.join(dist, "api-docs");
await fs.cp(apiDocsSrc, apiDocsDest, { recursive: true }).catch(()=>{});
console.log(`✓ dist/index.html + api-docs → ${dist} (${apis.length} APIs, ${results.summary.ok}/${results.summary.total})`);

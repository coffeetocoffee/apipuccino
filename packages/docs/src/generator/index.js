/**
 * Generator: output /index.html + /endpoints/[tag]/[op].html + /schemas/[name].html
 * Sidebar tag-grouped, method colors, auto curl/JS/Python samples
 */
import fs from "node:fs/promises";
import path from "node:path";
import { extractPages, extractNavigation } from "../parser/index.js";

function sampleFor(op, path, method, servers) {
  const base = servers?.[0]?.url || "https://api.example.com";
  const params = (op.parameters || []).map(p => `\${${p.name}}`).join(",");
  const url = `${base}${path}`;
  // handle query/path params in samples (show placeholders)
  let curlParams = "", jsHeaders = "", pyHeaders = "";
  const hasAuth = op.security && op.security.length;
  if (hasAuth) {
    curlParams = ` -H "Authorization: Bearer <token>"`;
    jsHeaders = `, headers: { Authorization: "Bearer <token>" }`;
    pyHeaders = `, headers={"Authorization": "Bearer <token>"}`;
  }
  return {
    curl: `curl -X ${method} "${url}" -H "Accept: application/json"${curlParams}`,
    js: `fetch("${url}", { method: "${method}"${jsHeaders} }).then(r=>r.json()).then(console.log)`,
    python: `import requests\nrequests.${method.toLowerCase()}("${url}"${pyHeaders}).json()`,
  };
}

function playgroundForm(op, path, method, servers, anchor) {
  const base = servers?.[0]?.url || "";
  const params = op.parameters || [];
  const paramInputs = params.map(p => `<label>${p.name} (${p.in}) <input data-param="${p.name}" data-in="${p.in}" placeholder="${p.schema?.example ?? ""}" ${p.required?"required":""}></label>`).join("");
  return `<section class="playground" ${anchor ? `id="${anchor}" ` : ""}data-try-it data-method="${method}" data-path="${path}" data-base="${base}">
<h3>Try It (offline-first)</h3>
<div class="params">${paramInputs || "<em>no params</em>"}</div>
<label>Auth <input data-auth placeholder="Bearer <token>"></label>
<label>Body (JSON) <textarea data-body placeholder='{}'></textarea></label>
<button data-send>Send</button>
<pre data-response></pre>
<p class="cors-note">If CORS blocks, copy curl from samples above — static docs are offline-first.</p>
</section>`;
}

export async function generatePages(spec, cfg) {
  const out = path.resolve(cfg.output);
  await fs.mkdir(out, { recursive: true });
  const pages = extractPages(spec);
  const nav = extractNavigation(pages);
  const servers = spec.servers || [];
  const slug = (spec.info?.title || "api").toLowerCase().replace(/[^a-z0-9]+/g,"-");
  // directory slug (cfg.slug) wins for badge lookup in results.json; fall back to title-derived
  const badgeSlug = cfg.slug || slug;
  // static badge embedded at build time (live status + 30d uptime) — offline-first, badge.js refreshes at runtime
  const b = cfg.badge || {};
  const badgeHtml = b.ok == null ? ""
    : b.ok
      ? `<span style="color:var(--ok,#16a34a);font-weight:600">\u25CF Live ${b.status ?? 200}\u2014 ${(b.uptime30d ?? 1) > 0 ? `${(b.uptime30d*100).toFixed(1)}% 30d` : "new"}</span>`
      : `<span style="color:var(--bad,#dc2626);font-weight:600">\u25CF Down ${b.status ?? ""}\u2014 ${b.uptime30d ? `${(b.uptime30d*100).toFixed(1)}% 30d` : "failing"}</span>`;

  // Try EJS render if available, else fallback
  let themeToggleInline = `(()=>{const t=localStorage.getItem("apipuccino-theme")|| (matchMedia("(prefers-color-scheme:dark)").matches?"dark":"default"); document.documentElement.dataset.theme=t;})();`;
  let sidebarHtml = Object.keys(nav).map(t=>`<section><h3>${t}</h3><ul>${nav[t].map(p=>`<li><span class="method-${p.method.toLowerCase()}">${p.method}</span> <a href="./endpoints/${t}/${(p.operation.operationId||p.path.replace(/[^a-z0-9]/gi,'-'))}.html">${p.operation.summary||p.path}</a></li>`).join("")}</ul></section>`).join("");
  let versionOptions = "";
  try {
    const { buildVersionOptions } = await import("../utils/version-switcher.js");
    versionOptions = buildVersionOptions(cfg);
  } catch {}
  // per-slug builds have one input -> show current spec version as a static label in the switcher
  if (!versionOptions && spec.info?.version) versionOptions = `<option selected disabled>v${spec.info.version}</option>`;

  // Read EJS templates if present
  let useEjs = false, ejs, baseEjs, endpointEjs;
  try { ejs = (await import("ejs")).default; baseEjs = await fs.readFile(path.resolve("packages/docs/templates/base.ejs"),"utf8"); endpointEjs = await fs.readFile(path.resolve("packages/docs/templates/endpoint.ejs"),"utf8"); useEjs = true; } catch {}

  // Build main content with per-endpoint sections + playground + samples
  const content = pages.map((p, i) => {
    const samples = sampleFor(p.operation, p.path, p.method, servers);
    const playground = playgroundForm(p.operation, p.path, p.method, servers, i === 0 ? "try-it" : null);
    if (useEjs) {
      try { return ejs.render(endpointEjs, { path: p.path, method: p.method, operation: p.operation, servers, samples, anchor: i === 0 ? "try-it" : null }); } catch {}
    }
    return `<article class="endpoint"><h2><span class="method-${p.method.toLowerCase()}">${p.method}</span> ${p.path}</h2><p>${p.operation.summary||""}</p><h3>Samples</h3><pre><code>${samples.curl}</code></pre><pre><code>${samples.js}</code></pre><pre><code>${samples.python}</code></pre>${playground}</article>`;
  }).join("\n");

  let html;
  if (useEjs) {
    try { html = ejs.render(baseEjs, { info: spec.info, theme: cfg.theme||"default", basePath: "./", slug, badgeSlug, badgeHtml, tryIt: pages.length > 0, sidebar: sidebarHtml, content: content + `<div id="search"></div>`, themeToggleInline, versionOptions }); } catch { useEjs = false; }
  }
  if (!useEjs) {
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${spec.info?.title||"API Docs"}</title><link rel="stylesheet" href="./themes/${cfg.theme||"default"}.css"><link rel="stylesheet" href="./print.css" media="print"><script>${themeToggleInline}</script></head><body data-theme="${cfg.theme||"default"}"><header class="no-print"><button id="theme-toggle">Toggle</button>${versionOptions ? ` <select id="version-switcher">${versionOptions}</select>` : ""}</header><nav>${sidebarHtml}</nav><main><h1>${spec.info?.title||""} <small>${spec.info?.version||""}</small></h1><p>${spec.info?.description||""}</p><div id="search"></div>${content}</main><footer>Verified by <a href="https://github.com/coffeetocoffee/apipuccino">Apipuccino</a> — ${badgeHtml} <span data-badge="${badgeSlug}">loading badge…</span> <img data-shield alt="badge" src="https://img.shields.io/badge/live-brightgreen">${pages.length ? ` — <a href="#try-it">Try It</a>` : ""}</footer><script src="./badge.js"></script><script src="./playground.js"></script><script src="./search.js"></script><script src="./theme-toggle.js"></script></body></html>`;
  }
  await fs.writeFile(path.join(out, "index.html"), html, "utf8");

  // Also write per-endpoint files (endpoint/ + schemas/)
  for (const p of pages) {
    const tag = (p.tags?.[0] || "default");
    const dir = path.join(out, "endpoints", tag);
    await fs.mkdir(dir, { recursive: true });
    const samples = sampleFor(p.operation, p.path, p.method, servers);
    const playground = playgroundForm(p.operation, p.path, p.method, servers);
    const epHtml = useEjs ? ejs.render(endpointEjs, { path: p.path, method: p.method, operation: p.operation, servers, samples, anchor: null }) + playground : `<h2>${p.method} ${p.path}</h2><pre>${samples.curl}</pre>${playground}`;
    await fs.writeFile(path.join(dir, `${p.operation.operationId||p.path.replace(/[^a-z0-9]/gi,'-')}.html`), epHtml, "utf8");
  }

  // Copy static assets (playground.js, badge.js, search.js, theme-toggle.js, print.css)
  const staticDir = path.resolve("packages/docs/static");
  for (const f of ["playground.js","badge.js","search.js","theme-toggle.js"]) {
    try { const c = await fs.readFile(path.join(staticDir, f), "utf8"); await fs.writeFile(path.join(out, f), c, "utf8"); } catch { await fs.writeFile(path.join(out, f), `// ${f} missing`, "utf8"); }
  }
  for (const t of ["default.css","dark.css","monokai.css","nord.css"]) {
    try { const c = await fs.readFile(path.resolve(`packages/docs/themes/${t}`),"utf8"); await fs.mkdir(path.join(out,"themes"),{recursive:true}); await fs.writeFile(path.join(out,"themes",t), c, "utf8"); } catch {}
  }
  try { const c = await fs.readFile(path.resolve("packages/docs/themes/print.css"),"utf8"); await fs.writeFile(path.join(out,"print.css"), c, "utf8"); } catch {}

  console.log(`  generated ${pages.length} endpoints to ${out}/index.html (+ per-endpoint files)`);
}

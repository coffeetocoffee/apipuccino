<div align="center">

# ☕ Apipuccino

### *Nobody lists dead APIs.*

**Free, self-verifying API directory + offline OpenAPI docs generator.**

[![Live](https://img.shields.io/badge/150%2F150-live-brightgreen?style=flat-square)](packages/directory/data/results.json) [![Check](https://img.shields.io/badge/health-nightly-blue?style=flat-square)](#verification-l0-l3) [![MIT](https://img.shields.io/badge/license-MIT-black?style=flat-square)](#free-forever) [![CC0](https://img.shields.io/badge/data-CC0-lightgrey?style=flat-square)](#free-forever) [![Node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)](#quick-start) [![pnpm](https://img.shields.io/badge/pnpm-9-F69220?style=flat-square)](#quick-start)

**`apipuccino`** (directory) + **`apidocs`** (docs) → one flywheel, zero servers.

[🎯 Browse 150 Live APIs](#browse) · [📚 Demo Docs](./api-docs/) · [⚡ Quick Start](#quick-start) · [🤝 Submit Yours](#submit)

</div>

---

### The Problem → The Fix

> **1,500 stale listings** vs **150 that actually work.** Public registries love quantity. We love `200 OK`.

Apipuccino checks every API **nightly** (L0-L3, dual-region) and only shows the ones that answer. Pair that with `apidocs` — a blazing-fast, **offline-first** OpenAPI generator — and you get discovery + documentation in one sip.

```
npx apidocs build  ──►  prompt: submit?  ──►  directory grows  ──►  [View Docs][Badge][Try It]  ──►  more installs
       ▲                                                                                              │
       └──────────────────────────────────  beautiful docs drive discovery  ──────────────────────────┘
```

---

### ✨ What Makes It Different

| Moat | Printing Press | ☕ Apipuccino |
| :--- | :--- | :--- |
| **Verified Badge** | static | `API Live: 200 OK — 2m ago | 99.2% 30d` |
| **Try-It Playground** | none | vanilla 5kb, CORS→curl fallback |
| **Drift Alert** | none | `contentHash` detects breaking changes |
| **Search on GH Pages** | server needed | Pagefind + lunr fallback |
| **One-Command Submit** | manual PR | `npx apidocs submit` |
| **PDF that works** | heavy | `print.css` default, optional `puppeteer-core` |
| **Versioned + Timeline** | single | `v1/v2/v3` switcher + sparkline `████░` |

---

### ⚡ Quick Start

```bash
# 1. Requirements: Node 20+ · pnpm 9
#    https://nodejs.org  https://pnpm.io/installation

pnpm install

# 2. Directory — verify & check (150 APIs, ~45s)
node packages/directory/scripts/verify.mjs   # zod validation
node packages/directory/scripts/check.mjs    # L0/L1 + p-limit 5 + history/*.jsonl
node packages/directory/scripts/history-graph.mjs
node packages/directory/scripts/build-web.mjs  # → dist/index.html

# 3. Docs — generate from OpenAPI
npx apidocs init                                    # scaffolds apidocs.config.js
npx apidocs build --input ./examples/petstore.yaml --output ./api-docs --theme nord
npx apidocs check --url https://api.example.com/health
# open ./api-docs/index.html — themes, search, playground, curl/JS/Python samples
```

<details>
<summary><b>CLI Reference</b></summary>

```bash
apidocs init                  # scaffold config + example yaml
apidocs build -i -o -t --pdf  # input glob, output, theme (default|dark|monokai|nord), --pdf-advanced
apidocs serve -o ./api-docs   # preview (npx serve ./api-docs)
apidocs submit --dry-run      # build → create PR entry in apis.json
apidocs check --url <url>     # L0 probe your own API
```
</details>

---

### 🔍 Verification L0-L3

> Trust, not volume. `AGENTS.md §3` · `packages/shared/types.ts:10`

```
L0  HTTP 200 + 8s timeout
        ↓
L1  content-type + JSON parse + expectedJsonPath exists
        ↓
L2  contentHash drift (schema keys changed?)
        ↓
L3  openapiUrl reachable + ajv validate (phase 3)
```

**Flow:** `cron 03:00 UTC` · `p-limit 5` · jitter `800-1600ms` · UA `ApipuccinoBot/2.0` · respect `Retry-After` · fail → re-probe Cloudflare Worker (`packages/directory/worker/index.js:8`) → both fail `⇒ consecutiveFailures++` → `≥3 days ⇒ Death Report issue` → pass `⇒ reset`. Commit only if `summary` changed. History appends to `history/YYYY-MM-DD.jsonl`, not git bloat.

Current: **150/150 live** — see `packages/directory/data/results.json:3`, sparkline from `history-summary.json:1`, drift from `drift-report.json:1`.

---

### 📁 Structure

```
apipuccino/
├── packages/directory/data/{apis.json, results.json, history/*.jsonl}
├── packages/directory/scripts/{check.mjs, verify.mjs, build-web.mjs, history-graph.mjs}
├── packages/directory/worker/{index.js, wrangler.toml}   # CF secondary probe
├── packages/docs/src/{cli, parser, generator, search, themes, playground, pdf, utils}
├── packages/docs/themes/{default,dark,monokai,nord}.css + print.css
├── packages/docs/templates/{base,endpoint,schema}.ejs
├── packages/shared/types.ts                              # ApiEntry & ProbeResult
├── apps/web/pages/index.astro                            # Directory UI
├── api-docs/                                             # generated (Pagefind + lunr)
├── dist/                                                 # GH Pages bundle
└── apidocs.config.js
```

Probe shape: `{ method, expectedStatus, expectedContentType?, expectedJsonPath?, timeoutMs:8000 }` — see `AGENTS.md §2`.

---

### 🎨 Docs Generator Pipeline

`parseSpec` (swagger-parser deref + yaml + zod) → `extractPages/Navigation` → `generatePages` → `buildSearchIndex` (Pagefind Node API, never `execSync`) → `generatePDF?`

Outputs: `/index.html` · `/endpoints/[tag]/[op].html` · `/schemas/[name].html` — sidebar tag-grouped, method colors (`GET` green, `POST` blue…), auto `curl`/`JS`/`Python` samples, version switcher `input: string|string[]`.

Themes: CSS vars + `data-theme` + `localStorage` + `prefers-color-scheme` — no flash. Playground: vanilla fetch console (`params/auth/Send`) — CORS blocked → shows curl.

---

### 🚀 Submit

Built an API? Ship it:

```bash
npx apidocs build --input ./openapi.yaml --output ./api-docs
npx apidocs submit          # verifies build → appends to apis.json → gh pr create
npx apidocs submit --dry-run
```

Every directory entry shows **View Docs · Badge · Try It** — your docs become our distribution.

---

### 🆓 Free Forever

**MIT** (code) + **CC0** (data) — no paywall, no pro features, no sponsors logic. `AGENTS.md §0`

Zero-cost: GitHub Actions + Pages + Cloudflare Workers free tier only. No servers. If we outgrow it, we cache/shard — never charge.

Sponsor button is “buy me a coffee”, not “unlock features”.

---

### 🧪 Test & Deploy

```bash
node packages/directory/scripts/verify.mjs
pnpm exec vitest run                 # 2 tests — apis.json shape
npx playwright test                  # e2e: petstore → build → search
```

Deploy: ` .github/workflows/health-check.yml` (03:00 UTC) + `deploy.yml` (Pages). Worker: `npx wrangler deploy --cwd packages/directory/worker` + set `CF_WORKER_URL` secret.

---

### 🛣️ Roadmap

- **D1-D6 MVP done** — 150 live, parser glob+generator+search+themes+playground+PDF+flywheel
- **Phase 2** — drift UI history graphs + category chips (`build-web.mjs:56` now surfaces drift/death + 30d sparklines)
- **Phase 3** — community discovery + AI search (still free)

Kill criteria: `<90%` pass 2 weeks → cut to 250 best. `<100` submissions 60d → archive dir, keep docs.

---

<div align="center">

**Built with ☕ + Node 20 native `fetch` + `p-limit` + `zod` + `Pagefind`**

`npx apidocs build` — *discover only live APIs. document them beautifully. both offline.*

[⬆ back to top](#-apipuccino)

</div>

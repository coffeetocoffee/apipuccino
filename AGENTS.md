# AGENTS.md — Apipuccino Platform (Memorize)

> **One line:** Free, self-verifying API directory + offline docs generator. Monorepo `apidocs` + `directory` flywheel. Source: `COMBINED-APIPUCCINO-MASTER-PLAN.txt` v2.0 FREE.

## 0. Laws (Never Break)
1. FREE FOREVER: MIT+CC0, no paywall, no pro features, no sponsors logic
2. TRUST > QUANTITY: 400-600 alive APIs > 1500 stale. "Nobody lists dead APIs."
3. ZERO-COST: GitHub Actions + Pages + CF Worker free tier only. No servers.
4. OFFLINE-FIRST: Docs are static HTML/CSS/JS, no server required
5. HISTORY != GIT: Overwrite `results.json`; append to `history/YYYY-MM-DD.jsonl`

## 1. Monorepo
```
apipuccino-platform/
 packages/directory/data/{apis.json,results.json,history/*.jsonl}
 packages/directory/scripts/{check.mjs,verify.mjs}
 packages/directory/.github/workflows/health-check.yml
 packages/docs/src/{cli,parser,generator,search,themes,pdf,playground,utils}
 packages/docs/templates + themes/{default,dark,monokai,nord}.css
 packages/shared/types.ts
 apps/web/pages/index.astro
 apidocs.config.js
```

## 2. Data Model (Minimal)
**apis.json** entry:
`{name, slug, url, probe:{method,expectedStatus,expectedContentType,expectedJsonPath,timeoutMs:8000}, auth:none|key|oauth, category, cors, docs, openapiUrl?, generatedDocs?, added}`

**results.json** (latest only):
`{checkedAt, summary:{total,ok,failed}, results:[{slug,ok,status,latencyMs,contentType,timeChecked,consecutiveFailures,contentHash}]}`

## 3. Verification L0-L3
- L0: HTTP 200, timeout 8-10s
- L1: content-type + jsonPath exists
- L2: contentHash drift (Phase2)
- L3: OpenAPI schema validate (Phase3)
- Flow: cron 03:00 UTC `p-limit 5` | fail -> re-probe CF Worker -> both fail => failures++ | failures>=3 days => Issue "Death Report" | pass => reset
- Throttle: 30/min, jitter 800-1600ms, UA `ApipuccinoBot/2.0`, respect Retry-After, commit only if summary changed

## 4. Docs Generator Pipeline
`parseSpec -> extractPages/Navigation -> generatePages -> buildSearchIndex -> (optional) generatePDF`
- Parser: `@apidevtools/swagger-parser` deref + `yaml` + `zod` + `ajv`, handle $ref cycles, 3.0/3.1, glob
- Output: `/index.html` + `/endpoints/[tag]/[op].html` + `/schemas/[name].html`, sidebar tag-grouped, method colors
- Extra: auto curl/JS/Python samples, version switcher `input: string|string[]`
- Search: Pagefind Node API + lunr fallback `search-index.json` (never execSync CLI)
- Themes: CSS vars, `data-theme`, localStorage + prefers-color-scheme, no flash
- Playground: vanilla 5kb fetch console (params/auth/Send), CORS -> show curl fallback
- PDF: default `print.css` (no deps), `--pdf-advanced` -> `puppeteer-core` (warn size)
- CLI: `init|build -i -o -t --pdf|serve|submit (PR)|check (health)`

## 5. Stack Cheat Sheet
Dir: Node20 native fetch, p-limit, zod, shields.io
Docs: Node20 TS5 pnpm, EJS/Handlebars typed, Pagefind+lunr, PostCSS, Commander+cosmiconfig
Host: GH Pages, CF Pages alt

## 6. Moat 7 (vs Printing-Press)
1 Badge embed (live 200 + 30d uptime) 2 Try-It playground 3 Drift alert (hash) 4 Pagefind on GH Pages 5 `apidocs submit` PR 6 PDF with curl samples 7 Versioned + sparkline timeline

## 7. Flywheel
`apidocs build` -> prompt submit -> directory grows free -> each entry [View Docs][Badge][Try It] -> drives CLI installs

## 8. Build Order (6d MVP)
D1 Dir: seed 150 from public-apis, check.mjs, GH Action, Pages
D2 Docs core: parser+generator CLI build <2s
D3 Search+themes+playground+samples
D4 print.css + submit/check
D5 Integrate: dir embeds docs, docs footer badge, CF probe
D6 Launch: README flywheel, Vitest+Playwright, deploy.yml, HN copy

Phase2: drift, history graphs, compare. Phase3: community, AI search (free)

## 9. Agent DO / DON'T
DO: use Node API not CLI, overwrite results.json, p-limit+jitter, L1 validation, optional pdf, type partials
DON'T: commit nightly history bloat, install full puppeteer by default, single-region trust, execSync pagefind, add paid tiers, use React SSR

## 10. Kill Criteria
<90% pass 2 weeks => cut to 250 best. <100 submissions 60d => archive dir, keep docs. Scope creep => D1 dir, D2-4 docs, D5 integrate (no interleave).

## 11. Token Saver
When coding, reference `packages/shared/types.ts` for types. Probe = `{method,status,contentType,jsonPath,timeout}`. Remember: FREE, VERIFY, OFFLINE, HISTORY-JSONL, P-LIMIT5, PAGEFIND-API.

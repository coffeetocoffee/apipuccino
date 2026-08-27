# Apipuccino Platform v2.0 â€” FREE FOREVER

> Nobody lists dead APIs.

Monorepo `apipuccino` + `apidocs` flywheel â€” Synthesis of `COMBINED-APIPUCCINO-MASTER-PLAN.txt` v2.0

## Flywheel
`npx apidocs build` â†’ prompt `apidocs submit` â†’ directory grows â†’ each entry [View Docs][Badge][Try It] â†’ drives CLI installs

## Quick Start

```bash
# 1. Install Node 20+ and pnpm 9
# https://nodejs.org â€” https://pnpm.io/installation

pnpm install
node packages/directory/scripts/verify.mjs
node packages/directory/scripts/check.mjs   # L0/L1 + p-limit 5 + history/*.jsonl

# Docs generator
npx apidocs init
npx apidocs build --input ./openapi.yaml --output ./api-docs
npx apidocs check --url https://api.example.com/health
```

## Structure
See `AGENTS.md` Sec 1 + `COMBINED-APIPUCCINO-MASTER-PLAN.txt` Sec 3.

- `packages/directory/data/apis.json` â€” source of truth (probe: method,status,contentType,jsonPath,timeout)
- `packages/directory/data/results.json` â€” overwritten nightly (not history bloat)
- `packages/directory/data/history/YYYY-MM-DD.jsonl` â€” append-only
- `packages/docs/` â€” parser/generator/search/themes/playground/pdf
- `packages/shared/types.ts` â€” ApiEntry, ProbeResult

## Verification L0-L3
L0 200/timeout 8s â†’ L1 content-type + jsonPath â†’ L2 hash drift â†’ L3 OpenAPI validate
Cron 03:00 UTC, p-limit 5, jitter 800-1600ms, UA `ApipuccinoBot/2.0`, CF Worker secondary probe, commit only if summary changed.

## FREE
MIT (code) + CC0 (data). No paywall, no pro features. See Master Plan Sec 10.

## Kill Criteria
<90% pass 2 weeks â†’ cut to 250 best. <100 submissions 60d â†’ archive dir, keep docs.

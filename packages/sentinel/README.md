# ☕ Apipuccino Sentinel

> **Dead-API early-warning for YOUR stack.** The directory verifies 550 public APIs nightly —
> Sentinel turns that same L0–L3 verification inward, onto the upstream APIs *your* app depends on.

## Why

The directory answers *"is this API alive?"*. Sentinel answers *"will MY app survive the night?"*:

- **Watch** the 3–10 upstream APIs you actually call (`sentinel add`)
- **Detect** death spirals (3 consecutive failures), fresh outages, and silent schema drift
- **Alert** before your users notice (webhook: Slack/Discord/custom)
- **Survive** with a stale-cache runtime guard that serves last-known-good responses

Zero dependencies. Offline-first. MIT. No servers, no paywall — same laws as the rest of Apipuccino.

## Quick start

```bash
# 1. Pin the APIs you depend on
npx apidocs sentinel add https://api.advice-slip.com/advice --name "Advice Slip"
npx apidocs sentinel add https://api.example.com/health --json-path '$.ok'

# 2. Check them (run nightly in CI — see .github/workflows/sentinel-watch.yml)
npx apidocs sentinel watch

# 3. See your risk
npx apidocs sentinel risk
# ✓ advice-slip — Stable (live, no drift)
# ● payments-acme — Evolving (response schema drifted since last check)
```

## Commands

| Command | What it does |
|---|---|
| `sentinel add <url> [--name] [--slug] [--expected-status] [--json-path] [--openapi-url] [--webhook]` | pin a dependency into `.sentinel/config.json` |
| `sentinel watch [--webhook <url>] [--json]` | probe all watched deps, persist + alert. Exit code **1** on any DEATH (CI-friendly) |
| `sentinel status [--json]` | last check per dependency |
| `sentinel risk [--json]` | risk dashboard: Stable / Evolving / Volatile |

State lives in `.sentinel/`:

- `config.json` — **commit this** (your pinned deps + webhook)
- `results.json`, `last-report.json`, `history/*.jsonl`, `cache/*` — local runtime state (gitignore them)

## Runtime guard

Wrap `fetch` so a dead upstream degrades instead of 500-ing:

```js
import { createGuard } from "@apipuccino/sentinel/guard";
import { loadResults, loadCache } from "@apipuccino/sentinel";

const cwd = process.cwd();
const guard = createGuard({
  getStatus: async (slug) => (await loadResults(cwd))?.results.find((r) => r.slug === slug) ?? null,
  loadCache: (slug) => loadCache(cwd, slug),
});

// same signature as fetch, bound to one watched slug:
const getAdvice = guard.for("advice-slip");

try {
  const res = await getAdvice("https://api.advice-slip.com/advice");
  if (res.headers.get("x-apipuccino-sentinel") === "stale-cache") {
    console.warn("upstream down — serving last-known-good response");
  }
} catch (e) {
  if (e.name === "UpstreamDeadError") return fallback();
  throw e;
}
```

## Alerts

Set a webhook once (`sentinel add --webhook <url>` or `config.json → alerts.webhook`), or per-run
(`sentinel watch --webhook <url>`). POSTs `{ text, events, summary }` — works with Slack/Discord
incoming webhooks and anything else that takes JSON. Webhook failure never fails the run.

## The flywheel

`apidocs build` → beautiful docs → `apidocs submit` → directory grows → **Sentinel watches your
deps against that same verification data** → fewer 3am pages → more trust → more submissions. ☕

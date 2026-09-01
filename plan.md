# plan.md — Apipuccino Flagship Roadmap

> Living plan for the "BIG" next update. Picked direction: **Apipuccino Verified** (breaking-change
> detection + per-API Stability score + changelog). Runners-up A/B also specced for later cycles.
> Laws are non-negotiable: FREE, VERIFY, OFFLINE-FIRST, ZERO-COST, HISTORY != GIT.

---

## 0. Why now

The product thesis is *"Nobody lists dead APIs."* Today we answer **"Is this API alive?"**
(L0–L3 + drift + death report + 30d uptime sparkline). That is table stakes for a verifier.

The **flagship leap** is to answer **"Is it safe to build on?"** — a question no free directory
answers. That moves Apipuccino from a *liveness checker* to a *trust authority* for public APIs,
which is the strongest expression of Law #2 (TRUST > QUANTITY) and the real flywheel.

---

## 1. FLAGSHIP — Apipuccino Verified (v4.0)

### 1.1 Problem
- `drift-report.json` only stores `prevHash → newHash`. We know *something* changed, not *what* or
  *how badly*. A renamed field vs an added optional param are treated identically.
- API consumers can't tell a stable bedrock API from a churny one.
- We already fetch every `openapiUrl` spec nightly (L3, `check.mjs`) — the diff signal is free, we
  just throw it away after hashing.

### 1.2 What we build
1. **Semantic spec diff** between last-known spec and current spec for every `openapiUrl` entry.
   - Classify each change: `breaking` | `non_breaking` | `additive`.
   - Detect: removed/renamed paths or operations, removed params, changed required-ness,
     narrowed types, changed response schema, changed auth, removed enum values.
   - Use existing parser deref (`@apidevtools/swagger-parser`) + structural compare; no new dep
     beyond what's already in the stack (zod/ajv available). Aligns with Law #3 ZERO-COST.
2. **Per-API Stability rating** — `Stable` / `Evolving` / `Volatile`, from breaking-change frequency
   over 30d and 90d windows.
3. **Per-API Changelog page** — `dist/docs/<slug>/changelog.html` (themed, offline, Pagefind-indexed),
   listing dated changes with severity chips. Reuses the `base.ejs` shell + sidebar.
4. **Weekly digest** — "Breaking changes this week (N)" card on `dist/index.html`, linking to the
   affected changelog pages; optionally open a GitHub Issue/PR summary (never required).

### 1.3 Data model (additive — Law #5: history != git)
- New per-slug append-only log: `packages/directory/data/changelog/<slug>.jsonl`
  ```json
  {"date":"2026-09-01","severity":"breaking","change":"removed_path","path":"/v1/foo","detail":"GET /v1/foo removed"}
  ```
- New summary in `history-summary.json` (extend, don't break): add
  `stability: "stable|evolving|volatile"`, `breaking30d: 0`, `breaking90d: 0`.
- Keep existing `drift-report.json`; it becomes the *trigger* that runs the diff (drift ⇒ diff).
- `generated-docs.json` gains `changelog: "docs/<slug>/changelog.html"`.

### 1.4 Pipeline integration
- **New script** `packages/directory/scripts/diff.mjs` (runs after `check.mjs`, before
  `build-docs.mjs` / `build-web.mjs`):
  - Reads `drift-report.json` (only diff slugs that drifted this run — cheap, no full re-parse).
  - For each drifted slug: fetch current spec, load previous spec snapshot from
    `packages/directory/data/specs-snapshot/<slug>.json` (write-on-change), run semantic diff,
    append to `changelog/<slug>.jsonl`, update `history-summary.json` counters + `stability`.
  - No drift ⇒ no work (idempotent, fast).
- `build-docs.mjs`: when a slug has a changelog, generate `changelog.html` from `changelog/<slug>.jsonl`
  (reuse `generatePages` shell via a small `generateChangelog` renderer, or a new EJS partial).
- `build-web.mjs`: add **Stability** column + filter chip (like the existing docs chip), and the
  weekly "Breaking changes" digest card (reuse death/drift card styling).
- `deploy.yml`: insert `node packages/directory/scripts/diff.mjs` between check and build-docs.

### 1.5 UI surfaces
- Directory table: new **Stability** column (colored chip) + category-style chip filter.
- Per-slug docs footer/sidebar: link to `/changelog.html` (alongside Try It / search).
- Per-slug changelog page: severity chips (red breaking, amber non-breaking, green additive),
  grouped by date, offline-first static HTML.

### 1.6 Milestones (suggested split)
- **v3.6** — `diff.mjs` core: snapshot + classify + `changelog/<slug>.jsonl` + history-summary fields.
  No UI yet (validate signal quality on real drifts first).
- **v3.7** — Stability rating + directory column/chip in `build-web.mjs`.
- **v3.8** — Per-slug `changelog.html` + weekly digest card + `generated-docs.json` link.

### 1.7 Risk / guardrails
- Diff false-positives erode trust (Law #2). Start conservative: only high-confidence breaking rules;
  additive/non-breaking are lower-stakes. Tune against the 6 known drifts in `drift-report.json`.
- Keep it FREE and ZERO-COST: pure Node, no external diff service, no new Action minutes beyond
  what check already uses (diff only runs on drifted slugs).

---

## 2. RUNNER-UP A — Embeddable "Verified" Widget (v4.x later)

Paste-in snippet for API owners' own docs/sites:
```html
<script src="https://apipuccino.pages.dev/widget.js" data-slug="dnd5e-abilities"></script>
```
- Renders static uptime + drift + Stability badge. Offline-first: static SVG fallback if JS blocked.
- Flywheel: every embed = backlink + impression → discovery → submissions (Law #7).
- Needs a hosted static bundle (GH Pages, already free) + CORS-friendly `results.json`/`history-summary.json`
  served as static assets. No server (Law #4 OFFLINE-FIRST still holds for the directory itself).
- Lower engineering risk than v1 but more "marketing" than "trust product."

### 2.1 Implemented (Runner A shipped)
- `packages/docs/static/widget.js` — vanilla, dependency-free embeddable badge. Reads `data-slug`,
  `data-theme` (light|dark), optional `data-base`. Falls back through the same URL chain as `badge.js`
  (relative → `/apipuccino/` → github.io → raw.githubusercontent). Renders
  `Live 200 · <ms> · <uptime>% 30d · <Stability>` (green) or `Down · <fails>` (red); static fallback text
  if fetch fails. Inline styles so it never inherits host CSS.
- `packages/docs/static/verified-badge.svg` — static offline fallback mark.
- `packages/docs/static/widget-demo.html` — live preview + copy-paste snippets.
- `build-web.mjs` now publishes `results.json` + `history-summary.json` **and** the `packages/docs/static`
  folder to the Pages bundle (`dist/`), so the widget (and the existing `badge.js`) resolve cross-origin.
  This also fixes `badge.js`, which previously 404'd because the data was never published.
- README "Embed the Verified badge" section documents usage.

## 3. RUNNER-UP B — AI "Which API should I use?" Assistant (Phase 3)

- NL query over the 550 specs: "free weather API with CORS and no auth."
- Phase 3 in AGENTS.md is explicitly "community, AI search (free)."
- Must stay FREE: use a free-tier/in-browser model or cached embeddings; never bill.
- Big, but depends on a free model + token budget and risks scope creep (Law #10). Defer until
  Verified ships and proves the flywheel.

---

## 4. Sequencing summary
| Version | Scope | Flagship? |
|---|---|---|
| v3.6 | diff.mjs core + changelog log + history-summary fields | foundation |
| v3.7 | Stability rating + directory column/chip | visible |
| v3.8 | Per-slug changelog.html + weekly digest | complete |
| v4.0 | Promotion: "Apipuccino Verified" brand + badge + README flywheel copy | launch |
| later | Runner A widget / Runner B AI assistant | expansion |

## 5. Law compliance check
- FREE: no paywall, MIT+CC0, all features open. ✓
- VERIFY: diff is verification, not opinion. ✓
- OFFLINE-FIRST: changelog.html + widget fallback are static. ✓
- ZERO-COST: reuses nightly spec fetch; diff only on drifted slugs. ✓
- HISTORY != GIT: append `changelog/<slug>.jsonl`; overwrite `results.json`. ✓

---

## 6. NEXT UPDATE — Recommended execution order (added)

Current state: Apipuccino Verified engine shipped through **v3.8.0** (diff.mjs core →
changelog.jsonl → Stability rating → weekly digest). The engine is built but not yet
*positioned* as the product headline. Recommended order before/at the v4.0 launch:

1. **Trust hardening (do first)** — audit `packages/directory/scripts/diff.mjs` against the
   real drifts captured in `drift-report.json` / `changelog/*.jsonl`. Confirm the
   breaking-change classifier has a low false-positive rate *before* we promote "Verified",
   since false positives directly erode Law #2 (TRUST > QUANTITY). Tune high-confidence
   breaking rules; additive/non-breaking are lower-stakes. No new UI.
2. **v4.0 — "Apipuccino Verified" launch** — turn the engine into the headline: a "Verified"
   trust badge + Stability chip in `build-web.mjs`, a static badge asset, and README flywheel
   copy. This is the promotion milestone that drives the flywheel (Law #7).
3. **Runner A — Embeddable widget** (`packages/docs/static/widget.js` served from GH Pages) —
   paste-in snippet for API owners' sites (`data-slug=...`). Every embed = backlink +
   discovery → submissions. Expansion step, after Verified proves the flywheel.

### 6.1 Updated sequencing
| Version | Scope | Flagship? |
|---|---|---|
| v3.6 | diff.mjs core + changelog log + history-summary fields | foundation |
| v3.7 | Stability rating + directory column/chip | visible |
| v3.8 | Per-slug changelog.html + weekly digest | complete |
| *(next)* | **Trust-hardening pass on diff.mjs** (validate signal quality) | gate |
| v4.0 | Promotion: "Apipuccino Verified" brand + badge + README flywheel copy | launch |
| later | Runner A widget / Runner B AI assistant | expansion |

### 6.2 Trust-hardening audit — findings (executed)
Offline audit of `packages/directory/scripts/diff.mjs` pure functions (`diffSpecs`/`diffOp`/
`schemaSig`, now also `diffSchema`) against crafted before/after specs. **18/18 cases pass**
after the fix below.

- **Bug found & fixed:** the old `schemaSig` hashed only `type|format|required|enum` and
  **ignored `properties`**. Result: adding/removing/renaming a field inside an object request
  or response body produced *no* change — a silent false-negative that defeats the entire
  "renamed field vs added param" promise in §1.1. This is now fixed by a recursive
  `diffSchema()` that detects `property_added` (additive), `property_removed`
  (breaking if required, non-breaking if optional), nested `type_changed` (breaking),
  `enum_changed` (breaking) and `required_*` changes.
- **False-positive guard kept:** `diffSchema` deliberately ignores `description`, `example`,
  `nullable`, `additionalProperties` so editorial-only spec edits don't trip a breaking alert
  (protects Law #2 TRUST > QUANTITY).
- **Remaining gap (needs live data):** the audit is structural only. Real-world precision
  (false-positive rate on the ~6 known drifts) still needs a live run of `check.mjs` →
  `diff.mjs` to populate `drift-report.json` + `changelog/*.jsonl`, then spot-check. No
  `drift-report.json`/`specs-snapshot/` exists in the repo yet, so the pipeline has never
  captured real data. Recommended: run the nightly once (or locally with `node
  packages/directory/scripts/check.mjs`) to baseline `specs-snapshot/`, then let `diff.mjs`
  classify subsequent drifts.
  - **Update:** nightly executed locally on **2026-09-01** — `check.mjs` → 544/550 ok, 6 failed,
    7 drifts; `results.json` refreshed + `history/2026-09-01.jsonl` appended; `build-web.mjs`
    republished `dist/results.json` + `dist/history-summary.json` + `dist/static/widget.js`.
    The 7 drifted slugs have no `openapiUrl`, so `diff.mjs` performed no semantic spec diff
    (L2 content drift only). Widget smoke test renders `Live 200 · 989ms · 100% 30d`. The
    data is now real; the earlier "fallback until CI deploy" caveat is resolved.

### 6.3 v4.0 launch checklist (next, after 6.2 live-run)
- [ ] "Apipuccino Verified" badge in `build-web.mjs` directory (reuse Stability chip styling).
- [ ] Static badge asset `packages/docs/static/verified-badge.svg` (offline-first).
- [ ] README flywheel copy: lead with Verified, [View Docs][Badge][Try It] CTAs.
- [ ] Promote v4.0 tag once the above ship.

// widget.js — Apipuccino Verified embeddable badge (Runner A, plan.md §2)
// Paste-in for API owners' own docs/sites:
//   <script src="https://coffeetocoffee.github.io/apipuccino/static/widget.js"
//           data-slug="dnd5e-abilities"></script>
// Offline-first: if JS is blocked, show a static SVG badge (see README). No server, no deps.
(function () {
  const script = document.currentScript;
  if (!script) return;
  const slug = script.dataset.slug;
  if (!slug) return;

  const theme = script.dataset.theme || "light";
  const customBase = script.dataset.base || "";
  // Resolve where the public data lives. Try an explicit override first, then the
  // same fallback chain badge.js uses so it works from any origin (GH Pages is CORS-*).
  const BASES = [customBase, "./", "/apipuccino/", "https://coffeetocoffee.github.io/apipuccino/", "https://raw.githubusercontent.com/coffeetocoffee/apipuccino/master/packages/directory/data/"].filter(Boolean);

  const isDark = theme === "dark";
  const C = {
    ok: "#16a34a", bad: "#dc2626", warn: "#d97706", mute: "#64748b",
    bg: isDark ? "#0f172a" : "#fff", fg: isDark ? "#e2e8f0" : "#0f172a",
    border: isDark ? "#1e293b" : "#e2e8f0", link: isDark ? "#7dd3fc" : "#0ea5e9",
  };

  function el(html) {
    const d = document.createElement("span");
    d.innerHTML = html;
    return d.firstChild;
  }
  function badge(inner, color) {
    return el(`<a href="https://coffeetocoffee.github.io/apipuccino/#browse" target="_blank" rel="noopener"
      style="display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border-radius:999px;
      background:${C.bg};border:1px solid ${C.border};box-shadow:0 1px 2px rgba(0,0,0,.06);
      font:600 12px/1.2 ui-sans-serif,Segoe UI,Roboto,Arial;color:${C.fg};text-decoration:none;
      font-family:ui-sans-serif,Segoe UI,Roboto,Arial,sans-serif;white-space:nowrap">
      <span style="width:8px;height:8px;border-radius:999px;background:${color};display:inline-block"></span>
      <span>${inner}</span></a>`);
  }
  function render(status, uptime30d, stability) {
    let color = C.mute, text = "Apipuccino Verified";
    if (status && typeof status.ok === "boolean") {
      if (status.ok) {
        const up = uptime30d != null ? ` · ${(uptime30d * 100).toFixed(0)}% 30d` : "";
        const stab = stability && stability !== "unknown" ? ` · ${stability}` : "";
        color = C.ok;
        text = `Live ${status.status} · ${status.latencyMs}ms${up}${stab}`;
      } else {
        color = C.bad;
        text = `Down · ${status.consecutiveFailures || 0} fails`;
      }
    }
    const node = badge(text, color);
    script.parentNode.insertBefore(node, script.nextSibling);
  }
  function fallback() { script.parentNode.insertBefore(badge("Apipuccino Verified", C.mute), script.nextSibling); }

  (async () => {
    let results = null, summary = null;
    for (const b of BASES) {
      try {
        const r = await fetch(b + "results.json", { cache: "no-store" });
        if (r.ok) { results = await r.json(); break; }
      } catch {}
    }
    if (results) {
      for (const b of BASES) {
        try {
          const r = await fetch(b + "history-summary.json", { cache: "no-store" });
          if (r.ok) { summary = await r.json(); break; }
        } catch {}
      }
    }
    if (!results || !results.results) return fallback();
    const r = results.results.find(x => x.slug === slug);
    if (!r) return fallback();
    const stab = summary?.[slug]?.stability || "unknown";
    const up = summary?.[slug]?.uptime30d;
    render(r, up, stab);
  })();
})();

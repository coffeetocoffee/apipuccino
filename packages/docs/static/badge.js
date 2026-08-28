// badge.js — Verified by Apipuccino: live 200 + 30d uptime from results.json
(async () => {
  const el = document.querySelector("[data-badge]");
  if (!el) return;
  const slug = el.dataset.badge;
  try {
    const urls = [
      "./results.json",
      "/apipuccino/results.json",
      "https://coffeetocoffee.github.io/apipuccino/results.json",
      "https://raw.githubusercontent.com/coffeetocoffee/apipuccino/main/packages/directory/data/results.json"
    ];
    let data = null;
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: "no-store" });
        if (r.ok) { data = await r.json(); break; }
      } catch {}
    }
    if (!data || !data.results) throw new Error("badge fetch failed");
    const r = data.results.find(x => x.slug === slug);
    if (!r) { el.textContent = "Verified: unknown"; return; }
    const ago = Math.round((Date.now() - new Date(r.timeChecked).getTime())/60000);
    el.textContent = r.ok ? `API Live: ${r.status} OK \u2014 ${ago}m ago | ${r.latencyMs}ms` : `API Down: ${r.error || r.status} \u2014 ${r.consecutiveFailures} fails`;
    el.style.color = r.ok ? "var(--ok)" : "var(--bad)";
  } catch {
    el.textContent = "Verified by Apipuccino (offline)";
  }
})();

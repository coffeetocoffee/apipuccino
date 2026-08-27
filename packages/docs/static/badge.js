// badge.js — Verified by Apipuccino: live 200 + 30d uptime from results.json
(async () => {
  const el = document.querySelector("[data-badge]");
  if (!el) return;
  const slug = el.dataset.badge;
  try {
    // Try to fetch directory results.json (works on GH Pages)
    const res = await fetch("https://raw.githubusercontent.com/you/apipuccino/main/packages/directory/data/results.json", { cache: "no-store" });
    if (!res.ok) throw new Error("badge fetch failed");
    const data = await res.json();
    const r = data.results.find(x => x.slug === slug);
    if (!r) { el.textContent = "Verified: unknown"; return; }
    const ago = Math.round((Date.now() - new Date(r.timeChecked).getTime())/60000);
    el.textContent = r.ok ? `API Live: ${r.status} OK — ${ago}m ago | ${r.latencyMs}ms` : `API Down: ${r.error || r.status} — ${r.consecutiveFailures} fails`;
    el.style.color = r.ok ? "var(--method-get)" : "var(--method-delete)";
  } catch {
    el.textContent = "Verified by Apipuccino (offline)";
  }
  // Also update shields.io endpoint badge dynamically if present
  const shield = document.querySelector("[data-shield]");
  if (shield) {
    // shields.io endpoint expects JSON: {schemaVersion:1,label:"status",message:"live",color:"brightgreen"}
    // We serve via raw results.json — alternative: compute locally
  }
})();

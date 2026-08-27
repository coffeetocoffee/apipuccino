// search.js — Pagefind (if built) else lunr fallback
(async () => {
  const el = document.getElementById("search");
  if (!el) return;
  try {
    // Try Pagefind UI if /pagefind/ exists (built via Node API)
    if (window.PagefindUI) { new PagefindUI({ element: "#search" }); return; }
  } catch {}
  // Fallback: lunr from search-index.json
  const idx = await fetch("./search-index.json").then(r=>r.json()).catch(()=>null);
  if (!idx || !idx.length) { el.innerHTML = '<input placeholder="Search (no index)"/>'; return; }
  el.innerHTML = '<input id="q" placeholder="Search endpoints…"><ul id="hits"></ul>';
  const q = document.getElementById("q"), hits = document.getElementById("hits");
  q.addEventListener("input", () => {
    const term = q.value.toLowerCase();
    const res = idx.filter(d => JSON.stringify(d).toLowerCase().includes(term)).slice(0,8);
    hits.innerHTML = res.map(r => `<li><a href="${r.url}">${r.title}</a></li>`).join("");
  });
})();

// search.js — Pagefind (if built) else prebuilt lunr index else substring fallback
(async () => {
  const el = document.getElementById("search");
  if (!el) return;
  try {
    if (window.PagefindUI) { new PagefindUI({ element: "#search" }); return; }
  } catch {}

  const data = await fetch("./search-index.json").then(r => r.json()).catch(() => null);
  if (!data) { el.innerHTML = '<input placeholder="Search (no index)"/>'; return; }
  const docs = Array.isArray(data) ? data : (data.docs || []);
  if (!docs.length) { el.innerHTML = '<input placeholder="Search (no index)"/>'; return; }

  const byUrl = Object.fromEntries(docs.map(d => [d.url, d]));
  let idx = null;
  if (!Array.isArray(data) && data.index) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "./lunr.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
      if (window.lunr) idx = window.lunr.Index.load(data.index);
    } catch {}
  }

  el.innerHTML = '<input id="q" placeholder="Search endpoints…" aria-label="Search endpoints"><ul id="hits"></ul>';
  const q = document.getElementById("q"), hits = document.getElementById("hits");
  q.addEventListener("input", () => {
    const term = q.value.trim();
    if (!term) { hits.innerHTML = ""; return; }
    let res = [];
    try {
      if (idx) {
        res = idx.search(term + " " + term.split(/\s+/).map(t => t + "*").join(" ")).slice(0, 8).map(h => byUrl[h.ref]).filter(Boolean);
      }
    } catch {}
    if (!res.length) {
      const t = term.toLowerCase();
      res = docs.filter(d => (d.title + " " + d.excerpt).toLowerCase().includes(t)).slice(0, 8);
    }
    hits.innerHTML = res.map(r => `<li><a href="${r.url}">${r.title}</a></li>`).join("");
  });
})();

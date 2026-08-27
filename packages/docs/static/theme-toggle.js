// theme-toggle.js — no flash, localStorage + prefers-color-scheme
(() => {
  const btn = document.getElementById("theme-toggle");
  const order = ["default","dark","monokai","nord"];
  function apply(t){ document.documentElement.dataset.theme=t; document.body.dataset.theme=t; localStorage.setItem("apipuccino-theme",t); }
  // inline script in <head> already set initial — this just wires toggle
  if (btn) btn.addEventListener("click", () => {
    const cur = localStorage.getItem("apipuccino-theme") || "default";
    const nxt = order[(order.indexOf(cur)+1)%order.length];
    apply(nxt);
  });
})();

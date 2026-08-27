/**
 * Playground: vanilla 5kb fetch console (params/auth/Send), CORS -> show curl fallback
 * Injected into generated HTML as playground.js
 */
export function initPlayground() {
  // Client JS — handles CORS warning gracefully
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-try-it]");
    if (!btn) return;
    const url = btn.dataset.url, method = btn.dataset.method || "GET";
    try {
      const res = await fetch(url, { method });
      const text = await res.text();
      btn.nextElementSibling.textContent = `${res.status} ${text.slice(0,2000)}`;
    } catch (err) {
      btn.nextElementSibling.textContent = `CORS blocked — copy curl: curl -X ${method} "${url}"`;
    }
  });
}

// playground.js — vanilla 5kb fetch console (params/auth/body, CORS -> curl fallback)
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-send]");
  if (!btn) return;
  const section = btn.closest("[data-try-it]");
  let base = section.dataset.base || "";
  let path = section.dataset.path || section.dataset.url || "";
  const method = section.dataset.method || "GET";
  const auth = section.querySelector("[data-auth]")?.value?.trim();
  const bodyText = section.querySelector("[data-body]")?.value?.trim();
  const out = section.querySelector("[data-response]");
  // Build URL from params: path params replace {id}, query params append
  const q = [];
  section.querySelectorAll("[data-param]").forEach(inp => {
    const name = inp.dataset.param, place = inp.dataset.in, val = inp.value.trim();
    if (!val) return;
    if (place === "path") path = path.replace(`{${name}}`, encodeURIComponent(val)).replace(`:${name}`, encodeURIComponent(val));
    else if (place === "query") q.push(`${encodeURIComponent(name)}=${encodeURIComponent(val)}`);
    else if (place === "header") { /* handled via headers */ }
  });
  let url = `${base}${path}`;
  if (q.length) url += (url.includes("?") ? "&" : "?") + q.join("&");
  // Also collect header params
  const headers = { Accept: "application/json" };
  if (auth) headers["Authorization"] = auth.includes(" ") ? auth : `Bearer ${auth}`;
  section.querySelectorAll("[data-param][data-in='header']").forEach(inp => {
    if (inp.value.trim()) headers[inp.dataset.param] = inp.value.trim();
  });
  let body;
  if (bodyText && method !== "GET" && method !== "HEAD") {
    try { body = JSON.stringify(JSON.parse(bodyText)); headers["Content-Type"] = "application/json"; } catch { body = bodyText; }
  }
  out.textContent = `→ ${method} ${url}\n…sending`;
  const started = Date.now();
  try {
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    const ms = Date.now() - started;
    out.textContent = `← ${res.status} ${res.statusText} (${ms}ms)\n${text.slice(0, 8000)}`;
  } catch (err) {
    let curl = `curl -X ${method} "${url}"`;
    for (const [k,v] of Object.entries(headers)) curl += ` -H "${k}: ${v}"`;
    if (body) curl += ` -d '${body}'`;
    out.textContent = `CORS / network blocked — copy curl:\n${curl}\n\n${err.message}`;
  }
});
// version switcher
(() => {
  const sel = document.getElementById("version-switcher");
  if (!sel) return;
  sel.addEventListener("change", () => location.href = sel.value);
})();

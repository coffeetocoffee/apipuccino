/**
 * Cloudflare Worker — secondary probe (10 lines, free tier, distributed)
 * Deploy: wrangler deploy --name apipuccino-probe
 * Env: no secrets needed
 * Usage: GET https://apipuccino-probe.workers.dev/?url=https://api.example.com/health
 */
export default {
  async fetch(req) {
    const url = new URL(req.url).searchParams.get("url");
    if (!url) return new Response("missing ?url=", { status: 400 });
    let target;
    try { target = new URL(url); } catch { return new Response("invalid url", { status: 400 }); }
    if (!["http:","https:"].includes(target.protocol)) return new Response("only http(s)", { status: 400 });
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(target, { headers: { "User-Agent": "ApipuccinoBot/2.0 (+https://github.com/you/apipuccino)" }, signal: controller.signal });
      const body = await res.text();
      return new Response(body.slice(0, 4000), { status: res.status, headers: { "content-type": res.headers.get("content-type") || "text/plain", "access-control-allow-origin": "*" } });
    } catch (e) {
      return new Response(e.message, { status: 502 });
    } finally { clearTimeout(t); }
  }
};

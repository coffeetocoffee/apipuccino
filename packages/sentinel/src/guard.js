/**
 * Apipuccino Sentinel — runtime guard.
 * Framework-agnostic `fetch` wrapper: when an upstream you watch dies or errors,
 * serve the last-known-good cached body (recorded by `sentinel watch`) instead of
 * crashing your app at 3am. When nothing is cached, throw a typed error you can
 * catch and degrade on.
 *
 * Works in Node 20+ and browsers (uses global Response when available).
 */
export class UpstreamDeadError extends Error {
  constructor(slug, reason) {
    super(`[sentinel] upstream dead: ${slug} (${reason})`);
    this.name = "UpstreamDeadError";
    this.slug = slug;
    this.reason = reason;
  }
}

export function isDeadStatus(status) {
  return Boolean(status && (status.consecutiveFailures ?? 0) >= 3);
}

function staleResponse(cached) {
  const body = cached?.body ?? "";
  const headers = {
    "content-type": cached?.contentType ?? "application/json",
    "x-apipuccino-sentinel": "stale-cache",
    ...(cached?.savedAt ? { "x-apipuccino-sentinel-saved-at": cached.savedAt } : {}),
  };
  if (typeof Response !== "undefined") return new Response(body, { status: 200, headers });
  // Non-DOM fallback: minimal Response-shaped object
  return {
    ok: true,
    status: 200,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

/**
 * @param {{ getStatus?: (slug)=>any|Promise<any>, loadCache?: (slug)=>any|Promise<any>, fetchFn?: typeof fetch }} opts
 * `getStatus(slug)` returns the last watch result for the slug (or null if unknown).
 * `loadCache(slug)` returns `{ body, contentType, savedAt }` or null.
 */
export function createGuard({ getStatus, loadCache, fetchFn = fetch } = {}) {
  /**
   * Guarded fetch for one watched dependency.
   * @param {string} slug sentinel slug from `sentinel add`
   * @param {string|URL} input request URL
   * @param {RequestInit} [init]
   */
  async function guardedFetch(slug, input, init) {
    let liveRes = null;
    let liveError = null;
    try {
      liveRes = await fetchFn(input, init);
      if (liveRes.ok) return liveRes;
      liveError = `HTTP ${liveRes.status}`;
    } catch (e) {
      liveError = e?.message ?? String(e);
    }

    const cached = (await loadCache?.(slug)) ?? null;
    if (cached?.body) return staleResponse(cached);

    const status = (await getStatus?.(slug)) ?? null;
    const reason = status && !status.ok ? `failing (${status.consecutiveFailures ?? "?"} consecutive)` : liveError;
    throw new UpstreamDeadError(slug, reason ?? "unknown");
  }

  /** Bind a slug once: `const get = guard.for("advice-slip"); await get(url)` */
  guardedFetch.for = (slug) => (input, init) => guardedFetch(slug, input, init);
  return guardedFetch;
}

/**
 * Apipuccino Sentinel — prober.
 * Same verification semantics as packages/directory/scripts/check.mjs (L0/L1 + hashes),
 * but dependency-injected `fetchFn` so it is unit-testable without network.
 *
 * L0: HTTP expectedStatus + timeout | L1: content-type + expectedJsonPath exists
 * L2: contentHash (exact bytes) + schemaHash (sorted keys — stable drift signal)
 */
import crypto from "node:crypto";
import { DEFAULT_TIMEOUT_MS, UA } from "./constants.js";

export function getJsonPath(obj, path) {
  // supports "$.a.b", "$[0].b", "$.a[2].c" (brackets normalized to segments)
  if (!path || path === "$") return obj;
  const parts = path
    .replace(/^\$\.?/, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur = obj;
  for (const p of parts) cur = cur?.[p];
  return cur;
}

export function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "api"
  );
}

export function hashContent(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

/** Stable drift signal: hash of sorted top-level keys (+ array length), ignores random values. */
export function hashKeys(json) {
  try {
    const obj = JSON.parse(json);
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "empty-array";
      const first = obj[0];
      if (typeof first === "object" && first !== null) {
        const keys = Object.keys(first).sort().join(",");
        return crypto.createHash("sha256").update(keys + ":len" + obj.length).digest("hex").slice(0, 12);
      }
      return crypto.createHash("sha256").update("array:len" + obj.length).digest("hex").slice(0, 12);
    }
    if (obj && typeof obj === "object") {
      const keys = Object.keys(obj).sort().join(",");
      return crypto.createHash("sha256").update(keys).digest("hex").slice(0, 12);
    }
    return null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Probe a single watched dependency.
 * @param {{slug:string,url:string,probe?:{method?,expectedStatus?,expectedContentType?,expectedJsonPath?,timeoutMs?}}} dep
 * @param {{fetchFn?:typeof fetch}} opts
 */
export async function probeOne(dep, { fetchFn = fetch } = {}) {
  const cfg = dep.probe ?? {};
  const method = cfg.method ?? "GET";
  const expectedStatus = cfg.expectedStatus ?? 200;
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();
  let status = null;
  let contentType = null;
  let bodyText = "";
  let ok = false;
  let error = null;

  try {
    let lastRes = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetchFn(dep.url, {
        method,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": UA, Accept: "*/*" },
      });
      lastRes = res;
      status = res.status;
      contentType = res.headers?.get?.("content-type") ?? null;
      if (res.status === 429) {
        const ra = res.headers?.get?.("retry-after");
        const wait = ra ? Math.min(Number(ra) * 1000, 4000) : 1200;
        try {
          await res.text().catch(() => "");
        } catch {}
        await sleep(wait);
        if (attempt === 0) continue; // retry once
        throw new Error(`expected status ${expectedStatus} got 429 (rate-limited, retried)`);
      }
      bodyText = await res.text().catch(() => "");
      break;
    }
    if (!lastRes) throw new Error("no response");
    if (status !== expectedStatus) throw new Error(`expected status ${expectedStatus} got ${status}`);
    if (cfg.expectedContentType && contentType && !contentType.includes(cfg.expectedContentType)) {
      throw new Error(`expected content-type ${cfg.expectedContentType} got ${contentType}`);
    }
    if (cfg.expectedJsonPath) {
      let json;
      try {
        json = JSON.parse(bodyText);
      } catch {
        throw new Error("expected JSON but parse failed");
      }
      const val = getJsonPath(json, cfg.expectedJsonPath);
      if (val === undefined || val === null) throw new Error(`jsonPath ${cfg.expectedJsonPath} not found`);
    }
    ok = true;
  } catch (e) {
    error = e?.name === "AbortError" ? "timeout" : (e?.message ?? String(e));
    ok = false;
  }

  return {
    slug: dep.slug,
    url: dep.url,
    ok,
    status,
    latencyMs: Date.now() - start,
    contentType,
    timeChecked: new Date().toISOString(),
    contentHash: bodyText ? hashContent(bodyText) : null,
    schemaHash: bodyText ? hashKeys(bodyText) : null,
    bodyText,
    ...(error ? { error } : {}),
  };
}

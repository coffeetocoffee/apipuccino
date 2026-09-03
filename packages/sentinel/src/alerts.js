/**
 * Apipuccino Sentinel — alerts.
 * Channels: console (always) + generic webhook POST (Slack/Discord/custom).
 * Never throws: a failing webhook must not fail the watch run (Law: cheap + robust).
 */
import { UA } from "./constants.js";

export function formatEvent(e) {
  switch (e.type) {
    case "death":
      return `☠ DEATH  ${e.slug} — dead ${e.consecutiveFailures} consecutive checks (last: ${e.detail})`;
    case "down":
      return `✗ DOWN   ${e.slug} — failing (${e.consecutiveFailures} consecutive, last: ${e.detail})`;
    case "recovered":
      return `✓ RECOVERED ${e.slug} — live again after ${e.wasFailing} failed checks`;
    case "drift":
      return `● DRIFT  ${e.slug} — response schema changed (${e.prevHash}→${e.newHash})`;
    default:
      return `· ${e.type} ${e.slug}`;
  }
}

/**
 * @param {{events: Array, summary: object, webhook?: string}} opts
 * @param {{fetchFn?: typeof fetch}} io
 */
export async function dispatchAlerts({ events, summary, webhook }, { fetchFn = fetch } = {}) {
  const lines = events.map(formatEvent);
  for (const line of lines) console.log(`[sentinel] ${line}`);

  if (!webhook || events.length === 0) return { webhookOk: null, lines };

  const text = `:coffee: *Apipuccino Sentinel* — ${events.length} event(s)\n${lines.map((l) => `• ${l}`).join("\n")}\nSummary: ${summary.ok}/${summary.total} live`;
  try {
    const res = await fetchFn(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ text, events, summary }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn(`[sentinel] webhook returned ${res.status}`);
    return { webhookOk: res.ok, lines };
  } catch (e) {
    console.warn(`[sentinel] webhook failed: ${e.message}`);
    return { webhookOk: false, lines };
  }
}

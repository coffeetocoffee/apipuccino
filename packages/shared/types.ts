/**
 * Apipuccino Platform — Shared Types v2.0
 * References: COMBINED-APIPUCCINO-MASTER-PLAN.txt Sec 5 + AGENTS.md
 */

// ── Directory Data Model ──────────────────────────────
export type AuthType = "none" | "key" | "oauth";
export type HttpMethod = "GET" | "POST" | "HEAD";

export interface ProbeConfig {
  method: HttpMethod;
  expectedStatus: number;
  expectedContentType?: string; // e.g. "application/json" — L1 validation
  expectedJsonPath?: string;    // e.g. "$.success" or "$.data" — L1 semantic
  timeoutMs: number;            // 8000 default per AGENTS.md
}

export interface ApiEntry {
  name: string;
  slug: string;
  url: string;                  // probe URL
  probe: ProbeConfig;
  auth: AuthType;
  category: string;
  cors: string;                 // "yes" | "no" | "unknown"
  docs: string;
  openapiUrl?: string;
  generatedDocs?: string;       // /docs/[slug]/ hosted on Pages
  added: string;                // YYYY-MM-DD
}

export interface ProbeResult {
  slug: string;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  contentType: string | null;
  timeChecked: string;          // ISO
  consecutiveFailures: number;
  contentHash: string | null;   // sha256 first 8 hex, for L2 drift
  error?: string;
}

export interface ResultsFile {
  checkedAt: string;
  summary: { total: number; ok: number; failed: number };
  results: ProbeResult[];
}

// ── Docs Generator ───────────────────────────────────
export interface ParsedSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, unknown> };
  tags?: { name: string; description?: string }[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
  security?: unknown[];
}

export interface ApidocsConfig {
  input: string | string[];
  output: string;
  theme?: "default" | "dark" | "monokai" | "nord";
  title?: string;
  pdf?: boolean;
}

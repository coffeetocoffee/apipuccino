#!/usr/bin/env node
/**
 * verify.mjs — Zod validation for apis.json (L1 schema)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APIS_JSON = path.resolve(__dirname, "../data/apis.json");

let z;
try { z = await import("zod"); } catch { console.error("zod not installed — run pnpm install"); process.exit(1); }
const { z: zod } = z;

const ProbeSchema = zod.object({
  method: zod.enum(["GET","POST","HEAD"]).default("GET"),
  expectedStatus: zod.number().int().min(100).max(599),
  expectedContentType: zod.string().optional(),
  expectedJsonPath: zod.string().optional(),
  timeoutMs: zod.number().int().min(1000).max(30000).default(8000),
});

const ApiSchema = zod.object({
  name: zod.string().min(1),
  slug: zod.string().regex(/^[a-z0-9-]+$/),
  url: zod.string().url(),
  probe: ProbeSchema,
  auth: zod.enum(["none","key","oauth"]),
  category: zod.string().min(1),
  cors: zod.string(),
  docs: zod.string().url(),
  openapiUrl: zod.string().url().optional(),
  generatedDocs: zod.string().optional(),
  added: zod.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ApisSchema = zod.array(ApiSchema);

const raw = JSON.parse(await fs.readFile(APIS_JSON, "utf8"));
const parsed = ApisSchema.safeParse(raw);
if (!parsed.success) {
  console.error("✗ apis.json validation failed:");
  console.error(parsed.error.format());
  process.exit(1);
}
console.log(`✓ apis.json valid — ${parsed.data.length} entries`);
const slugs = parsed.data.map(a=>a.slug);
const dup = slugs.filter((s,i)=>slugs.indexOf(s)!==i);
if (dup.length) { console.error(`✗ duplicate slugs: ${dup.join(", ")}`); process.exit(1); }
console.log("✓ no duplicate slugs");
// — ANTI-SPAM: prevent bulk same-host duplicates (DO NOT bulk-add DummyJSON Products 1-20 again) —
const byHost = {};
for (const a of parsed.data) { try { const h = new URL(a.url).hostname; byHost[h] = (byHost[h]||0)+1; } catch {} }
const hostOver = Object.entries(byHost).filter(([,c])=>c>4);
if (hostOver.length) {
  console.error(`✗ host limit exceeded (max 4 per host, found): ${hostOver.map(([h,c])=>`${h}:${c}`).join(", ")}`);
  console.error(`  → Fix: replace duplicates with diverse providers (see AGENTS.md TRUST>QUANTITY). DO NOT bulk-add same host.`);
  process.exit(1);
}
console.log(`✓ host diversity ok — ${Object.keys(byHost).length} hosts (max ${Math.max(...Object.values(byHost))}/host)`);
const byBase = {};
for (const a of parsed.data) { const b = a.name.replace(/\s*\d+$/,'').toLowerCase(); byBase[b]=(byBase[b]||0)+1; }
const baseOver = Object.entries(byBase).filter(([,c])=>c>3);
if (baseOver.length) {
  console.error(`✗ base-name bulk duplicate (max 3 per base, found): ${baseOver.map(([b,c])=>`${b}:${c}`).join(", ")}`);
  process.exit(1);
}
console.log("✓ base-name diversity ok");

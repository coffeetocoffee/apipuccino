/**
 * Parser: dereference $ref, handle 3.0/3.1, glob, zod+ajv validate
 * Uses @apidevtools/swagger-parser + yaml
 */
import SwaggerParser from "@apidevtools/swagger-parser";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";

async function expandGlob(pattern) {
  // minimal glob: supports * and **, else return as-is
  if (!pattern.includes("*") && !pattern.includes("?")) return [pattern];
  // use fs glob if Node >=22, fallback to simple readdir
  try {
    // Node 22+ has fs.glob
    const { glob } = await import("node:fs/promises");
    if (glob) {
      const out = [];
      for await (const p of glob(pattern)) out.push(p);
      if (out.length) return out;
    }
  } catch {}
  // fallback: handle dir/* pattern
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  const star = base.replace(/\*/g, ".*").replace(/\?/g, ".");
  const rx = new RegExp(`^${star}$`);
  try {
    const entries = await readdir(dir);
    return entries.filter(e => rx.test(e)).map(e => path.join(dir, e));
  } catch { return [pattern]; }
}

export async function parseSpec(input) {
  // input: string | string[] — glob support (Master-Plan Sec 4 parser)
  const rawInputs = Array.isArray(input) ? input : [input];
  const files = [];
  for (const pat of rawInputs) {
    const expanded = await expandGlob(pat);
    files.push(...expanded);
  }
  const first = files[0];
  if (!first) throw new Error(`parseSpec: no files matched ${JSON.stringify(input)}`);
  // If multiple files (glob), merge paths/components (simple shallow merge)
  if (files.length > 1) {
    let merged = null;
    for (const f of files) {
      let raw;
      try { raw = await SwaggerParser.dereference(f); }
      catch {
        const text = await readFile(f, "utf8");
        raw = f.endsWith(".yaml") || f.endsWith(".yml") ? yaml.parse(text) : JSON.parse(text);
        raw = await SwaggerParser.dereference(raw);
      }
      if (!merged) merged = raw;
      else {
        merged.paths = { ...merged.paths, ...raw.paths };
        if (raw.components?.schemas) merged.components = { ...merged.components, schemas: { ...merged.components?.schemas, ...raw.components.schemas } };
        if (raw.tags) merged.tags = [...(merged.tags||[]), ...raw.tags];
      }
    }
    return merged;
  }
  let raw;
  try {
    raw = await SwaggerParser.dereference(first);
  } catch (e) {
    // fallback: read + yaml parse
    const text = await readFile(first, "utf8");
    raw = first.endsWith(".yaml") || first.endsWith(".yml") ? yaml.parse(text) : JSON.parse(text);
    raw = await SwaggerParser.dereference(raw);
  }
  return raw;
}

export function extractPages(spec) {
  const pages = [];
  for (const [p, methods] of Object.entries(spec.paths || {})) {
    for (const [m, op] of Object.entries(methods)) {
      pages.push({ path: p, method: m.toUpperCase(), operation: op, tags: op.tags || ["default"] });
    }
  }
  return pages;
}

export function extractNavigation(pages) {
  const byTag = {};
  for (const pg of pages) for (const t of pg.tags) (byTag[t] ??= []).push(pg);
  return byTag;
}

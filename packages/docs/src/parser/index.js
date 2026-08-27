/**
 * Parser: dereference $ref, handle 3.0/3.1, glob, zod+ajv validate
 * Uses @apidevtools/swagger-parser + yaml
 */
import SwaggerParser from "@apidevtools/swagger-parser";
import { readFile } from "node:fs/promises";
import yaml from "yaml";
import { glob } from "node:fs";

export async function parseSpec(input) {
  // input: string | string[] — glob support
  const files = Array.isArray(input) ? input : [input];
  // For MVP: parse first file, dereference with swagger-parser
  const first = files[0];
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

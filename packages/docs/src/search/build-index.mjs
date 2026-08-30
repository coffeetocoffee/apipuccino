#!/usr/bin/env node
/**
 * build-index.mjs — explicit search index builder for CI (GH Action deploy)
 * Usage: node packages/docs/src/search/build-index.mjs ./api-docs
 * Runs the same Node API path as `apidocs build`: lunr fallback + Pagefind index.
 */
const dir = process.argv[2] || "./api-docs";
const { buildSearchIndex } = await import("./index.js");
await buildSearchIndex(dir);

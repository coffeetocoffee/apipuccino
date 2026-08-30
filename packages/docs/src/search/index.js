/**
 * Search: Pagefind Node API (primary) + real lunr index fallback (prebuilt at build time)
 * Never execSync CLI — per AGENTS.md. Writes { docs, index } search-index.json + lunr.min.js
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

async function buildDocs(outDir, basePath) {
  // Walk HTML files and collect { title, url, excerpt }
  const docs = [];
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "pagefind") continue; // skip pagefind assets
        await walk(full);
      } else if (e.name.endsWith(".html")) {
        const url = "/" + path.relative(basePath, full).replace(/\\/g, "/"); // for GH Pages
        const html = await fs.readFile(full, "utf8").catch(() => "");
        const title = (html.match(/<title>(.*?)<\/title>/i)?.[1] || html.match(/<h1>(.*?)<\/h1>/i)?.[1] || path.basename(full)).replace(/<[^>]*>/g, "").trim().slice(0, 120);
        const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
        docs.push({ title, url, excerpt: text });
      }
    }
  }
  await walk(basePath);
  return docs;
}

export async function buildLunrData(outDir) {
  const docs = await buildDocs(outDir, outDir);
  let index = null;
  try {
    const { default: lunr } = await import("lunr");
    index = lunr(function () {
      this.ref("url");
      this.field("title", { boost: 10 });
      this.field("excerpt");
      for (const d of docs) this.add(d);
    }).toJSON();
  } catch (e) {
    console.log("  lunr unavailable — search-index.json docs-only:", e.message?.slice(0, 80));
  }
  return { docs, index };
}

/** Copy vendored lunr.min.js next to the built docs so the fallback works offline */
export async function vendorLunr(outDir) {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve("lunr"); // .../lunr/lunr.js
    const min = path.join(path.dirname(entry), "lunr.min.js");
    const src = await fs.readFile(min).catch(() => fs.readFile(entry));
    await fs.writeFile(path.join(outDir, "lunr.min.js"), src, "utf8");
    return true;
  } catch (e) {
    console.log("  lunr.min.js not vendored:", e.message?.slice(0, 80));
    return false;
  }
}

export async function buildSearchIndex(outDir) {
  const out = path.resolve(outDir);
  const data = await buildLunrData(out);
  await fs.writeFile(path.join(out, "search-index.json"), JSON.stringify(data), "utf8");
  await vendorLunr(out);
  console.log(`  search-index.json: ${data.docs.length} docs ${data.index ? "+ lunr index" : "(docs-only fallback)"}`);

  // Pagefind via Node API
  try {
    const { createIndex } = await import("pagefind");
    console.log("  Pagefind: indexing", out);
    const { index } = await createIndex();
    const { errors, page_count } = await index.addDirectory({ path: out });
    if (errors?.length) console.warn("  Pagefind errors:", errors);
    const { outputPath } = await index.writeFiles({ outputPath: path.join(out, "pagefind") });
    console.log(`  Pagefind: ${page_count} pages → ${outputPath}`);
  } catch (e) {
    console.log("  Pagefind not available or failed — using lunr fallback only:", e.message?.slice(0, 200));
  }
  return data.docs;
}

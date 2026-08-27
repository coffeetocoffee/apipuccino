/**
 * Search: Pagefind Node API (primary) + lunr fallback always built
 * Never execSync CLI — per AGENTS.md
 */
import fs from "node:fs/promises";
import path from "node:path";

async function buildLunrFallback(outDir, fallbackPath) {
  // Walk HTML files and build minimal search-index.json { title, url, excerpt }
  const docs = [];
  async function walk(dir, base) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, base);
      else if (e.name.endsWith(".html")) {
        const url = "/" + path.relative(base, full).replace(/\\/g,"/"); // for GH Pages
        const html = await fs.readFile(full, "utf8").catch(()=> "");
        const title = (html.match(/<title>(.*?)<\/title>/i)?.[1] || html.match(/<h1>(.*?)<\/h1>/i)?.[1] || path.basename(full)).replace(/<[^>]*>/g,"").trim().slice(0,120);
        const text = html.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0, 600);
        docs.push({ title, url, excerpt: text });
      }
    }
  }
  await walk(outDir, outDir);
  await fs.writeFile(fallbackPath, JSON.stringify(docs, null, 2), "utf8");
  console.log(`  lunr fallback: ${docs.length} docs → search-index.json`);
  return docs;
}

export async function buildSearchIndex(outDir) {
  const out = path.resolve(outDir);
  const fallbackPath = path.join(out, "search-index.json");
  const docs = await buildLunrFallback(out, fallbackPath);

  // Pagefind via Node API
  try {
    const { createIndex } = await import("pagefind");
    console.log("  Pagefind: indexing", out);
    const { index } = await createIndex();
    const { errors, page_count } = await index.addDirectory({ path: out });
    if (errors?.length) console.warn("  Pagefind errors:", errors);
    const { outputPath } = await index.writeFiles({ outputPath: path.join(out, "pagefind") });
    console.log(`  Pagefind: ${page_count} pages → ${outputPath}`);
    // Also ensure pagefind UI assets are referenced in HTML (optional)
  } catch (e) {
    console.log("  Pagefind not available or failed — using lunr fallback only:", e.message?.slice(0,200));
  }
  return docs;
}

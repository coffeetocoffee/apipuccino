/**
 * PDF: default print.css (no deps), --pdf-advanced -> puppeteer-core
 */
import fs from "node:fs/promises";
import path from "node:path";

export async function generatePDF(outDir) {
  const html = path.join(path.resolve(outDir), "index.html");
  console.log(`PDF: print via browser from ${html} (default: print.css)`);
  try {
    const puppeteer = await import("puppeteer-core");
    const chromium = await import("@sparticuz/chromium");
    const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath() });
    const page = await browser.newPage();
    await page.goto(`file://${html}`, { waitUntil: "networkidle0" });
    await page.pdf({ path: path.join(outDir, "api.pdf"), format: "A4" });
    await browser.close();
    console.log("  → api.pdf generated (advanced)");
  } catch (e) {
    console.warn("  puppeteer-core not installed — use browser Print to PDF (print.css already included).", e.message);
  }
}

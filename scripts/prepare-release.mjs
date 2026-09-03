#!/usr/bin/env node
/**
 * prepare-release.mjs — build release packages for the GitHub Releases page + npm.
 *
 * 1. `pnpm pack` @apipuccino/docs and @apipuccino/sentinel (pnpm rewrites the
 *    workspace:* dep to a real version) into dist-release/ as downloadable tarballs.
 * 2. Build a single combined `apipuccino` package with one `apipuccino` bin that
 *    dispatches to both CLIs, then pack it too — so the Releases page ships ONE
 *    installable package (`npm i -g apipuccino-X.tgz`).
 *
 * Zero servers, zero cost — just tarballs + (optional) npm publish.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const version = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")).version;
const outDir = path.join(root, "dist-release");
await fs.mkdir(outDir, { recursive: true });

console.log(`[release] building packages for v${version}`);

// 1. Pack the two workspace packages.
const packs = ["@apipuccino/docs", "@apipuccino/sentinel"];
for (const pkg of packs) {
  execSync(`pnpm --filter ${pkg} exec pnpm pack --pack-destination "${outDir}"`, { cwd: root, stdio: "inherit" });
}

// 2. Build the combined single package outside the workspace (so pnpm ignores it).
const combined = await fs.mkdtemp(path.join(os.tmpdir(), "apipuccino-combined-"));
const bin = path.join(combined, "bin");
await fs.mkdir(bin, { recursive: true });

await fs.writeFile(
  path.join(combined, "package.json"),
  JSON.stringify(
    {
      name: "apipuccino",
      version,
      description: "Apipuccino — self-verifying API directory + offline OpenAPI docs + Sentinel dead-API early-warning. Single install.",
      type: "module",
      license: "MIT",
      engines: { node: ">=20" },
      bin: { apipuccino: "./bin/apipuccino.js", apidocs: "./bin/apipuccino.js", sentinel: "./bin/apipuccino.js" },
      dependencies: { "@apipuccino/docs": "*", "@apipuccino/sentinel": "*" },
      files: ["bin"],
    },
    null,
    2,
  ) + "\n",
);

await fs.writeFile(
  path.join(bin, "apipuccino.js"),
  `#!/usr/bin/env node
// Unified Apipuccino CLI: ` + "`apipuccino <sentinel ...>`" + ` → Sentinel, otherwise → apidocs.
const [, /*node*/ , /*script*/ cmd, ...rest] = process.argv;
if (cmd === "sentinel") {
  const { run } = await import("@apipuccino/sentinel/cli");
  const res = await run(rest, { cwd: process.cwd() });
  console.log(res.output);
  process.exit(res.exitCode);
}
// Everything else delegates to the apidocs CLI (it parses process.argv itself).
await import("@apipuccino/docs/cli");
`,
);

const tgzName = `apipuccino-${version}.tgz`;
execSync(`npm pack --pack-destination "${outDir}"`, { cwd: combined, stdio: "inherit" });

// npm pack names the file after package.json name (apipuccino); normalize to include version if needed.
const files = await fs.readdir(outDir);
if (!files.includes(tgzName)) {
  const generic = files.find((f) => f.startsWith("apipuccino-") && f.endsWith(".tgz"));
  if (generic && generic !== tgzName) await fs.rename(path.join(outDir, generic), path.join(outDir, tgzName));
}

console.log("[release] packages:");
for (const f of (await fs.readdir(outDir)).sort()) console.log("  -", f);

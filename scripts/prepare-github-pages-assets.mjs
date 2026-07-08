import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "out");
const nextDir = join(outDir, "_next");
const pagesAssetsDir = join(outDir, "next-assets");

if (!existsSync(outDir) || !existsSync(nextDir)) {
  console.error("Expected a static export in out/_next before preparing Pages assets.");
  process.exit(1);
}

cpSync(nextDir, pagesAssetsDir, { recursive: true, force: true });

const textExtensions = new Set([".html", ".txt", ".js", ".css", ".json"]);

function hasTextExtension(filePath) {
  return [...textExtensions].some((extension) => filePath.endsWith(extension));
}

function rewriteFile(filePath) {
  if (!hasTextExtension(filePath)) {
    return;
  }

  const current = readFileSync(filePath, "utf8");
  const next = current
    .replaceAll("/ainovel/_next", "/ainovel/next-assets")
    .replaceAll("\\/ainovel\\/_next", "\\/ainovel\\/next-assets")
    .replaceAll("pathname.indexOf('/_next/')", "pathname.indexOf('/next-assets/')")
    .replaceAll('pathname.indexOf("/_next/")', 'pathname.indexOf("/next-assets/")')
    .replaceAll("indexOf('/_next/')", "indexOf('/next-assets/')")
    .replaceAll('indexOf("/_next/")', 'indexOf("/next-assets/")')
    .replaceAll("to contain '/_next/'", "to contain '/next-assets/'");

  if (next !== current) {
    writeFileSync(filePath, next);
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const filePath = join(dir, entry);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else {
      rewriteFile(filePath);
    }
  }
}

walk(outDir);

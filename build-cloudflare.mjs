import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  rmSync
} from "node:fs";
import {
  extname,
  join,
  relative
} from "node:path";

const root = process.cwd();
const output = join(root, "dist");

const excludedDirectories = new Set([
  ".git",
  ".github",
  ".wrangler",
  "dist",
  "node_modules",
  "functions",
  "server",
  "supabase",
  "scripts",
  "upload"
]);

const excludedFiles = new Set([
  "build-cloudflare.mjs",
  "build-inventory-pages.mjs",
  "tracking-worker.js",
  "wrangler.jsonc",
  "package.json",
  "package-lock.json",
  "pages.yml"
]);

const publicExtensions = new Set([
  ".html",
  ".css",
  ".js",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".webmanifest",
  ".mp4",
  ".webm"
]);

function copyPublicFiles(source, destination) {
  mkdirSync(destination, { recursive: true });

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (excludedFiles.has(entry.name)) continue;

    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);

    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) continue;
      copyPublicFiles(sourcePath, destinationPath);
      continue;
    }

    if (!publicExtensions.has(extname(entry.name).toLowerCase())) continue;

    mkdirSync(join(destinationPath, ".."), { recursive: true });
    copyFileSync(sourcePath, destinationPath);

    console.log(`Copied ${relative(root, sourcePath)}`);
  }
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

copyPublicFiles(root, output);

console.log("Cloudflare production output created in dist/");

import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync
} from "node:fs";
import {
  extname,
  join,
  relative,
  dirname,
  resolve
} from "node:path";
import { createHash } from "node:crypto";

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
  "docs",
  "upload"
]);

const excludedFiles = new Set([
  "build-cloudflare.mjs",
  "build-inventory-pages.mjs",
  "tracking-worker.js",
  "worker.js",
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

    if (!publicExtensions.has(extname(entry.name).toLowerCase()) &&
        sourcePath !== join(root, "VERSION.json") &&
        !(relative(root, sourcePath).startsWith("assets/vendor/") && entry.name.endsWith("-LICENSE.txt"))) continue;

    mkdirSync(join(destinationPath, ".."), { recursive: true });
    copyFileSync(sourcePath, destinationPath);

  }
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

copyPublicFiles(root, output);

// Content-addressed URLs avoid re-downloading unchanged scripts between pages.
// Retain original paths for scripts loaded dynamically and GitHub branch compatibility.
const fingerprints = {};
const htmlFiles = [];
function fingerprintDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) { fingerprintDirectory(file); continue; }
    const name = relative(output, file).split("\\").join("/");
    if (extname(file) === ".html") htmlFiles.push(file);
    if (!name.startsWith("assets/") || !/\.(js|css)$/.test(file)) continue;
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
    const fingerprinted = file.replace(/\.(js|css)$/, `.${hash}.$1`);
    copyFileSync(file, fingerprinted);
    fingerprints[name] = relative(output, fingerprinted).split("\\").join("/");
  }
}
fingerprintDirectory(output);
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8").replace(/<(?:script|link)\b[^>]*>/gi, tag =>
    tag.replace(/\b(src|href)=(["'])([^"']+)\2/gi, (match, attr, quote, url) => {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(url)) return match;
      const [pathname] = url.split(/[?#]/);
      const source = relative(output, resolve(dirname(file), pathname)).split("\\").join("/");
      if (!fingerprints[source]) return match;
      const target = relative(dirname(file), join(output, fingerprints[source])).split("\\").join("/");
      return `${attr}=${quote}${target}${quote}`;
    })
  );
  writeFileSync(file, html);
}
writeFileSync(join(output, "asset-manifest.json"), JSON.stringify({ fingerprints }, null, 2) + "\n");
// Assets normally bypass the Worker. The Worker handles /assets/* to apply cache
// policies, while this file also covers HTML served directly by the asset router.
writeFileSync(join(output, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n");
console.log(`Cloudflare output: ${htmlFiles.length} pages, ${Object.keys(fingerprints).length} fingerprinted assets, VERSION.json and asset-manifest.json in dist/.`);

# Deploy this revision to Cloudflare Workers

Target: https://supply-chain-intelligence.manoj-k-manne.workers.dev/index.html

This package contains the complete source. Replace the corresponding repository files, including the entire assets folder and nested module folders. Keep the existing repository root layout; index.html, worker.js, wrangler.jsonc and build-cloudflare.mjs belong at that root. This revised package has not been published to your account.

## Build and deploy

From the extracted SUPPLY-CHAIN-INTELLIGENCE-main folder:

```bash
node build-cloudflare.mjs
npx wrangler deploy
```

Use Wrangler authenticated to your existing Cloudflare account. For a Cloudflare build connected to your repository branch, use node build-cloudflare.mjs as the build command and npx wrangler deploy as the deployment command. The root directory is the repository root. No GitHub Actions workflow is required.

The build creates a fresh dist directory. Wrangler uploads that directory through the ASSETS binding together with worker.js. Deploy both in the same revision. The source ZIP omits generated dist files so an old build cannot be uploaded accidentally.

Keep assets.html_handling set to none. Keep assets.run_worker_first set to ["/assets/*", "/api/*"] so the Worker applies the asset cache policy and handles the API routes. The Worker also resolves extensionless pages and nested directory entry points.

## Release behavior

- HTML and release metadata revalidate. New builds generate code filenames containing a content hash, with a one-year immutable browser cache. Static images and fonts cache for one day. Dynamically loaded mutable scripts revalidate.
- Native navigation preserves the current page while the next document loads. Supported browsers use document transitions; reduced-motion preferences are respected. Prefetch runs on link intent with a maximum of six same-origin HTML pages, and skips sign-in, callback, token-bearing, download and external links.
- Shared data scripts are deferred. Loading/authentication states show a generic branded surface while retaining the protected-content gate. Fonts load without blocking startup. Chart, workbook, authentication and formatting dependencies are pinned and included locally.
- MK Intelligence 4.2 sends completed website calculations to the existing website_chat Space endpoint. No Hugging Face token belongs in the website. The legacy Worker proxy accepts only that JSON contract and completed SSE results.
- Existing browser workspace keys and business-record schemas are preserved. If you change the hosting origin, use Data Center backup/export and restore to move browser-only records; browser storage is scoped to the origin.

After deployment, check VERSION.json for 2026.10.07-unified-enterprise-production42 and asset_version 20261007-1. Check asset-manifest.json and the fingerprinted script URLs in the page source. Open index.html, mk-brain.html, a regional report and a nested module; verify navigation and a report-backed brand question using your own report.

## Validation and limits

The package passed workflow, DOM, transport, build, startup and syntax checks, plus actual public Space inference with synthetic facts. CORS checks use your Workers origin. Machine-readable reports are in docs.

No graphical browser preview or rendered page-transition timing was performed. Live Cloudflare deployment, real sign-in/membership, database migrations/RLS and live business transactions remain unverified. These checks do not certify the optional cloud backend as a deployed enterprise service.

GitHub Pages remains supported through Deploy from a branch, main, / (root). Use DEPLOY_FROM_BRANCH.md for that target. Keep root .nojekyll and continue without custom .github/workflows or root pages.yml.

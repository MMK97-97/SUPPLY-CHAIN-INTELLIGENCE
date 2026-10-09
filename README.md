# Supply Chain Intelligence — Unified Enterprise System

**Current release: v47 production audit, metadata revision 2026.10.09-1.** Failed-save retries, corrupt workspace recovery, unsafe record attributes and shared dialog behavior are corrected. Release metadata now separates source verification from live deployment; see [METADATA_FIX.md](docs/METADATA_FIX.md). All 90 pages were inspected; see [PRODUCTION_AUDIT.md](docs/PRODUCTION_AUDIT.md) for current evidence and live verification limits.

**Retained: v46 ship-to label correction (October 8).** Each address field now has its own label, fixing the repeated comma-separated label list. See [SHIP_TO_LABEL_FIX.md](docs/SHIP_TO_LABEL_FIX.md).

**Retained: v45 customer orders and navigation.** Removed the regional Dashboard / Raw Report / Reorder Report / Active Brands / Instructions banner and Regional Workspace. Search appears only in Order Management and Vendor Management, including vendor procurement. Customer orders now use CRM addresses, configurable sales order numbering, carrier/LTL methods and automatic descriptions, inventory levels and warehouse suggestions. See [CUSTOMER_ORDER_UPDATE.md](docs/CUSTOMER_ORDER_UPDATE.md). The v44 EU AI correction is retained.


The two former entry points now open the same enterprise control tower. All working modules use one nested sidebar and a shared customer, supplier, SKU, order, warehouse and 3PL data layer.

Start with `index.html`. `business-operations.html` is a compatible entry point to the same workspace. US/EU/Canada reports open directly from Inventory & planning. Old `regional-workspace.html` bookmarks redirect to the matching regional inventory dashboard.

See **INTEGRATION_GUIDE.md** for deployment, workflow connections, data migration and cloud setup. See **docs/VERIFICATION.md** for checks and remaining verification limits.

This revision improves page navigation and connects **MK Intelligence 4.2** to your [Supply AI Chain Hub](https://huggingface.co/spaces/MMK97/supply-ai-chain-hub). Current content stays visible until the next document opens. Shared scripts are deferred, cosmetic fonts do not block startup, navigation prefetch is bounded, and loading/authentication failures have visible states. Browser document transitions respect reduced motion.

For the Workers website, follow [DEPLOY_TO_WORKERS.md](DEPLOY_TO_WORKERS.md). The build creates fingerprinted assets and includes `VERSION.json`; the Worker caches unchanged code and static images while HTML revalidates. Pinned chart, spreadsheet, authentication and Markdown libraries are bundled with their licenses. The legacy cloud analyst sanitizes formatted output and sign-in forms wait for client readiness.

MK receives completed website calculations as verified facts rather than tools it should invoke. Brand analysis includes eligible-model totals, monthly demand, recommended units and model-level stockout risks. The public Space passed an October 7 synthetic Cozy Earth test through the shipped connector. Local report calculations remain available when AI cannot answer. This revised package has not been published to your Workers account or GitHub repository. See [docs/MK_AI_SETUP.md](docs/MK_AI_SETUP.md).

GitHub Pages branch publishing remains supported; see [DEPLOY_FROM_BRANCH.md](DEPLOY_FROM_BRANCH.md). The eight changed shared scripts use cache version `20261008-5`; unchanged assets retain their existing cache versions. Upload the complete source package together. Existing storage keys and schema version 1 are retained; new workflow fields extend the records without replacing existing IDs.

## Customer orders, shipping, 3PL and procurement

The October 8 revision adds dedicated order issue, unvalidated and cancelled queues; structured customer delivery and billing fields; Sarasota shipping and daily reports; vendor PO item details and packing-slip attachments; and a 3PL processing history, shipment request, order, dispatch and import workflow. **3PL and Transportation are separate modules.**

See [docs/FULFILLMENT_WORKFLOWS.md](docs/FULFILLMENT_WORKFLOWS.md) for the requested field/page mapping and daily operation. Existing orders can complete delivery details without losing their allocations. Uploaded planning formulas remain unchanged.

The optional 3PL processing API sends through an authenticated server connector, with server-only partner credentials, durable idempotency and explicit uncertain-delivery handling. It is included as source and is **not deployed or connected to a real partner**. See [docs/3PL_API_SETUP.md](docs/3PL_API_SETUP.md). The local forms and shipment records work without that connection.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html`. Use a local HTTP server rather than opening HTML files directly so storage and imports use a consistent origin.

## Deploy

For the current Workers website, follow **DEPLOY_TO_WORKERS.md** and deploy the built `dist/` assets together with `worker.js`.

For GitHub Pages, this package also supports **Deploy from a branch** with **main → / (root)**.

1. Copy everything inside the extracted `SUPPLY-CHAIN-INTELLIGENCE-main/` folder into the existing repository root, including the empty `.nojekyll` file, the complete `assets/` folder and the nested module folders. The repository root must contain `index.html` directly.
2. Open repository **Settings → Pages → Build and deployment**. Set **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)**, then click **Save**.
3. Commit the files to `main`. GitHub publishes the committed static pages automatically. All pages and scripts are already present at the repository root; no build command is required for this publishing method.

The package includes no custom `.github/workflows` files or root `pages.yml`. Remove an old root `pages.yml` if it remains in the repository. The `.nojekyll` marker tells GitHub to publish the static site directly. If your file picker omits it, use GitHub's Add file → Create new file to create `.nojekyll` at the repository root.

GitHub's built-in **pages build and deployment** job may still appear in Actions. That is normal for branch publishing and does not require workflow files in the repository. Cloudflare deployment remains supported through `node build-cloudflare.mjs` and the existing worker configuration.

## Shared data

The static application saves work in the current browser. Existing operations and logistics records are migrated on first use; existing regional report databases remain in place. Sample records are labeled. Data Center can export backups, restore them, import regional inventory, or start an empty operations workspace.

An optional authenticated cloud adapter and SQL migration are included. Apply `supabase/migrations/20261005_unified_system.sql` followed by `supabase/migrations/20261008_fulfillment_workflows.sql` to your existing Supabase project, then sign in and connect through Data Center. This step has not been performed on your live database.

## Workflow checks

```bash
node scripts/check-workflows.cjs
```

These checks exercise allocation, receiving, picking, dispatch, holds, 3PL, dropship, regional data separation, backup validation and cloud conflict handling. Cloud tests use a mock service and do not validate a deployed database.

## Interface regression checks

```bash
npm install --no-save --package-lock=false jsdom@26
node scripts/check-interface.cjs
```

These checks load local source into a Node.js DOM simulation. They check module startup, navigation, menu/search/region behavior, dialog controls and selected text colors without opening a browser or contacting live services. The test dependency is separate from the deployed static website. Results are recorded in `docs/verification-interface.json`.

## MK analyst checks

```bash
node scripts/check-mk-ai.cjs
node scripts/check-mk-region.cjs
node scripts/check-mk-space.cjs
```

Use the same separate jsdom dependency as the interface checks. These scripts cover local tools, the retained private-service code, scenario isolation, import validation, the actual Space payload/SSE contract, conversation history, response validation and fallback/cancellation with mocked services. They make no live AI request or browser preview. Separate live synthetic checks are recorded in `docs/verification-mk-space-live.json`.

## Production navigation and build checks

Build first, then run the additional checks using the same separate jsdom dependency:

```bash
node build-cloudflare.mjs
node scripts/check-production.cjs
```

These checks exercise normal/modified/cancelled links, prefetch limits, restoration, cached assets, deep links, auth startup and errors, safe formatted output, real local workbook parsing, 14 regional/built page startups and completed-fact AI payloads. They are Node.js DOM/transport checks and do not measure rendered browser navigation speed.

## Fulfillment workflow checks

```bash
node scripts/check-fulfillment.cjs
```

Use the separate jsdom test dependency described above. Tests cover forms, validation, allocation, dispatch, imports, attachments, API transport, legacy records and uncertain delivery.

Optional isolated PostgreSQL checks:

```bash
npm install --no-save --package-lock=false @electric-sql/pglite@0.3.14
node scripts/check-fulfillment-sql.cjs
```

These execute the migrations, RLS and RPC behavior with synthetic principals in an in-process database. They do not deploy or modify Supabase. Test dependencies are not required by the website or Cloudflare build.

## Production failure-path checks

```sh
node scripts/check-resilience.cjs
```

Use the same separate jsdom dependency as the interface checks. This suite exercises storage failures/retries, stale edits, malformed workspace recovery/export, escaped record attributes, keyboard and asynchronous dialog behavior, and the actual 3PL routing and receiving buttons with synthetic local records. Results are in `docs/verification-resilience.json`.

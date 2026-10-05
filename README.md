# Supply Chain Intelligence — Unified Enterprise System

The two former entry points now open the same enterprise control tower. All working modules use one nested sidebar and a shared customer, supplier, SKU, order, warehouse and 3PL data layer.

Start with `index.html`. `business-operations.html` is a compatible entry point to the same workspace. The original market analysis interface is preserved at `regional-workspace.html`; existing US/EU/Canada report routes remain available.

See **INTEGRATION_GUIDE.md** for deployment, workflow connections, data migration and cloud setup. See **docs/VERIFICATION.md** for checks and remaining verification limits.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html`. Use a local HTTP server rather than opening HTML files directly so storage and imports use a consistent origin.

## Deploy

This package publishes using **Deploy from a branch** with **main → / (root)**.

1. Copy everything inside the extracted `SUPPLY-CHAIN-INTELLIGENCE-main/` folder into the existing repository root, including the empty `.nojekyll` file, the complete `assets/` folder and the nested module folders. The repository root must contain `index.html` directly.
2. Open repository **Settings → Pages → Build and deployment**. Set **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)**, then click **Save**.
3. Commit the files to `main`. GitHub publishes the committed static pages automatically. All pages and scripts are already present at the repository root; no build command is required for this publishing method.

The package includes no custom `.github/workflows` files or root `pages.yml`. Remove an old root `pages.yml` if it remains in the repository. The `.nojekyll` marker tells GitHub to publish the static site directly. If your file picker omits it, use GitHub's Add file → Create new file to create `.nojekyll` at the repository root.

GitHub's built-in **pages build and deployment** job may still appear in Actions. That is normal for branch publishing and does not require workflow files in the repository. Cloudflare deployment remains supported through `node build-cloudflare.mjs` and the existing worker configuration.

## Shared data

The static application saves work in the current browser. Existing operations and logistics records are migrated on first use; existing regional report databases remain in place. Sample records are labeled. Data Center can export backups, restore them, import regional inventory, or start an empty operations workspace.

An optional authenticated cloud adapter and SQL migration are included. Apply `supabase/migrations/20261005_unified_system.sql` to your existing Supabase project, then sign in and connect through Data Center. This step has not been performed on your live database.

## Workflow checks

```bash
node scripts/check-workflows.cjs
```

These checks exercise allocation, receiving, picking, dispatch, holds, 3PL, dropship, regional data separation, backup validation and cloud conflict handling. Cloud tests use a mock service and do not validate a deployed database.

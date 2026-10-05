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

Copy the contents of the extracted project folder into the existing repository root. Keep the `assets/` folder and all nested module folders. The included GitHub Actions workflow deploys `main` to GitHub Pages. Cloudflare deployment remains supported through `node build-cloudflare.mjs` and the existing worker configuration.

## Shared data

The static application saves work in the current browser. Existing operations and logistics records are migrated on first use; existing regional report databases remain in place. Sample records are labeled. Data Center can export backups, restore them, import regional inventory, or start an empty operations workspace.

An optional authenticated cloud adapter and SQL migration are included. Apply `supabase/migrations/20261005_unified_system.sql` to your existing Supabase project, then sign in and connect through Data Center. This step has not been performed on your live database.

## Workflow checks

```bash
node scripts/check-workflows.cjs
```

These checks exercise allocation, receiving, picking, dispatch, holds, 3PL, dropship, regional data separation, backup validation and cloud conflict handling. Cloud tests use a mock service and do not validate a deployed database.

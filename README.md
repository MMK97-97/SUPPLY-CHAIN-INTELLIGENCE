# Supply Chain Intelligence — Unified Enterprise System

The two former entry points now open the same enterprise control tower. All working modules use one nested sidebar and a shared customer, supplier, SKU, order, warehouse and 3PL data layer.

Start with `index.html`. `business-operations.html` is a compatible entry point to the same workspace. The original market analysis interface is preserved at `regional-workspace.html`; existing US/EU/Canada report routes remain available.

See **INTEGRATION_GUIDE.md** for deployment, workflow connections, data migration and cloud setup. See **docs/VERIFICATION.md** for checks and remaining verification limits.

For the current manual upload, follow [DEPLOY_FROM_BRANCH.md](DEPLOY_FROM_BRANCH.md). The October 7 check confirmed that the live site still uses UI2, the repository is missing root `.nojekyll`, and the old root `pages.yml` remains. The package includes the root marker and the full AI integration; the guide explains the upload and cleanup. The shipped Hugging Face connector passed a fresh synthetic inference test.

This revision connects **MK Intelligence 4.1** to your [Supply AI Chain Hub](https://huggingface.co/spaces/MMK97/supply-ai-chain-hub). Open **MK AI analyst → Analyst workspace** for conversational inventory/sales analysis, regional comparisons, scenarios, report evidence and proactive findings. MK calls the Space's dedicated `website_chat` JSON endpoint. Shared scripts and styles use asset version `20261005-5`; upload the full package together.

The public Space provides model-powered answers without a website OpenAI key or AI Edge Function deployment. A live synthetic report check confirmed inference and cross-origin access from your GitHub Pages domain. Local analysis remains available if the Space cannot answer. The website changes have not been published to your live repository. See [docs/MK_AI_SETUP.md](docs/MK_AI_SETUP.md) for Fast/Auto/Deep modes, connection tests and limits. The cancelled order-management/3PL revision is excluded from this package.

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

## Interface regression checks

```bash
npm install --no-save --package-lock=false jsdom@26
node scripts/check-interface.cjs
```

These checks load local source into a Node.js DOM simulation. They check module startup, navigation, menu/search/region behavior, dialog controls and selected text colors without opening a browser or contacting live services. The test dependency is separate from the deployed static website. Results are recorded in `docs/verification-interface.json`.

## MK analyst checks

```bash
node scripts/check-mk-ai.cjs
node scripts/check-mk-space.cjs
```

Use the same separate jsdom dependency as the interface checks. These scripts cover local tools, the retained private-service code, scenario isolation, import validation, the actual Space payload/SSE contract, conversation history, response validation and fallback/cancellation with mocked services. They make no live AI request or browser preview. Separate live synthetic checks are recorded in `docs/verification-mk-space-live.json`.

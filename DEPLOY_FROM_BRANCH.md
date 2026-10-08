# Publish v47 from a branch

This is the complete source release `2026.10.08-unified-enterprise-production-audit47`. It includes the production audit fixes, the v45 customer-order update, the v46 ship-to labels and the v44 regional AI correction. This release has not been published remotely.

Repository: [MMK97-97/SUPPLY-CHAIN-INTELLIGENCE](https://github.com/MMK97-97/SUPPLY-CHAIN-INTELLIGENCE)

## Upload the complete source

1. Extract `SUPPLY-CHAIN-INTELLIGENCE-2026-10-08-v47-production-audit.zip`.
2. Upload everything **inside** `SUPPLY-CHAIN-INTELLIGENCE-main/` to the repository's `main` branch. The repository root must contain `index.html`, `business-operations.html`, `VERSION.json`, `assets/` and the nested module folders directly. Upload the source files, not the ZIP or an extra outer folder.
3. Include every page and asset in the same commit. The eight changed shared scripts use cache version `20261008-5`; unchanged dependencies keep their existing versions.
4. Keep the empty `.nojekyll` file at the repository root. If the file picker skips it, use **Add file → Create new file**, name it `.nojekyll` and commit it at the root.
5. Keep custom `.github/workflows` files and root `pages.yml` removed, as requested. Uploading files does not remove files that already exist in the repository.

Do not generate or upload `dist/` for this branch deployment. Existing browser storage keys, schema version 1, customer/order IDs and regional report databases are retained. Data Center can export a workspace backup before replacing the website source.

## Select branch publishing

Open **Settings → Pages → Build and deployment**:

| Setting | Value |
| --- | --- |
| Source | Deploy from a branch |
| Branch | main |
| Folder | / (root) |

Save if a setting changed. GitHub may show its own Pages build/deployment job. No custom Actions workflow or npm build is required for this static branch deployment.

## Verify the published release

1. Open `VERSION.json` on the published site. Confirm `version` is `2026.10.08-unified-enterprise-production-audit47` and `asset_version` is `20261008-5`, then refresh the home page.
2. Navigate between the home page, CRM, orders, procurement, shipping, warehouse, 3PL, transportation and each regional report. Check desktop/mobile layout and the transition while the next page loads.
3. Use test records to create a CRM customer, save its addresses, create a customer order and validate it. Verify its sales order number, carrier method, inventory and selected warehouse.
4. Check vendor PO creation, receiving/putaway, Sarasota dispatch and the daily shipment export. Keep 3PL orders and transportation in their separate modules.
5. In MK AI Analyst, select EU and an EU report; verify that its facts and response stay in EU. Repeat for US and Canada. Test connection, then use synthetic report facts for inference.
6. For shared multi-user operation, use your configured authenticated cloud workspace and apply the included database migrations in your existing environment. This request did not deploy or migrate that backend.

Read [docs/PRODUCTION_AUDIT.md](docs/PRODUCTION_AUDIT.md) and [docs/VERIFICATION.md](docs/VERIFICATION.md) for the fixes, local test evidence and remaining live checks. The Hugging Face integration guide remains [docs/MK_AI_SETUP.md](docs/MK_AI_SETUP.md).

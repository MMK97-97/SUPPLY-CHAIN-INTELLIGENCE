# MK Supply Chain Intelligence

**Current release: v52 workspace and saved-report fixes — October 13, 2026.** Saved Reorder Reports now work below the compact title, with an explicit Save current report action. Organization/demo entry keeps the current page and region. Top AI controls and Analysis Report navigation are removed. Regional dialogs, report headings and the analyst conversation layout are repaired. See [Workspace fixes](docs/WORKSPACE_FIXES.md). The manual reorder simulator, login entry and portfolio workflows remain available.

**Publishing correction:** the inspected repository has newer asset copies at the root while the actual `assets/` folder still contains older code. Preserve the extracted folder paths when publishing. `system-shell.js` at the root does not update `assets/system-shell.js`.

Open `index.html` for sign-in or **Explore the demo**. `login.html` provides the same entry. The application home and demo reset now lead to `workspace.html`. Existing working records stay intact; legacy `index.html?demo=1` links redirect to the demo. `business-operations.html` remains a compatible dashboard route.

The demo covers CRM, customer orders, procurement, receiving, warehouse picking, Sarasota dispatch, masked digital rewards, 3PL processing, shipment tracking and regional reports. Guided actions update the same linked records and inventory as the working modules. **3PL and Transportation are separate.** Search remains scoped to Order Management and Vendor Management, including procurement. Demo cloud/partner transmission is blocked; explicit demo acknowledgements and tracking use fictional records.

The full-width MK analyst combines existing verified report/forecast tools with connected inventory and operational evidence. Its scenario lab keeps the official reorder formula separate, flags missing costs and stale sources, and never combines currencies. Local analysis works without remote AI. The existing [Supply AI Chain Hub](https://huggingface.co/spaces/MMK97/supply-ai-chain-hub) connector remains available for optional external inference; the remote model was not changed by this source release.

## Publish from a branch

Use GitHub Pages **Deploy from a branch → main → /(root)**. Upload everything inside `SUPPLY-CHAIN-INTELLIGENCE-main/`, including `.nojekyll`, in one commit. Do not upload an extra outer folder, `dist/`, or custom `.github/workflows`. See [DEPLOY_FROM_BRANCH.md](DEPLOY_FROM_BRANCH.md). This package has not been published remotely.

Workers compatibility remains; [DEPLOY_TO_WORKERS.md](DEPLOY_TO_WORKERS.md) explains the optional build. Changed application assets use version `20261013-1`, and Workers builds fingerprint the JS/CSS bundles.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html`. Use HTTP rather than opening HTML directly so reports, imports and browser storage have a consistent origin.

## Real organization operation

Sign-in retains the configured authentication and organization membership flow. Working records remain in the local browser until organization synchronization is connected. Shared operations require the supplied backend migrations, organization permissions and real provider configuration. See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md), [Fulfillment workflows](docs/FULFILLMENT_WORKFLOWS.md), [3PL API setup](docs/3PL_API_SETUP.md) and [MK AI setup](docs/MK_AI_SETUP.md).

## Verification

See [VERIFICATION.md](docs/VERIFICATION.md) and the current release JSON report. Automated checks cover transactions, region isolation, demo isolation, conversations, forms, source-driven DOM startup, error recovery, SQL and build/static integrity. Graphical desktop/mobile rendering and live authentication, AI, carrier/partner services and deployment require separate checks on the published site.

The archive retains the earlier source files and historical v51/v50/v49/v48/v47 reports. `VERSION.json` and the current v52 release report are authoritative for this update.

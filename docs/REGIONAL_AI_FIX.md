# Regional AI correction — October 8, v44

The reported EU Reorder Report showed an EU Analysis region in the header while MK displayed United States and analyzed US inventory. The saved `mk-analyst-v4.scope` value took precedence over the current page, and MK listened for `stark:system-region` rather than the header's `stark:region-change` event.

## Corrected behavior

- A regional report URL such as `reorder-report-eu.html` selects EU before MK starts. Valid `region` and `workspace` query parameters select their matching region; generic modules follow the shared Analysis region.
- A previous US/EU/CA/ALL AI selection no longer pins later pages. An explicit selection in the analyst workspace lasts for the current page session. A header region change resets it.
- Local calculations, remembered notes, report evidence and the Space request use the selected scope. Normal EU analysis includes EU report data only. Missing EU data produces a missing-report result, and a provider failure retains the EU local result.
- Restored chat displays the selected scope's saved conversation. Other regional conversations remain stored. Only matching history and notes enter a normal regional AI request.
- Switching scope stops the pending chat and rejects a late answer from the previous scope, even when a provider adapter ignores cancellation.
- Explicit cross-region comparisons remain available. A comparison does not replace the current page's default scope.

No inventory dataset, workspace record, reorder formula, sales formula or fulfillment workflow was changed. The calculation section of `mk-brain.js` matches v43 exactly; only scope and chat handling changed.

## Publish the correction

For GitHub Pages, extract the ZIP and put the **contents** of `SUPPLY-CHAIN-INTELLIGENCE-main` in the repository root. Include the updated HTML pages and complete assets folder. Publish from **main → / (root)** with no custom workflow. For the Workers site, follow `DEPLOY_TO_WORKERS.md` and rebuild its assets before deployment.

After the deployment completes, check `VERSION.json` for `2026.10.08-unified-enterprise-regional-ai44` and asset version `20261008-2`. Reload the EU page with a hard refresh, then choose Analyze data. The panel should show European Union and its evidence should identify EU sources. Browser reports and saved conversations remain in place; clearing browser data is not required.

## Verification

The original implementation failed all 15 new region regression cases. The correction passes all 15 and the complete 213-check release suite. Checks cover US/EU/CA routes, query parameters, nested modules, saved scope migration, header/cross-tab changes, visible chat isolation, real connector POST/SSE behavior with mocked responses, provider failure, missing reports, explicit comparison and a late response after switching regions.

These are source/DOM tests with synthetic data and mocked transport. No business reports were sent to the live Space and no live website was deployed. Graphical browser rendering remains outside this verification. See `VERIFICATION.md` and `verification-mk-region.json`.

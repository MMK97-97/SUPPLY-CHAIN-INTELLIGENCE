# Publish v52 from a branch

This complete source release is `2026.10.13-workspace-fixes52`. It has not been published remotely.

Repository: [MMK97-97/SUPPLY-CHAIN-INTELLIGENCE](https://github.com/MMK97-97/SUPPLY-CHAIN-INTELLIGENCE)

## Preserve folder paths

The October 13 cloud-browser inspection found new asset files at the repository root and older copies inside `assets/`. The running pages request `assets/system-shell.js`, which still contained Analysis Report and the AI header button. A new version query does not correct an outdated file at that path.

Copy the extracted source tree into a checkout of the repository, merging each folder with the same folder, then commit the complete update to the publishing branch. Do not flatten the files. If using GitHub's web uploader, open the correct repository folder before selecting its contents:

| Extracted location | Repository upload location |
| --- | --- |
| Root files, including `index.html`, `login.html`, `workspace.html`, `VERSION.json` | Repository root |
| Files directly inside `assets/` | `assets/` |
| Files inside `assets/vendor/` | `assets/vendor/` |
| Files inside each module folder, such as `order-management/` | That same module folder |
| `docs/`, `scripts/`, `database/`, `supabase/` | The matching folder and subfolder |

For web uploads, prepare the updates on a release branch, preserving those paths, and merge after all folders are present so Pages publishes a consistent tree. The Pages publishing source remains **Deploy from a branch → main → /(root)**. Root-level copies of application assets are not loaded and need not be removed to apply this repair.

## Upload the source

1. Extract `SUPPLY-CHAIN-INTELLIGENCE-2026-10-13-v52-workspace-fixes.zip`.
2. Upload everything **inside** `SUPPLY-CHAIN-INTELLIGENCE-main/` to the repository's `main` branch. The root must directly contain `index.html`, `login.html`, `workspace.html`, `business-operations.html`, `VERSION.json`, `assets/` and the nested module folders.
3. Commit all changed pages and assets together. Changed application assets use cache version `20261013-1`.
4. Include the empty root `.nojekyll`. If a file picker omits it, use **Add file → Create new file**, name it `.nojekyll`, and commit it at the root.
5. Keep custom `.github/workflows` and root `pages.yml` removed. Uploading source does not remove old files already in the repository.

Do not upload the ZIP, an extra outer folder, `dist/`, test dependencies or temporary verification folders. No npm build or custom Actions workflow is required for branch publishing. Working browser keys/schema/IDs are retained; demo data uses a separate namespace. Export a Data Center backup if you need a portable copy of working records.

## Pages settings

| Setting | Value |
| --- | --- |
| Source | Deploy from a branch |
| Branch | main |
| Folder | / (root) |

## Verify and share the portfolio

1. Confirm published `VERSION.json` reports `2026.10.13-workspace-fixes52` and asset version `20261013-1`.
2. Open plain `index.html` in a fresh browser session. It must show the login form and **Explore the demo**. Clicking Explore the demo opens `workspace.html?demo=1` with fictional regional reports and the guided order workflow. Existing working data must remain intact when you switch back.
3. Create, validate and dispatch the guided order. Check inventory, shipment history and audit activity. Receive the example vendor PO. Try warehouse picking and digital reward dispatch in their modules.
4. Open 3PL request history and process the demo request. Its acknowledgement must be clearly simulated. Try demo tracking; it must report no carrier request was sent. Keep 3PL and Transportation separate.
5. Open MK AI Analyst from its bottom launcher. The top AI button and analyst tabs must be absent. In MK AI Analyst, test EU and Canada scope, demand/delay scenarios, action-plan chat and evidence export. Local analysis should work with external AI disabled. Test external AI only with synthetic facts before relying on model access.
6. Open Decision Intelligence in US, EU and Canada. Enter a manual reorder quantity and check coverage after arrival and the buffer target. Probability needs six complete same-region sales months; otherwise it reads Not estimated. Analysis Report bookmarks redirect to Decision Intelligence, and the pictured banners/cards are removed.
7. In all three regional Reorder Reports, verify Saved Reorder Reports appears below the compact title. Save a current report, reload and download the saved Excel. Existing working reports belong to the same browser and origin; switch from demo back to working records to find them. The workspace menu must open as a centered dialog and keep the same module/region when choosing demo or organization sign-in.
8. Check the top module menu, mobile bottom navigation, forms, table scrolling, focus/Escape behavior, portrait/landscape layout, reduced motion and transitions on actual desktop/mobile browsers.
9. Test organization login/recovery, permissions, cloud synchronization and configured carriers/partners in your deployed environment. This update did not deploy or migrate those services.

Share the published `index.html` with recruiters; they can choose the demo from the login page. The demo does not require an account.

See [docs/WORKSPACE_FIXES.md](docs/WORKSPACE_FIXES.md), [docs/PORTFOLIO_UPGRADE.md](docs/PORTFOLIO_UPGRADE.md), [docs/VERIFICATION.md](docs/VERIFICATION.md), [docs/REORDER_SIMULATOR.md](docs/REORDER_SIMULATOR.md) and the current v52 JSON release report for implementation and test evidence.

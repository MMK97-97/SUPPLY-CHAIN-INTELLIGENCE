# Publish v51 from a branch

This complete source release is `2026.10.12-reorder-simulator51`. It has not been published remotely.

Repository: [MMK97-97/SUPPLY-CHAIN-INTELLIGENCE](https://github.com/MMK97-97/SUPPLY-CHAIN-INTELLIGENCE)

## Upload the source

1. Extract `SUPPLY-CHAIN-INTELLIGENCE-2026-10-12-v51-reorder-simulator.zip`.
2. Upload everything **inside** `SUPPLY-CHAIN-INTELLIGENCE-main/` to the repository's `main` branch. The root must directly contain `index.html`, `login.html`, `workspace.html`, `business-operations.html`, `VERSION.json`, `assets/` and the nested module folders.
3. Commit all changed pages and assets together. Changed application assets use cache version `20261012-4`.
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

1. Confirm published `VERSION.json` reports `2026.10.12-reorder-simulator51` and asset version `20261012-4`.
2. Open plain `index.html` in a fresh browser session. It must show the login form and **Explore the demo**. Clicking Explore the demo opens `workspace.html?demo=1` with fictional regional reports and the guided order workflow. Existing working data must remain intact when you switch back.
3. Create, validate and dispatch the guided order. Check inventory, shipment history and audit activity. Receive the example vendor PO. Try warehouse picking and digital reward dispatch in their modules.
4. Open 3PL request history and process the demo request. Its acknowledgement must be clearly simulated. Try demo tracking; it must report no carrier request was sent. Keep 3PL and Transportation separate.
5. In MK AI Analyst, test EU and Canada scope, demand/delay scenarios, action-plan chat and evidence export. Local analysis should work with external AI disabled. Test external AI only with synthetic facts before relying on model access.
6. Open Decision Intelligence in US, EU and Canada. Enter a manual reorder quantity and check coverage after arrival and the buffer target. Probability needs six complete same-region sales months; otherwise it reads Not estimated. Analysis Report bookmarks redirect to Decision Intelligence, and the pictured banners/cards are removed.
7. Check the top module menu, mobile bottom navigation, forms, table scrolling, focus/Escape behavior, portrait/landscape layout, reduced motion and transitions on actual desktop/mobile browsers.
8. Test organization login/recovery, permissions, cloud synchronization and configured carriers/partners in your deployed environment. This update did not deploy or migrate those services.

Share the published `index.html` with recruiters; they can choose the demo from the login page. The demo does not require an account.

See [docs/PORTFOLIO_UPGRADE.md](docs/PORTFOLIO_UPGRADE.md), [docs/VERIFICATION.md](docs/VERIFICATION.md), [docs/REORDER_SIMULATOR.md](docs/REORDER_SIMULATOR.md) and the current v51 JSON release report for implementation and test evidence.

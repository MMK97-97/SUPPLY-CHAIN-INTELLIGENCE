# Publish v49 from a branch

This complete source release is `2026.10.12-portfolio-upgrade49`. It has not been published remotely.

Repository: [MMK97-97/SUPPLY-CHAIN-INTELLIGENCE](https://github.com/MMK97-97/SUPPLY-CHAIN-INTELLIGENCE)

## Upload the source

1. Extract `SUPPLY-CHAIN-INTELLIGENCE-2026-10-12-v49-portfolio-upgrade.zip`.
2. Upload everything **inside** `SUPPLY-CHAIN-INTELLIGENCE-main/` to the repository's `main` branch. The root must directly contain `index.html`, `login.html`, `business-operations.html`, `VERSION.json`, `assets/` and the nested module folders.
3. Commit all changed pages and assets together. Changed application assets use cache version `20261012-2`.
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

1. Confirm published `VERSION.json` reports `2026.10.12-portfolio-upgrade49` and asset version `20261012-2`.
2. Open `index.html?demo=1` in a fresh browser session. It should display **Portfolio demo**, fictional regional reports and the guided order workflow. Existing working data must remain intact when you switch back.
3. Create, validate and dispatch the guided order. Check inventory, shipment history and audit activity. Receive the example vendor PO. Try warehouse picking and digital reward dispatch in their modules.
4. Open 3PL request history and process the demo request. Its acknowledgement must be clearly simulated. Try demo tracking; it must report no carrier request was sent. Keep 3PL and Transportation separate.
5. In MK AI Analyst, test EU and Canada scope, demand/delay scenarios, action-plan chat and evidence export. Local analysis should work with external AI disabled. Test external AI only with synthetic facts before relying on model access.
6. Check the top module menu, mobile bottom navigation, forms, table scrolling, focus/Escape behavior, portrait/landscape layout, reduced motion and transitions on actual desktop/mobile browsers.
7. Test organization login/recovery, permissions, cloud synchronization and configured carriers/partners in your deployed environment. This update did not deploy or migrate those services.

Share the published `index.html?demo=1` or `login.html` with recruiters. The demo does not require an account.

See [docs/PORTFOLIO_UPGRADE.md](docs/PORTFOLIO_UPGRADE.md), [docs/VERIFICATION.md](docs/VERIFICATION.md) and the current v49 JSON release report for implementation and test evidence.

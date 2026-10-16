# v52 workspace and saved-report repair

Release: `2026.10.13-workspace-fixes52`, asset version `20261013-1`.

## Observed defects and fixes

| Reported problem | Cause and change |
| --- | --- |
| Saved Reorder Reports disappeared | History depended on the large heading removed in v51. It now mounts below the compact title or directly inside the report, with Save current report, Refresh files, download and history controls. |
| Existing working reports appeared missing | An unmarked deep link could enter demo and read a different database. Fresh deep links now select working records; the login page still offers an explicit recruiter demo. Native working database names are retained. |
| Organization/demo connection lost the current module | The workspace dialog now carries a safe return path and region into organization sign-in and guest demo entry. An explicit option returns to working browser records. |
| Analysis Report and top AI controls remained visible | The updated shell omits them. A small navigation guard also removes late legacy reinsertions. Decision Intelligence stays in Inventory & planning under Modules; the analyst is available from the bottom launcher. |
| Workspace dialog appeared inline at the page bottom | All shared pages now load the modal foundation and workspace-card styles; the switcher uses the system dialog. |
| AI conversation compressed into narrow columns | Its open flex container now explicitly uses a column layout with a scrollable feed and fixed composer. |
| Dark text on the Reorder title | The report title and its text use an explicit light foreground. |
| Repeated old export asset loading | The legacy loader checks existing script URLs and uses this release's asset version. |
| Uploaded updates did not reach the running assets | Public repository inspection found newer root-level copies while `assets/system-shell.js` still had old controls. Publish every file to its extracted relative path. See the deployment guide. |

## Saved data behavior

Saved reports retain the established `stark-reorder-history-v1` database and `reports` store. Demo uses its existing isolated namespace. Each region retains its latest 30 reports. Legacy `Canada` labels are readable alongside `CA`; this release does not migrate or clear saved records.

A saved workbook is reported as successful only after its transaction commits. If archiving the prior raw report fails, replacing it is rejected. Saving the same source and calculated snapshot manually twice reuses the existing archive. Downloads remain Excel workbooks with report title, formula, headers and rows.

History is browser-local and origin-specific. GitHub Pages, Workers and a different browser have separate storage. This repair reveals existing records in their original workspace and adds explicit saving; it cannot recreate deleted browser data or copy files from another device. Organization authentication does not itself synchronize report history.

## Login and workspace behavior

The public entry remains `index.html`/`login.html`. Explicit guest entry seeds fictional demo records, and organization authentication selects working mode. Switching retains the current HTML module, region query and hash while dropping obsolete workspace and authentication parameters. External destinations, traversal and login-entry loops resolve safely to the workspace.

Authentication and real organization membership are still handled by the existing Supabase flow. Demo operations cannot invoke organization synchronization or real partner transport. No credentials, memberships or backend permissions are changed by this release.

## Verification limits

The original defects, workspace switcher and organization login form were inspected in the cloud browser on October 13. The public repository was inspected read-only; it is signed out in that browser. No real organization sign-in or repository publication occurred.

The official managed preview failed because the container could not mount its required process filesystem. Corrected rendering has therefore been checked through source-driven DOM/CSS checks, not a graphical desktop/mobile preview. Regression reports include real workbook serialization/reading, transaction success/abort fixtures, legacy archive visibility, workspace return paths, storage isolation, navigation and dialog styles. See VERIFICATION.md for actual results.

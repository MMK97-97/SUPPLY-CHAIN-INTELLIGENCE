# Independent draggable operational modules — October 21, 2026

The previous homepage and its telemetry dashboard are restored. All 12 existing operational module cards retain their original design, banners, page links, launch links and quick actions. Each card can be positioned independently on the screen by dragging its header.

## Arrange modules

1. Open the homepage and choose **Operational Modules**.
2. Drag a card by its title bar or six-dot handle. Its whole card moves, including all its links and actions. The other cards stay where they are.
3. Select an overlapping card to bring it to the front. Its contents remain usable; links keep their normal navigation and modified-click behavior.
4. Use the card's return arrow, or **Return to grid** in its original grid slot, to restore that card. **Restore module layout** returns all cards to their original grid positions.

Every moved card's position is saved between homepage visits and restored after regional changes. Resizing, rotating or zooming the visible screen keeps the card reachable. Long card contents scroll inside the card on smaller screens. Demo and working layout preferences are separate. Switching to Telemetry & KPIs restores that view; returning to Operational Modules restores the arrangement.

Keyboard: focus a card's six-dot handle and press Alt + arrow keys to move it. Add Shift for smaller steps. Alt + Home returns that card to the grid. Escape cancels a move in progress. A cancelled move does not replace the saved layout.

The cards are Item Master, Inventory & Planning, Customers & CRM, Order Management, Vendor Management, Procurement, Shipping, Warehouse Management, 3PL Management, Transportation, Analytics & Reports, and System & Data.

## Scope

The added shared all-modules launcher from the preceding revision is removed. `system-shell.js` is restored to the source before that revision. Existing homepage content and navigation are retained. The independent-card behavior is implemented within the existing Operational Modules view in `control-tower.js`; its styles are appended to `enterprise-layout.css`. Root and loaded `assets/` copies agree.

Only presentation preferences are saved by the new arrangement controls. Moving a card does not change orders, inventory, prices, accounts or workflow state. All earlier browser QA fixes remain included. Layout state survives dashboard refreshes without accumulating pointer handlers.

## Verification

- 18 focused checks passed in `scripts/check-draggable-modules.cjs`: original card content and destinations, independent movement of every module, mouse/touch and keyboard interaction, drag cancellation and click suppression, independent persistence and reset, overlap ordering, responsive bounds, region changes, telemetry switching, repeated refreshes, storage failure and demo isolation.
- The 19 earlier browser-fix checks and 23 core workflow checks passed again.
- Changed JavaScript parses; root and loaded asset copies match. Existing static destinations are retained.
- Checks run the actual local source/defer order in jsdom@26 with synthetic events and simulated geometry. They do not render a graphical browser or contact live services. The preceding cloud-browser preview connection timed out; graphical layout verification remains pending.

Run with a development-only installation of `jsdom@26`:

```bash
node scripts/check-draggable-modules.cjs
node scripts/check-browser-fixes.cjs
node scripts/check-workflows.cjs
```

## Publishing

The live GitHub Pages site has not been changed. Upload the contents of `SUPPLY-CHAIN-INTELLIGENCE-main/` to the existing repository root, preserving `assets/`, the other directories and `.nojekyll`. The three restored/changed presentation assets use cache version `20261021-dragcards1`. Existing working records do not need to be reset.

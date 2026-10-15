# Decision Intelligence — manual reorder scenarios

Release v51 removes the large Raw Report, Reorder Report, Active Brands and Decision Intelligence banners in US, EU and Canada. Compact titles and source feedback replace them. The learning and regulations panels are removed. Analysis Report is removed from both module menus; its three old URLs redirect to the corresponding Decision Intelligence page with the query and fragment retained.

## Try a quantity

Open the regional Decision Intelligence page, choose a Model#, and enter **Manual reorder quantity**. Results update as you type. Monthly demand starts from the regional report's average monthly sales. Target coverage, buffer and arrival time start from the region's settings and brand lead time; all can be adjusted for the scenario. Use report quantity restores the official quantity in the preview; Reset scenario restores all defaults for the model. Different models retain separate drafts while the page remains open.

The cards show current months of coverage, months after receipt, months above the minimum stock buffer, and the reorder quantity needed for the target. The progress meter compares coverage above buffer to the target. An explicit warning shows when average demand exhausts current stock before the assumed arrival date.

Inputs are previews. They do not change inventory, official reorder settings or formulas, and do not create or send a purchase order. Reloading the page resets the manual drafts. No new search field is introduced.

## Stock and coverage calculation

The page's region determines every source, including monthly sales. Browser location does not determine the region. A unique linked catalog model uses connected on-hand stock less reservations and damaged units; report commitments are not deducted again. A report-only model uses `Stock Qty − open client orders`. Negative net stock is preserved as a backlog. ATS and undated supplier supply are excluded from this stock basis.

Report-eligible inbound is excluded by default. Selecting its checkbox assumes the report's planning-eligible quantity arrives **at the same time as this proposed reorder**. It does not promise an actual supplier delivery date.

All calculations use a 30-day planning month:

```
lead-time demand = monthly demand × arrival days / 30
net stock at receipt = net current stock − lead-time demand + manual quantity + selected inbound
months coverage after receipt = max(0, net stock at receipt) / monthly demand
months above buffer = max(0, net stock at receipt − buffer) / monthly demand
quantity needed = ceil(max(0, monthly demand × (arrival days / 30 + target months)
                              + buffer − net current stock − selected inbound))
```

Zero monthly demand displays undefined coverage rather than infinite coverage. Outstanding backlog remains visible when the proposed quantity cannot clear it. Scenario quantities must be whole numbers from 0 to 1 billion; arrival time is 0–730 days and target coverage is 0.1–24 months.

Example: 100 on hand, 20 committed, 30 units/month, a 30-day arrival and 40 reorder units give `80 − 30 + 40 = 90` units at receipt, or **3 months**. A 3-unit buffer requires **43 reorder units** for three full months above that buffer. A larger order arriving after stock runs out does not prevent the earlier stockout.

## Conditional probability

Probability uses the selected model's complete monthly unit-sales series saved by **Sales Analysis in the same region**. The latest 24 recorded complete months are considered; at least six are required. Current/future months, ambiguous model matches, missing or negative units and all-zero history do not produce an estimate. Repeated inventory snapshots and decision confidence scores are not treated as sales-month observations. Stale or discontinuous history is disclosed.

The engine samples 2,000 demand paths from the observed monthly units with replacement. Historical variability is scaled to the entered monthly demand. Each 30-day planning month has uniform consumption; partial months use the appropriate fraction of the same draw. Success means both:

- Current stock lasts until the entered arrival date.
- Total stock including the proposed receipt covers demand through arrival plus the target horizon and leaves the minimum buffer.

The second probability reports stockout before arrival. Demand paths use a deterministic seed independent of order quantity, so results are reproducible and increasing a quantity cannot lower success on the same assumptions. Evidence shows successful path count, history span, source file and median/90th-percentile demand over the horizon.

This is an **uncalibrated conditional bootstrap estimate**, not a guarantee, forecast-accuracy score or service-level commitment. It assumes independent stationary monthly draws; seasonality, trends, supply disruption and intra-month demand bursts are not modeled. The interface states those assumptions. When evidence is insufficient, manual coverage still works and probability reads **Not estimated**.

The isolated recruiter demo includes fictional complete monthly sales series. Direct demo visits to all three Decision Intelligence pages can therefore exercise both quantity and probability controls. Working reports, sales history, authentication and operations remain separate from the demo.

## Refresh and compatibility

Report reloads are guarded against out-of-order completion; failed or cleared sources clear prior results and balances. Connected stock changes update the preview immediately. Focus, visible-page return, report events and regional synchronization refresh sources. Unavailable monthly-sales storage does not block deterministic coverage; Reload source retries it.

Canadian Active Brands now reads the canonical `Canada` inventory/settings key. Legacy `CA` brand settings are retained, and missing canonical entries are copied without overwriting existing canonical choices. The older logistics key is retained. The original inventory, sales, reservation, reconciliation, fulfillment and receiving calculation sections are unchanged.

## Verification and publication

`scripts/check-reorder-simulator.cjs` checks math, conditional probability, UI controls, regional/working data sources, refresh recovery, read-only behavior, removed sections, legacy routes and brand saving with synthetic records. Shared regression, all-page and static/build evidence is recorded in the v51 release report.

Source-driven DOM and declared responsive CSS checks do not establish graphical mobile/browser rendering, actual-demand calibration, real authentication or live inference. The complete source must be committed to `main` at the repository root to update branch-published GitHub Pages. No workflow is needed. See [DEPLOY_FROM_BRANCH.md](../DEPLOY_FROM_BRANCH.md).

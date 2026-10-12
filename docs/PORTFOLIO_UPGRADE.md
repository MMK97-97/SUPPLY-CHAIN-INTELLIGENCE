# v49 portfolio upgrade

This source release replaces the vertical sidebar and persistent AI dock with a top module menu, horizontal module pages, a centered analyst dialog and a full-width analyst workspace. Every existing route remains available. 3PL and Transportation stay separate.

## Recruiter entry

Share the published `index.html?demo=1` or `login.html`. First-time visitors to `index.html` also receive the demo automatically when no working records exist. The login page provides **Explore the demo** without an account. Existing browser records keep their working workspace by default.

The demo includes fictional US/EU/Canada customers, inventory and twelve complete months of sales, purchase orders, warehouse picking, masked digital reward tokens, shipment history and a queued 3PL request. Dates are relative to opening the demo. Guided order creation, validation, allocation, dispatch and vendor receiving use the same transactions as the working modules. Tracking reads the fictional dispatch/delivery records. Demo partner processing explicitly returns a simulated acknowledgement; it sends no partner request.

Demo application storage, report datasets, preferences, chat and synchronization channels use an isolated namespace. Workspace selection is per tab. Resetting a demo advances its database namespace; it keeps working records and authentication storage. This is a browser-local portfolio sandbox, not a shared multi-user demo database. Uploaded reports and edits stay in the selected workspace.

## Login and working records

The redesigned sign-in form retains the configured Supabase password, invitation, recovery and organization membership flow. Successful login selects the working workspace. No sample credentials or fake password verification were added. Cloud synchronization and real partner processing are unavailable in the demo. Organization roles, server credentials, migrations and partner configuration remain necessary for real shared operation.

Application records in the local working workspace remain browser-local until organization synchronization is connected. This release does not turn browser storage into server authorization. The backend's authentication and row-level policies control shared records.

## MK Intelligence 5.0 and Decision Lab

The new local analytical layer reads current linked inventory, open orders, supplier POs and regional reports. Action-plan conversations return scoped evidence and explicit assumptions. Inventory allocations and dispatches affect the connected-stock analysis immediately. Existing forecast/backtest tools and the Hugging Face Space connector are retained; this source update does not change the remotely hosted model.

The lab offers demand change, extra supplier delay and assumed lead-time scenarios, data-quality flags and a JSON evidence export. A scenario uses a 30-day demand month and one additional month of coverage. It excludes unconfirmed inbound and separates USD, EUR and CAD. Missing costs and stale connected snapshots are shown. Modeled days of cover are estimates, not delivery guarantees or calibrated probabilities. Official report reorder calculations are retained and displayed separately from the stress target. Scenario controls do not change orders, stock, report settings or the official reorder formula.

Local report monitoring works while the site is open. External AI is optional and disabled by default in a fresh demo. Enabling it uses the existing facts contract with the public Space; service/model availability must be verified on the deployed site.

## Mobile and loading

Dedicated `portfolio-mobile.css` and `portfolio-mobile.js` provide touch navigation, safe-area spacing, horizontal table regions and single-column forms. The module launcher opens a menu, not a side rail. The analyst supports focus trapping and modal/Escape precedence. Password visibility works independently of authentication startup. Reduced-motion preferences are respected.

The website uses a 319 KB WebP background instead of transferring the original 5.6 MB PNG for these views. The original asset remains in the source. Changed application assets use cache version `20261012-2`. Native document navigation preserves the current page until navigation, with bounded prefetch and a visible loading surface.

## Correctness fixes

- Clearing a regional report clears its connected snapshot without referencing an undefined variable.
- Closed or resolved 3PL discrepancies stop appearing as active exceptions.
- Supplier POs dispatched for inventory remain open until receipt; completed dropship dispatches are closed commitments.
- Analytical picking counts read the actual shared `waves` collection.
- Tracking events display their recorded timestamps; demo references accept the tracking field's normalized input.

## Verification limits

See `VERIFICATION.md` and the current JSON reports. Checks use source-driven DOM tests, synthetic transactions, mocked transport, isolated SQL and build/static inspection. They do not establish graphical rendering, mobile-device behavior, real latency, production sign-in, live carrier/partner processing, live inference or successful remote deployment. Publish and complete the live checklist before presenting those capabilities as verified.

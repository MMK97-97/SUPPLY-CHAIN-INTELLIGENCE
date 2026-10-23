# MK AI Co-Pilot — installation and operating contract

Copy the updated files into the existing repository at their paths in the ZIP. Keep root and `assets/` copies together. Publish through the project's existing GitHub Pages/Worker process; this code package does not update the live website by itself.

## Included behavior

MK is available on every operational workspace page, including the order register, inventory, CRM, purchasing and Tasks. Open MK → **Co-Pilot workspace** to inspect all open orders. The selected order, canonical SKU, inventory filters, intent and recent Co-Pilot conversation persist through same-tab navigation, scoped to organization, user, region and demo mode.

The order file shows FIFO coverage, Open PO Quantity, matching ETAs, secured/on-hand supply, incoming units assigned after prior commitments, uncovered quantity, urgency, contact status, Follow-up Date and the original communication timeline. The order register links to the same file; CRM shows communication status separately from customer account access status. Proactive alerts are in the page flow and include recorded PO delays. Existing homepage cards, draggable menus, Tasks, ATS imports, prices and links are retained.

In a browser-only workspace, **Record communication** saves a manually recorded incoming reply or confirmed already-sent outreach. It is labeled **Manually recorded**. Draft text never marks Contacted. No email credentials are available in the browser. Automated receiving and sending require the setup below.

## Backend installation

1. Retain the existing Supabase organization/auth setup. Apply these migrations in order, if not already applied:
   - `20261005_unified_system.sql`
   - `20261008_fulfillment_workflows.sql`
   - `20261021_tasks_price_notices_permissions.sql`
   - `20261023_mk_copilot.sql`
2. Configure the server secrets listed in `supabase/functions/mk-copilot/.env.example`. Use a verified Resend sender. The server API key needs both sending and receiving access. Never place service-role keys, the Resend key, webhook secret or cron secret in public JavaScript.
3. Deploy the function using the supplied `supabase/config.toml`:
   ```sh
   supabase functions deploy mk-copilot
   ```
   `verify_jwt=false` is intentional for signed provider webhooks and the cron route. The handler verifies organization JWT membership for browser actions, the raw Svix signature for webhooks, and a separate server secret for monitoring. Only owner/admin/manager/editor members may record or send communications.
4. Configure a dedicated receiving subdomain, e.g. `reply.your-domain.example`, with Resend's required receiving DNS/MX records. Set it as `STARK_COPILOT_REPLY_DOMAIN`. Avoid replacing a corporate inbox's existing MX records. Set up forwarding/provider integration separately if staff must continue using an existing inbox.
5. Register a Resend webhook at:
   `https://YOUR_PROJECT.supabase.co/functions/v1/mk-copilot/webhook`
   Subscribe to **email.received** and **email.sent**. Put this webhook's signing secret in `RESEND_COPILOT_WEBHOOK_SECRET`. The function verifies the exact raw request; do not put an intermediary in front of it that rewrites bodies or removes Svix headers.
6. Connect the signed-in organization workspace in Data Center. Set the customer's actual email in CRM before sending. In an order file choose **Record communication → Send customer email through Co-Pilot**. Review the exact text and CRM recipient, check the confirmation box and send. The server creates an opaque order reply address and durable send job before contacting the provider. Contacted and exact outreach text are recorded only after provider acceptance or a verified sent event. Acceptance does not claim delivery to the recipient's inbox.
7. For closed-browser monitoring, create the two Vault secrets described in `supabase/configure-copilot-schedule.sql`, then run it. This schedules bounded scans and stores current High/Critical alerts in `stark_copilot_alerts`. The page recalculates on changes and every minute; connected pages refresh clean shared data every 30 seconds/on focus. Keep the existing `workspace-notifications` function and its schedule enabled for task reminder emails.

## Reply matching and follow-ups

Automatic capture applies to replies addressed to the generated order thread. The handler fetches the original plain-text message from the receiving API, requires an exact CRM customer/contact sender match, and resolves the order through the opaque recipient token. Subjects, order numbers mentioned in text and customer instructions cannot redirect the message to another order or execute fulfillment/cancellation changes. Customer sender-address matching is not a separate identity verification system; preserve provider spam/authentication controls and use the captured message for team review.

The original body is retained exactly, with a 10,000-character limit. HTML-only messages, oversized bodies, unknown reply addresses, unrecognized senders and ambiguous thread recipients are rejected for provider-inbox review; they are not silently truncated or filed under a guessed order. Check provider webhook failures/retries and Edge logs as part of normal operations. This connector does not automatically ingest unrelated Outlook/Gmail conversations or phone calls; use the manual record form or implement a verified provider adapter into the same transaction service.

Clear English dates such as “next Thursday”, “Nov 5th”, ISO dates, today and tomorrow create one linked team task and populate Follow-up Date. Relative dates use the original receipt time in the configured organization zone. Due time is 9:00 AM with daylight-saving adjustment. Quoted email history is excluded from scheduling. Multiple conflicting dates, negated dates and ambiguous numeric dates require review; no date is guessed. Cancellation/change/expedite intent is classified as a request, never executed from customer text. Older delayed replies cannot replace a newer response's follow-up date.

Duplicate provider events, retried saves and retries with the same send request ID are idempotent. If an email is unconfirmed, retain the same request and check delivery before composing another message. Uncertain sends older than 23 hours require manual review to avoid resending outside the provider's idempotency window. Changing content requires a new message, rather than reusing an old request ID.

## Allocation and urgency rules

Coverage is a read-only planning calculation. It never reserves, releases or ships inventory. Demand includes all open customer orders in the shared document; UI filters do not narrow its queue. FIFO uses creation time with a stable ID tie-breaker; missing timestamps take conservative precedence and are flagged. Validated existing reservations stay with their owners. Hold redemptions reduce the parent hold rather than duplicating remaining demand. Partially shipped lines contribute only remaining quantities.

Supply pools respect regional SKU and fulfillment channel. Dedicated dropship POs cannot cover another customer; 3PL quantities stay with their node; digital coverage uses available/allocated vault metadata without exposing keys. Open PO balance is ordered minus physically received minus cancelled units. Supplier-shipped units remain inbound. Vendor PO updates now record `shipped` separately; physical receipt still uses warehouse receiving. Previously entered bad historical receiving values are not guessed or rewritten: review affected legacy POs against actual receipts.

Each incoming unit is assigned once across the queue, with PO ETAs shown. “Yes - Allocatable” means quantity coverage after prior commitments and order validation. Delivery timing is assessed separately. Unknown/past ETAs do not become a confirmed delivery date. Shipping buffers use calendar days; the default is 1 handling + 3 transit days. **Planning settings** lets an editor set the zone, handling/transit days, deadline windows and contact-review interval. Review these assumptions for each organization; this is not a carrier transit guarantee or holiday calendar.

Urgency is derived separately from operational fulfillment status:
- **Critical:** deadline passed, or within 7 days by default with a queue shortage, unknown/overdue required ETA or a missed logistics buffer.
- **High:** approaching deadline depending on inbound/constrained supply; uncovered demand/required unknown or overdue ETA; at least 7 days without recorded team contact.
- **Medium:** incoming supply dependence, a recorded PO delay, an overdue follow-up or contact review interval reached.
- **Low:** none of those conditions. Missing in-hands dates remain missing; no deadline is invented.

Recorded PO ETA changes preserve their original/prior ETA so MK can explain delays. Older records without ETA history cannot supply a historical delay amount. Demand trends use recorded order quantities over completed days only, up to 90 days. Missing earlier history is not fabricated; insufficient history yields no forecast. Existing report-backed MK analysis remains available for other questions.

## Shared data and verification

The database writes a message, contact fields and linked task in one transaction against the latest workspace revision. It rejects protected fulfillment/account-access changes. Browser saves cannot forge, edit or remove verified connector message evidence. Private connector tables use organization RLS. Conflicts retry against fresh data; local edits are preserved if a response arrives while a user is editing. The interface may pause synchronization and ask the user to reconnect/load shared data in that case.

Run the included checks with Node and the `jsdom` / `@electric-sql/pglite` development dependencies:
```sh
node scripts/check-copilot.cjs
node scripts/check-copilot-service.cjs
node scripts/check-copilot-sql.cjs
node scripts/check-copilot-cloud.cjs
```
These checks use synthetic users, orders and provider responses. No production email, real organization login, live DNS, Supabase deployment or live cron execution was performed in preparing this package. Complete a test-domain send/reply and scheduled-scan check after configuration, before relying on automatic communication capture.

Provider contracts used: [receiving body API](https://resend.com/docs/api-reference/emails/retrieve-received-email), [receiving content](https://resend.com/docs/dashboard/receiving/get-email-content), [webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests).

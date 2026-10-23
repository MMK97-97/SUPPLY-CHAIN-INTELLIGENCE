# Tasks, permissions and notifications

The home page now links to Tasks beside Operational Modules in both views. Cards still move independently, with original links preserved. Individual Return to grid controls and placeholder text are removed.

Tasks persist in the unified workspace and include due times, reminders, notes, note history, priority and status. Browser reminders appear while a workspace page is open. Connected organization tasks with a verified owner can receive email reminders from the scheduled worker when the browser is closed. Local-only tasks do not send mail.

Cancellation is restricted to existing owner, admin and manager roles. Browser guards cover the dedicated cancel operation, generic transactions, module saves, active-order deletion and validation downgrade. The database trigger enforces membership again on each save and stamps cancellation audit fields. Loading a verified shared snapshot does not require cancellation permission. Organization memberships have not been changed.

Price notices are generated from server-side committed differences, not client-submitted email payloads. Active CRM account status, currency, brand preferences and recipient emails determine delivery. Catalog and contract pricing are labeled separately; contract terms and historic order prices are preserved. Repeated imports of unchanged prices do not send another notice. Account opt-out or recipient changes suppress pending notices.

Apply the included migration after the existing unified-system and fulfillment migrations. Deploy workspace-notifications with its own request authentication as configured in supabase/config.toml, supply the server secrets described in its .env.example, and run configure-notification-schedule.sql after creating the named Vault secrets. No live email can be sent until the backend is configured. The schedule runs every minute and processes bounded batches with leases, provider idempotency keys, retry backoff and explicit unconfirmed states. ACCEPTED means provider acceptance, not inbox delivery.

Verification: 22 source/DOM and delivery checks, 20 isolated PostgreSQL checks, 19 draggable-module checks, 19 prior browser-fix checks, 23 workflow checks and 21 login/import checks. Cloud browser confirmed task creation, editing fields, note persistence, completion/reopening, home navigation and module movement. Real organization credentials were not submitted; production email delivery and deployment remain unverified.

# MK Intelligence 4.2 — Supply AI Chain Hub

MK uses your [Hugging Face Space](https://huggingface.co/spaces/MMK97/supply-ai-chain-hub) for conversational AI and the existing website engines for verified report calculations. The connection uses the explicit `website_chat` endpoint, independently of Gradio's textboxes, buttons and status messages. It does not guess an endpoint or treat UI text such as “Enter a message” as an answer.

The public Space was running during verification. Its website API, inference and cross-origin support for `https://mmk97-97.github.io` were checked with synthetic report data. No Space files, secrets, live business reports, repository files or Pages settings were changed remotely.

## Publish and use MK

1. For the Workers site, follow [DEPLOY_TO_WORKERS.md](../DEPLOY_TO_WORKERS.md): build with `node build-cloudflare.mjs`, then deploy the Worker with its `dist/` assets. For GitHub Pages, upload to the repository root and publish with **Deploy from a branch → main → / (root)**. Keep root `index.html`, empty `.nojekyll` and the complete `assets/` folder. No custom workflow is needed. Shared assets use version `20261008-2`.
2. Open **MK AI analyst → Analyst workspace**. **Use the AI analyst** is enabled for new workspaces. A previously saved choice is preserved. Turning it off keeps analysis local.
3. Click **Test connection** to check that the Space exposes the expected one-JSON-input, one-JSON-output API. This test does not make an inference request. Ask a question to check actual model access.
4. Select **Fast**, **Auto** or **Deep**. The Space currently uses tool budgets of 4, 12 and 20 calls respectively, with up to 2, 6 and 10 tool-selection rounds. These modes adjust the tool budget; they do not expose a model's private reasoning.
5. Select US, EU or Canada and upload a CSV, TSV or XLSX inventory Raw Report. It needs a Model#, Model, SKU or ItemID column. Existing regional uploads are found automatically. Sales files use **Sales report upload** and the existing saved sales-analysis workflow.
6. Ask “Analyze Cozy Earth”, “Which models have stockout risks?”, “Compare all regions”, “What if demand increases 20%?”, “Explain the sales revenue exposure”, or a natural follow-up. Region scope is preserved in conversation context.
7. **Monitor report changes** detects stockout, data-quality, low-confidence, stale-report and changed-reorder findings while a website tab is open. **Investigate** opens a question about the finding. Optional **AI briefings when reports change** makes at most one automatic request per ten minutes per open tab. This is a local throttle, not a global inference quota.
8. **New conversation**, **Stop**, **Mark reviewed** and **Export analysis** manage the current browser's chat and alerts. They are separate from the enterprise business-record backup and cloud sync.

The public connection needs no Hugging Face token, OpenAI key or AI Supabase deployment in the website. The Space's own `HF_TOKEN`, model/provider access and inference billing remain in its server settings. Do not place access tokens in HTML, browser JavaScript or local storage. If you make the Space private or enable its username/password gate, this anonymous connector requires a server authentication proxy; it will show an access error and keep local analysis available.

## API contract

Space: `MMK97/supply-ai-chain-hub`  
Host: `https://mmk97-supply-ai-chain-hub.hf.space`

1. POST `/gradio_api/call/website_chat` with `{"data":[{"message":"…","context":"…","history":[{"user":"…","assistant":"…"}],"mode":"Auto"}]}`.
2. Read the returned `event_id`, then GET `/gradio_api/call/website_chat/{event_id}` as an SSE stream.
3. Accept only `event: complete` with exactly one JSON object containing `ok: true` and a nonempty `answer`. Explicit `ok: false` errors, interface/status text, malformed output and unsupported source references trigger clearly labeled local fallback.

`assets/mk-space.js` owns this contract. `docs/mk-space-contract.json` records the inspected live schema for offline regression tests. The current Space source is [app.py](https://huggingface.co/spaces/MMK97/supply-ai-chain-hub/blob/main/app.py); its `website_chat` function is separate from the Gradio UI's chat handler.

## Report context and limits

- The website runs its read-only report overview, model search, brand comparison, scenario, sales and operations tools before asking the Space. These calculations remain the source for reorder quantities. Full report totals, settings, timestamps and explicit missing-row limits are included.
- The Space accepts up to 16,000 context characters. The connector rebuilds smaller valid JSON documents to fit that limit. Relevant records and local tool outputs are bounded excerpts; the context names the omitted collections. Raw report bytes, customer/contact records and ERP credentials are excluded.
- The local analysis snapshot includes at most 6,000 inventory rows and 1,500 sales models, while portfolio summaries retain full source totals. Inventory prioritizes queried models/brands and risk. Sales keeps up to 500 risk-ranked models per region. A context excerpt is not the complete report or a remotely uploaded dataset.
- Up to six complete recent user/assistant pairs are sent, capped at 24,000 serialized characters. Scope-filtered remembered notes are also sent when space permits. Instructions found inside report fields are data, not privileged instructions.
- AI prose is model-generated and not independently numerically certified. **Verified website facts**, **Local planning suggestions** and **Report evidence sent to the Space** are labeled separately. Any source ID the answer explicitly cites must have been present in the context. That check verifies references, not every inference.
- The Space can choose its own available read-only tools. Its dataset tools do not have the complete website workbook: this endpoint receives verified context rather than uploaded table state. The website has already calculated supported scenarios and passes their results for explanation. Neither side can automatically create POs, allocate inventory, ship orders or send messages through this integration.
- Regions and currencies remain separate. Sales revenue/margin exposure uses historical units and the current price/cost snapshot; it is a planning estimate, not an accounting total. Missing evidence remains unknown.
- Request timeouts are 120 seconds in Fast, 180 in Auto and 300 in Deep. **Stop** aborts the website transport and prevents saving a cancelled reply. An already submitted Space inference may still finish on its server.
- Sleeping, restarting, busy, rate-limited or misconfigured Spaces show a connection problem and the verified local result. A test confirming API availability does not guarantee future provider capacity.
- Chats and alerts stay in the current browser. Sent context is processed by Hugging Face and the Space's configured inference provider under their data terms. This connection does not add a server conversation database or scheduled background execution.

The earlier optional private OpenAI/Supabase function and its quota migration remain in the source for a separately configured private deployment. They are not invoked by the current MK workspace, and their organization quotas do not apply to this public Space connection. Business-data cloud synchronization is unchanged.

## Verification

```bash
node scripts/check-workflows.cjs
NODE_PATH=/path/to/separate/jsdom/node_modules node scripts/check-interface.cjs
NODE_PATH=/path/to/separate/jsdom/node_modules node scripts/check-mk-ai.cjs
NODE_PATH=/path/to/separate/jsdom/node_modules node scripts/check-mk-space.cjs
```

These scripts use Node.js, pure-function checks, mock HTTP services and jsdom DOM simulations. They do not render a browser or call a live model. Separate synthetic live API results and verification limits are recorded in `docs/verification-mk-space-live.json` and `docs/VERIFICATION.md`.

Implementation reference: [Hugging Face Spaces as API endpoints](https://huggingface.co/docs/hub/en/spaces-api-endpoints).

## Completed calculation handoff

The website sends `MK verified website facts v2`. `completed_calculations` contains already calculated business facts with readable labels and a completed status; it does not advertise callable website tools to the Space. Brand summaries cover eligible models only and include monthly demand, reorder units, model risk counts and confidence scores. Relevant model rows explain the brand total and excluded items remain outside that total. The website calculation names remain in the local audit trace.

The October 7 live synthetic Cozy Earth check returned 304 eligible on-hand units, 20 monthly demand units, a 26-unit recommendation and one at-risk model, with valid report references and no unavailable-tool warning. These are test values, not your inventory figures. AI explanations remain subject to review; reference checks do not prove every sentence is correct.

## Regional scope (v44)

MK follows the active report route/query or shared Analysis region. The analyst workspace permits an explicit scope for the current page session; it is reset by a header region change and is not restored as a pin on later pages. Regional chat history, notes and report context stay scoped, and late responses from a previous region are discarded. See [REGIONAL_AI_FIX.md](REGIONAL_AI_FIX.md).

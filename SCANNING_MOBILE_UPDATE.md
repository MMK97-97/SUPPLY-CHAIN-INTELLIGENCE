# Phone and website scanning update — 28 October 2026

Built from your uploaded `SUPPLY-CHAIN-INTELLIGENCE-main (2).zip`. This update preserves that version's MK97, Mail, order, inventory and navigation code.

## PO lookup, existing-receipt and cycle-count follow-up

The scanner now recognizes customer POs, vendor POs and cycle-count references automatically. Opening vendor PO `PO-2026-887411` from customer picking switches to vendor receiving instead of reporting a missing PO. A shared human reference honors the selected workflow; ambiguous matches require an exact generated barcode or explicit selection.

Entered receiving quantities are separate from barcode-verified quantities. A legacy receipt with 50 entered units and an existing putaway task starts with **50 units requiring verification**. Opening the PO clears the previous item selection. Select its item in Step 2 to enable scanning; the button explains this while disabled. The first matching scan verifies one unit and leaves 49 to scan, without increasing the entered receipt quantity or on-hand stock. Every already-entered unit must be verified before finishing that batch. Existing putaway tasks are reused rather than duplicated, and putaway cannot post a barcode batch before verification is finished.

Cycle-count scanning is available through **Warehouse Management → Cycle Counts → Scan count / Count barcode**, or the scanner's **Cycle count · inventory** workflow. Each count has a stable `SCI-CC:<count ID>` barcode. Select the count's item and check the displayed bin, then use the phone camera, webcam, handheld scanner or manual barcode entry to tally physical units. Wrong items are rejected. Counts can exceed the system quantity; there is no fulfillment-style cap. Saving records the actual total and variance in the existing queue without changing inventory stock. A zero count requires selecting the item and explicitly confirming that the bin has zero units of that item. Saved scanner counts are retained; schedule a new count to recount.

## Install the files

For the updated-files ZIP, copy the contents of its `SUPPLY-CHAIN-INTELLIGENCE-main` folder into your existing project root, preserving the folders and replacing the matching files. Include the root files, `assets` files, HTML pages and bundled vendor files together. The full-source ZIP is an alternative complete project. Do not install one inside the other.

Publish the updated project using your normal GitHub Pages process. This package has not been deployed. Updated script/style version tags prevent previously cached files from being reused after deployment.

## Customer-order picking

1. Every saved customer order receives a stable Code 128 barcode (`SCI-CO:<order ID>`). Existing orders receive the same barcode field when shared state is reconciled.
2. Open **Scan** in the website header, or open an order's **Items → Scan order items / PO barcode**. The scanner is also available in Warehouse Management.
3. Scan the PO label with a phone camera or webcam, use a handheld scanner followed by Enter, or enter the exact customer PO / order reference. The PO opens its item list.
4. Select an item, then scan its barcode. A match records the specified number of units; a mismatch shows **Wrong item** and records nothing. Quantities cannot exceed the line's remaining quantity.
5. Camera capture accepts one scan per explicit **Scan selected item / next unit** action. Re-arm for the next unit so a stationary barcode cannot repeatedly count itself. Handheld/manual submissions are supported directly on the website.
6. **Finish picking** is available after every required item is verified. It creates the packing work and moves the order to Packing; stock is dispatched through the existing shipping workflow.

Hold, draft, closed, external-fulfillment and digital orders display a reason when this physical warehouse workflow does not apply. Grouped legacy waves with unassigned prior picks must be reconciled before order-specific barcode counting.

## Vendor-PO receiving

1. Vendor POs receive a separate stable Code 128 barcode (`SCI-VPO:<PO ID>`).
2. Choose **Vendor PO · receiving**, or use the receiving/PO shortcut. Scan the PO and select an item on its item list.
3. Scan each received item. Wrong items and excess quantities are rejected. The list separates already received units, scanned units awaiting putaway, and units still to scan.
4. Select a valid destination bin and choose **Finish delivery**. Partial deliveries are supported.
5. Complete the resulting putaway tasks in the existing **Receiving & putaway** page. Stock and posted PO received quantities update at putaway, once only. Pending scans are not counted as available stock, and legacy bulk receiving cannot overwrite an active scanned batch.

## Item labels and cameras

Matching uses exact SKU/model or recorded barcode, UPC, EAN and GTIN identifiers, with case-insensitive comparison and valid GTIN leading-zero normalization. It preserves punctuation and rejects identifiers shared by multiple products. The **Item barcodes** editor lets an authorized user add a manufacturer's missing barcode while preserving leading zeroes; do this before using that barcode for verification. PO and item labels can be previewed and printed from the scanner.

Cameras require HTTPS (or localhost) and browser camera permission. GitHub Pages provides HTTPS. Rear-camera preference, camera switching, stop/cleanup and supported torch controls are included. Browsers without suitable native BarcodeDetector support use the locally bundled ZXing decoder. There is no runtime barcode CDN dependency. Camera access starts only after pressing a camera action. Handheld scanning and manual barcode entry remain available when a camera is unavailable.

## Mobile changes

- Compact header with reachable Search, Scan, region, alerts and profile controls.
- Homepage tabs and narrow Inventory forms fit the viewport; wide record tables scroll inside their containers.
- Customer and vendor forms stack on narrow screens; vendor line-item actions wrap.
- Open-order list and detail panels stack on phones.
- Mail uses Folders / Messages / Read / Related panels on phones and smaller tablets; filters and composing controls fit the viewport.
- MK opens in a viewport-sized phone panel. Mail now loads the missing MK dependencies. The existing missing-microphone-element initialization error is guarded.
- Shared mobile styles load in the page head before first layout on the 96 pages using the shared shell.

## Verification and limits

- **63/63** isolated lookup, receiving-verification, cycle-count, quantity, idempotency, stock, camera-lifecycle and independent Code 128 decoding checks passed.
- **14/14** scanner DOM integration checks passed.
- Cloud Chrome browser confirmed wrong-item rejection, correct picking, reload persistence, completion to Packing, printable SVG barcode and partial vendor receiving with pending putaway, using fictional demo records.
- **32/32 responsive layout checks** found zero page-level horizontal overflow: eight pages at 320, 390, 768 and 1024px iframe widths. Pages: Home, Item Master, Mail, Create Customer Order, Create Vendor PO, All Open Orders, Scan, and Receiving. Mail panel switching, mobile search, MK opening and the desktop order Items scanner entry were also checked. These are controlled responsive Chrome views, not physical mobile-device tests.
- Follow-up cloud browser checks reproduced the 50-unit receipt, automatic vendor detection, explicit item selection, wrong-item rejection and 1 verified / 49 remaining. Cycle-count checks covered wrong items, a total of 75 against system quantity 74, saved variance +1, the updated queue and its printable barcode. Six additional responsive checks (receiving and cycle scanning at 320, 390 and 768px) had zero page-level overflow. These used isolated fictional seed fixtures and current production scripts.
- JavaScript syntax and root/assets mirrors passed; no new broken script or stylesheet references were introduced.
- The rerun existing fulfillment suite reports **40 passed / 9 failed**, versus **39 passed / 10 failed** on the untouched attachment. There are **no new failing test names**. Remaining failures concern five cancellation/partner tests that hit the existing manager-permission fixture, navigation expectations, two customer-form tests and a vendor-form test. Details and baseline comparison are in `docs/verification-phone-scanning-*.json`.
- Physical iPhone/Android camera decoding, actual printed-label scans, printer output, authenticated organization workflows, production deployment and cross-device cloud synchronization were not tested. Camera permission/errors and decode lifecycle were tested with simulated media. Check the deployed HTTPS page on your intended devices before warehouse use.

## Run the focused checks locally

Use Node.js with `jsdom@26.1.0` and `@zxing/library@0.21.3` available to the test runner (test dependencies only), then run:

```sh
node scripts/check-scanning.cjs
node scripts/check-scanning-ui.cjs
```

The application itself loads the included `assets/vendor/zxing-browser-0.1.5.min.js` and `JsBarcode-code128-3.12.1.min.js`. Their licenses and SHA-256 hashes are listed in `docs/vendor-dependencies.json`.

Camera and decoder documentation: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MDN BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector), [ZXing Browser](https://github.com/zxing-js/browser).

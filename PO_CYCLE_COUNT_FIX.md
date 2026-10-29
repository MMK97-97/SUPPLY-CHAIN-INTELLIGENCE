# PO lookup and cycle-count scanning fixes — 28 October 2026

This cumulative update includes the earlier phone/mobile scanning changes plus both issues shown in the screenshots and cycle-count scanning.

- Vendor POs are found even when the scanner opens in customer-picking mode. Generated PO/count barcodes select their workflow automatically.
- Opening a document clears the previous item selection. Select an item in Step 2 to enable camera or handheld scanning.
- Receipt quantities entered before barcode scanning are not treated as verified scans. PO-2026-887411's existing 50-unit receipt now requires 50 item verifications. The first valid scan leaves 49; wrong items leave all counters unchanged.
- Verifying existing receiving quantities preserves the original receipt and on-hand stock. Finish delivery reuses existing putaway work. Stock posts once through putaway after the batch is verified.
- Cycle Counts now has Scan count and Count barcode actions, using the same phone-camera, webcam, handheld and manual-entry workflow. Confirm the displayed bin and select the item before scanning.
- Cycle scans tally the physical quantity, accept overages and reject wrong items. Save cycle count records the quantity and variance for review; it does not change inventory stock. Zero requires explicit confirmation, and saved counts require a newly scheduled count for a recount.

Apply all files from the updated-files ZIP to your project root, or use the complete-source ZIP. The 20261028-scan2 script/style tags are included. This update has not been deployed.

Verification: 63 core checks and 14 DOM integration checks passed; cloud-browser receiving and cycle-count checks passed. Six targeted responsive views had no page-level overflow. The broader fulfillment suite remains 40 passed / 9 existing failures, with no new failing test names compared with the supplied attachment. Full evidence is under docs/. Physical phone-camera decoding and authenticated production/cloud synchronization were not tested.

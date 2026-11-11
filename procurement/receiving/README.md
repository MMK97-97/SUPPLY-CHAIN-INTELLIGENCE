# Receiving inspection and 3PL handoff

Extract the update ZIP into the local `SUPPLY-CHAIN-INTELLIGENCE` repository
root (the directory with `workspace.html`), preserving all folder paths,
including `.github/workflows`. This update was checked against main at
`bc7e858e7186ab582cc038540b13ca9da1371aa6`. Commit and push the extracted
changes together. GitHub Actions runs a new Pages deployment for the new
commit; an older run still uses the workflow and files from its own commit.

On the new Pages run, check that both the **build** and **deploy** jobs finish
successfully before opening the receiving page. The build checks that the
receiving files are present. The deploy job waits for the artifact from that
build to be available before publishing. The separate Supabase workflow is
only for the sandbox email function and does not run for this update.

1. Open **Procurement → Receiving inspection**. Upload one vendor PO and one
   packing slip, then select **Extract PO and packing slip**.
2. Review the PO reference, each model, the actual ordered quantity, and the
   packing slip quantity. Choose **LTL** and enter its **PRO number**, or choose
   **FedEx**, **UPS**, or **USPS** and enter its **tracking number**. Enter the
   expected delivery date if known. Confirm that you reviewed the source data.
3. Download the prefilled **3PL Word template** or **3PL fillable PDF** and send
   it to the warehouse. Both include the Stark logo, PO details, and source
   quantities. Receiving counts, damage fields, and evidence are blank.
4. The warehouse completes the form and returns it with all signed BOL/POD
   files. It can insert photos in the matching truck, pallet, or model box in
   Word, or return files named with the PO and model/photo type. The fillable PDF
   has fields for filenames; return the photos as separate attachments.
5. Optionally record the returned details in Procurement. Attach multiple
   signed delivery documents and truck, pallet, and model photos. The page
   calculates shortage as `max(packing slip quantity - received quantity, 0)`
   and shows overages separately. For an offline copy, the formula is printed
   for manual entry. Export the PDF, Word, or receiving packet ZIP. Use **Open
   receiving packet** later to resume editing with the originals.

PDF, Word tables, Excel, CSV/TSV, text, and JPEG/PNG/WebP are supported for
source extraction. English OCR is used on scanned pages and images. Review
the output before sending, particularly when headers are unfamiliar or scans
are unclear. A missing quantity stays blank; enter zero only if the source
confirms zero units for this shipment. Both PDFs and images can be attached as
delivery proof. The blank templates are also available at the top of the page.

Uploaded documents are processed in the current browser. This tool does not
send email, change inventory, or save attachments to an ERP database. Save a
receiving packet before closing the page if you want to retain or reopen the
record. The 3PL completes the exported form without an ERP account.

Run the focused checks from the repository root:

```sh
node --test procurement/receiving/tests/receiving.test.mjs
node scripts/verify-mirrors.cjs
```

See `vendor/NOTICES.md` for the bundled libraries.

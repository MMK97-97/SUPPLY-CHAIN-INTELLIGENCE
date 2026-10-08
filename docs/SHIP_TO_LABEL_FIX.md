# Ship-to field label correction — v46

Release: `2026.10.08-unified-enterprise-address-labels46`. Corrected script cache version: `20261008-4`. The source update has not been deployed to the live website.

The v45 customer-order form passed an entire array of address labels to each field. JavaScript converted the array to comma-separated text, producing the repeated label list shown in the screenshot. The renderer now selects the matching label for each address key.

| Address field | Label |
| --- | --- |
| name | Recipient / company |
| line1 | Address line 1 |
| line2 | Address line 2 |
| line3 | Address line 3 |
| city | City |
| state | State / province |
| zip | ZIP / postal code |
| country | Country |

Each input retains its own native wrapping label and existing form name. CRM address loading, custom destinations, saved order addresses, shipping services, sales order numbering and fulfillment selection retain the v45 behavior.

The new regression checks each field's exact label and input association. It reproduces the screenshot failure against v45 and passes with this correction. The customer-order suite also checks address loading and preservation through complete order saves.

All 17 fulfillment page references use the corrected script cache version. The production build creates a new content-hashed script filename. Unchanged assets retain their previous cache versions. Branch publishing remains **Deploy from a branch → main → / (root)**, without custom workflows.

After publishing, verify VERSION.json reports v46 and open Order Management → Create customer order. The ship-to fields should show the eight labels above. See `VERIFICATION.md` for checks and limits.

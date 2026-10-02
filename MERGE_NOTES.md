# Merge Notes

This archive is a full deployable website bundle built from the latest complete Supply Chain Intelligence snapshot available in the conversation (`stark-supply-chain-mk-hybrid-v54`) plus the new CRM, Order Management and Vendor Management suite.

The current GitHub repository screenshots show additional files created after that snapshot (for example existing login/Supabase/mobile/Cloudflare files). Those exact source bytes were not available in the conversation, so they are not overwritten or fabricated here.

When merging into the current repository:

1. Add/replace the CRM/Order/Vendor files from this archive.
2. Keep any existing live authentication files and `assets/supabase-config.js` from the current repository.
3. Keep any newer current-repository file whose modification date is later than the base snapshot unless you explicitly want the bundled version.
4. `index.html` in this archive already contains the Business Operations loader. If you keep your newer current `index.html`, add only:
   `<script src="assets/index-suite-loader.js?v=20261002-1" defer></script>`
   before `</head>`.

No credentials, private API keys or voucher plaintext are included in this package.

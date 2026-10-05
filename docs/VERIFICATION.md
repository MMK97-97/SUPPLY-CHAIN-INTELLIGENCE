# Verification — branch publishing, 2026-10-05

## Scope

The latest uploaded source omitted the shared system assets and warehouse routes and retained pre-integration scripts in several modules. Matching files from the completed integration were restored after confirming that existing affected files still matched the original source archive. The package now uses Deploy from a branch with main and / (root), includes an empty root .nojekyll marker, and contains no custom workflow files or pages.yml.

## Checks

All 23 shared workflow scenarios passed. All 56 JavaScript syntax checks passed, and 873 local references across 76 HTML pages resolved without missing files. The root entry point, empty .nojekyll marker and absence of custom workflow files were verified. Machine-readable current-package results are recorded in verification-branch.json. The shared workflow checks are reproduced with `node scripts/check-workflows.cjs`; cloud tests use a mock authenticated service.

## Verification limits

The live repository, GitHub Pages settings and website were not modified in this session. Branch publication must be verified after committing the complete files and saving the source settings. Browser preview access was denied earlier in the session; desktop/mobile rendering and actual UI interaction remain unverified.

The optional Supabase migration was not applied to the live project. Authentication, actual database policies, RPC execution and cross-device synchronization require deployment verification. No real vendor/3PL requests, carrier labels, voucher delivery or financial transactions were performed.

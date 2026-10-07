# Publish the MK Hugging Face integration

The package contains the completed MK Intelligence 4.1 integration. The live website was still on UI2 when checked on October 7, 2026. Publishing has not been performed remotely.

Repository: [MMK97-97/SUPPLY-CHAIN-INTELLIGENCE](https://github.com/MMK97-97/SUPPLY-CHAIN-INTELLIGENCE)

## Upload the source

1. Extract `SUPPLY-CHAIN-INTELLIGENCE-branch.zip`.
2. Open the repository's `main` branch, choose **Add file → Upload files**, and upload everything **inside** `SUPPLY-CHAIN-INTELLIGENCE-main/`. Upload the source files rather than the ZIP itself or an additional outer folder. The root should contain `index.html`, `business-operations.html`, `mk-brain.html` and `assets/` directly.
3. Include all nested module folders and all assets together. This updates the shared pages to asset version `20261005-5`. Commit the upload to `main`.
4. Confirm the empty `.nojekyll` file is at the repository root. The public repository did not contain it during the October 7 check. If your file picker skips it, use **Add file → Create new file**, name it `.nojekyll`, and commit it at the root.
5. Delete the old root [`pages.yml`](https://github.com/MMK97-97/SUPPLY-CHAIN-INTELLIGENCE/blob/main/pages.yml). It was still present during the check. Uploading this package will not automatically delete existing repository files. The package does not contain it or any custom `.github/workflows` files.

The unrelated `download` and `download (1)` files are retained with their current repository contents. The shared business, regional inventory, order, warehouse and logistics engines match the existing `main` branch. No business-record migration is needed for this AI connection.

## Select branch publishing

Open **Settings → Pages → Build and deployment**:

| Setting | Value |
| --- | --- |
| Source | Deploy from a branch |
| Branch | main |
| Folder | / (root) |

Click **Save** if a setting changed. No npm build, OpenAI key, AI Supabase deployment or custom Actions workflow is needed for this public Hugging Face integration. GitHub may show its own Pages build/deployment job while publishing.

## Check the published site

1. After GitHub finishes publishing, hard-refresh [the home page](https://mmk97-97.github.io/SUPPLY-CHAIN-INTELLIGENCE/index.html).
2. Open [MK AI Analyst](https://mmk97-97.github.io/SUPPLY-CHAIN-INTELLIGENCE/mk-brain.html). Confirm **Supply AI Chain Hub**, the **Fast / Auto / Deep** selector, and **Use the AI analyst** are available.
3. Click **Test connection**. This checks the Space API without making a model request. Ensure AI is enabled, select **Fast**, and ask a question to check inference.
4. Select a region and use its existing inventory or sales report. Ask about a model, brand, stockout risk or scenario; then ask a follow-up. The response should show the Space explanation and separately labeled verified website facts.
5. If a new workspace has no report, upload a regional Raw Report before asking report-specific questions. If the Space is unavailable, MK shows the connection issue and the local analysis.

During the October 7 readiness check, the shipped connector returned the correct synthetic TEST-00001 model, 21-unit reorder recommendation and report citation. Cross-origin access from your GitHub Pages domain passed. The original 99 automated checks remain attached to the unchanged application code. Browser rendering and the eventual published upload still need to be checked on your computer.

Read [docs/MK_AI_SETUP.md](docs/MK_AI_SETUP.md) for report context, conversation limits, monitoring and data handling. Deployment comparison and the latest synthetic test are recorded in `docs/verification-deployment-20261007.json`.

Reference: [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

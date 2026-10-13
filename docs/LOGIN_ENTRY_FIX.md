# v50 main login entry fix

The v49 package placed the dashboard/demo at `index.html` and the login on a separate route. v50 corrects that entry flow:

| Route | Result |
| --- | --- |
| `index.html` or the site root | Login page with email, password and Explore the demo |
| `login.html` | The same login option |
| `workspace.html` | Connected dashboard and application modules |
| `workspace.html?demo=1` | Isolated fictional recruiter demo |
| Legacy `index.html?demo=1` | Redirects to the demo workspace; valid region selection is retained |

Successful sign-in and existing authenticated sessions go to the working workspace or a safe requested module. Returns pointing to the root login or callback routes fall back to the workspace to prevent loops. Demo entry, reset and application home links use the workspace route so guests do not repeatedly return to login. Working records and authentication storage are retained.

The login page contains the actual form markup. Displaying it does not depend on loading the operational modules or successfully contacting the authentication service. Organization sign-in still uses the existing configured provider. The independent demo option works while authentication is starting or unavailable.

This is a complete corrected source archive. It has not been pushed to GitHub. The published website changes only after these files are committed to the branch configured for Pages. A file download in this conversation does not update the repository or live site.

Open the published `VERSION.json` after deployment and confirm `2026.10.12-login-entry50`. Then open the plain main URL in a fresh tab, verify the login form, and click Explore the demo. Check real sign-in separately with an authorized account. Automated sign-in checks use a mocked client and synthetic credentials, not the live authentication service.

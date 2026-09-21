# SENTINEL

Smart Vehicle Security & Incident Intelligence System — a complete React/Vite frontend, Supabase PostgreSQL schema and Edge Functions, browser Tesseract.js OCR, Gemini Vision fallback, Gemini incident explanations, and Cloudinary image evidence.

**Team:** Subodh Sharma, Varad Shimpi, Jagdish Panada, Anish Sawant.

## Current workflow: localhost first

Nothing needs to be deployed to Vercel to test this project. No remote Supabase changes have been made by the build process. You apply the SQL and configure your backend yourself.

```powershell
cd "C:\Users\Jagdish\OneDrive\Documents\New project\sentinel"
npm install
npm run dev
```

Open **http://127.0.0.1:5174**. Port 5174 is intentional because 5173 was already occupied. The server listens only on your local machine. If you change the port, update the OAuth redirect URLs and browser test configuration too.

The supplied project's public Supabase settings are already saved in your ignored `.env`. Gemini and Cloudinary credentials are in ignored `.env.functions`; they are **not** bundled into React. Placeholder-only `.env.example` and `.env.functions.example` are safe to commit. Never add real secrets to a variable starting with `VITE_`.

The landing page, architecture, and login interface work immediately. Authenticated operations need the SQL, an authorized operator, and the Edge Functions described below. There is no fake backend or hidden demo login.

## Recognition architecture

```text
Vehicle image
    |
    v
Tesseract.js (real browser Web Worker + WebAssembly OCR)
    |
    v
OCR text + confidence -> authenticated process-scan Edge Function
    |
    +-- one standard plate candidate AND confidence >= 80% --> normalized plate
    |
    +-- uncertain / no candidate / multiple candidates --> Gemini Vision
                                                          |
                                         readable single plate OR retry/manual entry
    |
    v
Levenshtein comparison against every registered vehicle
    |
Threshold + registration status + tie check -> GRANTED / DENIED
    |
Rule-based risk using exact detected-plate history from the last 24 hours
    |
Cloudinary authenticated image + PostgreSQL incident
    |
AI Incident Analyst explains the saved facts (cannot change the decision)
```

Both OCR branches converge on the **same deterministic backend matching engine**. Gemini Vision reads characters; it never authorizes access. A second Gemini call explains the incident only after it is saved. If that explanation fails, the access result remains available.

Manual input skips image recognition, is explicitly recorded as `MANUAL`, and uses the same backend decision rules. If local Tesseract fails to initialize, the UI sends an uncertain result to trigger Gemini Vision. If Vision also cannot identify one readable plate, no access incident is created: the operator is asked for another image or verified manual entry.

## Apply the SQL yourself

Use your Supabase project's SQL Editor. Do **not** paste any API secrets into SQL.

**One-file option:** paste `supabase/SETUP.sql` to install both the schema and optional presentation data in one transaction. If you use it, skip steps 1–2 below and continue with operator setup. See `START_HERE.md` for the shortest setup path.

1. Run **`supabase/migrations/202609210001_sentinel.sql`** once. This creates the tables, indexes, RLS policies, aggregate functions, and rate limiting. It expects these SENTINEL table names not to exist already.
2. Optionally run **`supabase/seed.sql`** for 10 fictional vehicles and 24 labeled presentation incidents. This seed can be rerun without duplicating its records. Sample incidents appear in statistics but are excluded from risk history. No AI explanations are fabricated for samples.
   For a larger vehicle-only list, run **`supabase/vehicle_registry_demo.sql`** after the setup. It has 30 fictional vehicles and skips any existing plate number.
3. Create an email/password user in **Authentication → Users → Add user**. Use your own email and password; confirm the email when creating a presentation account. Alternatively, sign in once with Google after configuring it.
4. Edit the placeholder email in **`supabase/authorize-operator.sql`**, then run it to authorize that account. Every operator uses the same college/security workspace. All operators can manage vehicles and settings. Only a trusted database administrator can enroll operators.

There are deliberately no hardcoded passwords or seeded Auth users. Signing in alone does not grant registry access; an account must be in `public.operators`.

Tables:

| Table                 | Purpose                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `operators`           | Explicit allowlist of authorized Supabase Auth users                                                            |
| `registered_vehicles` | Unique normalized plate, owner, type, status, registration time                                                 |
| `system_settings`     | Single row with similarity threshold (60) and OCR confidence threshold (80)                                     |
| `incident_log`        | Immutable client-facing audit records, decision facts, original OCR, image public ID and format, AI explanation |
| `request_limits`      | Atomic per-user/per-action minute counters for authenticated Edge Functions                                     |

Only Edge Functions using the server service-role credential can create/update incident records. Browser clients can read incidents but cannot forge a stored decision. Vehicle deletion preserves historical plate/status snapshots in incidents.

## Enable Google authentication yourself

The login screen already has **Continue with Google** and email/password sign-in.

1. In Google Cloud Console, configure an OAuth consent screen and create an **OAuth client ID → Web application**. If the consent screen is in testing, add your team as test users.
2. Add the local origins you use, for example `http://127.0.0.1:5174` and `http://localhost:5174`.
3. Set the Google authorized redirect URI to your Supabase callback:

   ```text
   https://frzfabqjiazeevuyxytd.supabase.co/auth/v1/callback
   ```

4. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and enter the Google OAuth client ID and client secret. These are separate from your Gemini API key.
5. In Supabase **Authentication → URL Configuration**, set your local Site URL and allow these redirect URLs:

   ```text
   http://127.0.0.1:5174/dashboard
   http://localhost:5174/dashboard
   ```

6. Click Continue with Google. After the first sign-in creates the Auth user, authorize its email using `authorize-operator.sql`, then click Retry on the operator-access screen.

The app calls `signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/dashboard' } })`. Supabase completes OAuth and manages the session; React does not receive the Google client secret. Reference: [Supabase Google sign-in documentation](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Edge Functions — configure and deploy when you are ready

SQL alone cannot install an Edge Function. The frontend's real scan flow requires these functions, even when React runs on localhost. These commands are **instructions for you** and have not been run against your project:

```powershell
supabase login
supabase link --project-ref frzfabqjiazeevuyxytd
supabase secrets set --env-file .env.functions
supabase functions deploy process-scan
supabase functions deploy ai-analysis
supabase functions deploy evidence-url
supabase functions deploy health-check
```

Alternatively, deploy function source through your Supabase dashboard, preserving the `_shared` imports. The CLI is easier because it deploys the source tree correctly.

`verify_jwt = false` in `supabase/config.toml` avoids gateway assumptions about JWT signing algorithms. **Every function still validates the bearer token using `auth.getUser()` and checks operator membership before doing any work.** An anon key is not an operator token.

| Function       | Request                                                                                                          | Purpose                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `process-scan` | `{requestId, mode:'manual', plate}` or `{requestId, mode:'image', image:<base64>, mime, ocrText, ocrConfidence}` | Validates input, selects OCR route, reads registry/settings/history, computes rules, uploads evidence, logs result |
| `ai-analysis`  | `{incidentId}`                                                                                                   | Reads saved facts, generates explanation, stores summary; never accepts a client decision                          |
| `evidence-url` | `{incidentId}`                                                                                                   | Checks access and issues a 120-second Cloudinary private download URL                                              |
| `health-check` | `{}`                                                                                                             | Checks DB connectivity and reports secret configuration, without exposing secrets                                  |

The development browser calls these functions with its signed-in session. All external API calls happen server-side. Rate limits: 10 scans, 10 analyst requests, or 30 evidence-link requests per operator per minute.

For a fully isolated backend, Supabase CLI also supports `supabase start` and `supabase functions serve --env-file .env.functions` with Docker. Point `.env` at that local stack's URL and anon key and apply the migration there. This is optional; automated SQL tests already run in an isolated embedded PostgreSQL instance without Docker or your remote database.

## Environment variables

| Name                        | Location                                 | Secret?                            |
| --------------------------- | ---------------------------------------- | ---------------------------------- |
| `VITE_SUPABASE_URL`         | React `.env`                             | No                                 |
| `VITE_SUPABASE_ANON_KEY`    | React `.env`                             | No, public anon or publishable key |
| `GEMINI_API_KEY`            | Edge Function secrets / `.env.functions` | Yes                                |
| `GEMINI_MODEL`              | Edge Function secrets                    | No; defaults to `gemini-2.5-flash` |
| `CLOUDINARY_CLOUD_NAME`     | Edge Function secrets                    | Account identifier                 |
| `CLOUDINARY_API_KEY`        | Edge Function secrets                    | Kept backend-only                  |
| `CLOUDINARY_API_SECRET`     | Edge Function secrets                    | Yes                                |
| `SUPABASE_URL`              | Supabase-provided Edge environment       | Automatic                          |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase-provided Edge environment       | Yes, automatic; never add to React |

No OCR.space key is needed. Tesseract.js loads its English language model and WASM worker in the browser on the first scan, using the library's default CDN paths; internet access is needed for that initial download. Subsequent language data can be cached. Model output confidence is an OCR estimate, not a statistically calibrated plate-identity probability.

Cloudinary uploads use `type=authenticated` and signed server requests, not an unsigned upload preset. Database records store the image's public ID/format, not a permanently public delivery URL. The evidence viewer requests an expiring link when opened. Cloudinary is the image store; Supabase Storage is not used.

## What is implemented

- Public landing page, animated SVG scanning illustration, team credits, and architecture page.
- Supabase email/password and Google login, logout, session-aware routes, operator allowlist.
- Dashboard with database aggregate metrics, animated counters, last-seven-day chart, risk distribution, and incident timeline.
- Vehicle add/edit/delete/details, normalized plates, duplicate rejection, status changes, search/filter/pagination.
- Drag/drop image scanner, preview, file format/size validation, real Tesseract worker progress, manual entry, OCR routing and result details.
- Deterministic Levenshtein matching, configurable threshold, blocked/expired overrides, safe tied-match denial, explainable risk.
- Real Cloudinary evidence integration; Gemini Vision and analyst calls are server-only.
- Incident search, decision/risk filters, sorting, pagination, full details and image access.
- Automatic polling every 15 seconds while the tab is visible. SQL aggregates are not limited to the current UI page.
- System configuration, service health, clean errors, skeletons, notifications, responsive layouts, keyboard-focus indicators, native accessible dialogs, reduced-motion CSS.
- SQL seed, local tests, setup instructions and viva notes.

## Algorithms and viva explanation

See **`docs/VIVA.md`** for the presentation explanation and **`docs/TESTING.md`** for test coverage and limitations.

Normalization uppercases and removes non-alphanumeric characters. Manual plates must contain 5–12 letters/digits and at least one of each. The high-confidence OCR gate recognizes common Indian state registrations and BH registrations; other valid formats fall through to Vision or manual entry.

The implementation of Levenshtein distance is in `supabase/functions/_shared/domain.ts`. It uses dynamic programming, considering insertion, deletion, and substitution. Time complexity is O(m×n); memory is O(n) for two rows. Plates are short.

```text
similarity = (1 - distance / max(lengthA, lengthB)) * 100

MH12AB1294 vs MH12AB1234:
distance = 1; max length = 10; similarity = 90%
```

The backend compares the unrounded score against the configured threshold. The UI rounds for display only. It fetches the entire registry in 1,000-row pages rather than silently comparing only the first page.

Access order: no match → deny; below threshold → deny; tied best match → deny; blocked/expired → deny; otherwise grant. The default 60% is the requested teaching-project setting, not a recommended physical-security threshold.

Risk is HIGH for any denial or 3+ previous denials for the exact detected plate in 24 hours. Otherwise MEDIUM for similarity <85%, any previous denial, or 3+ previous scans. Otherwise LOW. Risk does not override the requested access rule: a granted result can carry HIGH risk due to history. Sample incidents are excluded from history counts.

## Testing

```powershell
npm test                 # Algorithms + real local PostgreSQL migration/RLS tests
npm run check:edge       # Deno type checks, no deployment
npm run build            # TypeScript + production bundle
npm run dev              # Keep this running in another terminal
npm run test:browser     # Uses installed Google Chrome; localhost UI tests
```

Browser tests intercept Supabase API calls using test-only fixtures. These prove frontend behavior, not live integration. A separate browser test runs actual Tesseract.js against a synthetic plate image and requires the OCR CDN. There are no test fixtures or mock results in application runtime code.

## Demonstration checklist

1. Apply schema and optional sample data; configure provider secrets/functions and an operator.
2. Sign in with email/password or Google.
3. Review dashboard and vehicle registry. Explain the sample labels.
4. Manually scan `MH12AB1234`: exact ACTIVE registration, GRANTED.
5. Scan `MH12AB1294`: 90% match to `MH12AB1234`, GRANTED at 60%.
6. Scan `MH01XY9090`: exact BLOCKED vehicle, DENIED despite 100% similarity.
7. Scan `MH04EF2468`: exact EXPIRED vehicle, DENIED.
8. Upload a clear single plate crop. Show real Tesseract text/confidence, source, calculation and stored incident.
9. Upload a harder image to exercise Vision; if still uncertain, show the honest retry/manual-entry state.
10. Change threshold to 95 and scan `MH12AB1294` again: DENIED at 90%. Previous incidents retain their original threshold snapshot.
11. Open image evidence, review Gemini's explanation, and show analytics updating.

## Practical limitations

- This is an operator-assisted college project, not a physical gate controller, identity proof, or law-enforcement risk model.
- Browser OCR observations and manual input originate with the authorized operator. A tampered client can submit a claimed plate. For untrusted unattended cameras, move ingestion/OCR to a trusted capture service and add anti-spoofing and hardware controls.
- OCR/vision can misread characters. Ties fail closed. A low similarity threshold increases false matches.
- Concurrent scans can observe the same prior-history counts. This does not change the access rule, but very high-throughput deployments should serialize per-plate risk history updates.
- AI explanations can contain mistakes; the stored deterministic fields and rule explanations are authoritative.
- Gemini/Cloudinary require valid credentials, quota, and network connectivity. Health reports CONFIGURED, not a provider availability guarantee.
- Upload and DB commit are not one distributed transaction. Retrying reuses the scan request ID and evidence public ID; an unretried DB failure can leave orphaned Cloudinary evidence. Delete orphaned test assets via Cloudinary if needed.
- There is no automatic evidence retention/deletion policy in this mini-project. Plan retention before using real personal data.

## Optional deployment later

Vercel deployment is intentionally deferred. The repository retains a `vercel.json` SPA rewrite configuration for later use. When ready, import the `sentinel` folder as a Vite project, use `npm run build`, output `dist`, and configure only the two public `VITE_SUPABASE_*` values. Add your production `/dashboard` callback to Supabase's redirect allowlist. Supabase Edge Functions and Cloudinary remain independent of the frontend host.

## Sources

- [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
- [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Gemini 2.5 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash)
- [Cloudinary signed API requests](https://cloudinary.com/documentation/authentication_signatures)
- [Cloudinary authenticated media and expiring access](https://cloudinary.com/documentation/control_access_to_media)

See **`docs/FILE_TREE.txt`** for the source file tree.

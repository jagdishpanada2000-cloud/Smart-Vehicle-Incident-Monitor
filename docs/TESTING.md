# Local verification

No tests modify or query the user's remote Supabase project. No Vercel deployment was performed.

## Automated tests

- **58 Vitest tests:** plate normalization and validation; candidate extraction; confident/uncertain OCR routing; Levenshtein insert/delete/substitute cases; similarity boundaries; best-match selection; blocked/expired/tied-match denial; empty registry; low/medium/high risk; invalid thresholds.
- These include executing the actual SQL migration and optional seed in **PGlite (embedded PostgreSQL)**: constraints, seed idempotency, real RLS isolation, operator CRUD, denial of anonymous/unapproved reads, denial of operator self-enrollment and direct incident writes, aggregate statistics, rate limits.
- These also execute the **actual process-scan handler** with isolated test providers: authentication, operator membership, request limits, saved-request replay, client decision fields ignored, Tesseract and Gemini branches, Cloudinary authenticated upload signature, Vision ambiguity/error, invalid images, DB failure, CORS/method handling.
- **7 Playwright browser tests:** public routes, protected-route redirect, Google OAuth URL and local callback, console pages, manual-scan validation/results with AI unavailable, vehicle form normalization/submission, responsive navigation/no horizontal overflow, and actual Tesseract.js reading a generated image.

Supabase responses are intercepted only inside browser test files. Handler tests use an isolated in-memory Supabase/provider substitute. These integration contracts do not constitute a live service test. Runtime application code uses real services and does not include mock data.

The OCR browser test uses a real Tesseract worker and language model. Its synthetic clear image is a smoke test, not a real-world accuracy benchmark. The initial model download requires network access.

## Commands

```powershell
npm test
npm run check:edge
npm run build
npm run dev
# in another terminal:
npm run test:browser
```

Browser tests use locally installed Google Chrome and `http://127.0.0.1:5174`. They save review screenshots under ignored `test-results/`; screenshots whose names contain `fixture` show test-only API data.

## Manual verification after your Supabase setup

1. Paste `supabase/SETUP.sql` and authorize your account.
2. Configure Google OAuth and confirm a real Google sign-in. Confirm an unapproved account cannot access records.
3. Set function secrets and deploy the four Edge Functions yourself.
4. Add/edit/delete a vehicle; verify records persist after reload.
5. Run the sample ACTIVE, BLOCKED, EXPIRED, and below-threshold manual scans.
6. Upload a sharp real plate crop. Verify OCR source/text/confidence and incident persistence.
7. Try uncertain/multiple/unreadable plates. Confirm Vision routing and honest retry errors.
8. Open private Cloudinary evidence; test that unsigned image delivery is unavailable.
9. Verify Gemini summaries and retry behavior, dashboard refresh, filters, and threshold snapshots.

Live Google authentication, Gemini API validity/quota, and remote Supabase end-to-end scanning remain unverified until you configure those services. The local frontend is available before those setup steps.

## Cloudinary follow-up diagnosis

The configured Cloudinary credentials passed a real read-only ping. A real upload using the application's helper was rejected with HTTP 403, missing permission `create`; no test asset was created. Upload success and private delivery remain blocked until that API key has upload permission. See `CLOUDINARY_TROUBLESHOOTING.md`.

Four regression cases were added for safe classification of Cloudinary 403, 401, 429, and 500 failures. All 17 handler tests and the Edge Function type checks passed after this change. No Supabase configuration was changed.

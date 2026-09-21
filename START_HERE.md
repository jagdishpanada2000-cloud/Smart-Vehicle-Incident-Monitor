# Start SENTINEL locally

The app is at **http://127.0.0.1:5174** while the development server is running.

To start it again:

```powershell
cd "C:\Users\Jagdish\OneDrive\Documents\New project\sentinel"
npm run dev
```

## 1. Paste the SQL yourself

Open **`supabase/SETUP.sql`** and paste its entire contents into your Supabase SQL Editor. Run once on a project without existing SENTINEL tables. It creates the schema, security policies, functions, 10 sample vehicles, and 24 labeled sample incidents in a transaction.

Do not also run the individual migration/seed files if you used `SETUP.sql`.

For an expanded fictional registry, then run `supabase/vehicle_registry_demo.sql`. It adds 30 vehicles and safely skips plates that already exist.

## 2. Create and authorize your login

For email/password: create a confirmed user in Supabase Authentication → Users. Choose your own password.

For Google: enable the Google provider using the instructions below, then sign in once to create your Auth user.

In **`supabase/authorize-operator.sql`**, replace `YOUR_EMAIL_HERE` with that account's email and run it. The final query should list your email. Return to the app and sign in or click Retry.

## 3. Enable Google sign-in

Create a Google OAuth **Web application** client. The Google client ID/secret are different from your Gemini API key.

- Google authorized JavaScript origins: `http://127.0.0.1:5174` and `http://localhost:5174`.
- Google authorized redirect URI: `https://frzfabqjiazeevuyxytd.supabase.co/auth/v1/callback`.
- Supabase Authentication → Providers → Google: enable it and enter the OAuth client ID/secret.
- Supabase URL Configuration: allow `http://127.0.0.1:5174/dashboard` and `http://localhost:5174/dashboard`.
- If Google's consent screen is in testing, add your team as test users.

Click **Continue with Google**. An account must still be authorized as an operator in step 2.

## 4. Install the backend functions when ready

**SQL creates the database, but does not install Edge Functions.** Full image/manual scanning needs these backend functions. Run these yourself from the `sentinel` folder:

```powershell
supabase login
supabase link --project-ref frzfabqjiazeevuyxytd
supabase secrets set --env-file .env.functions
supabase functions deploy process-scan
supabase functions deploy ai-analysis
supabase functions deploy evidence-url
supabase functions deploy health-check
```

Your supplied Gemini/Cloudinary credentials are stored only in the ignored `.env.functions` file for this step. The frontend uses only the public Supabase configuration in ignored `.env`. Never commit either file.

No cloud setup commands above have been run by the build. React remains on localhost; no Vercel deployment is required.

If image upload reports a Cloudinary permission error, follow `docs/CLOUDINARY_TROUBLESHOOTING.md`. A valid API key must also have asset creation/upload permission in the selected Cloudinary product environment.

## 5. Try the flow

- Manual plate `MH12AB1234`: ACTIVE, exact match, granted.
- Manual plate `MH12AB1294`: 90% match, granted at the 60% setting.
- Manual plate `MH01XY9090`: BLOCKED, denied even at 100%.
- Upload a clear plate image: Tesseract reads it; uncertain OCR goes to Gemini Vision. Both paths use backend Levenshtein matching.
- Open the incident to see the formula, reasons, risk, AI explanation, and private Cloudinary evidence.

See `README.md` for full setup/security/architecture details and `docs/VIVA.md` for your college presentation.

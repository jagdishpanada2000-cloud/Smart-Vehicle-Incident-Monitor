# Cloudinary upload permission

The reported upload failure was reproduced using the actual upload helper and a generated 1-pixel image. Cloudinary accepted the configured credentials for its read-only ping, but rejected the upload with HTTP 403:

```text
Request forbidden due to missing permissions (actions=["create"])
```

This means the API key is recognized but is not allowed to create an image asset in the selected product environment. The test image was rejected, so no diagnostic image was created. No Supabase changes were made during diagnosis.

## Fix in Cloudinary

1. Sign in to the Cloudinary Console as an administrator and select product environment `dwta5v9wi`.
2. Open **Settings → API Keys**, open the key's **three-dot menu → Assign Roles**, and assign a role that includes **Upload assets** for this product environment. SENTINEL uses `sentinel/<operator-id>/<request-id>` public IDs and authenticated images. If using folder-scoped roles instead, Cloudinary requires API assignment of those folder roles to the key.
3. If you cannot edit the existing key's permissions, use a key your administrator has authorized for uploads. Generating a replacement alone will not help if it is assigned the same restricted permissions. Keep API secrets in backend configuration.

For the standard global product-environment roles, **Contributor** includes uploads. **Editor** also includes downloading all assets, which the private evidence viewer needs, plus other media-management permissions. Choose the applicable product-environment role, not a similarly named account-level role. See the [system role descriptions](https://cloudinary.com/documentation/dam_admin_system_roles_permissions).

If you only changed permissions on the existing key, retry the image scan; credentials do not need to be changed.

If the key or secret changed, update `.env.functions` locally, then run this command yourself from the `sentinel` directory:

```powershell
supabase secrets set --env-file .env.functions --project-ref frzfabqjiazeevuyxytd
```

To deploy the improved error messages included in the updated code:

```powershell
supabase functions deploy process-scan --project-ref frzfabqjiazeevuyxytd
```

No SQL changes are required for this issue. The permissions correction alone resolves the reproduced cause; deploying the code improvement makes permission/authentication/quota failures clearer in the UI.

## Optional local verification

```powershell
npx deno run --env-file=.env.functions --allow-env --allow-net=api.cloudinary.com scripts/check-cloudinary.ts
```

This uses the application's Cloudinary helper to upload one generated pixel under a new diagnostic ID, checks repeat-upload behavior and private access, then deletes that exact test image. It never calls Supabase or uploads a user's photo. Successful cleanup also requires delete permission; if deletion is denied, the script prints the exact test public ID so an administrator can remove it. Run this optional write test only on an appropriately authorized key.

References: [Cloudinary API key settings](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials), [Cloudinary Roles and Permissions](https://cloudinary.com/documentation/dam_admin_permissions).

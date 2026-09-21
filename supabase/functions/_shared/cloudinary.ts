import { HttpError } from "./http.ts";
function config() {
  const cloud = Deno.env.get("CLOUDINARY_CLOUD_NAME")?.trim(),
    key = Deno.env.get("CLOUDINARY_API_KEY")?.trim(),
    secret = Deno.env.get("CLOUDINARY_API_SECRET")?.trim();
  if (!cloud || !key || !secret)
    throw new HttpError(
      503,
      "STORAGE",
      "Image storage is not configured. Contact your administrator.",
    );
  return { cloud, key, secret };
}
async function sign(params: Record<string, string>, secret: string) {
  const text =
    Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&") + secret;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function uploadEvidence(
  base64: string,
  mime: string,
  publicId: string,
) {
  const { cloud, key, secret } = config();
  const params = {
    timestamp: String(Math.floor(Date.now() / 1000)),
    public_id: publicId,
    type: "authenticated",
    overwrite: "false",
  };
  const form = new FormData();
  Object.entries(params).forEach(([k, v]) => form.set(k, v));
  form.set("api_key", key);
  form.set("signature", await sign(params, secret));
  form.set("file", `data:${mime};base64,${base64}`);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,
    { method: "POST", body: form, signal: AbortSignal.timeout(30_000) },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Classify provider failures without exposing credentials, signatures,
    // internal environment identifiers, or arbitrary provider response text.
    const providerMessage =
      typeof data?.error?.message === "string" ? data.error.message : "";
    let code = "STORAGE";
    let message = "Cloudinary could not store the image. Please retry.";
    if (response.status === 403) {
      code = "STORAGE_PERMISSION";
      message = /missing permissions.*create/i.test(providerMessage)
        ? "The Cloudinary API key lacks permission to upload images (create). Ask your administrator to enable that permission in Cloudinary."
        : "Cloudinary denied image upload permission. Ask your administrator to check the API key permissions.";
    } else if (response.status === 401) {
      code = "STORAGE_AUTH";
      message =
        "Cloudinary could not authenticate the upload. Ask your administrator to check the configured cloud name, API key, and API secret.";
    } else if (response.status === 429) {
      code = "STORAGE_LIMIT";
      message =
        "Cloudinary has reached an upload limit. Please wait before retrying or ask your administrator to check the account quota.";
    }
    console.error("Cloudinary upload rejected", {
      status: response.status,
      code,
    });
    throw new HttpError(503, code, message);
  }
  if (data?.public_id !== publicId || typeof data?.format !== "string")
    throw new HttpError(
      503,
      "STORAGE",
      "Image storage returned an invalid response.",
    );
  return { publicId: data.public_id as string, format: data.format as string };
}
export async function evidenceUrl(publicId: string, format: string) {
  const { cloud, key, secret } = config();
  const now = Math.floor(Date.now() / 1000);
  const params = {
    public_id: publicId,
    format,
    type: "authenticated",
    timestamp: String(now),
    expires_at: String(now + 120),
  };
  const query = new URLSearchParams({
    ...params,
    api_key: key,
    signature: await sign(params, secret),
  });
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/download?${query}`;
}

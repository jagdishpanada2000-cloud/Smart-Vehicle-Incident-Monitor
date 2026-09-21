// Local provider check: uploads only a generated 1-pixel image, then deletes it.
// Uses the same helper as process-scan. Never calls Supabase.
import {
  uploadEvidence,
  evidenceUrl,
} from "../supabase/functions/_shared/cloudinary.ts";

const cloud = Deno.env.get("CLOUDINARY_CLOUD_NAME")?.trim();
const key = Deno.env.get("CLOUDINARY_API_KEY")?.trim();
const secret = Deno.env.get("CLOUDINARY_API_SECRET")?.trim();
if (!cloud || !key || !secret)
  throw new Error("Cloudinary configuration is incomplete.");
const publicId = `sentinel/diagnostics/${crypto.randomUUID()}`;
const originalFetch = globalThis.fetch;
function safeMessage(value: unknown) {
  let text = typeof value === "string" ? value : "";
  for (const privateValue of [secret, key])
    text = text.split(privateValue!).join("[redacted]");
  return text.replace(/[a-f0-9]{40,64}/gi, "[signature]").slice(0, 500);
}
globalThis.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  if (!response.ok) {
    const data = await response
      .clone()
      .json()
      .catch(() => ({}));
    console.log(
      JSON.stringify({
        stage: "provider-response",
        httpStatus: response.status,
        message: safeMessage(data.error?.message),
      }),
    );
  }
  return response;
};
let uploaded = false;
try {
  const image =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/1cAAAAASUVORK5CYII=";
  const result = await uploadEvidence(image, "image/png", publicId);
  uploaded = true;
  console.log(
    JSON.stringify({ stage: "upload", success: true, format: result.format }),
  );
  const repeated = await uploadEvidence(image, "image/png", publicId);
  console.log(
    JSON.stringify({ stage: "retry", success: repeated.publicId === publicId }),
  );
  const url = await evidenceUrl(result.publicId, result.format);
  const download = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  console.log(
    JSON.stringify({
      stage: "private-image-access",
      httpStatus: download.status,
      contentType: download.headers.get("content-type"),
    }),
  );
  await download.body?.cancel();
  if (!download.ok) Deno.exitCode = 1;
} catch (error) {
  console.log(
    JSON.stringify({
      stage: "check",
      success: false,
      message: safeMessage(error instanceof Error ? error.message : ""),
    }),
  );
  Deno.exitCode = 1;
} finally {
  if (uploaded) {
    const form = new FormData();
    form.set("public_id", publicId);
    form.set("type", "authenticated");
    const response = await originalFetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/destroy`,
      {
        method: "POST",
        body: form,
        headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await response.json().catch(() => ({}));
    console.log(
      JSON.stringify({
        stage: "test-image-cleanup",
        httpStatus: response.status,
        result: data.result ?? "failed",
      }),
    );
    if (!response.ok || data.result !== "ok") {
      console.log(`Test asset awaiting cleanup: ${publicId}`);
      Deno.exitCode = 1;
    }
  }
}

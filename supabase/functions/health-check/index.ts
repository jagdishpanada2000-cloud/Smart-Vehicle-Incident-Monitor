import { context, endpoint, json } from "../_shared/http.ts";
Deno.serve(
  endpoint(async (req) => {
    const { admin } = await context(req);
    const { error } = await admin.from("system_settings").select("id").single();
    const cloudinary = [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ].every((key) => Deno.env.get(key));
    return json({
      frontend: "ONLINE",
      supabase: "ONLINE",
      database: error ? "ERROR" : "ONLINE",
      cloudinary: cloudinary ? "CONFIGURED" : "NOT_CONFIGURED",
      ocr: "TESSERACT_BROWSER",
      gemini: Deno.env.get("GEMINI_API_KEY") ? "CONFIGURED" : "NOT_CONFIGURED",
      matching: "ONLINE",
      checked_at: new Date().toISOString(),
    });
  }),
);

import {
  body,
  context,
  endpoint,
  HttpError,
  json,
  rateLimit,
  uuid,
} from "../_shared/http.ts";
import { evidenceUrl } from "../_shared/cloudinary.ts";
Deno.serve(
  endpoint(async (req) => {
    const { admin, user } = await context(req);
    await rateLimit(admin, user.id, "evidence", 30);
    const input = await body(req, 2000);
    if (!uuid(input.incidentId))
      throw new HttpError(400, "INPUT", "Select a valid incident.");
    const { data, error } = await admin
      .from("incident_log")
      .select("image_path,image_format")
      .eq("log_id", input.incidentId)
      .single();
    if (error || !data?.image_path || !data.image_format)
      throw new HttpError(
        404,
        "NOT_FOUND",
        "This incident has no stored image.",
      );
    return json({
      url: await evidenceUrl(data.image_path, data.image_format),
      expiresIn: 120,
    });
  }),
);

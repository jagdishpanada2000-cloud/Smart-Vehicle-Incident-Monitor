import { createClient } from "npm:@supabase/supabase-js@2";
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
export function endpoint(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST")
      return json({ error: "Use POST.", code: "METHOD" }, 405);
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError)
        return json({ error: e.message, code: e.code }, e.status);
      console.error(
        "Request failed",
        e instanceof Error ? e.name : "UnknownError",
      );
      return json(
        {
          error:
            "The service could not complete this request. Please try again.",
          code: "SERVICE_ERROR",
        },
        500,
      );
    }
  };
}
export async function context(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer "))
    throw new HttpError(401, "AUTH", "Sign in to continue.");
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(auth.slice(7));
  if (error || !user)
    throw new HttpError(
      401,
      "AUTH",
      "Your session has expired. Please sign in again.",
    );
  const { data: operator, error: memberError } = await admin
    .from("operators")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError)
    throw new HttpError(
      503,
      "DATABASE",
      "Operator access could not be verified.",
    );
  if (!operator)
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Your account has not been authorized as an operator.",
    );
  return { admin, user };
}
export async function rateLimit(
  admin: Awaited<ReturnType<typeof context>>["admin"],
  user: string,
  action: string,
  limit: number,
) {
  const { data, error } = await admin.rpc("sentinel_consume_request", {
    p_user: user,
    p_action: action,
    p_limit: limit,
  });
  if (error)
    throw new HttpError(
      503,
      "DATABASE",
      "The service is temporarily unavailable.",
    );
  if (!data)
    throw new HttpError(
      429,
      "RATE_LIMIT",
      "Too many requests. Please wait a minute.",
    );
}
export async function body(
  req: Request,
  maxBytes = 7_100_000,
): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length")) > maxBytes)
    throw new HttpError(
      413,
      "SIZE",
      "Image is too large. Maximum size is 5 MB.",
    );
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "BODY", "Request data is missing.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "SIZE", "Request is too large.");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(all));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw 0;
    return parsed;
  } catch {
    throw new HttpError(400, "BODY", "Request data is invalid.");
  }
}
export function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

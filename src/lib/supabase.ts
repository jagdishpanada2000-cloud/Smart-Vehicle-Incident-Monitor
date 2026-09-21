import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(
  url?.startsWith("https://") && key && !url.includes("YOUR_PROJECT"),
);
export const supabase = configured ? createClient(url, key) : null;
export function db() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Add the public environment variables.",
    );
  return supabase;
}
export async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await db().functions.invoke(name, {
    body: body as Record<string, unknown>,
  });
  if (error) {
    let message =
      "The server could not be reached. Check your connection and try again.";
    if (error.context instanceof Response) {
      try {
        const result = await error.context.json();
        if (typeof result.error === "string") message = result.error;
      } catch {
        /* Use a safe public message. */
      }
    }
    throw new Error(message);
  }
  return data as T;
}

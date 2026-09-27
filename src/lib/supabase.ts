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

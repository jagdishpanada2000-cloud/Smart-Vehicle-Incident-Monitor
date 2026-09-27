import { db } from "./supabase";

const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data, error } = await db().auth.getSession();
  if (error || !data.session) throw new Error("Sign in again to continue.");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${data.session.access_token}`,
      },
      signal: options.signal ?? AbortSignal.timeout(100_000),
    });
  } catch {
    throw new Error("The Java server could not be reached. Check that Spring Boot is running and the API URL is correct.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "The server could not complete this request.");
  if (body === null) throw new Error("The API returned an invalid response. Check the API URL.");
  return body as T;
}

export function invoke<T>(name: string, body: unknown): Promise<T> {
  return api<T>(`/${name}`, { method: "POST", body: JSON.stringify(body) });
}

export function query(values: Record<string, string | number | boolean>): string {
  return new URLSearchParams(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]))).toString();
}

export interface PageResult<T> { data: T[]; count: number }

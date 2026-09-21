import { HttpError } from "./http.ts";
export async function generate(
  parts: unknown[],
  jsonOutput = false,
): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key)
    throw new HttpError(
      503,
      "GEMINI_UNAVAILABLE",
      "Gemini is not configured. Use manual plate entry after visual verification.",
    );
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingBudget: 0 },
          ...(jsonOutput ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );
  if (!response.ok)
    throw new HttpError(
      503,
      "GEMINI_UNAVAILABLE",
      "Gemini is unavailable. Try again or use manual entry after checking the image.",
    );
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((p: { text?: string; thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text || "")
    .join("");
  if (!text)
    throw new HttpError(
      422,
      "NO_PLATE",
      "No readable result was returned. Try a clearer plate image.",
    );
  return text;
}

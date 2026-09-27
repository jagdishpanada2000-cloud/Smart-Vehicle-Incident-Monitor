import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Execute the actual Edge handler locally with an in-memory Supabase client and
// intercepted provider HTTP. No external services or credentials are used.
const state = vi.hoisted(() => ({
  authenticated: true,
  operator: true,
  allowed: true,
  saved: null as Record<string, unknown> | null,
  existing: null as Record<string, unknown> | null,
  databaseError: false,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: state.authenticated
            ? { id: "11111111-1111-4111-8111-111111111111" }
            : null,
        },
        error: null,
      }),
    },
    rpc: async () => ({ data: state.allowed, error: null }),
    from: (table: string) => {
      let payload: Record<string, unknown> | null = null;
      const query: Record<string, any> = {};
      for (const method of ["select", "eq", "neq", "gte", "order", "range"])
        query[method] = () => query;
      query.insert = (value: Record<string, unknown>) => {
        payload = value;
        return query;
      };
      query.update = (value: Record<string, unknown>) => {
        payload = value;
        return query;
      };
      query.maybeSingle = async () => ({
        data:
          table === "operators"
            ? state.operator
              ? { user_id: "operator" }
              : null
            : state.existing,
        error: null,
      });
      query.single = async () => {
        if (table === "system_settings")
          return {
            data: { similarity_threshold: 60, ocr_confidence_threshold: 80 },
            error: null,
          };
        if (state.databaseError)
          return { data: null, error: { code: "TEST_FAILURE" } };
        state.saved = payload;
        return {
          data: { ...payload, log_id: "33333333-3333-4333-8333-333333333333" },
          error: null,
        };
      };
      query.then = (resolve: (value: unknown) => void) =>
        resolve(
          table === "registered_vehicles"
            ? {
                data: [
                  {
                    vehicle_id: "one",
                    plate_number: "MH12AB1234",
                    status: "ACTIVE",
                    owner_name: "Fixture",
                    vehicle_type: "Car",
                    created_at: "",
                  },
                ],
                error: null,
              }
            : { data: null, count: 0, error: null },
        );
      return query;
    },
  }),
}));
let handler: (req: Request) => Promise<Response>;
const fetchMock = vi.fn();
beforeAll(async () => {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string) =>
        (
          ({
            SUPABASE_URL: "https://local.test",
            SUPABASE_SERVICE_ROLE_KEY: "local-test",
            GEMINI_API_KEY: "fake-test-only",
            CLOUDINARY_CLOUD_NAME: "test",
            CLOUDINARY_API_KEY: "test",
            CLOUDINARY_API_SECRET: "test",
          }) as Record<string, string>
        )[name],
    },
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  });
  await import("../supabase/functions/process-scan/index");
});
beforeEach(() => {
  state.authenticated = true;
  state.operator = true;
  state.allowed = true;
  state.saved = null;
  state.existing = null;
  state.databaseError = false;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
const requestId = "22222222-2222-4222-8222-222222222222";
async function call(body: unknown, auth = true) {
  return handler(
    new Request("http://local.test/process-scan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: "Bearer local-test" } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}
const image = {
  requestId,
  mode: "image",
  image: btoa(String.fromCharCode(137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0)),
  mime: "image/png",
  ocrText: "MH12AB1234",
  ocrConfidence: 95,
};
function cloudinaryResponse() {
  return Response.json({
    public_id: `sentinel/11111111-1111-4111-8111-111111111111/${requestId}`,
    format: "png",
  });
}
describe("actual process-scan orchestration", () => {
  it("rejects missing authentication before processing", async () => {
    expect(
      (await call({ requestId, mode: "manual", plate: "MH12AB1234" }, false))
        .status,
    ).toBe(401);
    expect(state.saved).toBeNull();
  });
  it("rejects an invalid session", async () => {
    state.authenticated = false;
    expect((await call({ requestId })).status).toBe(401);
  });
  it("rejects an authenticated but unauthorized account", async () => {
    state.operator = false;
    expect((await call({ requestId })).status).toBe(403);
  });
  it("enforces rate limits", async () => {
    state.allowed = false;
    expect(
      (await call({ requestId, mode: "manual", plate: "MH12AB1234" })).status,
    ).toBe(429);
  });
  it("computes and saves a manual decision without a provider call", async () => {
    const response = await call({
      requestId,
      mode: "manual",
      plate: "mh-12 ab 1234",
      decision: "DENIED",
      similarity_score: 0,
    });
    expect(response.status).toBe(200);
    expect(state.saved?.detected_plate).toBe("MH12AB1234");
    expect(state.saved?.decision).toBe("GRANTED");
    expect(state.saved?.similarity_score).toBe(100);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns the existing incident for a completed request ID", async () => {
    state.existing = { log_id: "existing", decision: "GRANTED" };
    expect(
      (
        await (
          await call({ requestId, mode: "manual", plate: "MH12AB1234" })
        ).json()
      ).incident.log_id,
    ).toBe("existing");
    expect(state.saved).toBeNull();
  });
  it("uses confident Tesseract directly and uploads an authenticated image", async () => {
    fetchMock.mockResolvedValueOnce(cloudinaryResponse());
    expect((await call(image)).status).toBe(200);
    expect(state.saved?.source).toBe("TESSERACT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("api.cloudinary.com");
    expect(options.body.get("type")).toBe("authenticated");
    expect(options.body.get("signature")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("uses Gemini Vision for uncertain OCR then performs the same matching", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      plate: "MH12AB1234",
                      uncertain: false,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(cloudinaryResponse());
    expect((await call({ ...image, ocrConfidence: 40 })).status).toBe(200);
    expect(state.saved?.source).toBe("GEMINI_VISION");
    expect(state.saved?.decision).toBe("GRANTED");
    expect(fetchMock.mock.calls[0][0]).toContain(
      "generativelanguage.googleapis.com",
    );
  });
  it.each([
    [
      403,
      'Request forbidden due to missing permissions (actions=["create"])',
      "STORAGE_PERMISSION",
      "lacks permission to upload images (create)",
    ],
    [401, "Invalid API key", "STORAGE_AUTH", "could not authenticate"],
    [429, "Rate limit exceeded", "STORAGE_LIMIT", "upload limit"],
    [500, "Internal provider error", "STORAGE", "could not store the image"],
  ])(
    "classifies Cloudinary HTTP %s without exposing its raw response",
    async (status, providerMessage, code, expectedMessage) => {
      const raw = `${providerMessage} [private-provider-details]`;
      fetchMock.mockResolvedValueOnce(
        Response.json({ error: { message: raw } }, { status: Number(status) }),
      );
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const response = await call(image);
        expect(response.status).toBe(503);
        const data = await response.json();
        expect(data.code).toBe(code);
        expect(data.error).toContain(expectedMessage);
        expect(JSON.stringify(data)).not.toContain("private-provider-details");
        expect(JSON.stringify(logged.mock.calls)).not.toContain(
          "private-provider-details",
        );
        expect(state.saved).toBeNull();
      } finally {
        logged.mockRestore();
      }
    },
  );
  it("does not grant or save when Vision remains uncertain", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        candidates: [
          { content: { parts: [{ text: '{"plate":null,"uncertain":true}' }] } },
        ],
      }),
    );
    expect((await call({ ...image, ocrConfidence: 20 })).status).toBe(422);
    expect(state.saved).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("reports Vision provider errors without returning raw provider responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("private-provider-error", { status: 429 }),
    );
    const response = await call({ ...image, ocrConfidence: 20 });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-provider-error");
    expect(state.saved).toBeNull();
  });
  it("rejects invalid image bytes", async () => {
    expect(
      (await call({ ...image, image: btoa("not a real image") })).status,
    ).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not return a successful result when incident storage fails", async () => {
    state.databaseError = true;
    expect(
      (await call({ requestId, mode: "manual", plate: "MH12AB1234" })).status,
    ).toBe(503);
  });
  it("serves CORS preflight without accepting an unauthenticated scan", async () => {
    expect(
      (await handler(new Request("http://local.test", { method: "OPTIONS" })))
        .status,
    ).toBe(200);
    expect((await handler(new Request("http://local.test"))).status).toBe(405);
  });
});

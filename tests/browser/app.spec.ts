import { test, expect, type Page } from "@playwright/test";
// Browser-only API fixtures. All Supabase network requests are intercepted:
// these tests never contact or mutate the user's Supabase project.
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "operator@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-09-21T00:00:00Z",
};
const session = {
  access_token: "test-session",
  refresh_token: "test-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};
const sample = {
  log_id: "33333333-3333-4333-8333-333333333333",
  request_id: "44444444-4444-4444-8444-444444444444",
  detected_text: "MH12AB1234",
  detected_plate: "MH12AB1234",
  matched_plate: "MH12AB1234",
  vehicle_status: "ACTIVE",
  similarity_score: 100,
  edit_distance: 0,
  threshold: 60,
  risk_level: "LOW",
  risk_reasons: ["Strong active match."],
  decision: "GRANTED",
  reason: "Active vehicle matched at 100%, meeting the 60% threshold.",
  source: "MANUAL",
  ocr_confidence: null,
  previous_incident_count: 0,
  previous_denied_count: 0,
  image_path: null,
  ai_summary: null,
  ai_status: "pending",
  is_sample: false,
  created_at: new Date().toISOString(),
};
async function mockApi(page: Page, authenticated = true) {
  if (authenticated)
    await page.addInitScript(
      ({ session }) =>
        localStorage.setItem(
          "sb-frzfabqjiazeevuyxytd-auth-token",
          JSON.stringify(session),
        ),
      { session },
    );
  await page.route("https://*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "content-type": "application/json",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 200, headers, body: "{}" });
    let data: unknown = [];
    if (path.includes("/auth/v1/user")) data = user;
    else if (path.includes("sentinel_is_operator")) data = true;
    else if (path.includes("sentinel_dashboard_stats"))
      data = {
        vehicles: 10,
        scans: 1,
        granted: 1,
        denied: 0,
        high: 0,
        medium: 0,
        low: 1,
        average: 100,
        samples: 0,
      };
    else if (path.includes("sentinel_daily_scans"))
      data = Array.from({ length: 7 }, (_, i) => ({
        day: `2026-09-${15 + i}`,
        scans: i === 6 ? 1 : 0,
        granted: i === 6 ? 1 : 0,
        denied: 0,
      }));
    else if (path.includes("system_settings"))
      data = {
        id: true,
        similarity_threshold: 60,
        ocr_confidence_threshold: 80,
      };
    else if (path.includes("/functions/v1/process-scan"))
      data = { incident: sample };
    else if (path.includes("/functions/v1/ai-analysis"))
      data = {
        incident: { ...sample, ai_status: "unavailable" },
        warning:
          "AI explanation is unavailable. The saved access decision is unchanged.",
      };
    else if (path.includes("/functions/v1/health-check"))
      data = {
        frontend: "ONLINE",
        supabase: "ONLINE",
        database: "ONLINE",
        cloudinary: "CONFIGURED",
        ocr: "TESSERACT_BROWSER",
        gemini: "CONFIGURED",
        matching: "ONLINE",
        checked_at: new Date().toISOString(),
      };
    else if (path.includes("incident_log")) data = [sample];
    else if (path.includes("registered_vehicles"))
      data = [
        {
          vehicle_id: "55555555-5555-4555-8555-555555555555",
          plate_number: "MH12AB1234",
          owner_name: "Test Owner",
          vehicle_type: "Car",
          status: "ACTIVE",
          created_at: new Date().toISOString(),
        },
      ];
    return route.fulfill({
      status: 200,
      headers: { ...headers, "content-range": "0-0/1" },
      body: JSON.stringify(data),
    });
  });
}
test("public landing and architecture render; protected routes require login", async ({
  page,
}) => {
  await mockApi(page, false);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every vehicle/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "View system architecture" }).click();
  await expect(
    page.getByRole("heading", { name: "Inside the intelligence." }),
  ).toBeVisible();
  await page.goto("/scanner");
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
});
test("Google button requests OAuth with the correct local redirect", async ({
  page,
}) => {
  await mockApi(page, false);
  await page.goto("/login");
  const request = page.waitForRequest((r) =>
    r.url().includes("/auth/v1/authorize"),
  );
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const url = new URL((await request).url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe(
    "http://127.0.0.1:5174/dashboard",
  );
});
test("console pages render with intercepted fixture data and no runtime errors", async ({
  page,
}) => {
  await mockApi(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, title] of [
    ["/dashboard", "Security overview"],
    ["/vehicles", "Vehicle registry"],
    ["/incidents", "Incident log"],
    ["/analytics", "Security analytics"],
    ["/system", "System settings"],
    ["/scanner", "Vehicle scanner"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".skeleton")).toHaveCount(0);
    if (path === "/dashboard")
      await page.screenshot({
        path: "test-results/dashboard-fixture-desktop.png",
        fullPage: true,
      });
  }
  expect(errors).toEqual([]);
});
test("manual scan validates input, saves result and survives AI unavailability", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/scanner");
  await page.getByRole("button", { name: "Manual entry" }).click();
  await page.getByRole("button", { name: "Run security scan" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter 5");
  await page.getByLabel("Vehicle registration number").fill("MH-12 AB 1234");
  const request = page.waitForRequest((r) =>
    r.url().includes("/functions/v1/process-scan"),
  );
  await page.getByRole("button", { name: "Run security scan" }).click();
  expect((await request).postDataJSON().mode).toBe("manual");
  await expect(page.locator(".decision-banner")).toContainText(
    "ACCESS GRANTED",
  );
  await expect(page.locator(".formula")).toContainText(
    "(1 − 0 / 10) × 100 = 100.0%",
  );
  await expect(page.locator(".analyst-box")).toContainText("unavailable");
  await page.screenshot({
    path: "test-results/scan-result-fixture.png",
    fullPage: true,
  });
});
test("vehicle form validates, normalizes and submits to real API contract", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/vehicles");
  await page.getByRole("button", { name: "Register vehicle" }).click();
  await page.getByLabel("Plate number").fill("mh-12 zz 9876");
  await page.getByLabel("Owner name").fill("New Owner");
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().includes("registered_vehicles"),
  );
  await page.getByRole("button", { name: "Save vehicle" }).click();
  expect((await request).postDataJSON().plate_number).toBe("MH12ZZ9876");
});
test("mobile pages fit viewport and navigation works", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Security overview" }),
  ).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-fixture-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: /Vehicle scanner/ }).click();
  await expect(
    page.getByRole("heading", { name: "Vehicle scanner" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

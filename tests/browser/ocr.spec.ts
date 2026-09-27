import { test, expect } from "@playwright/test";
test("real Tesseract.js reads a synthetic plate image", async ({ page }) => {
  test.setTimeout(120000);
  await page.route("https://*.supabase.co/**", (route) => route.abort());
  await page.goto("/");
  // Actual Tesseract worker and language model, no mocked OCR output.
  const result = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 260;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1000, 260);
    ctx.fillStyle = "black";
    ctx.font = "bold 100px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MH12AB1234", 500, 165);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png"),
    );
    // @ts-expect-error Vite serves this source module to the browser test.
    const { plateDetector } = await import("/src/services/ocr.ts");
    return plateDetector.detect(
      new File([blob], "test-plate.png", { type: "image/png" }),
      () => {},
    );
  });
  expect(result.text.replace(/[^A-Z0-9]/g, "")).toContain("MH12AB1234");
  expect(result.confidence).toBeGreaterThanOrEqual(80);
});

export interface OcrResult {
  text: string;
  confidence: number;
}
export interface PlateDetectionProvider {
  detect(
    image: File,
    onProgress: (progress: number) => void,
  ): Promise<OcrResult>;
}
export class TesseractProvider implements PlateDetectionProvider {
  async detect(
    image: File,
    onProgress: (progress: number) => void,
  ): Promise<OcrResult> {
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") onProgress(m.progress);
      },
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const { data } = await worker.recognize(image);
      return { text: data.text.slice(0, 4000), confidence: data.confidence };
    } finally {
      await worker.terminate();
    }
  }
}
// A future MLPlateDetectionProvider can implement the same interface.
// No untrained model or simulated detection is used in this application.
export const plateDetector: PlateDetectionProvider = new TesseractProvider();
export async function validateImage(file: File): Promise<void> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Image is too large. Maximum size is 5 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Choose another file.");
  }
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  if (pixels > 25_000_000)
    throw new Error(
      "Image resolution is too large. Resize it to under 25 megapixels.",
    );
}
export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

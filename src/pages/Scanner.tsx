import { useEffect, useRef, useState } from "react";
import {
  Upload,
  ScanLine,
  Keyboard,
  ArrowRight,
  Check,
  Sparkles,
  RotateCcw,
  ImagePlus,
} from "lucide-react";
import {
  assessOcr,
  isValidPlate,
  normalizePlate,
} from "../../supabase/functions/_shared/domain";
import { Badge, ErrorBox, Heading, Panel, useToast } from "../components/ui";
import { IncidentDetail } from "../components/IncidentDetail";
import { db, invoke } from "../lib/supabase";
import { plateDetector, toBase64, validateImage } from "../services/ocr";
import type { Incident, Settings } from "../types";
const stages = [
  "Input received",
  "Optical recognition",
  "Plate normalization",
  "Database matching",
  "Risk analysis",
  "Decision complete",
];
export function Scanner() {
  const [mode, setMode] = useState<"image" | "manual">("image"),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false),
    [stage, setStage] = useState(-1),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [ocr, setOcr] = useState<{ text: string; confidence: number } | null>(null),
    [route, setRoute] = useState(""),
    [result, setResult] = useState<Incident | null>(null),
    [settings, setSettings] = useState<Settings | null>(null);
  const input = useRef<HTMLInputElement>(null),
    requestId = useRef(crypto.randomUUID()),
    toast = useToast(),
    processing = useRef(false);
  useEffect(() => {
    let active = true;
    db()
      .from("system_settings")
      .select("*")
      .single()
      .then(({ data }) => {
        if (active && data) setSettings(data as Settings);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function reset() {
    requestId.current = crypto.randomUUID();
    setResult(null);
    setOcr(null);
    setStage(-1);
    setRoute("");
    setError("");
  }
  async function choose(candidate?: File) {
    if (!candidate || busy) return;
    reset();
    try {
      await validateImage(candidate);
      setFile(candidate);
    } catch (e) {
      setFile(null);
      setError((e as Error).message);
    }
  }
  async function scan() {
    if (processing.current) return;
    if (mode === "image" && !file) {
      setError("Choose an image first.");
      return;
    }
    if (mode === "manual" && !isValidPlate(normalizePlate(manual))) {
      setError(
        "Enter 5–12 letters and digits, with at least one letter and one digit.",
      );
      return;
    }
    processing.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    setStage(0);
    try {
      let payload: Record<string, unknown> = {
        mode,
        requestId: requestId.current,
      };
      if (mode === "image") {
        setStage(1);
        setProgress(0);
        let detected;
        try {
          detected = await plateDetector.detect(file!, setProgress);
        } catch {
          detected = { text: "", confidence: 0 };
          toast("Local OCR failed. Trying Gemini Vision.", true);
        }
        setOcr(detected);
        setStage(2);
        const reliable =
          settings &&
          assessOcr(
            detected.text,
            detected.confidence,
            settings.ocr_confidence_threshold,
          ).reliable;
        setRoute(
          reliable
            ? "Tesseract result → Levenshtein"
            : "Uncertain OCR → Gemini Vision → Levenshtein",
        );
        payload = {
          ...payload,
          image: await toBase64(file!),
          mime: file!.type,
          ocrText: detected.text,
          ocrConfidence: detected.confidence,
        };
      } else {
        payload.plate = manual;
        setStage(2);
        setRoute("Manual input → Levenshtein");
      }
      // Matching and risk happen together in the backend. Do not simulate their completion.
      setStage(3);
      const data = await invoke<{ incident: Incident }>(
        "process-scan",
        payload,
      );
      setStage(5);
      setResult(data.incident);
      toast("Scan complete. Incident saved.");
      try {
        const analysis = await invoke<{ incident: Incident; warning?: string }>(
          "ai-analysis",
          { incidentId: data.incident.log_id },
        );
        setResult(analysis.incident);
        if (analysis.warning) toast(analysis.warning, true);
      } catch {
        toast(
          "Incident saved. AI explanation can be retried from the incident details.",
          true,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      processing.current = false;
    }
  }
  return (
    <>
      <Heading
        eyebrow="IDENTIFY. VERIFY. UNDERSTAND."
        title="Vehicle scanner"
        description="From a plate image to an explainable access decision."
        action={
          <Badge tone={busy ? "medium" : ""}>
            {busy ? "SCAN IN PROGRESS" : "READY TO SCAN"}
          </Badge>
        }
      />
      <div className="scanner-grid">
        <div>
          <Panel title="Scan input" label="01 / CAPTURE">
            <div className="scanner-input">
              <div className="tabs">
                <button
                  className={mode === "image" ? "active" : ""}
                  disabled={busy}
                  onClick={() => {
                    setMode("image");
                    reset();
                  }}
                >
                  <Upload size={16} /> Upload image
                </button>
                <button
                  className={mode === "manual" ? "active" : ""}
                  disabled={busy}
                  onClick={() => {
                    setMode("manual");
                    reset();
                  }}
                >
                  <Keyboard size={16} /> Manual entry
                </button>
              </div>
              {mode === "image" ? (
                <>
                  <input
                    ref={input}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => void choose(e.target.files?.[0])}
                  />
                  <button
                    className={`upload-zone ${preview ? "has-image" : ""}`}
                    disabled={busy}
                    onClick={() => input.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void choose(e.dataTransfer.files[0]);
                    }}
                  >
                    {preview ? (
                      <>
                        <img src={preview} alt="Selected vehicle to scan" />
                        {busy && <span className="scan-line" />}
                        <span className="preview-label">
                          {file?.name} · Click to replace
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="upload-symbol">
                          <ImagePlus size={30} />
                        </span>
                        <strong>Drop your vehicle image here</strong>
                        <span>or click to browse files</span>
                        <small>JPG, PNG, WEBP · MAX 5 MB</small>
                      </>
                    )}
                  </button>
                  <p className="input-hint">
                    For best results, use a sharp, straight-on crop with one
                    visible plate.
                  </p>
                </>
              ) : (
                <div className="manual-input">
                  <label>
                    Vehicle registration number
                    <input
                      className="plate-input"
                      maxLength={40}
                      placeholder="MH 12 AB 1234"
                      value={manual}
                      disabled={busy}
                      onChange={(e) => {
                        setManual(e.target.value);
                        reset();
                      }}
                    />
                  </label>
                  <p className="input-hint">
                    Normalized plate:{" "}
                    <strong className="mono">
                      {normalizePlate(manual) || "—"}
                    </strong>
                  </p>
                  <p className="input-hint">
                    Use manual entry only after visually verifying the plate.
                  </p>
                </div>
              )}
              {error && <ErrorBox message={error} />}
              <button
                className="button full"
                disabled={busy || Boolean(result)}
                onClick={scan}
              >
                <ScanLine size={18} />
                {busy
                  ? stage === 1
                    ? `Reading image… ${Math.round(progress * 100)}%`
                    : stage === 5
                      ? "Generating AI explanation…"
                      : "Processing with backend…"
                  : "Run security scan"}
                <ArrowRight size={18} />
              </button>
              {result && (
                <button className="text-button rescan" onClick={reset}>
                  <RotateCcw size={15} /> Start a new scan
                </button>
              )}
            </div>
          </Panel>
          <div className="pipeline-info">
            <Sparkles size={20} />
            <div>
              <strong>A smarter second look.</strong>
              <p>
                Tesseract handles clear images. Gemini Vision steps in when
                confidence is low or the plate is ambiguous.
              </p>
            </div>
          </div>
        </div>
        <div>
          <Panel title="Recognition pipeline" label="02 / PROCESS">
            <ol className="scan-stages">
              {stages.map((name, i) => (
                <li
                  className={
                    i < stage || stage === 5
                      ? "complete"
                      : i === stage
                        ? "current"
                        : ""
                  }
                  key={name}
                >
                  <span>
                    {i < stage || stage === 5 ? (
                      <Check size={14} />
                    ) : (
                      `0${i + 1}`
                    )}
                  </span>
                  <div>
                    {name}
                    {i === 1 && stage === 1 && (
                      <small>
                        Tesseract.js worker · {Math.round(progress * 100)}%
                      </small>
                    )}
                    {i === 3 && stage === 3 && (
                      <small>
                        Backend matching, risk analysis, and incident storage
                      </small>
                    )}
                  </div>
                  {i === stage && stage < 5 && <span className="step-pulse" />}
                </li>
              ))}
            </ol>
          </Panel>
          {ocr && (
            <Panel title="OCR observation" label="TESSERACT.JS">
              <div className="ocr-observation">
                <div className="ocr-score">
                  {ocr.confidence.toFixed(1)}%
                  <span>OCR confidence estimate</span>
                </div>
                <pre>{ocr.text || "No readable text from local OCR."}</pre>
                <div className="route-label">{route}</div>
                <small className="muted">
                  The backend applies the current confidence setting. This
                  estimate is separate from plate-match similarity.
                </small>
              </div>
            </Panel>
          )}
        </div>
      </div>
      {result && (
        <Panel title="Scan intelligence" label="03 / RESULT">
          <div className="result-wrapper">
            <IncidentDetail incident={result} onUpdate={setResult} />
          </div>
        </Panel>
      )}
    </>
  );
}

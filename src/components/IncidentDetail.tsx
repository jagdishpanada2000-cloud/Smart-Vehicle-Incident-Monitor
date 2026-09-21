import { useEffect, useState } from "react";
import { Sparkles, Image, RefreshCw } from "lucide-react";
import type { Incident } from "../types";
import { invoke } from "../lib/supabase";
import { Badge, dateTime, ErrorBox, useToast } from "./ui";
export function IncidentDetail({
  incident,
  onUpdate,
}: {
  incident: Incident;
  onUpdate?: (incident: Incident) => void;
}) {
  const [record, setRecord] = useState(incident),
    [image, setImage] = useState(""),
    [busy, setBusy] = useState(false),
    [imageError, setImageError] = useState("");
  const toast = useToast();
  useEffect(() => {
    setRecord(incident);
    setImage("");
    setImageError("");
  }, [incident]);
  async function loadImage() {
    setImageError("");
    try {
      const { url } = await invoke<{ url: string }>("evidence-url", {
        incidentId: record.log_id,
      });
      setImage(url);
    } catch (e) {
      setImageError((e as Error).message);
    }
  }
  async function analyze() {
    setBusy(true);
    try {
      const data = await invoke<{ incident: Incident; warning?: string }>(
        "ai-analysis",
        { incidentId: record.log_id },
      );
      setRecord(data.incident);
      onUpdate?.(data.incident);
      if (data.warning) toast(data.warning, true);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="incident-detail">
      <div className={`decision-banner ${record.decision.toLowerCase()}`}>
        <Badge tone={record.decision}>ACCESS {record.decision}</Badge>
        <h2 className="plate-text">{record.detected_plate}</h2>
        <p>{record.reason}</p>
      </div>
      <div className="detail-grid">
        <div>
          <small>BEST MATCH</small>
          <strong className="mono">
            {record.matched_plate || "No registered match"}
          </strong>
        </div>
        <div>
          <small>SIMILARITY</small>
          <strong>{record.similarity_score.toFixed(1)}%</strong>
        </div>
        <div>
          <small>THRESHOLD USED</small>
          <strong>{record.threshold}%</strong>
        </div>
        <div>
          <small>VEHICLE STATUS</small>
          <strong>{record.vehicle_status || "—"}</strong>
        </div>
        <div>
          <small>RECOGNITION SOURCE</small>
          <strong>{record.source.replace("_", " ")}</strong>
        </div>
        <div>
          <small>TESSERACT CONFIDENCE</small>
          <strong>
            {record.ocr_confidence === null
              ? "Manual entry"
              : `${record.ocr_confidence.toFixed(1)}%`}
          </strong>
        </div>
      </div>
      {record.matched_plate && (
        <div className="formula mono">
          (1 − {record.edit_distance} /{" "}
          {Math.max(record.detected_plate.length, record.matched_plate.length)})
          × 100 = {record.similarity_score.toFixed(1)}%
        </div>
      )}
      <div className="risk-explanation">
        <Badge tone={record.risk_level}>{record.risk_level} RISK</Badge>
        <ul>
          {record.risk_reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <small className="muted">
          History window: 24 hours · {record.previous_incident_count} prior
          scans · {record.previous_denied_count} prior denials for this exact
          plate
        </small>
      </div>
      <div className="analyst-box">
        <div className="panel-heading">
          <h3>
            <Sparkles size={17} /> AI INCIDENT ANALYST
          </h3>
          <span className="mono muted">EXPLANATION ONLY</span>
        </div>
        {record.ai_summary ? (
          <p>{record.ai_summary}</p>
        ) : (
          <>
            <p>
              {record.ai_status === "unavailable"
                ? "AI explanation is unavailable. The rule-based result above is saved and valid."
                : "Generate an AI explanation of the saved incident."}
            </p>
            <button className="text-button" disabled={busy} onClick={analyze}>
              <RefreshCw size={15} className={busy ? "spin" : ""} />
              {busy ? "Analyzing…" : "Generate explanation"}
            </button>
          </>
        )}
      </div>
      {record.detected_text && (
        <details>
          <summary>
            Original{" "}
            {record.source === "MANUAL" ? "manual input" : "Tesseract OCR text"}
          </summary>
          <pre>{record.detected_text}</pre>
        </details>
      )}
      {record.image_path && (
        <div className="evidence">
          <button className="text-button" onClick={loadImage}>
            <Image size={16} />
            {image ? "Refresh private image" : "View private image evidence"}
          </button>
          {imageError && <ErrorBox message={imageError} />}{" "}
          {image && (
            <img
              src={image}
              alt={`Evidence for ${record.detected_plate}`}
              onError={() =>
                setImageError(
                  "Image link expired or could not load. Refresh the private image.",
                )
              }
            />
          )}
        </div>
      )}
      <div className="detail-footer mono">
        {dateTime(record.created_at)}
        {record.is_sample && " · PRESENTATION SAMPLE"}
        <br />
        INCIDENT {record.log_id.slice(0, 8).toUpperCase()}
      </div>
    </div>
  );
}

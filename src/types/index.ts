import type {
  Risk,
  VehicleStatus,
} from "../../supabase/functions/_shared/domain";
export type {
  Vehicle,
  VehicleStatus,
  Risk,
} from "../../supabase/functions/_shared/domain";
export interface Incident {
  log_id: string;
  request_id: string;
  detected_text: string;
  detected_plate: string;
  matched_plate: string | null;
  vehicle_status: VehicleStatus | null;
  similarity_score: number;
  edit_distance: number | null;
  threshold: number;
  risk_level: Risk;
  risk_reasons: string[];
  decision: "GRANTED" | "DENIED";
  reason: string;
  source: "MANUAL" | "TESSERACT" | "GEMINI_VISION";
  ocr_confidence: number | null;
  previous_incident_count: number;
  previous_denied_count: number;
  image_path: string | null;
  ai_summary: string | null;
  ai_status: "pending" | "complete" | "unavailable";
  is_sample: boolean;
  created_at: string;
}
export interface Settings {
  id: boolean;
  similarity_threshold: number;
  ocr_confidence_threshold: number;
}
export interface Stats {
  vehicles: number;
  scans: number;
  granted: number;
  denied: number;
  high: number;
  medium: number;
  low: number;
  average: number;
  samples: number;
}
export interface Day {
  day: string;
  scans: number;
  granted: number;
  denied: number;
}

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw, Save, ShieldCheck } from "lucide-react";
import {
  Badge,
  ErrorBox,
  Heading,
  Panel,
  Skeleton,
  useToast,
} from "../components/ui";
import { db, invoke } from "../lib/supabase";
import type { Settings } from "../types";
export function System() {
  const [settings, setSettings] = useState<Settings | null>(null),
    [health, setHealth] = useState<Record<string, string> | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [checking, setChecking] = useState(false);
  const toast = useToast();
  async function check() {
    setChecking(true);
    setError("");
    try {
      const [h, s] = await Promise.all([
        invoke<Record<string, string>>("health-check", {}),
        db().from("system_settings").select("*").single(),
      ]);
      if (s.error) throw new Error("Settings could not be loaded.");
      setSettings(s.data as Settings);
      setHealth(h);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    void check();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await db()
        .from("system_settings")
        .update({
          similarity_threshold: settings.similarity_threshold,
          ocr_confidence_threshold: settings.ocr_confidence_threshold,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true)
        .select()
        .single();
      if (error) throw error;
      toast("System thresholds saved. New scans will use these values.");
    } catch {
      toast("Could not save settings.", true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="TRANSPARENT RULES. COMPLETE CONTROL."
        title="System settings"
        description="Check service configuration and tune the recognition pipeline."
        action={
          <button
            className="button secondary"
            disabled={checking}
            onClick={check}
          >
            <RefreshCw size={16} className={checking ? "spin" : ""} />
            Check health
          </button>
        }
      />
      {error && <ErrorBox message={error} retry={check} />}
      <div className="settings-grid">
        <Panel title="Access & recognition rules" label="CONFIGURATION">
          {!settings ? (
            <Skeleton />
          ) : (
            <form className="settings-form" onSubmit={save}>
              <label>
                <span>
                  Plate similarity threshold
                  <strong>{settings.similarity_threshold}%</strong>
                </span>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={settings.similarity_threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      similarity_threshold: Number(e.target.value),
                    })
                  }
                />
                <small>
                  Default 60%. Active vehicles must meet this threshold.
                  Blocked, expired, and tied matches are denied.
                </small>
              </label>
              <label>
                <span>
                  Tesseract confidence threshold
                  <strong>{settings.ocr_confidence_threshold}%</strong>
                </span>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={settings.ocr_confidence_threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ocr_confidence_threshold: Number(e.target.value),
                    })
                  }
                />
                <small>
                  Default 80%. Lower confidence or multiple/no standard plate
                  candidates trigger Gemini Vision.
                </small>
              </label>
              <div className="settings-callout">
                <ShieldCheck size={20} />
                <p>
                  Similarity and OCR confidence measure different things. Gemini
                  reads uncertain images and explains incidents; backend rules
                  always decide access.
                </p>
              </div>
              <button className="button" disabled={saving}>
                <Save size={16} />
                {saving ? "Saving…" : "Save configuration"}
              </button>
            </form>
          )}
        </Panel>
        <Panel
          title="Service health"
          label={health ? "CHECKED" : "NOT CHECKED"}
        >
          <div className="health-list">
            {[
              { key: "frontend", name: "React frontend" },
              { key: "supabase", name: "Supabase authentication" },
              { key: "database", name: "PostgreSQL database" },
              { key: "ocr", name: "Tesseract.js · browser OCR" },
              { key: "gemini", name: "Gemini Vision & Analyst" },
              { key: "cloudinary", name: "Cloudinary image storage" },
              { key: "matching", name: "Levenshtein engine" },
            ].map(({ key, name }) => (
              <div key={key}>
                <span>{name}</span>
                <Badge
                  tone={
                    health &&
                    ["ONLINE", "CONFIGURED", "TESSERACT_BROWSER"].includes(
                      health[key],
                    )
                      ? "granted"
                      : health
                        ? "medium"
                        : ""
                  }
                >
                  {health?.[key]?.replaceAll("_", " ") || "NOT CHECKED"}
                </Badge>
              </div>
            ))}
          </div>
          <p className="health-note">
            CONFIGURED means a secret exists; it does not verify API quota or
            provider availability. Tesseract loads in the browser on the first
            image scan.
          </p>
          {health && (
            <p className="health-note mono">
              LAST CHECK {new Date(health.checked_at).toLocaleString()}
            </p>
          )}
        </Panel>
      </div>
      <Link className="architecture-banner" to="/architecture">
        <div>
          <span className="eyebrow">UNDER THE HOOD</span>
          <h3>Explore the system architecture</h3>
          <p>A clear explanation of OCR, fuzzy matching, risk rules, and AI.</p>
        </div>
        <ArrowUpRight size={26} />
      </Link>
    </>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ScanLine,
  ShieldCheck,
  Activity,
  CircleCheck,
  CircleX,
} from "lucide-react";
import {
  Badge,
  Empty,
  ErrorBox,
  Heading,
  Metric,
  Modal,
  Panel,
  Skeleton,
} from "../components/ui";
import { IncidentDetail } from "../components/IncidentDetail";
import { useOverview } from "../hooks/useOverview";
import type { Day, Incident, Stats } from "../types";
export function StatsRow({ stats }: { stats: Stats }) {
  return (
    <div className="stats-row">
      <Metric
        label="REGISTERED VEHICLES"
        value={stats.vehicles}
        note="Vehicles in registry"
      />
      <Metric
        label="TOTAL SCANS"
        value={stats.scans}
        note="Across all recorded activity"
      />
      <Metric
        label="ACCESS GRANTED"
        value={stats.granted}
        note="Cleared by access rules"
        accent="green"
      />
      <Metric
        label="ACCESS DENIED"
        value={stats.denied}
        note="Flagged by access rules"
        accent="red"
      />
      <Metric
        label="HIGH-RISK INCIDENTS"
        value={stats.high}
        note="Require operator review"
        accent="amber"
      />
    </div>
  );
}
function ActivityChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.scans));
  return (
    <div className="activity-chart">
      <div className="chart-legend">
        <span>
          <i className="green-dot" />
          Granted
        </span>
        <span>
          <i className="red-dot" />
          Denied
        </span>
        <small>LAST 7 DAYS · UTC</small>
      </div>
      <div
        className="bar-chart"
        role="img"
        aria-label="Daily scan counts for the past seven days"
      >
        {days.map((day) => (
          <div className="bar-column" key={day.day}>
            <div className="bar-top">{day.scans}</div>
            <div className="bar-track">
              <div
                className="stacked-bar"
                style={{ height: `${(day.scans / max) * 100}%` }}
                title={`${day.day}: ${day.granted} granted, ${day.denied} denied`}
              >
                <div className="bar-denied" style={{ flex: day.denied }} />
                <div className="bar-granted" style={{ flex: day.granted }} />
              </div>
            </div>
            <span>
              {new Date(day.day + "T00:00:00Z").toLocaleDateString("en", {
                weekday: "short",
                timeZone: "UTC",
              })}
            </span>
          </div>
        ))}
      </div>
      {days.every((d) => d.scans === 0) && (
        <p className="chart-empty">No scans in the last seven days.</p>
      )}
    </div>
  );
}
function RiskChart({ stats }: { stats: Stats }) {
  const low = stats.scans ? (stats.low / stats.scans) * 100 : 0,
    medium = stats.scans ? (stats.medium / stats.scans) * 100 : 0;
  return (
    <div className="risk-chart">
      <div
        className="donut"
        style={{
          background: stats.scans
            ? `conic-gradient(var(--lime) 0 ${low}%, var(--amber) ${low}% ${low + medium}%, var(--red) ${low + medium}% 100%)`
            : "var(--border)",
        }}
      >
        <div>
          <strong>
            {stats.scans ? Math.round((stats.granted / stats.scans) * 100) : 0}%
          </strong>
          <small>GRANTED</small>
        </div>
      </div>
      <div className="risk-legend">
        {[
          ["LOW", "Low risk", stats.low],
          ["MEDIUM", "Medium risk", stats.medium],
          ["HIGH", "High risk", stats.high],
        ].map(([tone, label, count]) => (
          <div key={tone}>
            <Badge tone={String(tone)}>{label}</Badge>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Dashboard() {
  const { stats, days, incidents, error, updated, load } = useOverview();
  const [selected, setSelected] = useState<Incident | null>(null);
  return (
    <>
      <Heading
        eyebrow="YOUR PERIMETER. AT A GLANCE."
        title="Security overview"
        description="A clear view of your vehicles, access decisions, and incidents."
        action={
          <Link className="button" to="/scanner">
            <ScanLine size={18} /> New vehicle scan <ArrowUpRight size={17} />
          </Link>
        }
      />
      {error && <ErrorBox message={error} retry={load} />}{" "}
      {!stats ? (
        <Skeleton />
      ) : (
        <>
          <StatsRow stats={stats} />
          {stats.samples > 0 && (
            <div className="sample-notice">
              Presentation dataset enabled · {stats.samples} clearly marked
              sample incidents included in statistics.
            </div>
          )}
          <div className="dashboard-grid">
            <Panel title="Access activity" label="7-DAY OVERVIEW">
              <ActivityChart days={days} />
            </Panel>
            <Panel title="Threat distribution" label="ALL TIME">
              <RiskChart stats={stats} />
            </Panel>
          </div>
          <div className="dashboard-bottom">
            <Panel
              title="Recent incidents"
              label={
                updated
                  ? `SYNCED ${updated.toLocaleTimeString("en-GB")}`
                  : "CONNECTING"
              }
            >
              <div className="timeline">
                {incidents.length === 0 ? (
                  <Empty title="Perimeter is quiet">
                    Run your first scan to start the incident timeline.
                  </Empty>
                ) : (
                  incidents.map((i) => (
                    <button
                      className="timeline-row"
                      key={i.log_id}
                      onClick={() => setSelected(i)}
                    >
                      <span
                        className={`timeline-icon ${i.decision.toLowerCase()}`}
                      >
                        {i.decision === "GRANTED" ? (
                          <CircleCheck size={19} />
                        ) : (
                          <CircleX size={19} />
                        )}
                      </span>
                      <span className="timeline-plate">
                        <strong className="mono">{i.detected_plate}</strong>
                        <small>
                          {i.is_sample
                            ? "Presentation sample"
                            : i.source.replace("_", " ")}{" "}
                          · {new Date(i.created_at).toLocaleTimeString("en-GB")}
                        </small>
                      </span>
                      <span className="similarity">
                        {i.similarity_score.toFixed(1)}
                        <small>% MATCH</small>
                      </span>
                      <Badge tone={i.decision}>{i.decision}</Badge>
                      <ArrowUpRight size={15} />
                    </button>
                  ))
                )}
              </div>
              <Link className="panel-link" to="/incidents">
                View all incidents <ArrowRight size={16} />
              </Link>
            </Panel>
            <section className="scan-promo">
              <div className="eyebrow">
                <Activity size={15} /> RECOGNITION ENGINE
              </div>
              <div className="promo-radar">
                <ScanLine size={45} />
              </div>
              <h2>
                Your next scan.
                <br />A smarter decision.
              </h2>
              <p>
                Upload an image or enter a plate. Let the pipeline do the rest.
              </p>
              <Link className="button secondary" to="/scanner">
                Launch scanner <ArrowUpRight size={17} />
              </Link>
              <span className="mono muted">TESSERACT.JS + GEMINI VISION</span>
            </section>
          </div>
          <div className="system-strip">
            <span>
              <ShieldCheck size={16} /> Deterministic access rules
            </span>
            <span>Automatic refresh every 15 seconds</span>
            <Link to="/system">
              Check system health <ArrowRight size={14} />
            </Link>
          </div>
        </>
      )}
      {selected && (
        <Modal title="Incident intelligence" onClose={() => setSelected(null)}>
          <IncidentDetail incident={selected} />
        </Modal>
      )}
    </>
  );
}
export function Analytics() {
  const { stats, days, error, load } = useOverview();
  return (
    <>
      <Heading
        eyebrow="PATTERNS INTO PERSPECTIVE"
        title="Security analytics"
        description="Understand access activity with transparent, database-backed metrics."
      />
      {error && <ErrorBox message={error} retry={load} />}{" "}
      {!stats ? (
        <Skeleton />
      ) : (
        <>
          <StatsRow stats={stats} />
          <div className="analytics-summary">
            <div>
              <small>AVERAGE MATCH SIMILARITY</small>
              <strong>{stats.average.toFixed(1)}%</strong>
            </div>
            <p>
              Calculated from every saved scan, including denied scans.{" "}
              {stats.samples > 0 &&
                `${stats.samples} presentation samples are included.`}
            </p>
          </div>
          <div className="dashboard-grid">
            <Panel title="Scans over time" label="LAST 7 DAYS">
              <ActivityChart days={days} />
            </Panel>
            <Panel title="Risk distribution" label="ALL TIME">
              <RiskChart stats={stats} />
            </Panel>
          </div>
          <Panel title="Access decisions" label="ALL TIME">
            <div className="decision-chart">
              <div className="decision-track">
                <span
                  style={{
                    width: `${stats.scans ? (stats.granted / stats.scans) * 100 : 0}%`,
                  }}
                />
              </div>
              <div>
                <Badge tone="granted">{stats.granted} GRANTED</Badge>
                <Badge tone="denied">{stats.denied} DENIED</Badge>
              </div>
              {stats.scans === 0 && <p>No decisions recorded yet.</p>}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

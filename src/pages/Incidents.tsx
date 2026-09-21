import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Badge,
  dateTime,
  Empty,
  ErrorBox,
  Heading,
  Modal,
  Skeleton,
} from "../components/ui";
import { IncidentDetail } from "../components/IncidentDetail";
import { db } from "../lib/supabase";
import type { Incident } from "../types";
export function Incidents() {
  const [rows, setRows] = useState<Incident[]>([]),
    [search, setSearch] = useState(""),
    [decision, setDecision] = useState(""),
    [risk, setRisk] = useState(""),
    [ascending, setAscending] = useState(false),
    [page, setPage] = useState(0),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Incident | null>(null);
  const load = useCallback(async () => {
    try {
      let query = db()
        .from("incident_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending })
        .order("log_id");
      const safe = search.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (safe)
        query = query.or(
          `detected_plate.ilike.%${safe}%,matched_plate.ilike.%${safe}%`,
        );
      if (decision) query = query.eq("decision", decision);
      if (risk) query = query.eq("risk_level", risk);
      const { data, error, count } = await query.range(
        page * 15,
        page * 15 + 14,
      );
      if (error) throw error;
      setRows(data as Incident[]);
      setCount(count ?? 0);
      setError("");
    } catch {
      setError("Incident records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [search, decision, risk, ascending, page]);
  useEffect(() => {
    setLoading(true);
    const first = setTimeout(() => void load(), 200),
      timer = setInterval(() => {
        if (!document.hidden) void load();
      }, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);
  return (
    <>
      <Heading
        eyebrow="EVERY DECISION LEAVES A TRACE"
        title="Incident log"
        description="Review detection evidence, access decisions, and AI explanations."
        action={<Badge>AUTO-REFRESH · 15S</Badge>}
      />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search incidents"
              placeholder="Search detected or matched plate…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Filter access decision"
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All decisions</option>
            <option>GRANTED</option>
            <option>DENIED</option>
          </select>
          <select
            aria-label="Filter risk level"
            value={risk}
            onChange={(e) => {
              setRisk(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All risk levels</option>
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
          </select>
          <select
            aria-label="Sort incidents"
            value={String(ascending)}
            onChange={(e) => {
              setAscending(e.target.value === "true");
              setPage(0);
            }}
          >
            <option value="false">Newest first</option>
            <option value="true">Oldest first</option>
          </select>
        </div>
        {error && <ErrorBox message={error} retry={load} />}{" "}
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <Empty title="No incidents found">
            Run a scan or adjust the active filters.
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>DETECTED PLATE</th>
                  <th>BEST MATCH</th>
                  <th>SIMILARITY</th>
                  <th>RISK</th>
                  <th>DECISION</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.log_id}>
                    <td className="muted nowrap">
                      {dateTime(i.created_at)}
                      {i.is_sample && (
                        <small className="sample-tag">SAMPLE</small>
                      )}
                    </td>
                    <td className="mono">{i.detected_plate}</td>
                    <td className="mono muted">{i.matched_plate || "—"}</td>
                    <td>
                      <div className="score-cell">
                        {i.similarity_score.toFixed(1)}%
                        <span>
                          <i style={{ width: `${i.similarity_score}%` }} />
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={i.risk_level}>{i.risk_level}</Badge>
                    </td>
                    <td>
                      <Badge tone={i.decision}>{i.decision}</Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View incident ${i.detected_plate}`}
                        onClick={() => setSelected(i)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {count} incidents · Page {page + 1} of{" "}
            {Math.max(1, Math.ceil(count / 15))}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={(page + 1) * 15 >= count}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {selected && (
        <Modal title="Incident intelligence" onClose={() => setSelected(null)}>
          <IncidentDetail
            incident={selected}
            onUpdate={(i) => {
              setSelected(i);
              void load();
            }}
          />
        </Modal>
      )}
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/supabase";
import type { Day, Incident, Stats } from "../types";
export function useOverview() {
  const [stats, setStats] = useState<Stats | null>(null),
    [days, setDays] = useState<Day[]>([]),
    [incidents, setIncidents] = useState<Incident[]>([]),
    [error, setError] = useState(""),
    [updated, setUpdated] = useState<Date | null>(null);
  const load = useCallback(async () => {
    try {
      const [s, d, i] = await Promise.all([
        db().rpc("sentinel_dashboard_stats"),
        db().rpc("sentinel_daily_scans"),
        db()
          .from("incident_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      if (s.error || d.error || i.error) throw new Error();
      setStats(s.data as Stats);
      setDays(d.data as Day[]);
      setIncidents(i.data as Incident[]);
      setError("");
      setUpdated(new Date());
    } catch {
      setError(
        "Could not load live records. Check your connection and operator access.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);
  return { stats, days, incidents, error, updated, load };
}

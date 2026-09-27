import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Day, Incident, Stats } from "../types";
export function useOverview() {
  const [stats, setStats] = useState<Stats | null>(null),
    [days, setDays] = useState<Day[]>([]),
    [incidents, setIncidents] = useState<Incident[]>([]),
    [error, setError] = useState(""),
    [updated, setUpdated] = useState<Date | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await api<{ stats: Stats; days: Day[]; incidents: Incident[] }>("/overview");
      setStats(data.stats);
      setDays(data.days);
      setIncidents(data.incidents);
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

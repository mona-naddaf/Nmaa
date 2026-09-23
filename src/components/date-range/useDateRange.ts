"use client";

import { useCallback, useMemo, useState } from "react";

export type DateRangeTab = "last" | "range";
export type DateRangePreset = "all" | "4w" | "8w" | "custom";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * "Last session / cumulative range" filter state, shared by the leaderboard
 * and the parent view. `dates` is every YYYY-MM-DD that has data; "last"
 * means the most recent of those, and presets count back from it.
 */
export function useDateRange(dates: string[]) {
  const sorted = useMemo(() => [...new Set(dates)].sort(), [dates]);
  const firstDate = sorted[0];
  const lastDate = sorted[sorted.length - 1];

  const [tab, setTab] = useState<DateRangeTab>("last");
  const [preset, setPreset] = useState<DateRangePreset>("all");
  const [fromDate, setFromDateState] = useState(firstDate ?? "");
  const [toDate, setToDateState] = useState(lastDate ?? "");

  function applyPreset(p: DateRangePreset) {
    setPreset(p);
    if (!lastDate) return;
    if (p === "all") {
      setFromDateState(firstDate);
      setToDateState(lastDate);
    } else if (p === "4w") {
      setFromDateState(addDaysISO(lastDate, -28));
      setToDateState(lastDate);
    } else if (p === "8w") {
      setFromDateState(addDaysISO(lastDate, -56));
      setToDateState(lastDate);
    }
  }

  function setFromDate(value: string) {
    setFromDateState(value);
    setPreset("custom");
  }

  function setToDate(value: string) {
    setToDateState(value);
    setPreset("custom");
  }

  const matches = useCallback(
    (date: string) => (tab === "last" ? date === lastDate : date >= fromDate && date <= toDate),
    [tab, lastDate, fromDate, toDate],
  );

  return { tab, setTab, preset, applyPreset, fromDate, setFromDate, toDate, setToDate, lastDate, matches };
}

export type DateRangeState = ReturnType<typeof useDateRange>;

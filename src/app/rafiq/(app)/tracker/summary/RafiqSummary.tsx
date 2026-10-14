"use client";

import { useEffect, useState } from "react";
import hl from "@/components/home-log/home-log.module.css";
import { TrackerSummary } from "@/components/student-work/TrackerSummary";
import type { SummaryPayload } from "@/lib/tracker/summary-data";
import type { PeriodKind } from "@/lib/tracker/summary";
import type { GroupGender } from "@/lib/text/gender";
import { summaryAction } from "../actions";

/** Her own days are her browser's: its time zone goes with every request. */
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function RafiqSummary({ g }: { g: GroupGender }) {
  const [initial, setInitial] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    summaryAction("month", 0, zone()).then((r) => {
      if (!live) return;
      if ("error" in r) setError(r.error);
      else setInitial(r);
    });
    return () => {
      live = false;
    };
  }, []);
  if (error) return <div className={hl.err}>{error}</div>;
  if (!initial) return <div className={hl.empty}>…</div>;
  return <TrackerSummary initial={initial} groupGender={g} self load={(kind: PeriodKind, offset: number) => summaryAction(kind, offset, zone())} />;
}

"use client";

import { useEffect, useState } from "react";
import hl from "@/components/home-log/home-log.module.css";
import { TrackerSummary } from "@/components/student-work/TrackerSummary";
import type { SummaryPayload } from "@/lib/tracker/summary-data";
import type { PeriodKind } from "@/lib/tracker/summary";
import type { GroupGender } from "@/lib/text/gender";
import { summaryAction } from "../actions";
import Link from "next/link";
import { genderText } from "@/lib/guide/help/text";
import { EMPTY } from "@/lib/guide/lines-texts";
import { useGuide } from "../../GuideProvider";

/** Her own days are her browser's: its time zone goes with every request. */
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// subjectId: «العائلة», a child's summaries on an adult's page. With guidance
// on (her own page only), a period without items says so with a way back.
export function RafiqSummary({ g, subjectId }: { g: GroupGender; subjectId?: string }) {
  const guide = useGuide();
  const [initial, setInitial] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    summaryAction("month", 0, zone(), subjectId).then((r) => {
      if (!live) return;
      if ("error" in r) setError(r.error);
      else setInitial(r);
    });
    return () => {
      live = false;
    };
  }, [subjectId]);
  if (error) return <div className={hl.err}>{error}</div>;
  if (!initial) return <div className={hl.empty}>…</div>;
  const empty =
    guide.on && !subjectId ? (
      <div className={hl.empty}>
        {genderText(EMPTY.summary, g === "GIRLS" ? "FEMALE" : "MALE")}
        <div className={hl.actionsRow} style={{ justifyContent: "center" }}>
          <Link href="/rafiq/tracker" className={hl.linkBtn}>
            {EMPTY.summaryButton}
          </Link>
        </div>
      </div>
    ) : undefined;
  return (
    <TrackerSummary
      initial={initial}
      groupGender={g}
      self
      load={(kind: PeriodKind, offset: number) => summaryAction(kind, offset, zone(), subjectId)}
      live
      {...(empty ? { empty } : {})}
    />
  );
}

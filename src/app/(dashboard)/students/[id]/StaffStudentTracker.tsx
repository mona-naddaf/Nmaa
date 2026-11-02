"use client";

import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import { TrackerWeek } from "@/components/student-work/TrackerWeek";
import type { TrackerSheet } from "@/lib/tracker/data";
import type { Excuse } from "@/lib/excuse/rules";

// Staff view of one student's tracker: this week day by day and its summary
// (managing items and approvals is on /tracker). The page only renders it
// for staff allowed to see her.
export function StaffStudentTracker({ sheet, groupId, excuses, quiet }: { sheet: TrackerSheet; groupId: string; excuses?: Excuse[]; quiet?: string[] }) {
  return (
    <>
      {/* title and card come from the page's Collapsible */}
      <TrackerWeek sheet={sheet} excuses={excuses} quiet={quiet} />
      <Link href={`/tracker?group=${groupId}`} className={hl.linkBtn} style={{ display: "inline-block", marginTop: 10 }}>
        جدول المجموعة والبنود ←
      </Link>
    </>
  );
}

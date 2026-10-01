"use client";

import Link from "next/link";
import detail from "./detail.module.css";
import hl from "@/components/home-log/home-log.module.css";
import { TrackerWeek } from "@/components/student-work/TrackerWeek";
import type { TrackerSheet } from "@/lib/tracker/data";

// Staff view of one student's tracker: this week day by day and its summary
// (managing items and approvals is on /tracker). The page only renders it
// for staff allowed to see her.
export function StaffStudentTracker({ sheet, groupId }: { sheet: TrackerSheet; groupId: string }) {
  return (
    <>
      <div className={detail.secTitle}>
        <span className={detail.dot} /> ✅ جدول المتابعة
      </div>
      <div className={detail.card}>
        <TrackerWeek sheet={sheet} />
        <Link href={`/tracker?group=${groupId}`} className={hl.linkBtn} style={{ display: "inline-block", marginTop: 10 }}>
          جدول المجموعة والبنود ←
        </Link>
      </div>
    </>
  );
}

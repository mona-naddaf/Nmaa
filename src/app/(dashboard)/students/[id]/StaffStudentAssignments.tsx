"use client";

import Link from "next/link";
import detail from "./detail.module.css";
import hl from "@/components/home-log/home-log.module.css";
import { AssignmentList } from "@/components/student-work/AssignmentList";
import type { StudentAssignment } from "@/lib/assignments/data";
import type { GroupGender } from "@/lib/text/gender";

// Staff view of one student's assignments, read-only (managing them is on
// /assignments). The page only renders it for staff allowed to see her.
export function StaffStudentAssignments({ assignments, groupGender }: { assignments: StudentAssignment[]; groupGender: GroupGender }) {
  const open = assignments.filter((a) => !a.done).length;
  return (
    <>
      <div className={detail.secTitle}>
        <span className={detail.dot} /> 📝 الواجبات
        {assignments.length > 0 && (
          <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--ink-soft)", marginInlineStart: 8 }}>
            {open} مفتوحة · {assignments.length - open} منجزة
          </span>
        )}
      </div>
      <div className={detail.card}>
        <AssignmentList assignments={assignments} groupGender={groupGender} />
        <Link href="/assignments" className={hl.linkBtn} style={{ display: "inline-block", marginTop: 10 }}>
          إدارة الواجبات ←
        </Link>
      </div>
    </>
  );
}

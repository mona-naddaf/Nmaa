"use client";

import hl from "@/components/home-log/home-log.module.css";
import { AssignmentList } from "@/components/student-work/AssignmentList";
import type { StudentAssignment } from "@/lib/assignments/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { setAssignmentDoneAction } from "./actions";

export function StudentAssignments({
  assignments,
  groupGender: g,
  linkSegments,
}: {
  assignments: StudentAssignment[];
  groupGender: GroupGender;
  linkSegments: boolean;
}) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  return (
    <div>
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>📝 الواجبات</span>
      </div>
      <p className={hl.muted} style={{ margin: "0 4px 12px" }}>
        {p("اضغط", "اضغطي")} ✓ عندما {p("تنجز", "تنجزين")} الواجب، {p("ويمكنك", "ويمكنكِ")} إلغاء العلامة إن{" "}
        {p("ضغطتَها", "ضغطتِها")} خطأً.
      </p>
      <AssignmentList assignments={assignments} groupGender={g} onToggle={setAssignmentDoneAction} linkSegments={linkSegments} />
    </div>
  );
}

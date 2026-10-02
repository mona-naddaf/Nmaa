"use client";

import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import { AssignmentList } from "@/components/student-work/AssignmentList";
import type { StudentAssignment } from "@/lib/assignments/data";
import type { GroupGender } from "@/lib/text/gender";

// Staff view of one student's assignments, read-only (managing them is on
// /assignments). The page only renders it for staff allowed to see her.
// The title, card and «N مفتوحة · M منجزة» hint come from the page's Collapsible.
export function StaffStudentAssignments({ assignments, groupGender }: { assignments: StudentAssignment[]; groupGender: GroupGender }) {
  return (
    <>
      <AssignmentList assignments={assignments} groupGender={groupGender} />
      <Link href="/assignments" className={hl.linkBtn} style={{ display: "inline-block", marginTop: 10 }}>
        إدارة الواجبات ←
      </Link>
    </>
  );
}
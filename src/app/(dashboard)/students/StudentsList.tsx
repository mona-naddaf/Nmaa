"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./students.module.css";
import type { StudentSummary } from "@/lib/students/summary";
import {
  presentWord,
  absentWord,
  studentNoun,
  studentsNoun,
  studentNounDef,
  newAdj,
  pickByGroup,
  imperative,
  type GroupGender,
  type PersonGender,
} from "@/lib/text/gender";

const ATTENDANCE_CLASS: Record<string, string> = { IN: "present", OUT: "absent", PENDING: "pending" };

export function StudentsList({
  groups,
  students,
  canAddStudents,
  viewerGender,
}: {
  groups: { id: string; name: string; gender: GroupGender }[];
  students: StudentSummary[];
  canAddStudents: boolean;
  viewerGender: PersonGender;
}) {
  const [activeGroup, setActiveGroup] = useState(groups[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const activeGender: GroupGender = groups.find((g) => g.id === activeGroup)?.gender ?? "MIXED";

  const attendanceLabel = (status: string) =>
    status === "IN" ? presentWord(activeGender) : status === "OUT" ? absentWord(activeGender) : "قيد الانتظار";

  const filtered = useMemo(() => {
    const q = query.trim();
    return students.filter((s) => s.groupId === activeGroup && (!q || s.name.includes(q)));
  }, [students, activeGroup, query]);

  return (
    <div>
      {canAddStudents && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Link href="/students/new" className={styles.addBtn}>
            + إضافة {studentNoun(activeGender)} {newAdj(activeGender)}
          </Link>
        </div>
      )}

      <div className={styles.topRow}>
        <input
          className={styles.search}
          placeholder={`بحث باسم ${studentNounDef(activeGender)}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.tabs}>
        {groups.map((g) => (
          <div
            key={g.id}
            className={`${styles.tab} ${activeGroup === g.id ? styles.active : ""}`}
            onClick={() => setActiveGroup(g.id)}
          >
            {g.name}{" "}
            <span className={styles.count}>({students.filter((s) => s.groupId === g.id).length})</span>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>لا يوجد {studentsNoun(activeGender)} في هذه المجموعة بعد</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((s) => (
            <Link key={s.id} href={`/students/${s.id}`} className={styles.girlCard}>
              <div className={styles.gcTop}>
                <div className={styles.avatar}>{s.name.charAt(0)}</div>
                <div>
                  <div className={styles.gcName}>{s.name}</div>
                  <div className={styles.gcAge}>{s.age} سنوات</div>
                </div>
              </div>
              <div className={styles.gcPos}>
                آخر موقف: <b>{s.lastPositionText}</b>
              </div>
              <div className={styles.gcFoot}>
                <div className={styles.attendDot}>
                  <span className={`${styles.dot} ${styles[ATTENDANCE_CLASS[s.attendance]]}`} />
                  {attendanceLabel(s.attendance)}
                </div>
                <div className={styles.pointsBadge}>{s.cumPoints}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className={styles.note}>
        {imperative(viewerGender, { m: "اضغط", f: "اضغطي" })} على بطاقة أي {studentNoun(activeGender)} لفتح شاشة
        التسميع الخاصة {pickByGroup(activeGender, { m: "به", f: "بها" })}
      </div>
    </div>
  );
}

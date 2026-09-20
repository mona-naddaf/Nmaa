"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./students.module.css";
import type { StudentSummary } from "@/lib/students/summary";

const ATTENDANCE_LABEL: Record<string, string> = { IN: "حاضرة", OUT: "غائبة", PENDING: "قيد الانتظار" };
const ATTENDANCE_CLASS: Record<string, string> = { IN: "present", OUT: "absent", PENDING: "pending" };

export function StudentsList({
  groups,
  students,
}: {
  groups: { id: string; name: string }[];
  students: StudentSummary[];
}) {
  const [activeGroup, setActiveGroup] = useState(groups[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    return students.filter((s) => s.groupId === activeGroup && (!q || s.name.includes(q)));
  }, [students, activeGroup, query]);

  return (
    <div>
      <div className={styles.topRow}>
        <input
          className={styles.search}
          placeholder="بحث باسم الطالبة..."
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
        <div className={styles.empty}>لا توجد طالبات في هذه المجموعة بعد</div>
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
                  {ATTENDANCE_LABEL[s.attendance]}
                </div>
                <div className={styles.pointsBadge}>{s.cumPoints}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className={styles.note}>اضغطي على بطاقة أي طالبة لفتح شاشة التسميع الخاصة بها</div>
    </div>
  );
}

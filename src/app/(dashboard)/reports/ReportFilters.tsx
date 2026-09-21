"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import styles from "./reports.module.css";
import { studentNoun, studentNounDef, type GroupGender } from "@/lib/text/gender";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReportFilters({
  scope,
  groupId,
  studentId,
  from,
  to,
  courseCreatedAt,
  today,
  groups,
  students,
  scopeGender,
}: {
  scope: "course" | "group" | "student";
  groupId?: string;
  studentId?: string;
  from: string;
  to: string;
  courseCreatedAt: string;
  today: string;
  groups: { id: string; name: string }[];
  students: { id: string; name: string; groupId: string }[];
  scopeGender: GroupGender;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function setScope(next: "course" | "group" | "student") {
    if (next === "course") {
      update({ scope: undefined, groupId: undefined, studentId: undefined });
    } else if (next === "group") {
      update({ scope: "group", groupId: groups[0]?.id, studentId: undefined });
    } else {
      update({ scope: "student", studentId: students[0]?.id, groupId: undefined });
    }
  }

  function applyPreset(preset: "all" | "4w" | "8w") {
    if (preset === "all") update({ from: courseCreatedAt, to: today });
    else if (preset === "4w") update({ from: addDaysISO(today, -28), to: today });
    else update({ from: addDaysISO(today, -56), to: today });
  }

  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <div>
          <label className={styles.label}>النطاق</label>
          <div className={styles.pillGroup}>
            <div className={`${styles.pill} ${scope === "course" ? styles.sel : ""}`} onClick={() => setScope("course")}>
              الدورة كاملة
            </div>
            <div className={`${styles.pill} ${scope === "group" ? styles.sel : ""}`} onClick={() => setScope("group")}>
              مجموعة معيّنة
            </div>
            <div className={`${styles.pill} ${scope === "student" ? styles.sel : ""}`} onClick={() => setScope("student")}>
              {studentNoun(scopeGender)} معيّن{scopeGender === "GIRLS" ? "ة" : ""}
            </div>
          </div>
        </div>

        {scope === "group" && (
          <div>
            <label className={styles.label}>المجموعة</label>
            <select className={styles.select} value={groupId} onChange={(e) => update({ groupId: e.target.value })}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === "student" && (
          <div>
            <label className={styles.label}>{studentNounDef(scopeGender)}</label>
            <select className={styles.select} value={studentId} onChange={(e) => update({ studentId: e.target.value })}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={styles.row}>
        <div>
          <label className={styles.label}>فترة جاهزة</label>
          <div className={styles.pillGroup}>
            <div className={`${styles.pill} ${styles.presetPill}`} onClick={() => applyPreset("all")}>
              الدورة كاملة
            </div>
            <div className={`${styles.pill} ${styles.presetPill}`} onClick={() => applyPreset("4w")}>
              آخر 4 أسابيع
            </div>
            <div className={`${styles.pill} ${styles.presetPill}`} onClick={() => applyPreset("8w")}>
              آخر 8 أسابيع
            </div>
          </div>
        </div>
        <div>
          <label className={styles.label}>من تاريخ</label>
          <input
            className={styles.dateInput}
            type="date"
            max={today}
            value={from}
            onChange={(e) => update({ from: e.target.value })}
          />
        </div>
        <div>
          <label className={styles.label}>إلى تاريخ</label>
          <input
            className={styles.dateInput}
            type="date"
            max={today}
            value={to}
            onChange={(e) => update({ to: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

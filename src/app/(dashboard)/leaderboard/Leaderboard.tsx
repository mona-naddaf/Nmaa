"use client";

import { useMemo, useState } from "react";
import styles from "./leaderboard.module.css";
import type { LeaderboardStudent, DailyEntry } from "@/lib/leaderboard/data";
import { useDateRange } from "@/components/date-range/useDateRange";
import { DateRangeFilter } from "@/components/date-range/DateRangeFilter";

type SortBy = "pages" | "points";

export function Leaderboard({
  students,
  groups,
  dailyEntries,
}: {
  students: LeaderboardStudent[];
  groups: { id: string; name: string }[];
  dailyEntries: DailyEntry[];
}) {
  const range = useDateRange(useMemo(() => dailyEntries.map((e) => e.date), [dailyEntries]));
  const [sortBy, setSortBy] = useState<SortBy>("pages");
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set(groups.map((g) => g.id)));

  function toggleGroup(id: string) {
    setActiveGroups((prev) => {
      if (prev.has(id)) {
        if (prev.size === 1) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      return new Set(prev).add(id);
    });
  }

  const { matches } = range;
  const totals = useMemo(() => {
    const map = new Map<string, { pages: number; points: number }>();
    students.forEach((s) => map.set(s.id, { pages: 0, points: 0 }));

    dailyEntries.filter((e) => matches(e.date)).forEach((e) => {
      const t = map.get(e.studentId);
      if (t) {
        t.pages += e.pages;
        t.points += e.points;
      }
    });
    return map;
  }, [dailyEntries, matches, students]);

  const board = useMemo(() => {
    const list = students
      .filter((s) => activeGroups.has(s.groupId))
      .map((s) => {
        const t = totals.get(s.id)!;
        return { ...s, pages: Math.round(t.pages * 10) / 10, points: t.points };
      });
    list.sort((a, b) => (sortBy === "pages" ? b.pages - a.pages : b.points - a.points));
    return list;
  }, [students, activeGroups, totals, sortBy]);

  const isEmpty = board.every((g) => g.points === 0 && g.pages === 0);

  return (
    <div>
      <div className={styles.subtitle}>لوحة إنجاز جميع الطلاب — تظهر لكل المعلمين معًا</div>

      <DateRangeFilter range={range} />

      <div className={styles.sortRow}>
        <div className={styles.sortLabel}>المجموعات:</div>
        {groups.map((g) => (
          <div
            key={g.id}
            className={`${styles.sortPill} ${activeGroups.has(g.id) ? styles.groupPill + " " + styles.sel : ""}`}
            onClick={() => toggleGroup(g.id)}
          >
            {g.name}
          </div>
        ))}
      </div>

      <div className={styles.sortRow}>
        <div className={styles.sortLabel}>الترتيب حسب:</div>
        <div className={`${styles.sortPill} ${sortBy === "pages" ? styles.sel : ""}`} onClick={() => setSortBy("pages")}>
          الصفحات
        </div>
        <div className={`${styles.sortPill} ${sortBy === "points" ? styles.sel : ""}`} onClick={() => setSortBy("points")}>
          النقاط
        </div>
      </div>

      <div className={styles.board}>
        {isEmpty ? (
          <div className={styles.emptyMsg}>لا توجد بيانات مسجّلة ضمن هذه الفترة</div>
        ) : (
          board.map((s, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
            const rankClass = i < 3 ? `${styles.rank} ${styles[`medal${i + 1}`]}` : styles.rank;
            return (
              <div className={styles.boardRow} key={s.id}>
                <div className={rankClass}>{medal}</div>
                <div className={styles.bAvatar}>{s.name.charAt(0)}</div>
                <div className={styles.bInfo}>
                  <div className={styles.bName}>{s.name}</div>
                  <div className={styles.bGroup}>مجموعة {s.groupName}</div>
                </div>
                <div className={styles.bStats}>
                  <div className={`${styles.bStat} ${styles.sage}`}>
                    <div className={styles.num}>{s.pages}</div>
                    <div className={styles.lbl}>صفحة</div>
                  </div>
                  <div className={styles.bStat}>
                    <div className={styles.num}>{s.points}</div>
                    <div className={styles.lbl}>نقطة</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ fontSize: 11.5, color: "var(--ink-soft)", textAlign: "center", marginTop: 22 }}>
        التبويب &quot;آخر جلسة&quot; يعرض أحدث تاريخ تسجيل مسجّل لكل الطلاب؛ التبويب &quot;فترة تراكمية&quot; يمكن ضبطه على أي مدى
        تاريخ
      </div>
    </div>
  );
}

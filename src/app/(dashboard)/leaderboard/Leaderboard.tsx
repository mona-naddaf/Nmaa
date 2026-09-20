"use client";

import { useMemo, useState } from "react";
import styles from "./leaderboard.module.css";
import type { LeaderboardStudent, DailyEntry } from "@/lib/leaderboard/data";

type Tab = "last" | "range";
type SortBy = "pages" | "points";
type Preset = "all" | "4w" | "8w" | "custom";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function Leaderboard({
  students,
  groups,
  dailyEntries,
}: {
  students: LeaderboardStudent[];
  groups: { id: string; name: string }[];
  dailyEntries: DailyEntry[];
}) {
  const allDates = useMemo(() => [...new Set(dailyEntries.map((e) => e.date))].sort(), [dailyEntries]);
  const lastDate = allDates[allDates.length - 1];
  const firstDate = allDates[0];

  const [tab, setTab] = useState<Tab>("last");
  const [sortBy, setSortBy] = useState<SortBy>("pages");
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set(groups.map((g) => g.id)));
  const [preset, setPreset] = useState<Preset>("all");
  const [fromDate, setFromDate] = useState(firstDate ?? "");
  const [toDate, setToDate] = useState(lastDate ?? "");

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

  function applyPreset(p: Preset) {
    setPreset(p);
    if (!lastDate) return;
    if (p === "all") {
      setFromDate(firstDate);
      setToDate(lastDate);
    } else if (p === "4w") {
      setFromDate(addDaysISO(lastDate, -28));
      setToDate(lastDate);
    } else if (p === "8w") {
      setFromDate(addDaysISO(lastDate, -56));
      setToDate(lastDate);
    }
  }

  const totals = useMemo(() => {
    const map = new Map<string, { pages: number; points: number }>();
    students.forEach((s) => map.set(s.id, { pages: 0, points: 0 }));

    const matches =
      tab === "last"
        ? (e: DailyEntry) => e.date === lastDate
        : (e: DailyEntry) => e.date >= fromDate && e.date <= toDate;

    dailyEntries.filter(matches).forEach((e) => {
      const t = map.get(e.studentId);
      if (t) {
        t.pages += e.pages;
        t.points += e.points;
      }
    });
    return map;
  }, [dailyEntries, tab, lastDate, fromDate, toDate, students]);

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
      <div className={styles.subtitle}>لوحة إنجاز جميع الطالبات — تظهر لكل المعلمات معًا</div>

      <div className={styles.tabs}>
        <div className={`${styles.tab} ${tab === "last" ? styles.active : ""}`} onClick={() => setTab("last")}>
          آخر جلسة
        </div>
        <div className={`${styles.tab} ${tab === "range" ? styles.active : ""}`} onClick={() => setTab("range")}>
          فترة تراكمية
        </div>
      </div>

      {tab === "range" && (
        <div className={styles.filterCard}>
          <div className={styles.presetRow} style={{ marginBottom: 12 }}>
            {(
              [
                ["all", "الدورة كاملة"],
                ["4w", "آخر 4 أسابيع"],
                ["8w", "آخر 8 أسابيع"],
                ["custom", "تحديد يدوي"],
              ] as [Preset, string][]
            ).map(([key, label]) => (
              <div
                key={key}
                className={`${styles.presetPill} ${preset === key ? styles.sel : ""}`}
                onClick={() => applyPreset(key)}
              >
                {label}
              </div>
            ))}
          </div>
          <div className={styles.filterRow}>
            <div className={styles.filterField}>
              <label htmlFor="fromDate">من تاريخ</label>
              <input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPreset("custom");
                }}
              />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="toDate">إلى تاريخ</label>
              <input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPreset("custom");
                }}
              />
            </div>
          </div>
        </div>
      )}

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
        التبويب &quot;آخر جلسة&quot; يعرض أحدث تاريخ تسجيل مسجّل لكل الطالبات؛ التبويب &quot;فترة تراكمية&quot; يمكن ضبطه على أي مدى
        تاريخ
      </div>
    </div>
  );
}

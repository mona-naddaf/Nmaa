"use client";

import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import f from "@/app/rafiq/(app)/family/family.module.css";
import { AYAH_COUNT, SURAH_NAME, TOTAL_PAGES } from "@/lib/quran-data";
import { dayOfInstant, useToday } from "@/lib/calendar/useToday";
import { pastDayLabel } from "@/lib/calendar/hijri";
import { dayScore, lastSevenDays, WEEKDAY_SHORT, weekdayOf, withLocalDays } from "@/lib/tracker/rules";
import { commitStart, computeStreak, streakDaysText } from "@/lib/rafiq/streak";
import { computeGoal } from "@/lib/goals/goal";
import { GoalLine } from "@/components/goal/GoalLine";
import type { DashboardData, DashCard } from "@/lib/family/dashboard-build";
import { nextFamilyItem } from "@/lib/family/calendar-rules";
import type { FamilyCalendarData } from "@/lib/family/calendar";

// «عائلتي» (step 5): one card per child, then one per adult who shares —
// each showing only what it carries (src/lib/family/dashboard-build.ts).
// «Today» is the viewer's own day, here in her browser; each card also says
// when the last session was, so a day apart in another time zone never
// misleads.

type G = "MALE" | "FEMALE";
const by = (g: G, m: string, fem: string) => (g === "FEMALE" ? fem : m);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function FamilyDashboard({
  data,
  viewer,
  upcoming,
  calendarHref,
}: {
  data: DashboardData;
  viewer: "adult" | "child";
  // step 6: the family calendar, for the «القادم» line
  upcoming?: FamilyCalendarData;
  calendarHref?: string;
}) {
  const today = useToday();
  const childTitle = viewer === "adult" ? "الأطفال" : "إخوتك";
  const next = today && upcoming ? nextFamilyItem(today, upcoming.enabledOccasions, upcoming.adjustments, upcoming.events) : null;
  return (
    <>
      {/* the family calendar: its nearest item when one comes within 30 days, else just the link */}
      {calendarHref && (
        <Link href={calendarHref} className={hl.section} style={{ display: "block", textDecoration: "none", color: "var(--ink)", fontSize: 14 }}>
          {next ? (
            <>
              📅 القادم: <b>{next.title}</b> — {next.when} <span className={hl.muted}>· تقويم العائلة ←</span>
            </>
          ) : (
            "📅 تقويم العائلة ←"
          )}
        </Link>
      )}
      {data.children.length > 0 && (
        <div className={hl.section}>
          <div className={hl.sectionTitle} style={{ margin: "0 0 10px" }}>
            {childTitle}
          </div>
          <div className={f.cards}>
            {data.children.map((c) => (
              <Card key={c.key} card={c} today={today} />
            ))}
          </div>
        </div>
      )}
      <div className={hl.section}>
        <div className={hl.sectionTitle} style={{ margin: "0 0 10px" }}>
          ما يشاركه الكبار
        </div>
        {data.adults.length === 0 ? (
          <p className={hl.muted} style={{ margin: 0 }}>
            لا يشارك أحد من الكبار شيئًا بعد.
          </p>
        ) : (
          <div className={f.cards}>
            {data.adults.map((a) => (
              <Card key={a.key} card={a} today={today} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Card({ card: c, today }: { card: DashCard; today: string | null }) {
  const g = c.gender;
  return (
    <div className={f.card} style={{ cursor: "default" }}>
      <div className={f.rowHead}>
        <span className={f.cardTitle}>
          {c.name}
          {c.isMe && " (أنا)"}
        </span>
        {c.kind === "CHILD" && <span className={f.tag}>{by(g, "ولد", "بنت")}</span>}
        {c.href && (
          <Link href={c.href} className={hl.linkBtn}>
            {by(g, "صفحته", "صفحتها")} ←
          </Link>
        )}
      </div>
      {!today ? (
        // until her browser knows her day: the card's usual height, no flash of «…»
        <div aria-hidden style={{ minHeight: c.tracker ? (c.progress ? 96 : 44) : 44 }} />
      ) : (
        <>
          {c.progress && <Progress card={c} today={today} />}
          {c.tracker && <Tracker card={c} today={today} />}
        </>
      )}
    </div>
  );
}

/** The result for her today, or (a time zone further off) the nearest day's. */
function pickDay<T>(by: Record<string, T>, today: string): T | null {
  if (today in by) return by[today];
  const days = Object.keys(by).sort();
  if (days.length === 0) return null;
  return by[today < days[0] ? days[0] : days[days.length - 1]];
}

function Progress({ card: c, today }: { card: DashCard; today: string }) {
  const p = c.progress!;
  const g = c.gender;
  const recordedToday = p.loggedDays.includes(today);
  const last = p.loggedDays[p.loggedDays.length - 1] ?? null;
  // goalBy / streakBy («أيام العذر» on, a woman): worked out by the server for each day that may be today
  const goal = p.goalBy ? pickDay(p.goalBy, today) : p.goal ? computeGoal(p.goal.plan, p.goal.spec, p.goal.sessions, today) : null;
  const streak = p.streakBy
    ? pickDay(p.streakBy, today)
    : p.streak
      ? computeStreak(p.streak.schedule, new Set(p.streak.loggedDays), today, commitStart(p.streak.loggedDays, dayOfInstant(p.streak.createdAt, null)))
      : null;
  return (
    <div style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--ink)" }}>
      <div>
        📖{" "}
        {p.position
          ? `${SURAH_NAME[p.position.surahNumber]} — الآية ${p.position.ayah} من ${AYAH_COUNT[p.position.surahNumber]}`
          : `${by(g, "لم يبدأ", "لم تبدأ")} بعد${p.firstSurah ? ` — أول سورة: ${SURAH_NAME[p.firstSurah]}` : ""}`}
      </div>
      <div>
        {recordedToday ? `✓ ${by(g, "سجّل", "سجّلت")} اليوم` : `${by(g, "لم يسجّل", "لم تسجّل")} اليوم بعد`}
        {last && last < today && <span className={f.cardMeta}> · آخر جلسة: {pastDayLabel(last, today)}</span>}
      </div>
      {p.memorizedPages !== undefined && (
        <div className={f.cardMeta}>
          {round1(p.memorizedPages)} صفحة محفوظة · {Math.min(100, Math.round((p.memorizedPages / TOTAL_PAGES) * 1000) / 10)}٪ من القرآن
        </div>
      )}
      {streak && (
        <div className={f.cardMeta}>
          🔥 {streak.current === 0 ? "لا أيام التزام متتالية بعد" : `${streakDaysText(streak.current)} من الالتزام المتتالي`}
        </div>
      )}
      {goal && <GoalLine goal={goal} feminine={g === "FEMALE"} />}
    </div>
  );
}

/** Completion only: today's score with a bar, and the last 7 days' scores. */
function Tracker({ card: c, today }: { card: DashCard; today: string }) {
  const items = withLocalDays(c.tracker!.items, null);
  const scoreOn = (d: string) => dayScore(items, new Set(c.tracker!.checks[d] ?? []), d);
  const now = scoreOn(today);
  const pct = now.possible ? Math.round((now.earned / now.possible) * 100) : 0;
  return (
    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
      <div style={{ fontSize: 13, color: "var(--ink)" }}>
        🗓️ جدول اليوم: {now.possible ? `${now.earned} من ${now.possible} · ${pct}٪` : "لا بنود اليوم"}
      </div>
      {now.possible > 0 && (
        <div style={{ height: 6, borderRadius: 999, background: "var(--cream)", overflow: "hidden" }} aria-hidden>
          <div className={f.bar} style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
      )}
      {!c.tracker!.todayOnly && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} aria-label="آخر سبعة أيام">
          {lastSevenDays(today).map((d) => {
            const s = scoreOn(d);
            return (
              <span key={d} className={f.tag} title={d}>
                {WEEKDAY_SHORT[weekdayOf(d)]} {s.possible ? `${s.earned}/${s.possible}` : "—"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

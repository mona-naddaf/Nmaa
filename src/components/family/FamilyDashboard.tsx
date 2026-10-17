"use client";

import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import f from "@/app/rafiq/(app)/family/family.module.css";
import { AYAH_COUNT, SURAH_NAME, TOTAL_PAGES } from "@/lib/quran-data";
import { dayOfInstant, useToday } from "@/lib/calendar/useToday";
import { dayScore, lastSevenDays, WEEKDAY_SHORT, weekdayOf, withLocalDays } from "@/lib/tracker/rules";
import { commitStart, computeStreak, streakDaysText } from "@/lib/rafiq/streak";
import { computeGoal } from "@/lib/goals/goal";
import { GoalLine } from "@/components/goal/GoalLine";
import type { DashboardData, DashCard } from "@/lib/family/dashboard-build";

// «عائلتي» (step 5): one card per child, then one per adult who shares —
// each showing only what it carries (src/lib/family/dashboard-build.ts).
// «Today» is the viewer's own day, here in her browser; each card also says
// when the last session was, so a day apart in another time zone never
// misleads.

type G = "MALE" | "FEMALE";
const by = (g: G, m: string, fem: string) => (g === "FEMALE" ? fem : m);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function FamilyDashboard({ data, viewer }: { data: DashboardData; viewer: "adult" | "child" }) {
  const today = useToday();
  const childTitle = viewer === "adult" ? "الأطفال" : "إخوتك";
  return (
    <>
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
        <div className={f.cardMeta}>…</div>
      ) : (
        <>
          {c.progress && <Progress card={c} today={today} />}
          {c.tracker && <Tracker card={c} today={today} />}
        </>
      )}
    </div>
  );
}

function Progress({ card: c, today }: { card: DashCard; today: string }) {
  const p = c.progress!;
  const g = c.gender;
  const recordedToday = p.loggedDays.includes(today);
  const last = p.loggedDays[p.loggedDays.length - 1] ?? null;
  const goal = p.goal ? computeGoal(p.goal.plan, p.goal.spec, p.goal.sessions, today) : null;
  const streak = p.streak
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
        {last && last !== today && <span className={f.cardMeta}> · آخر جلسة: {last}</span>}
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
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--sage-deep)" }} />
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

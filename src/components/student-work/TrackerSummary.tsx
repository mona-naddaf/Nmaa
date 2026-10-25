"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./summary.module.css";
import { GoalLine } from "@/components/goal/GoalLine";
import { GREGORIAN_MONTHS, gregorianLabelWithWeekday } from "@/lib/calendar/hijri";
import { weekStart, weekdayOf, WEEKDAY_SHORT } from "@/lib/tracker/rules";
import { OFFSET_MIN, PERIOD_KINDS, PERIOD_LABEL, percentLabel, scheduledOn, type DayCell, type PeriodKind } from "@/lib/tracker/summary";
import type { SummaryPayload } from "@/lib/tracker/summary-data";
import { streakText } from "@/lib/students/streak";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { inertClass, inertProps } from "@/components/nudge/nudge";
import { useGuideTarget } from "@/components/guide/targets";

// «المحصّلات»: a period's commitment as a segmented ring (one segment per
// item, filled by its commitment) and a mosaic (one tile per day, shaded by
// that day's score; a completed day carries an eight-pointed star),
// achievements, and each item's commitment. Hand-built SVG, right to left.
// Shared by the student, her teacher, the parent and «رفيق الحفظ»; load()
// is the caller's own (permission-checked) server action.

const RING_COLORS = ["#3F6650", "#A85C36", "#7C4A42", "#4C7862", "#BD7A3E", "#8F5A50", "#9C9484"];
const TRACK = "#EDE7DA";

/** A tile's colour by that day's score (0–1). */
function tileFill(c: DayCell): string {
  if (c.state === "future") return "#FBF9F3";
  if (c.state === "neutral") return "#F5F2E8";
  const r = c.earned / c.possible;
  if (r >= 1) return "#3F6650";
  if (r >= 0.75) return "#6E9681";
  if (r >= 0.5) return "#A9C2B2";
  if (r >= 0.25) return "#DDBB9F";
  if (r > 0) return "#E9D3C4";
  return "#E6D2CE";
}

const LEGEND: [string, string][] = [
  ["#E6D2CE", "0٪"],
  ["#E9D3C4", "أقل من 25٪"],
  ["#DDBB9F", "25–49٪"],
  ["#A9C2B2", "50–74٪"],
  ["#6E9681", "75–99٪"],
  ["#3F6650", "يوم مكتمل ✦"],
];

export function TrackerSummary({
  initial,
  groupGender: g,
  self,
  load,
  live = false,
  empty,
}: {
  initial: SummaryPayload;
  groupGender: GroupGender;
  // the student (or Rafiq user) herself, rather than her teacher or parent
  self: boolean;
  load: (kind: PeriodKind, offset: number) => Promise<SummaryPayload | { error: string }>;
  // Rafiq and «العائلة» (unset: as before): the period arrows at the ends of
  // the range stay visible but inactive with a tooltip, and the item shown in
  // the ring is marked, with «يُعرض الآن: …» and «عرض الكل» above the ring
  live?: boolean;
  // Rafiq's guidance: shown instead when the period had no items (unset: as before)
  empty?: React.ReactNode;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const t = useGuideTarget();
  // live: an item picked in «الالتزام في كل بند» brings «يُعرض الآن» and the ring into view when they are off screen
  const showingRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState(0);
  useEffect(() => {
    const top = showingRef.current ?? heroRef.current;
    const ring = heroRef.current;
    if (!reveal || !top || !ring) return;
    if (top.getBoundingClientRect().top >= 0 && ring.getBoundingClientRect().bottom <= window.innerHeight) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    top.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [reveal]);
  const [pending, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const s = data.summary;

  function go(kind: PeriodKind, offset: number) {
    setError(null);
    startTransition(async () => {
      const r = await load(kind, offset);
      if ("error" in r) return setError(r.error);
      setData(r);
      setSelectedDay(null);
      setSelectedItem(null);
    });
  }

  const color = (id: string) => RING_COLORS[Math.max(0, s.items.findIndex((i) => i.id === id)) % RING_COLORS.length];
  const overall = s.overall;
  const cheer =
    overall === null
      ? null
      : overall >= 90
        ? self
          ? p("ما شاء الله! التزام رائع، استمرّ على ذلك.", "ما شاء الله! التزام رائع، استمرّي على ذلك.")
          : "ما شاء الله! التزام رائع."
        : overall >= 70
          ? self
            ? p("أحسنت، التزام جيد، وكل يوم مكتمل يقرّبك من هدفك.", "أحسنتِ، التزام جيد، وكل يوم مكتمل يقرّبكِ من هدفكِ.")
            : "التزام جيد."
          : overall >= 40
            ? "بداية طيبة، وكل يوم فرصة جديدة."
            : "كل يوم فرصة جديدة للبدء.";
  const diff = data.comparison?.startsWith("+") ? styles.up : data.comparison?.startsWith("−") ? styles.down : styles.same;
  const oldest = data.offset <= OFFSET_MIN;
  const current = data.offset >= 0;
  /** «→ السابق» / «التالي ←» at the end of the range: disabled, or (live) inactive with a tooltip. */
  const nav = (atEnd: boolean, why: string) => (live ? { ...inertProps(atEnd, why), disabled: pending } : { disabled: pending || atEnd });
  const navClass = (atEnd: boolean) => (live && atEnd ? `${styles.navBtn} ${inertClass}` : styles.navBtn);
  const shown = live ? (s.items.find((i) => i.id === selectedItem) ?? null) : null;

  return (
    <div className={`${styles.wrap} ${pending ? styles.loading : ""}`} aria-busy={pending}>
      <div className={styles.periods} role="tablist" aria-label="الفترة" {...t("summary.periods")}>
        {PERIOD_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={data.kind === k}
            className={`${styles.period} ${data.kind === k ? styles.sel : ""}`}
            onClick={() => data.kind !== k && go(k, 0)}
          >
            {PERIOD_LABEL[k]}
          </button>
        ))}
      </div>
      <div className={styles.nav} {...t("summary.nav")}>
        <button type="button" className={navClass(oldest)} {...nav(oldest, "لا توجد فترات أقدم")} onClick={() => !oldest && go(data.kind, data.offset - 1)}>
          → السابق
        </button>
        <div className={styles.navLabel}>{data.label}</div>
        <button type="button" className={navClass(current)} {...nav(current, "هذه الفترة الحالية")} onClick={() => !current && go(data.kind, data.offset + 1)}>
          التالي ←
        </button>
      </div>
      {error && <div className={hl.err}>{error}</div>}

      {shown && (
        <div className={styles.showing} role="status" ref={showingRef}>
          <span>
            يُعرض الآن: <b>{shown.title}</b>
          </span>
          <button type="button" className={styles.showAll} onClick={() => setSelectedItem(null)}>
            عرض الكل
          </button>
        </div>
      )}
      <div className={`${styles.card} ${styles.hero}`} ref={heroRef} {...t("summary.ring")}>
        <Ring items={s.items} overall={overall} selected={selectedItem} onSelect={setSelectedItem} color={color} />
        <div>
          {/* the percentage itself is in the ring's centre */}
          <div className={styles.bigLabel}>نسبة الالتزام في الفترة: {percentLabel(overall)}</div>
          {data.comparison && <span className={`${styles.chip} ${diff}`}>{data.comparison}</span>}
          {cheer && <div className={styles.cheer}>{cheer}</div>}
          <div className={styles.facts}>
            <span>
              أيام مكتملة: <b>{s.completeDays}</b> من <b>{s.scoredDays}</b>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.card} {...t("summary.mosaic")}>
        <Mosaic data={data} selected={selectedDay} onSelect={(d) => setSelectedDay(d === selectedDay ? null : d)} />
        <div className={styles.legend}>
          {LEGEND.map(([c, label]) => (
            <span key={c}>
              <i style={{ background: c }} />
              {label}
            </span>
          ))}
          <span>
            <i style={{ background: "#F5F2E8", border: "1px dashed #CFC6B4" }} />
            لا بنود
          </span>
        </div>
        {selectedDay && <DayDetails data={data} day={selectedDay} />}
      </div>

      <div className={styles.achieve} {...t("summary.stats")}>
        <Stat num={formatPages(data.achievements.pages)} label="صفحات الحفظ الجديد" />
        <Stat num={String(data.achievements.sessions)} label="جلسات التسميع" />
        <Stat num={String(s.bestRun)} label="أطول سلسلة أيام مكتملة" />
        {data.achievements.weeklyStreak !== null && <Stat num={`🔥 ${data.achievements.weeklyStreak}`} label={streakText(data.achievements.weeklyStreak)} />}
      </div>
      {data.achievements.goal && (
        <div className={styles.card}>
          <div className={styles.bigLabel} style={{ marginBottom: 6 }}>
            هدف الحفظ
          </div>
          <GoalLine goal={data.achievements.goal} feminine={g === "GIRLS"} />
        </div>
      )}

      <div className={styles.card} {...t("summary.items")}>
        <div className={styles.bigLabel} style={{ marginBottom: 6 }}>
          الالتزام في كل بند
        </div>
        {s.items.length === 0 && (empty ?? <div className={hl.empty}>لا بنود في هذه الفترة.</div>)}
        {s.items.map((i) => (
          <button
            key={i.id}
            type="button"
            className={`${styles.itemRow} ${selectedItem === i.id ? styles.selected : ""}${live && selectedItem === i.id ? ` ${styles.picked}` : ""}`}
            aria-pressed={selectedItem === i.id}
            onClick={() => {
              setSelectedItem(selectedItem === i.id ? null : i.id);
              if (live && selectedItem !== i.id) setReveal(Date.now());
            }}
          >
            <span className={styles.dot} style={{ background: color(i.id) }} />
            <span className={styles.itemTitle}>{i.title}</span>
            <span className={styles.itemPct}>{percentLabel(i.percent)}</span>
            <span className={styles.bar}>
              <div style={{ width: `${i.percent ?? 0}%`, background: color(i.id) }} />
            </span>
            <span className={styles.itemMeta}>
              {i.due ? `${i.done} من ${i.due} ${i.due === 1 ? "يوم" : i.due === 2 ? "يومين" : i.due <= 10 ? "أيام" : "يومًا"}` : "لم يحن موعده بعد"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatPages(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statNum}>{num}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

// ---------- the ring ----------

const R = 78;
const W = 20;
const C = 100;

const point = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};

/** An arc clockwise from `from` to `to` degrees (0 = top). Clockwise is right to left at the top, as Arabic reads. */
function arc(from: number, to: number): string {
  const [x0, y0] = point(from);
  const [x1, y1] = point(to);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function Ring({
  items,
  overall,
  selected,
  onSelect,
  color,
}: {
  items: { id: string; title: string; percent: number | null }[];
  overall: number | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  color: (id: string) => string;
}) {
  const n = items.length;
  const gap = n > 1 ? 3 : 0;
  const span = n ? 360 / n : 0;
  const sel = items.find((i) => i.id === selected) ?? null;
  return (
    <svg className={styles.ring} viewBox="0 0 200 200" role="img" aria-label={`نسبة الالتزام ${percentLabel(overall)}`}>
      {n === 0 && <circle cx={C} cy={C} r={R} fill="none" stroke={TRACK} strokeWidth={W} />}
      {items.map((it, i) => {
        const from = i * span + gap / 2;
        const to = Math.min(from + span - gap, from + 359.9);
        const fill = it.percent === null ? 0 : (to - from) * (it.percent / 100);
        const dim = selected !== null && selected !== it.id;
        return (
          <g
            key={it.id}
            className={styles.ringSeg}
            role="button"
            tabIndex={0}
            aria-label={`${it.title}: ${percentLabel(it.percent)}`}
            aria-pressed={selected === it.id}
            style={{ opacity: dim ? 0.35 : 1 }}
            onClick={() => onSelect(selected === it.id ? null : it.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(selected === it.id ? null : it.id))}
          >
            <path d={arc(from, to)} fill="none" stroke={TRACK} strokeWidth={selected === it.id ? W + 4 : W} />
            {fill > 0.2 && <path d={arc(from, from + fill)} fill="none" stroke={color(it.id)} strokeWidth={selected === it.id ? W + 4 : W} />}
          </g>
        );
      })}
      <text x={C} y={sel ? 98 : 106} textAnchor="middle" fontSize={sel ? 30 : 36} fontWeight={900} fill="#3F6650">
        {percentLabel(sel ? sel.percent : overall)}
      </text>
      <text x={C} y={sel ? 120 : 128} textAnchor="middle" fontSize={11} fontWeight={700} fill="#6C685D">
        {sel ? (sel.title.length > 18 ? sel.title.slice(0, 17) + "…" : sel.title) : "الالتزام"}
      </text>
    </svg>
  );
}

// ---------- the mosaic ----------

// one distinct letter per weekday (Sunday first), for the smaller mosaics
const WEEKDAY_LETTER = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

const CELL = 26;
const GAP = 4;
const HEAD = 14;

/** An octagon tile (cut corners), the motif of the mosaic. */
function octagon(x: number, y: number, s: number): string {
  const c = s * 0.26;
  return `M ${x + c} ${y} H ${x + s - c} L ${x + s} ${y + c} V ${y + s - c} L ${x + s - c} ${y + s} H ${x + c} L ${x} ${y + s - c} V ${y + c} Z`;
}

/** An eight-pointed star (two squares, one turned 45°), for a completed day. */
function star(cx: number, cy: number, r: number): string {
  const sq = (rot: number) =>
    [0, 1, 2, 3]
      .map((k) => {
        const a = ((rot + k * 90) * Math.PI) / 180;
        return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
      })
      .join(" L ");
  return `M ${sq(45)} Z M ${sq(0)} Z`;
}

function Mosaic({ data, selected, onSelect }: { data: SummaryPayload; selected: string | null; onSelect: (day: string) => void }) {
  const cells = data.summary.days;
  const byDay = new Map(cells.map((c) => [c.day, c]));
  // a week is one block; longer periods are one block per month
  const blocks: { title: string | null; days: string[] }[] = [];
  if (data.kind === "week") blocks.push({ title: null, days: cells.map((c) => c.day) });
  else {
    for (const c of cells) {
      const key = c.day.slice(0, 7);
      const last = blocks[blocks.length - 1];
      if (last && last.days[0].slice(0, 7) === key) last.days.push(c.day);
      else blocks.push({ title: GREGORIAN_MONTHS[Number(key.slice(5)) - 1], days: [c.day] });
    }
  }
  const one = blocks.length === 1;
  const showNumbers = data.kind === "week" || data.kind === "month";
  return (
    <div className={`${styles.mosaic} ${one ? styles.one : styles.many}`}>
      {blocks.map((b) => {
        const first = weekStart(b.days[0]);
        const rows = Math.floor((daysBetween(first, b.days[b.days.length - 1])) / 7) + 1;
        const width = 7 * CELL + 6 * GAP;
        const height = HEAD + rows * (CELL + GAP);
        return (
          <div key={b.days[0]}>
            {b.title && !one && <div className={styles.monthTitle}>{b.title}</div>}
            <svg className={styles.mosaicSvg} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={b.title ?? data.label}>
              {/* weekday heads, Sunday on the right */}
              {WEEKDAY_SHORT.map((w, i) => (
                <text key={w} className={styles.weekHead} x={(6 - i) * (CELL + GAP) + CELL / 2} y={10} textAnchor="middle">
                  {showNumbers ? w : WEEKDAY_LETTER[i]}
                </text>
              ))}
              {b.days.map((day) => {
                const c = byDay.get(day)!;
                const col = 6 - weekdayOf(day);
                const row = Math.floor(daysBetween(first, day) / 7);
                const x = col * (CELL + GAP);
                const y = HEAD + row * (CELL + GAP);
                const full = c.state === "scored" && c.earned >= c.possible;
                const pct = c.state === "scored" ? Math.round((c.earned / c.possible) * 100) : null;
                const label = `${gregorianLabelWithWeekday(day)}: ${c.state === "future" ? "يوم قادم" : c.state === "neutral" ? "لا بنود" : `${pct}٪`}${c.today ? " (اليوم)" : ""}`;
                return (
                  <g
                    key={day}
                    className={`${styles.tile} ${selected === day ? styles.selected : ""}`}
                    role="button"
                    tabIndex={c.state === "future" ? -1 : 0}
                    aria-label={label}
                    onClick={() => c.state !== "future" && onSelect(day)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && c.state !== "future" && (e.preventDefault(), onSelect(day))}
                  >
                    <path
                      d={octagon(x, y, CELL)}
                      fill={tileFill(c)}
                      stroke={c.today ? "#A85C36" : c.state === "neutral" ? "#CFC6B4" : "rgba(0,0,0,0.06)"}
                      strokeWidth={c.today ? 2 : 1}
                      strokeDasharray={c.state === "neutral" ? "3 2" : undefined}
                    >
                      <title>{label}</title>
                    </path>
                    {full && <path d={star(x + CELL / 2, y + CELL / 2, CELL * 0.3)} fill="none" stroke="#F5F2E8" strokeWidth={1.3} opacity={0.9} />}
                    {showNumbers && !full && (
                      <text x={x + CELL / 2} y={y + CELL / 2 + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={c.state === "scored" && (c.earned / c.possible) >= 0.75 ? "#fff" : "#6C685D"}>
                        {Number(day.slice(8))}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function DayDetails({ data, day }: { data: SummaryPayload; day: string }) {
  const cell = data.summary.days.find((c) => c.day === day);
  const ticked = new Set(data.checks[day] ?? []);
  const items = data.items.filter((i) => scheduledOn(i, day));
  return (
    <div className={styles.dayPanel} aria-live="polite">
      <div className={styles.dayTitle}>
        {gregorianLabelWithWeekday(day)}
        {cell && cell.state === "scored" && ` — ${cell.earned}/${cell.possible}`}
      </div>
      {items.length === 0 && <div className={hl.muted}>لا بنود في هذا اليوم.</div>}
      {items.map((i) => (
        <div key={i.id} className={styles.dayRow}>
          <span>{i.title}</span>
          {ticked.has(i.id) ? <span className={styles.ok}>✓</span> : <span className={styles.miss}>{day === data.today ? "لم يُعلَّم بعد" : "✗"}</span>}
        </div>
      ))}
    </div>
  );
}

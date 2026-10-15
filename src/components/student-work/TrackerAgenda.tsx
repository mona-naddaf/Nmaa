"use client";

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./agenda.module.css";
import work from "./work.module.css";
import { OrderList } from "./OrderList";
import { DayScoreBar, LastSevenDays, type TickInput } from "./TrackerDaySheet";
import { useTimeZone } from "@/lib/time/TimeZoneProvider";
import { ScheduleEditor, type ScheduleInput } from "./ScheduleEditor";
import { gregorianLabelWithWeekday } from "@/lib/calendar/hijri";
import { addDays, dayScore, shownOn, weekdayOf, withLocalDays } from "@/lib/tracker/rules";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import {
  DAY_MINUTES,
  POINT_MINUTES,
  clockLabel,
  layoutLanes,
  minutesLabel,
  nowAndNext,
  nowKey,
  cardEnd,
  timelineScale,
  timelineSegments,
  type AgendaTime,
} from "@/lib/tracker/agenda";
import { effectiveTiming, resolveTiming, scheduleLabel, timingLabelOn, type SlotRow, type Timing } from "@/lib/tracker/schedule";
import { PRAYERS, PRAYER_NAME, prayerMinutes, type Prayer, type PrayerLocation } from "@/lib/prayer/times";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

// «الجدول اليومي»: the «الآن» card, the items «بلا وقت» as a compact strip,
// today's timeline (a moving «now» line; overlapping items side by side;
// past midnight in a lighter shade; the day's prayer times as thin markers),
// the day's score and the last seven days, yesterday's items on demand, and
// editing an item's schedule (clock times or prayer anchors, per weekday).
// With it on, this is the only place to tick (the day sheet's tiles are not
// shown); points are never shown here. Shared by the course student (course
// time zone, TimeZoneProvider) and «رفيق الحفظ» (her browser's day).
// AgendaOrder is the «ترتيب البنود» view.

/** A schedule to save, or "STAFF" = back to staff's (course students only). */
export type ScheduleChoice = ScheduleInput | "STAFF";

/** An item placed on a day: its timing that weekday and, resolved, its time (null: «بلا وقت»). */
type Placed = TrackerItemView & { timing: Timing; time: AgendaTime | null; label: string; ownTiming: boolean };

type Result = Promise<{ error?: string }>;

const PX_PER_MIN = 1.1;
const FOLD_PX = 34;
// room above the first hour so its label isn't cut off
const TOP_PAD = 12;
const LABEL_W = 58;
const BLOCK_MIN_H = 40;
// the space kept between two cards that follow each other
const CARD_GAP = 3;

// the minute now, re-read every 30 seconds and when the tab comes back
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function useNow(tz: string | null): { day: string; min: number } | null {
  const snapshot = useCallback(() => nowKey(tz), [tz]);
  const key = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!key) return null;
  const [day, min] = key.split("|");
  return { day, min: Number(min) };
}

const endOf = (t: AgendaTime) => t.startMin + (t.durationMin ?? POINT_MINUTES);

/** An item on a day: its timing that weekday (her own rows first) and, resolved with that day's prayer times, its time. */
function placeOn(i: TrackerItemView, day: string, prayers: Record<Prayer, number> | null): Placed {
  const e = effectiveTiming(i.ownSlots ?? [], i.slots ?? [], weekdayOf(day));
  const time = resolveTiming(e.timing, prayers);
  return { ...i, timing: e.timing, time, label: timingLabelOn(e.timing, time), ownTiming: e.own };
}

export function TrackerAgenda({
  sheet,
  today,
  groupGender: g,
  course,
  onTick,
  onSchedule,
  onRemoveOwn,
  place,
  showYesterday = false,
}: {
  sheet: TrackerSheet;
  today: string;
  groupGender: GroupGender;
  // the header's «أمس» pill: yesterday's items, to tick what was missed
  showYesterday?: boolean;
  // a course student (staff's items, «وقت المعلم/ة», her own items); false = «رفيق الحفظ»
  course: boolean;
  onTick: (input: TickInput) => Result;
  onSchedule: (itemId: string, choice: ScheduleChoice) => Result;
  // a course student removing one of her own items (approved ones are archived)
  onRemoveOwn?: (itemId: string) => Result;
  // the place for prayer times (course's, or hers); null: anchors unavailable
  place: PrayerLocation | null;
}) {
  const tz = useTimeZone();
  const now = useNow(tz);
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const teacher = p("المعلم", "المعلمة");
  // optimistic ticks keyed "day|itemId", dropped once the server's sheet catches up
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!now) return <div className={hl.empty}>…</div>;

  const all = withLocalDays(sheet.items, tz);
  // today's (and yesterday's) prayer times, for anchors and the markers
  const yesterday = addDays(today, -1);
  const prayersToday = place ? prayerMinutes(place, today, tz) : null;
  const prayersYesterday = place ? prayerMinutes(place, yesterday, tz) : null;
  const items = all.filter((i) => shownOn(i, today)).map((i) => placeOn(i, today, prayersToday));
  const timed = items.filter((i): i is Placed & { time: AgendaTime } => !!i.time);
  const untimed = items.filter((i) => !i.time);
  // yesterday's items still running after midnight
  const carried = all
    .filter((i) => shownOn(i, yesterday))
    .map((i) => placeOn(i, yesterday, prayersYesterday))
    .filter((i): i is Placed & { time: AgendaTime } => !!i.time && endOf(i.time) > DAY_MINUTES)
    .map((i) => ({ ...i, time: { ...i.time, startMin: i.time.startMin - DAY_MINUTES } }));
  const nowMin = now.day === today ? now.min : null;
  const status = nowMin === null ? null : nowAndNext([...timed, ...carried], nowMin);

  const checkedOn = (d: string) => {
    const set = new Set(sheet.checks[d] ?? []);
    for (const [key, on] of Object.entries(override)) {
      const [kd, id] = key.split("|");
      if (kd !== d) continue;
      if (on) set.add(id);
      else set.delete(id);
    }
    return set;
  };
  const checkedSet = checkedOn(today);
  const checkedYesterday = checkedOn(yesterday);

  function run(fn: () => Result, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else after?.();
    });
  }

  function tick(item: TrackerItemView, day = today) {
    const key = `${day}|${item.id}`;
    const on = !checkedOn(day).has(item.id);
    setError(null);
    setOverride((prev) => ({ ...prev, [key]: on }));
    startTransition(async () => {
      const r = await onTick({ itemId: item.id, day, today, on });
      if (r.error) setError(r.error);
      setOverride((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  }

  const tickButton = (item: TrackerItemView) => {
    const on = checkedSet.has(item.id);
    return (
      <button
        type="button"
        className={`${styles.check} ${on ? styles.on : ""}`}
        aria-pressed={on}
        aria-label={on ? `إلغاء تعليم «${item.title}»` : `تعليم «${item.title}»`}
        onClick={() => tick(item)}
      >
        {on ? "✓" : ""}
      </button>
    );
  };

  const editButton = (item: TrackerItemView) => (
    <button type="button" className={styles.iconBtn} aria-label={`وقت «${item.title}»`} onClick={() => setEditing(editing === item.id ? null : item.id)}>
      ⏱
    </button>
  );

  const editingItem = editing ? (items.find((i) => i.id === editing) ?? null) : null;
  const yesterdayItems = all.filter((i) => shownOn(i, yesterday));

  return (
    <div>
      {status && (status.current.length > 0 || status.next) && (
        <div className={styles.nowCard} aria-live="polite">
          {status.current.length > 0 ? (
            <>
              <div className={styles.nowLabel}>الآن</div>
              <div className={styles.nowTitle}>{status.current.map((c) => c.title).join("، ")}</div>
              <div className={styles.nowMeta}>
                {status.current[0].time.durationMin ? `باقٍ ${minutesLabel(status.leftMin!)}` : `بدأ ${clockLabel(status.current[0].time.startMin)}`}
              </div>
            </>
          ) : (
            <>
              <div className={styles.nowLabel}>الآن</div>
              <div className={styles.nowTitle}>لا بند في هذا الوقت</div>
            </>
          )}
          {status.next && (
            <div className={styles.nowNext}>
              التالي: <b>{status.next.title}</b> — {clockLabel(status.next.time.startMin)} (بعد {minutesLabel(status.inMin!)})
            </div>
          )}
        </div>
      )}

      {/* yesterday: its items as the same compact strip, to tick what was missed */}
      {showYesterday && (
        <div className={styles.yesterday}>
          <div className={styles.yesterdayTitle}>أمس — {gregorianLabelWithWeekday(yesterday)}</div>
          {yesterdayItems.length === 0 ? (
            <div className={hl.muted}>لا بنود في هذا اليوم.</div>
          ) : (
            <ChipStrip items={yesterdayItems} checked={checkedYesterday} onTick={(i) => tick(i, yesterday)} />
          )}
          <DayScoreBar score={dayScore(all, checkedYesterday, yesterday)} yesterday groupGender={g} />
        </div>
      )}

      {/* the items with no time today: a compact strip above the timeline */}
      {untimed.length > 0 && <ChipStrip label="بلا وقت" items={untimed} checked={checkedSet} onTick={(i) => tick(i)} editButton={editButton} />}

      {editingItem && (
        <TimeEditor
          key={editingItem.id}
          item={editingItem}
          course={course}
          teacher={teacher}
          place={place}
          prayers={prayersToday}
          pending={pending}
          error={error}
          onCancel={() => setEditing(null)}
          onChoose={(choice) => run(() => onSchedule(editingItem.id, choice), () => setEditing(null))}
          onRemove={onRemoveOwn && editingItem.own ? () => run(() => onRemoveOwn(editingItem.id), () => setEditing(null)) : undefined}
        />
      )}

      {timed.length > 0 && (
        <Timeline items={timed} nowMin={nowMin} prayers={prayersToday} checked={checkedSet} tickButton={tickButton} editButton={editButton} />
      )}

      {items.length === 0 && <div className={hl.empty}>لا بنود لليوم.</div>}
      {error && !editing && (
        <div className={hl.err} role="alert" style={{ margin: "0 4px 10px" }}>
          {error}
        </div>
      )}

      <DayScoreBar score={dayScore(all, checkedSet, today)} groupGender={g} />
      <LastSevenDays items={all} checkedOn={checkedOn} today={today} />
    </div>
  );
}

/** Items as small wrapping chips: the circle and the name are one tap target that ticks it. */
function ChipStrip({
  label,
  items,
  checked,
  onTick,
  editButton,
}: {
  label?: string;
  items: (TrackerItemView & { timing?: Timing; label?: string })[];
  checked: Set<string>;
  onTick: (item: TrackerItemView) => void;
  editButton?: (item: TrackerItemView) => React.ReactNode;
}) {
  return (
    <div className={styles.chips}>
      {label && <span className={styles.chipsLabel}>{label}</span>}
      {items.map((item) => {
        const on = checked.has(item.id);
        return (
          <span key={item.id} className={`${styles.chip} ${on ? styles.on : ""}`}>
            <button
              type="button"
              className={styles.chipTick}
              aria-pressed={on}
              aria-label={on ? `إلغاء تعليم «${item.title}»` : `تعليم «${item.title}»`}
              onClick={() => onTick(item)}
            >
              <span className={styles.chipDot} aria-hidden>
                {on ? "✓" : ""}
              </span>
              <span className={styles.chipText}>
                {item.title}
                {item.own && item.status === "PENDING" && <small>بانتظار الاعتماد</small>}
                {/* an anchor that can't be placed: no city yet */}
                {item.timing?.kind === "PRAYER" && <small>{item.label} — يتاح بعد تحديد المدينة</small>}
              </span>
            </button>
            {editButton?.(item)}
          </span>
        );
      })}
    </div>
  );
}

/** «ترتيب البنود» (with «الجدول اليومي»): her order of the items, each with today's time as a note. */
export function AgendaOrder({
  sheet,
  today,
  groupGender: g,
  course,
  place,
  onReorder,
  onDone,
}: {
  sheet: TrackerSheet;
  today: string;
  groupGender: GroupGender;
  course: boolean;
  place: PrayerLocation | null;
  onReorder: (ids: string[]) => Result;
  onDone: () => void;
}) {
  const tz = useTimeZone();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prayers = place ? prayerMinutes(place, today, tz) : null;
  const orderable = withLocalDays(sheet.items, tz)
    .filter((i) => i.archivedDay === null && i.status !== "REJECTED")
    .map((i) => placeOn(i, today, prayers));

  if (orderable.length < 2) return <div className={hl.empty}>لا يوجد ما يُرتَّب؛ يلزم بندان على الأقل.</div>;
  return (
    <OrderList
      hint={`${p("اسحب", "اسحبي")} البند من المقبض ⠿ أو ${p("استخدم", "استخدمي")} السهمين ▲ ▼، ثم ${p("احفظ", "احفظي")} الترتيب.${course ? ` الترتيب لك وحدك، ولا يغيّر جدول ${p("المعلم", "المعلمة")}.` : ""}`}
      entries={orderable.map((i) => ({ id: i.id, title: i.title, note: i.label }))}
      pending={pending}
      error={error}
      onCancel={onDone}
      onSave={(ids) =>
        startTransition(async () => {
          setError(null);
          const r = await onReorder(ids);
          if (r.error) setError(r.error);
          else onDone();
        })
      }
    />
  );
}

function Timeline({
  items,
  nowMin,
  prayers,
  checked,
  tickButton,
  editButton,
}: {
  items: (Placed & { time: AgendaTime })[];
  nowMin: number | null;
  prayers: Record<Prayer, number> | null;
  checked: Set<string>;
  tickButton: (item: TrackerItemView) => React.ReactNode;
  editButton: (item: TrackerItemView) => React.ReactNode;
}) {
  // each card's natural height as rendered (title and time in full, at its
  // lane's width), measured after layout; the scale stretches to fit them
  const [natural, setNatural] = useState<Record<string, number>>({});
  const inner = useRef(new Map<string, HTMLDivElement>());
  const box = useRef<HTMLDivElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    let width = 0;
    // fires on first layout and whenever a card's content or the timeline's width changes
    const ro = new ResizeObserver(() => {
      const w = box.current?.clientWidth ?? 0;
      // a different width (rotation, resize) re-measures from scratch
      const widthChanged = width !== 0 && Math.abs(w - width) > 1;
      width = w;
      const measured: [string, number][] = [...inner.current].map(([id, el]) => [id, el.offsetHeight + 14 + CARD_GAP]); // + the card's padding and border
      setNatural((prev) => {
        const next = widthChanged ? {} : { ...prev };
        let changed = widthChanged;
        // heights only ever grow (until the width changes), so this settles
        for (const [id, need] of measured) {
          if (need > (next[id] ?? 0) + 0.5) {
            next[id] = need;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    observer.current = ro;
    if (box.current) ro.observe(box.current);
    for (const el of inner.current.values()) ro.observe(el);
    return () => {
      ro.disconnect();
      observer.current = null;
    };
  }, []);

  const segments = timelineSegments(items, nowMin);
  const fromMin = segments[0].fromMin;
  const toMin = segments[segments.length - 1].toMin;
  const scale = timelineScale(
    segments,
    items.map((i) => ({ startMin: i.time.startMin, endMin: cardEnd(i.time), minPx: Math.max(BLOCK_MIN_H + CARD_GAP, natural[i.id] ?? 0) })),
    PX_PER_MIN,
    FOLD_PX,
  );
  const y = (min: number) => TOP_PAD + scale(min);
  const height = y(toMin) + 10;
  // hour lines only where the timeline is to scale
  const hours: number[] = [];
  for (const seg of segments) {
    if (seg.folded) continue;
    for (let m = seg.fromMin; m <= seg.toMin; m += 60) if (!hours.includes(m)) hours.push(m);
  }
  const lanes = layoutLanes(items);

  return (
    <div ref={box} className={styles.timeline} style={{ height }}>
      {toMin > DAY_MINUTES && (
        <div className={styles.afterMidnight} style={{ top: y(DAY_MINUTES), height: y(toMin) - y(DAY_MINUTES) + 8 }}>
          <span className={styles.afterMidnightLabel}>بعد منتصف الليل</span>
        </div>
      )}
      {segments
        .filter((s) => s.folded)
        .map((s) => (
          <div key={`fold-${s.fromMin}`} className={styles.fold} style={{ top: y(s.fromMin), height: FOLD_PX }}>
            ⋯ {minutesLabel(s.toMin - s.fromMin)} بلا بنود
          </div>
        ))}
      {hours.map((m) => (
        <div key={m} className={styles.hourLine} style={{ top: y(m) }}>
          <span className={styles.hourLabel}>{clockLabel(m)}</span>
        </div>
      ))}
      {lanes.map(({ item, lane, lanes: n }) => {
        // exactly its own minutes on the (stretched) scale: cards meet only when their times overlap
        const top = y(item.time.startMin);
        const h = y(cardEnd(item.time)) - top - CARD_GAP;
        const running = nowMin !== null && item.time.startMin <= nowMin && nowMin < endOf(item.time);
        return (
          <div
            key={item.id}
            className={`${styles.block} ${checked.has(item.id) ? styles.done : ""} ${running ? styles.running : ""}`}
            style={{
              top,
              height: h,
              insetInlineStart: `calc(${LABEL_W}px + (100% - ${LABEL_W + 6}px) * ${lane / n})`,
              width: `calc((100% - ${LABEL_W + 6}px) / ${n} - 4px)`,
            }}
          >
            <div
              className={styles.blockInner}
              ref={(el) => {
                const old = inner.current.get(item.id);
                if (old && old !== el) observer.current?.unobserve(old);
                if (el) {
                  inner.current.set(item.id, el);
                  observer.current?.observe(el);
                } else inner.current.delete(item.id);
              }}
            >
              {tickButton(item)}
              {/* title and time on one line when they fit, wrapping (never cut) when not */}
              <div className={styles.blockBody}>
                <span className={styles.blockTitle}>{item.title}</span>
                <span className={styles.blockTime}>
                  {item.label}
                  {item.own && item.status === "PENDING" && " · بانتظار الاعتماد"}
                </span>
                {editButton(item)}
              </div>
            </div>
          </div>
        );
      })}
      {/* the day's prayer times, as thin markers (only within the timeline's span) */}
      {prayers &&
        PRAYERS.filter((p) => prayers[p] >= fromMin && prayers[p] <= toMin && !segments.some((s) => s.folded && prayers[p] > s.fromMin && prayers[p] < s.toMin)).map((p) => (
          <div key={p} className={styles.prayerLine} style={{ top: y(prayers[p]) }}>
            <span className={styles.prayerTag}>
              {PRAYER_NAME[p]} {clockLabel(prayers[p])}
            </span>
          </div>
        ))}
      {nowMin !== null && nowMin >= fromMin && nowMin <= toMin && (
        <div className={styles.nowLine} style={{ top: y(nowMin) }}>
          <span className={styles.nowDot} />
          <span className={styles.nowTag}>الآن {clockLabel(nowMin)}</span>
        </div>
      )}
    </div>
  );
}

function TimeEditor({
  item,
  course,
  teacher,
  place,
  prayers,
  pending,
  error,
  onCancel,
  onChoose,
  onRemove,
}: {
  item: Placed;
  course: boolean;
  teacher: string;
  place: PrayerLocation | null;
  prayers: Record<Prayer, number> | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onChoose: (choice: ScheduleChoice) => void;
  onRemove?: () => void;
}) {
  const staffItem = course && !item.own;
  const own = item.ownSlots ?? [];
  // a course student edits her own rows (starting from staff's, if she has
  // none yet); her own items and «رفيق الحفظ» items keep their rows in one place
  const start: SlotRow[] = course ? (own.length ? own : (item.slots ?? [])) : (item.slots ?? []);
  const [rows, setRows] = useState<ScheduleInput | null>(null);
  const [valid, setValid] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div className={styles.editor}>
      <div className={styles.editorTitle}>وقت «{item.title}»</div>
      {staffItem && (
        <div className={hl.muted} style={{ marginBottom: 8 }}>
          وقت {teacher}: {scheduleLabel(item.slots ?? [])}
          {own.length > 0 && " · الوقت الحالي من اختيارك"}
        </div>
      )}
      <ScheduleEditor
        rows={start}
        activeDays={item.days}
        anchors={place !== null}
        prayers={prayers}
        onChange={(r, ok) => {
          setRows(r);
          setValid(ok);
        }}
      />
      {error && <div className={hl.err}>{error}</div>}
      <div className={hl.actionsRow} style={{ marginTop: 10 }}>
        <button type="button" className={hl.primaryBtn} disabled={pending || !valid || rows === null} onClick={() => rows && onChoose(rows)}>
          {pending ? "جارٍ الحفظ…" : "حفظ الوقت"}
        </button>
        {staffItem && own.length > 0 && (
          <button type="button" className={hl.ghostBtn} disabled={pending} onClick={() => onChoose("STAFF")}>
            العودة إلى وقت {teacher}
          </button>
        )}
        <button type="button" className={hl.ghostBtn} disabled={pending} onClick={onCancel}>
          إلغاء
        </button>
      </div>
      {onRemove && (
        <div className={hl.actionsRow} style={{ marginTop: 10 }}>
          {confirmRemove ? (
            <>
              <span className={hl.muted} style={{ alignSelf: "center" }}>
                {item.status === "APPROVED" ? "يتوقف احتسابه من اليوم، وتبقى درجات الأيام السابقة. حذف البند؟" : "حذف هذا البند؟"}
              </span>
              <button type="button" className={work.dangerBtn} disabled={pending} onClick={onRemove}>
                نعم، حذف
              </button>
              <button type="button" className={hl.ghostBtn} onClick={() => setConfirmRemove(false)}>
                تراجع
              </button>
            </>
          ) : (
            <button type="button" className={work.dangerBtn} onClick={() => setConfirmRemove(true)}>
              حذف البند
            </button>
          )}
        </div>
      )}
    </div>
  );
}

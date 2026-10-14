"use client";

import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./agenda.module.css";
import work from "./work.module.css";
import { OrderList } from "./OrderList";
import type { TickInput } from "./TrackerDaySheet";
import { useTimeZone } from "@/lib/time/TimeZoneProvider";
import { addDays, shownOn, withLocalDays } from "@/lib/tracker/rules";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import {
  DAY_MINUTES,
  POINT_MINUTES,
  clockLabel,
  clockValue,
  shiftEnd,
  layoutLanes,
  minutesLabel,
  nowAndNext,
  nowKey,
  timeFromInputs,
  timeLabel,
  timelineSegments,
  timelineY,
  type AgendaTime,
} from "@/lib/tracker/agenda";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

// «الجدول اليومي»: the «الآن» card, today's timeline (a moving «now» line;
// overlapping items side by side; past midnight in a lighter shade), the
// items «بلا وقت», editing an item's time, and reordering. Shared by the
// course student (course time zone, TimeZoneProvider) and «رفيق الحفظ» (her
// browser's day). Ticking is the same as the day sheet: onTick, today only.

/** "STAFF" = back to staff's time (course students only). */
export type TimeChoice = AgendaTime | null | "STAFF";

type Result = Promise<{ error?: string }>;

const PX_PER_MIN = 1.1;
const FOLD_PX = 34;
// room above the first hour so its label isn't cut off
const TOP_PAD = 12;
const LABEL_W = 58;
const BLOCK_MIN_H = 40;

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

export function TrackerAgenda({
  sheet,
  today,
  groupGender: g,
  course,
  onTick,
  onTime,
  onReorder,
  onRemoveOwn,
}: {
  sheet: TrackerSheet;
  today: string;
  groupGender: GroupGender;
  // a course student (staff's items, «وقت المعلم/ة», her own items); false = «رفيق الحفظ»
  course: boolean;
  onTick: (input: TickInput) => Result;
  onTime: (itemId: string, choice: TimeChoice) => Result;
  onReorder: (ids: string[]) => Result;
  // a course student removing one of her own items (approved ones are archived)
  onRemoveOwn?: (itemId: string) => Result;
}) {
  const tz = useTimeZone();
  const now = useNow(tz);
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const teacher = p("المعلم", "المعلمة");
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!now) return <div className={hl.empty}>…</div>;

  const all = withLocalDays(sheet.items, tz);
  const items = all.filter((i) => shownOn(i, today));
  const timed = items.filter((i): i is TrackerItemView & { time: AgendaTime } => !!i.time);
  const untimed = items.filter((i) => !i.time);
  // yesterday's items still running after midnight
  const yesterday = addDays(today, -1);
  const carried = all
    .filter((i): i is TrackerItemView & { time: AgendaTime } => !!i.time && endOf(i.time) > DAY_MINUTES && shownOn(i, yesterday))
    .map((i) => ({ ...i, time: { ...i.time, startMin: i.time.startMin - DAY_MINUTES } }));
  const nowMin = now.day === today ? now.min : null;
  const status = nowMin === null ? null : nowAndNext([...timed, ...carried], nowMin);

  const checkedSet = new Set(sheet.checks[today] ?? []);
  for (const [id, on] of Object.entries(override)) {
    if (on) checkedSet.add(id);
    else checkedSet.delete(id);
  }

  function run(fn: () => Result, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else after?.();
    });
  }

  function tick(item: TrackerItemView) {
    const on = !checkedSet.has(item.id);
    setOverride((prev) => ({ ...prev, [item.id]: on }));
    run(
      () => onTick({ itemId: item.id, day: today, today, on }),
      () =>
        setOverride((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        }),
    );
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

  const editingItem = editing ? items.find((i) => i.id === editing) ?? all.find((i) => i.id === editing) ?? null : null;
  const orderable = all.filter((i) => i.archivedDay === null && i.status !== "REJECTED");

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

      <div className={styles.toolbar}>
        <span className={hl.sectionTitle} style={{ margin: 0 }}>
          <span style={{ fontSize: 16, color: "var(--ink)" }}>🗓️ جدول اليوم</span>
        </span>
        {!ordering && orderable.length > 1 && (
          <button type="button" className={hl.ghostBtn} onClick={() => setOrdering(true)}>
            ترتيب البنود
          </button>
        )}
      </div>

      {ordering && (
        <OrderList
          hint={`${p("اسحب", "اسحبي")} البند من المقبض ⠿ أو ${p("استخدم", "استخدمي")} السهمين ▲ ▼، ثم ${p("احفظ", "احفظي")} الترتيب.${course ? ` الترتيب لك وحدك، ولا يغيّر جدول ${teacher}.` : ""}`}
          entries={orderable.map((i) => ({ id: i.id, title: i.title, note: i.time ? timeLabel(i.time) : "بلا وقت" }))}
          pending={pending}
          error={error}
          onCancel={() => setOrdering(false)}
          onSave={(ids) => run(() => onReorder(ids), () => setOrdering(false))}
        />
      )}

      {editingItem && (
        <TimeEditor
          key={editingItem.id}
          item={editingItem}
          course={course}
          teacher={teacher}
          pending={pending}
          error={error}
          onCancel={() => setEditing(null)}
          onChoose={(choice) => run(() => onTime(editingItem.id, choice), () => setEditing(null))}
          onRemove={onRemoveOwn && editingItem.own ? () => run(() => onRemoveOwn(editingItem.id), () => setEditing(null)) : undefined}
        />
      )}

      {timed.length > 0 && <Timeline items={timed} nowMin={nowMin} checked={checkedSet} tickButton={tickButton} editButton={editButton} />}

      {untimed.length > 0 && (
        <>
          <div className={hl.sectionTitle} style={{ margin: "0 4px 8px" }}>
            بلا وقت
          </div>
          <div className={styles.untimed}>
            {untimed.map((item) => (
              <div key={item.id} className={styles.row}>
                {tickButton(item)}
                <span className={styles.rowTitle}>
                  {item.title}
                  {item.own && item.status === "PENDING" && <small>بانتظار الاعتماد</small>}
                </span>
                {editButton(item)}
              </div>
            ))}
          </div>
        </>
      )}

      {items.length === 0 && <div className={hl.empty}>لا بنود لليوم.</div>}
      {error && !editing && !ordering && (
        <div className={hl.err} role="alert" style={{ margin: "0 4px 10px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function Timeline({
  items,
  nowMin,
  checked,
  tickButton,
  editButton,
}: {
  items: (TrackerItemView & { time: AgendaTime })[];
  nowMin: number | null;
  checked: Set<string>;
  tickButton: (item: TrackerItemView) => React.ReactNode;
  editButton: (item: TrackerItemView) => React.ReactNode;
}) {
  const segments = timelineSegments(items, nowMin);
  const fromMin = segments[0].fromMin;
  const toMin = segments[segments.length - 1].toMin;
  const y = (min: number) => TOP_PAD + timelineY(segments, min, PX_PER_MIN, FOLD_PX);
  const height = y(toMin) + 10;
  // hour lines only where the timeline is to scale
  const hours: number[] = [];
  for (const seg of segments) {
    if (seg.folded) continue;
    for (let m = seg.fromMin; m <= seg.toMin; m += 60) if (!hours.includes(m)) hours.push(m);
  }
  const lanes = layoutLanes(items);

  return (
    <div className={styles.timeline} style={{ height }}>
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
        const top = y(item.time.startMin);
        const h = Math.max(BLOCK_MIN_H, (item.time.durationMin ?? POINT_MINUTES) * PX_PER_MIN - 3);
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
            {tickButton(item)}
            <div className={styles.blockBody}>
              <div className={styles.blockTitle}>{item.title}</div>
              <div className={styles.blockTime}>
                {timeLabel(item.time)}
                {item.own && item.status === "PENDING" && " · بانتظار الاعتماد"}
              </div>
            </div>
            {editButton(item)}
          </div>
        );
      })}
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
  pending,
  error,
  onCancel,
  onChoose,
  onRemove,
}: {
  item: TrackerItemView;
  course: boolean;
  teacher: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onChoose: (choice: TimeChoice) => void;
  onRemove?: () => void;
}) {
  const [start, setStart] = useState(item.time ? clockValue(item.time.startMin) : "");
  const [end, setEnd] = useState(item.time?.durationMin ? clockValue(item.time.startMin + item.time.durationMin) : "");
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const staffItem = course && !item.own;

  function save() {
    const t = timeFromInputs(start, end);
    if ("error" in t) return setProblem(t.error);
    setProblem(null);
    onChoose(t);
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorTitle}>وقت «{item.title}»</div>
      {staffItem && (
        <div className={hl.muted} style={{ marginBottom: 8 }}>
          وقت {teacher}: {item.staffTime ? timeLabel(item.staffTime) : "بلا وقت"}
          {item.ownTime && " · الوقت الحالي من اختيارك"}
        </div>
      )}
      <div className={styles.timeInputs}>
        <label>
          البداية
          <input
            type="time"
            value={start}
            onChange={(e) => {
              // the end moves with the start, keeping the duration
              setEnd(shiftEnd(start, end, e.target.value));
              setStart(e.target.value);
            }}
          />
        </label>
        <label>
          النهاية (اختياري)
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {(problem || error) && <div className={hl.err}>{problem ?? error}</div>}
      <div className={hl.actionsRow}>
        <button type="button" className={hl.primaryBtn} disabled={pending} onClick={save}>
          {pending ? "جارٍ الحفظ…" : "حفظ الوقت"}
        </button>
        {item.time && (
          <button type="button" className={hl.ghostBtn} disabled={pending} onClick={() => onChoose(null)}>
            بلا وقت
          </button>
        )}
        {staffItem && item.ownTime && (
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

"use client";

import { useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "@/components/student-work/work.module.css";
import { WeekdayPicker } from "@/components/student-work/TrackerControls";
import { TrackerDaySheet } from "@/components/student-work/TrackerDaySheet";
import { useToday } from "@/lib/calendar/useToday";
import { useTimeZone } from "@/lib/time/TimeZoneProvider";
import { daysBetween } from "@/lib/calendar/hijri";
import { EVERY_DAY, TRACKER_LIMITS, withLocalDays } from "@/lib/tracker/rules";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { AgendaOrder, TrackerAgenda } from "@/components/student-work/TrackerAgenda";
import { CompactRow, TrackerHeader, ViewBar, type MenuEntry } from "@/components/student-work/TrackerItems";
import itemStyles from "@/components/student-work/items.module.css";
import { scheduleLabel } from "@/lib/tracker/schedule";
import { TimeFields, useTimeFields } from "@/components/student-work/TimeFields";
import type { PrayerLocation } from "@/lib/prayer/times";
import {
  addOwnTrackerItemAction,
  deleteOwnTrackerItemAction,
  renameOwnTrackerItemAction,
  setMyItemScheduleAction,
  setMyOrderAction,
  setTrackerCheckAction,
} from "./actions";

export function StudentTracker({
  sheet,
  groupGender: g,
  agenda = false,
  summary = false,
  place = null,
}: {
  sheet: TrackerSheet;
  groupGender: GroupGender;
  agenda?: boolean;
  // «المحصّلات» (course setting): a link to her summaries
  summary?: boolean;
  // the course's place for prayer times (null: anchors unavailable)
  place?: PrayerLocation | null;
}) {
  const today = useToday();
  const tz = useTimeZone();
  const [view, setView] = useState<"day" | "items" | "order">("day");
  const [yesterday, setYesterday] = useState(false);
  if (!today) return <div className={hl.empty}>…</div>;

  // items exist from the course's day they were created (not the UTC one)
  const allItems = withLocalDays(sheet.items, tz);

  // D8: «لم يُعتمد» shows for a week after the decision, then disappears
  const recentlyRejected = (i: TrackerItemView) =>
    i.status === "REJECTED" && i.reviewedDay !== null && daysBetween(i.reviewedDay, today) <= TRACKER_LIMITS.rejectedShowDays;
  const current = allItems.filter((i) => i.archivedDay === null && (i.status !== "REJECTED" || (i.own && recentlyRejected(i))));
  const waiting = current.filter((i) => i.own && i.status !== "APPROVED");
  const orderable = current.filter((i) => i.status !== "REJECTED");

  const show = (v: typeof view) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };
  // ordering only matters with «الجدول اليومي»
  const menu: MenuEntry[] = [
    { label: "إدارة البنود", onSelect: () => show("items") },
    ...(agenda && orderable.length > 1 ? [{ label: "ترتيب البنود", onSelect: () => show("order") }] : []),
  ];

  return (
    <div>
      <TrackerHeader
        // «أمس» on the agenda; the tile sheet keeps its own today/yesterday tabs
        yesterday={yesterday}
        onYesterday={agenda && view === "day" ? () => setYesterday(!yesterday) : undefined}
        summaryHref={summary ? "/student/tracker/summary" : undefined}
        menu={menu}
      />

      {view === "items" && <ManageItems items={current} g={g} agenda={agenda} place={place} onBack={() => show("day")} />}

      {view === "order" && (
        <>
          <ViewBar title="ترتيب البنود" onBack={() => show("day")} />
          <AgendaOrder sheet={sheet} today={today} groupGender={g} course place={place} onReorder={setMyOrderAction} onDone={() => show("day")} />
        </>
      )}

      {view === "day" && (
        <>
          {waiting.length > 0 && <WaitingNotice items={waiting} g={g} onOpen={() => show("items")} />}
          {/* «الجدول اليومي» (course setting): the agenda is the only place to tick */}
          {agenda ? (
            <TrackerAgenda
              sheet={sheet}
              today={today}
              groupGender={g}
              course
              onTick={setTrackerCheckAction}
              onSchedule={setMyItemScheduleAction}
              place={place}
              onRemoveOwn={deleteOwnTrackerItemAction}
              showYesterday={yesterday}
            />
          ) : (
            <TrackerDaySheet sheet={sheet} groupGender={g} today={today} onTick={setTrackerCheckAction} />
          )}
        </>
      )}
    </div>
  );
}

// «بند خاص» / «بندان خاصّان» / «٣ بنود خاصة» / «١١ بندًا خاصًّا»
const ownCount = (n: number) => (n === 1 ? "بند خاص" : n === 2 ? "بندان خاصّان" : n <= 10 ? `${n} بنود خاصة` : `${n} بندًا خاصًّا`);

/** One line on the day view about her own items awaiting a decision (or not approved this week). */
function WaitingNotice({ items, g, onOpen }: { items: TrackerItemView[]; g: GroupGender; onOpen: () => void }) {
  const pending = items.filter((i) => i.status === "PENDING").length;
  const rejected = items.length - pending;
  const parts = [
    pending > 0 && `${ownCount(pending)} بانتظار الاعتماد`,
    rejected > 0 && (rejected === 1 ? "بند خاص لم يُعتمد" : rejected === 2 ? "بندان خاصّان لم يُعتمدا" : `${ownCount(rejected)} لم ${rejected <= 10 ? "تُعتمد" : "يُعتمد"}`),
  ].filter(Boolean);
  return (
    <div className={itemStyles.notice}>
      <span>
        {pickByGroup(g, { m: "لديك", f: "لديكِ" })} {parts.join("، و")}.
      </span>
      <button type="button" className={hl.linkBtn} onClick={onOpen}>
        عرض البنود ←
      </button>
    </div>
  );
}

/**
 * «إدارة البنود»: staff's items (read-only: points, days, time) and her own
 * ones (rename while awaiting approval, delete; approved ones are archived).
 */
function ManageItems({
  items,
  g,
  agenda,
  place,
  onBack,
}: {
  items: TrackerItemView[];
  g: GroupGender;
  agenda: boolean;
  place: PrayerLocation | null;
  onBack: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(EVERY_DAY);
  const time = useTimeFields([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else after?.();
    });
  }

  const staffItems = items.filter((i) => !i.own);
  const ownItems = items.filter((i) => i.own);
  // her time for it if she set one, else staff's
  const timeOf = (i: TrackerItemView) => (agenda ? scheduleLabel(i.ownSlots?.length ? i.ownSlots : (i.slots ?? [])) : undefined);

  return (
    <>
      <ViewBar title="إدارة البنود" onBack={onBack}>
        {!adding && (
          <button type="button" className={hl.primaryBtn} onClick={() => setAdding(true)}>
            + بند خاص
          </button>
        )}
      </ViewBar>
      {adding && (
        <form
          className={hl.section}
          onSubmit={(e) => {
            e.preventDefault();
            const t = agenda ? time.read() : { schedule: undefined };
            if ("error" in t) return setError(t.error);
            run(
              () => addOwnTrackerItemAction({ title, days, ...(agenda ? { schedule: t.schedule } : {}) }),
              () => {
                setAdding(false);
                setTitle("");
                setDays(EVERY_DAY);
                time.reset();
              },
            );
          }}
        >
          <div className={styles.field}>
            <label htmlFor="own-title">اسم البند</label>
            <input
              id="own-title"
              className={styles.input}
              value={title}
              maxLength={TRACKER_LIMITS.titleMax}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: قراءة صفحة من كتاب"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>الأيام</span>
            <WeekdayPicker days={days} onChange={setDays} />
          </div>
          {agenda && <TimeFields fields={time} days={days} place={place} />}
          <div className={styles.hint} style={{ marginBottom: 8 }}>
            {p("يعتمده المعلم ويحدّد درجته، ويمكنك تعليمه قبل ذلك لكنه لا يُحتسب حتى يُعتمد.", "تعتمده المعلمة وتحدّد درجته، ويمكنكِ تعليمه قبل ذلك لكنه لا يُحتسب حتى يُعتمد.")}
          </div>
          {error && <div className={hl.err}>{error}</div>}
          <div className={hl.actionsRow}>
            <button type="submit" className={hl.primaryBtn} disabled={pending}>
              {pending ? "جارٍ الإرسال…" : "إرسال للاعتماد"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setAdding(false)} disabled={pending}>
              إلغاء
            </button>
          </div>
        </form>
      )}
      {error && !adding && (
        <div className={hl.err} role="alert" style={{ margin: "0 4px 10px" }}>
          {error}
        </div>
      )}

      <div className={hl.sectionTitle}>بنود {p("المعلم", "المعلمة")}</div>
      <div className={hl.section}>
        {staffItems.length === 0 ? (
          <div className={hl.empty}>لا بنود بعد.</div>
        ) : (
          staffItems.map((i) => <CompactRow key={i.id} title={i.title} points={i.value} days={i.days} time={timeOf(i)} />)
        )}
      </div>

      <div className={hl.sectionTitle}>بنودي الخاصة</div>
      <div className={hl.section}>
        {ownItems.length === 0 ? (
          <div className={hl.empty}>{p("لم تُضف", "لم تُضيفي")} بنودًا خاصة بعد.</div>
        ) : (
          ownItems.map((i) => <OwnRow key={i.id} item={i} time={timeOf(i)} run={run} pending={pending} />)
        )}
      </div>
    </>
  );
}

function OwnRow({
  item,
  time,
  run,
  pending,
}: {
  item: TrackerItemView;
  time?: string;
  run: (fn: () => Promise<{ error?: string }>, after?: () => void) => void;
  pending: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [title, setTitle] = useState(item.title);
  const toggle = (m: typeof mode) => setMode(mode === m ? "view" : m);
  const waiting = item.status === "PENDING";
  const approved = item.status === "APPROVED";

  return (
    <CompactRow
      title={item.title}
      status={approved ? undefined : waiting ? "بانتظار الاعتماد" : "لم يُعتمد"}
      points={item.value}
      days={item.days}
      time={time}
      muted={item.status === "REJECTED"}
      // the name can change only while it awaits approval
      onEdit={waiting ? () => toggle("edit") : undefined}
      editLabel="تعديل الاسم"
      onDelete={() => toggle("delete")}
    >
      {mode === "edit" && (
        <div className={itemStyles.confirm}>
          <input className={styles.input} style={{ flex: "1 1 200px" }} value={title} maxLength={TRACKER_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} aria-label="اسم البند" autoFocus />
          <button type="button" className={hl.primaryBtn} disabled={pending} onClick={() => run(() => renameOwnTrackerItemAction(item.id, title), () => setMode("view"))}>
            حفظ
          </button>
          <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
            إلغاء
          </button>
        </div>
      )}
      {mode === "delete" && (
        <div className={itemStyles.confirm}>
          <span>{approved ? "يتوقف احتسابه من اليوم، وتبقى درجات الأيام السابقة. حذف البند؟" : "حذف هذا البند؟"}</span>
          <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => deleteOwnTrackerItemAction(item.id))}>
            نعم، حذف
          </button>
          <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
            تراجع
          </button>
        </div>
      )}
    </CompactRow>
  );
}

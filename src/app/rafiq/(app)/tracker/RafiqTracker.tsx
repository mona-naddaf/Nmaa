"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import styles from "@/components/student-work/work.module.css";
import { TrackerDaySheet } from "@/components/student-work/TrackerDaySheet";
import { ValuePicker, WeekdayPicker } from "@/components/student-work/TrackerControls";
import { useToday } from "@/lib/calendar/useToday";
import { daysLabel, EVERY_DAY, TRACKER_LIMITS } from "@/lib/tracker/rules";
import type { RafiqTrackerData } from "@/lib/rafiq/tracker";
import { RAFIQ_TRACKER_MAX_ITEMS } from "@/lib/rafiq/rules";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { addItemAction, removeItemAction, reorderItemsAction, setCheckAction, setItemScheduleAction, updateItemAction } from "./actions";
import { AgendaOrder, TrackerAgenda } from "@/components/student-work/TrackerAgenda";
import { CompactRow, TrackerHeader, ViewBar, type MenuEntry } from "@/components/student-work/TrackerItems";
import itemStyles from "@/components/student-work/items.module.css";
import { TimeFields, useTimeFields } from "@/components/student-work/TimeFields";
import { scheduleLabel, type SlotRow } from "@/lib/tracker/schedule";
import type { ScheduleInput } from "@/components/student-work/ScheduleEditor";
import type { PrayerLocation } from "@/lib/prayer/times";
import { publishTemplateAction } from "../templates/actions";
import { TEMPLATE_LIMITS } from "@/lib/rafiq/template-rules";

type Item = RafiqTrackerData["active"][number];
type Run = (fn: () => Promise<{ error?: string }>, after?: () => void) => void;

// Her «جدول المتابعة»: the shared today/yesterday sheet, or with «الجدول
// اليومي» on (her settings) today's agenda instead, the only place to tick
// then. Her own items (she creates and edits them herself, no approval) are
// managed from the «⚙ البنود» menu: «إدارة البنود» (with publishing to the
// bank), «ترتيب البنود» (agenda only) and the link to «بنك الجداول».
export function RafiqTracker({
  data,
  g,
  agenda = false,
  summary = false,
  place = null,
}: {
  data: RafiqTrackerData;
  g: GroupGender;
  agenda?: boolean;
  // «المحصّلات» (her setting): a link to her summaries
  summary?: boolean;
  // her place for prayer times (null: anchors unavailable)
  place?: PrayerLocation | null;
}) {
  const today = useToday();
  const router = useRouter();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [view, setView] = useState<"day" | "items" | "order">("day");
  const [yesterday, setYesterday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const run: Run = (fn, after) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) return setError(r.error);
      after?.();
      router.refresh();
    });
  };

  if (!today) return <div className={hl.empty}>…</div>;
  const full = data.active.length >= RAFIQ_TRACKER_MAX_ITEMS;
  const empty = data.active.length === 0 && data.sheet.items.length === 0;
  const show = (v: typeof view) => {
    setView(v);
    setAdding(false);
    setError(null);
    window.scrollTo({ top: 0 });
  };

  // the bank is open to every «رفيق الحفظ» user; ordering only matters with «الجدول اليومي»
  const menu: MenuEntry[] = [
    { label: "إدارة البنود", onSelect: () => show("items") },
    ...(agenda && data.active.length > 1 ? [{ label: "ترتيب البنود", onSelect: () => show("order") }] : []),
    { label: "بنك الجداول", href: "/rafiq/templates" },
  ];

  return (
    <div>
      <TrackerHeader
        // «أمس» on the agenda; the tile sheet keeps its own today/yesterday tabs
        yesterday={yesterday}
        onYesterday={agenda && view === "day" && !empty ? () => setYesterday(!yesterday) : undefined}
        summaryHref={summary ? "/rafiq/tracker/summary" : undefined}
        menu={menu}
      />

      {view === "items" && (
        <>
          <ViewBar title="إدارة البنود" onBack={() => show("day")}>
            {!adding && (
              <button type="button" className={hl.primaryBtn} onClick={() => setAdding(true)} disabled={full}>
                + بند جديد
              </button>
            )}
          </ViewBar>
          {full && <div className={hl.err} style={{ margin: "0 4px 10px" }}>يضم الجدول {RAFIQ_TRACKER_MAX_ITEMS} بندًا، وهو الحدّ الأقصى.</div>}
          {adding && (
            <ItemForm
              submitLabel="إضافة البند"
              agenda={agenda}
              place={place}
              pending={pending}
              onCancel={() => setAdding(false)}
              onSubmit={(fields) => run(() => addItemAction(fields), () => setAdding(false))}
            />
          )}
          {error && (
            <div className={hl.err} role="alert" style={{ margin: "0 4px 10px" }}>
              {error}
            </div>
          )}
          <div className={hl.section}>
            {data.active.length === 0 ? (
              <div className={hl.empty}>لا بنود بعد.</div>
            ) : (
              data.active.map((item) => <ItemRow key={item.id} item={item} run={run} pending={pending} agenda={agenda} place={place} />)
            )}
          </div>
          {data.active.length > 0 && <Publish items={data.active} p={p} agenda={agenda} />}
        </>
      )}

      {view === "order" && (
        <>
          <ViewBar title="ترتيب البنود" onBack={() => show("day")} />
          <AgendaOrder sheet={data.sheet} today={today} groupGender={g} course={false} place={place} onReorder={reorderItemsAction} onDone={() => show("day")} />
        </>
      )}

      {view === "day" &&
        (empty ? (
          <div className={hl.section}>
            <div className={hl.empty}>
              {p("أضف", "أضيفي")} بنودًا يومية {p("تتابعها", "تتابعينها")} بنفسك (مثل: ورد المراجعة، أذكار الصباح)، لكل بند درجته
              وأيامه.
            </div>
            <div className={hl.actionsRow} style={{ justifyContent: "center" }}>
              <button type="button" className={hl.ghostBtn} onClick={() => show("items")}>
                إدارة البنود
              </button>
            </div>
          </div>
        ) : agenda ? (
          // «الجدول اليومي»: the timeline is the only place to tick
          <TrackerAgenda sheet={data.sheet} today={today} groupGender={g} course={false} onTick={setCheckAction} onSchedule={setItemScheduleAction} place={place} showYesterday={yesterday} />
        ) : (
          <TrackerDaySheet sheet={data.sheet} groupGender={g} today={today} onTick={setCheckAction} />
        ))}
    </div>
  );
}

/** Shares a snapshot of some of her items in the template bank. */
function Publish({ items, p, agenda }: { items: Item[]; p: (m: string, f: string) => string; agenda: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // what she unticked; every other current item (including ones added later) is included
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const chosen = new Set(items.filter((i) => !excluded.has(i.id)).map((i) => i.id));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function publish() {
    setMsg(null);
    startTransition(async () => {
      const r = await publishTemplateAction({ title, description, itemIds: items.filter((i) => chosen.has(i.id)).map((i) => i.id) });
      if (r.error) return setMsg({ ok: false, text: r.error });
      setOpen(false);
      setTitle("");
      setDescription("");
      setMsg({ ok: true, text: "تم نشر الجدول في البنك ✓" });
    });
  }

  return (
    <>
      <div className={hl.sectionTitle}>
        <span>مشاركة جدولي</span>
        {!open && (
          <button type="button" className={hl.ghostBtn} onClick={() => setOpen(true)}>
            نشر في بنك الجداول
          </button>
        )}
      </div>
      {msg && !open && (
        <div className={msg.ok ? hl.ok : hl.err} style={{ margin: "0 4px 10px" }}>
          {msg.text} {msg.ok && <Link href="/rafiq/templates">عرض البنك</Link>}
        </div>
      )}
      {open && (
        <div className={hl.section}>
          <p className={hl.muted} style={{ marginTop: 0 }}>
            يُنشر ما {p("تختاره", "تختارينه")} من بنودك بعنوانه ودرجاته وأيامه{agenda && " وترتيبه ووقته"}، دون اسمك. ما {p("تعدّله", "تعدّلينه")} في جدولك بعد النشر لا
            يغيّر الجدول المنشور.
          </p>
          <div className={styles.field}>
            <label htmlFor="tpl-title">عنوان الجدول</label>
            <input id="tpl-title" className={styles.input} value={title} maxLength={TEMPLATE_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: جدول المراجعة اليومية" />
          </div>
          <div className={styles.field}>
            <label htmlFor="tpl-desc">وصف (اختياري)</label>
            <textarea id="tpl-desc" className={styles.input} value={description} maxLength={TEMPLATE_LIMITS.descriptionMax} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>البنود</span>
            {items.map((i) => (
              <label key={i.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, margin: "4px 0" }}>
                <input type="checkbox" checked={chosen.has(i.id)} onChange={() => toggle(i.id)} />
                {i.title} <span className={hl.muted}>({daysLabel(i.days)})</span>
              </label>
            ))}
          </div>
          {msg && !msg.ok && <div className={hl.err}>{msg.text}</div>}
          <div className={hl.actionsRow}>
            <button type="button" className={hl.primaryBtn} onClick={publish} disabled={pending || chosen.size === 0}>
              {pending ? "جارٍ النشر…" : "نشر"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </>
  );
}

type ItemFields = { title: string; value: number; days: number; schedule?: ScheduleInput };

function ItemForm({
  initial = { title: "", value: 1, days: EVERY_DAY, slots: [] },
  submitLabel,
  agenda = false,
  place = null,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; value: number; days: number; slots: SlotRow[] };
  submitLabel: string;
  // «الجدول اليومي» on: the item's schedule too
  agenda?: boolean;
  place?: PrayerLocation | null;
  pending: boolean;
  onSubmit: (fields: ItemFields) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [value, setValue] = useState(initial.value);
  const [days, setDays] = useState(initial.days);
  const time = useTimeFields(initial.slots);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className={hl.section}
      onSubmit={(e) => {
        e.preventDefault();
        if (!agenda) return onSubmit({ title, value, days });
        const t = time.read();
        if ("error" in t) return setProblem(t.error);
        setProblem(null);
        onSubmit({ title, value, days, schedule: t.schedule });
      }}
    >
      <div className={styles.field}>
        <label htmlFor="item-title">اسم البند</label>
        <input
          id="item-title"
          className={styles.input}
          value={title}
          maxLength={TRACKER_LIMITS.titleMax}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: ورد المراجعة اليومي"
          autoFocus
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>الدرجة</span>
        <ValuePicker value={value} onChange={setValue} />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>الأيام</span>
        <WeekdayPicker days={days} onChange={setDays} />
      </div>
      {agenda && <TimeFields fields={time} days={days} place={place} />}
      {problem && <div className={hl.err}>{problem}</div>}
      <div className={hl.actionsRow}>
        <button type="submit" className={hl.primaryBtn} disabled={pending}>
          {pending ? "جارٍ الحفظ…" : submitLabel}
        </button>
        <button type="button" className={hl.ghostBtn} onClick={onCancel} disabled={pending}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

function ItemRow({ item, run, pending, agenda, place }: { item: Item; run: Run; pending: boolean; agenda: boolean; place: PrayerLocation | null }) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const toggle = (m: typeof mode) => setMode(mode === m ? "view" : m);
  return (
    <CompactRow
      title={item.title}
      points={item.value}
      days={item.days}
      time={agenda ? scheduleLabel(item.slots) : undefined}
      onEdit={() => toggle("edit")}
      onDelete={() => toggle("remove")}
    >
      {mode === "edit" && (
        <div className={itemStyles.rowPanel}>
          <ItemForm
            initial={item}
            agenda={agenda}
            place={place}
            submitLabel="حفظ"
            pending={pending}
            onCancel={() => setMode("view")}
            onSubmit={(fields) => run(() => updateItemAction(item.id, fields), () => setMode("view"))}
          />
        </div>
      )}
      {mode === "remove" && (
        <div className={itemStyles.confirm}>
          <span>حذف هذا البند؟ تبقى درجاته في الأيام السابقة.</span>
          <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => removeItemAction(item.id))}>
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

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { scopeCan, SELF_SCOPE, type RafiqScope } from "@/lib/rafiq/scope";
import { addItemToChildrenAction, copyTrackerAction, type CopyResult } from "./family-actions";
import { addReport, copyReport } from "@/lib/family/tracker-copy";
import type { CopyFamily } from "@/lib/family/tracker-copy-data";
import { pointTo } from "@/components/nudge/nudge";
import { useGuideTarget } from "@/components/guide/targets";
import { genderText } from "@/lib/guide/help/text";
import type { IntroId } from "@/lib/guide/keys";
import { EMPTY } from "@/lib/guide/lines-texts";
import { IntroLine } from "../guide/IntroLine";

type Item = RafiqTrackerData["active"][number];
type Run = (fn: () => Promise<{ error?: string }>, after?: () => void) => void;

// Her «جدول المتابعة»: the shared today/yesterday sheet, or with «الجدول
// اليومي» on (her settings) today's agenda instead, the only place to tick
// then. Her own items (she creates and edits them herself, no approval) are
// managed from the «⚙ البنود» menu: «إدارة البنود» (with publishing to the
// bank), «ترتيب البنود» (agenda only) and the link to «بنك الجداول».
// scope: «العائلة» — a child's tracker, for the child (items an adult added
// are ticked, never changed) or an adult of her family (view only: no ticks,
// no changes); her own Rafiq tracker by default.
export function RafiqTracker({
  data,
  g,
  agenda = false,
  summary = false,
  place = null,
  celebrateKey,
  scope = SELF_SCOPE,
  summaryHref,
  family,
  guide,
}: {
  data: RafiqTrackerData;
  g: GroupGender;
  agenda?: boolean;
  // «المحصّلات» (her setting): a link to her summaries
  summary?: boolean;
  // her place for prayer times (null: anchors unavailable)
  place?: PrayerLocation | null;
  // who is ticking, for the once-a-day celebration
  celebrateKey?: string;
  scope?: RafiqScope;
  // «العائلة»: where a child's «المحصّلات» open (her switch on); her own Rafiq page otherwise
  summaryHref?: string;
  // «العائلة»: the children she may add items to and copy to (an adult with
  // edit rights): on a child's tracker her family's, on her own every family's
  family?: CopyFamily[];
  // guidance (src/lib/guide), her own tracker only and only while it's on:
  // its intro lines, ?add=1 (the new-item form opened at once), and the
  // guide's empty-page wording
  guide?: { intros: IntroId[]; add: boolean };
}) {
  const can = scopeCan(scope);
  const subjectId = scope.subjectId;
  // «العائلة»: every action names the child on an adult's page
  const tick = (input: Parameters<typeof setCheckAction>[0]) => setCheckAction({ ...input, subjectId });
  const schedule = (id: string, choice: Parameters<typeof setItemScheduleAction>[1]) => setItemScheduleAction(id, choice, subjectId);
  const reorder = (ids: string[]) => reorderItemsAction(ids, subjectId);
  const today = useToday();
  const router = useRouter();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [view, setView] = useState<"day" | "items" | "order">(guide?.add ? "items" : "day");
  const t = useGuideTarget();
  const [yesterday, setYesterday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(guide?.add === true);
  const gt = (s: string) => genderText(s, g === "GIRLS" ? "FEMALE" : "MALE");
  // ?add=1 is done once the form is open: a reload shows her tracker as usual
  const openedByLink = guide?.add === true;
  useEffect(() => {
    if (openedByLink) router.replace("/rafiq/tracker", { scroll: false });
  }, [openedByLink, router]);
  const [pending, startTransition] = useTransition();
  // «العائلة»: what the last «إضافة إلى:» or copy did, child by child (shown by the control that did it)
  const [report, setReport] = useState<{ from: "add" | "copy"; lines: string[] } | null>(null);
  const limitRef = useRef<HTMLDivElement>(null);

  const run: Run = (fn, after) => {
    setError(null);
    setReport(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) return setError(r.error);
      after?.();
      router.refresh();
    });
  };
  // the same, keeping the action's report (an ended session or a dropped connection: an error)
  const runReport = (from: "add" | "copy", fn: () => Promise<CopyResult>, words: (lines: NonNullable<CopyResult["report"]>, max: number) => string[], after?: () => void) => {
    setError(null);
    setReport(null);
    startTransition(async () => {
      const r = await fn().catch(() => ({ error: "تعذّر الحفظ، يُرجى المحاولة مرة أخرى" }) as CopyResult);
      if (r.error) return setError(r.error);
      setReport({ from, lines: words(r.report ?? [], RAFIQ_TRACKER_MAX_ITEMS) });
      after?.();
      router.refresh();
    });
  };
  // «إضافة إلى:» on a child's tracker: her family's children, when there are two or more
  const siblings = scope.viewer === "adult-edit" && subjectId ? (family?.find((f) => f.children.some((c) => c.id === subjectId))?.children ?? []) : [];
  // whom a copy can go to: the other children of hers to edit
  const copyFamilies = (family ?? []).map((f) => ({ ...f, children: f.children.filter((c) => c.id !== subjectId) })).filter((f) => f.children.length > 0);
  const canCopy = (scope.viewer === "self" || scope.viewer === "adult-edit") && copyFamilies.length > 0;

  if (!today) return <div className={hl.empty}>…</div>;
  const full = data.active.length >= RAFIQ_TRACKER_MAX_ITEMS;
  const empty = data.active.length === 0 && data.sheet.items.length === 0;
  const show = (v: typeof view) => {
    setView(v);
    setAdding(false);
    setError(null);
    setReport(null);
    window.scrollTo({ top: 0 });
  };

  // the bank is open to every «رفيق الحفظ» user; ordering only matters with «الجدول اليومي»
  const menu: MenuEntry[] = [
    { label: can.record ? "إدارة البنود" : "البنود", onSelect: () => show("items"), guide: "tracker.menu.items" },
    ...(can.record && agenda && data.active.length > 1 ? [{ label: "ترتيب البنود", onSelect: () => show("order"), guide: "tracker.menu.order" as const }] : []),
    ...(can.ownExtras ? [{ label: "بنك الجداول", href: "/rafiq/templates", guide: "tracker.menu.bank" as const }] : []),
  ];

  return (
    <div>
      {guide && <IntroLine candidates={guide.intros} here={["agenda", "summary", "city"]} />}
      <TrackerHeader
        // «أمس» on the agenda; the tile sheet keeps its own today/yesterday tabs
        yesterday={yesterday}
        onYesterday={agenda && view === "day" && !empty ? () => setYesterday(!yesterday) : undefined}
        summaryHref={summaryHref ?? (summary && can.ownExtras ? "/rafiq/tracker/summary" : undefined)}
        menu={menu}
      />

      {view === "items" && (
        <>
          <ViewBar title={can.record ? "إدارة البنود" : "البنود"} onBack={() => show("day")} back={t("tracker.back")}>
            {!adding && can.record && (
              // never dead: with the tracker full it points to the limit message
              <button
                type="button"
                className={`${hl.primaryBtn} pressable`}
                onClick={() => (full ? pointTo(limitRef.current, { focus: false }) : setAdding(true))}
                {...t("tracker.newItem")}
              >
                + بند جديد
              </button>
            )}
          </ViewBar>
          {full && (
            <div ref={limitRef} className={hl.err} style={{ margin: "0 4px 10px" }} {...t("tracker.limit")}>
              يضم الجدول {RAFIQ_TRACKER_MAX_ITEMS} بندًا، وهو الحدّ الأقصى.
            </div>
          )}
          {adding && (
            <ItemForm
              submitLabel="إضافة البند"
              agenda={agenda}
              place={place}
              pending={pending}
              onCancel={() => setAdding(false)}
              targets={siblings.length > 1 ? siblings : undefined}
              hereId={subjectId}
              onSubmit={(fields, childIds) =>
                childIds && subjectId && !(childIds.length === 1 && childIds[0] === subjectId)
                  ? runReport("add", () => addItemToChildrenAction(subjectId, childIds, fields), addReport, () => setAdding(false))
                  : run(() => addItemAction({ ...fields, subjectId }), () => setAdding(false))
              }
            />
          )}
          {report?.from === "add" && <Report lines={report.lines} />}
          {error && (
            <div className={hl.err} role="alert" style={{ margin: "0 4px 10px" }}>
              {error}
            </div>
          )}
          <div className={hl.section}>
            {data.active.length === 0 ? (
              <div className={hl.empty}>{guide ? gt(EMPTY.trackerItems) : "لا بنود بعد."}</div>
            ) : (
              data.active.map((item) => <ItemRow key={item.id} item={item} run={run} pending={pending} agenda={agenda} place={place} scope={scope} />)
            )}
          </div>
          {data.active.length > 0 && canCopy && (
            <CopyTracker
              families={copyFamilies}
              own={scope.viewer === "self"}
              childName={scope.child?.name}
              pending={pending}
              onCopy={(ids, after) => runReport("copy", () => copyTrackerAction(scope.viewer === "self" ? null : (subjectId ?? null), ids), copyReport, after)}
            />
          )}
          {report?.from === "copy" && <Report lines={report.lines} />}
          {data.active.length > 0 && can.ownExtras && <Publish items={data.active} p={p} agenda={agenda} />}
        </>
      )}

      {view === "order" && (
        <>
          <ViewBar title="ترتيب البنود" onBack={() => show("day")} back={t("tracker.back")} />
          <AgendaOrder
            sheet={data.sheet}
            today={today}
            groupGender={g}
            course={false}
            place={place}
            onReorder={reorder}
            onDone={() => show("day")}
            live
            {...(guide
              ? {
                  empty: (
                    <div className={hl.empty}>
                      {EMPTY.trackerOrder}
                      <div className={hl.actionsRow} style={{ justifyContent: "center" }}>
                        <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => show("items")}>
                          {EMPTY.trackerOrderButton}
                        </button>
                      </div>
                    </div>
                  ),
                }
              : {})}
          />
        </>
      )}

      {view === "day" &&
        (empty ? (
          <div className={hl.section}>
            <div className={hl.empty}>
              {guide ? (
                gt(EMPTY.tracker)
              ) : scope.viewer === "self" ? (
                <>
                  {p("أضف", "أضيفي")} بنودًا يومية {p("تتابعها", "تتابعينها")} {p("بنفسك", "بنفسكِ")} (مثل: ورد المراجعة، أذكار الصباح)، لكل بند درجته
                  وأيامه.
                </>
              ) : scope.viewer === "child" ? (
                `لا توجد بنود في جدولك بعد. ${p("يمكنك", "يمكنكِ")} إضافة بند ${p("بنفسك", "بنفسكِ")}، وسيظهر هنا أيضًا ما يضيفه أهلك.`
              ) : (
                `لا توجد بنود في جدول ${scope.child?.name ?? "الطفل"} بعد.`
              )}
            </div>
            {guide ? (
              <div className={hl.actionsRow} style={{ justifyContent: "center" }}>
                <button
                  type="button"
                  className={`${hl.primaryBtn} pressable`}
                  onClick={() => {
                    show("items");
                    setAdding(true);
                  }}
                >
                  {EMPTY.trackerAdd}
                </button>
                <Link href="/rafiq/templates" className={`${hl.ghostBtn} pressable`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  {EMPTY.trackerBank}
                </Link>
              </div>
            ) : (
              can.record && (
                <div className={hl.actionsRow} style={{ justifyContent: "center" }}>
                  <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => show("items")}>
                    إدارة البنود
                  </button>
                </div>
              )
            )}
          </div>
        ) : agenda ? (
          // «الجدول اليومي»: the timeline is the only place to tick
          <TrackerAgenda
            sheet={data.sheet}
            today={today}
            groupGender={g}
            course={false}
            onTick={tick}
            onSchedule={schedule}
            place={place}
            showYesterday={yesterday}
            celebrateKey={celebrateKey}
            // the city is hers to set on her own tracker only (a child's comes from the family)
            live={{ cityHref: scope.viewer === "self" ? "/rafiq/settings#city" : null }}
          />
        ) : (
          <TrackerDaySheet
            sheet={data.sheet}
            groupGender={g}
            today={today}
            onTick={tick}
            celebrateKey={celebrateKey}
            readOnly={!can.record}
            {...(guide ? { emptyDay: gt(EMPTY.trackerDay) } : {})}
          />
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
  const t = useGuideTarget();
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
    // «نشر» never looks dead: with no item chosen it says so
    if (chosen.size === 0) return setMsg({ ok: false, text: `${p("اختر", "اختاري")} بندًا واحدًا على الأقل.` });
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
          <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => setOpen(true)} {...t("tracker.publish")}>
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
            يُنشر ما {p("تختاره", "تختارينه")} من {p("بنودك", "بنودكِ")} بعنوانه ودرجاته وأيامه{agenda && " وترتيبه ووقته"}، دون {p("اسمك", "اسمكِ")}. ما {p("تعدّله", "تعدّلينه")} في {p("جدولك", "جدولكِ")} بعد النشر لا
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
            <button type="button" className={`${hl.primaryBtn} pressable`} onClick={publish} disabled={pending}>
              {pending ? "جارٍ النشر…" : "نشر"}
            </button>
            <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </>
  );
}

type ItemFields = { title: string; value: number; days: number; schedule?: ScheduleInput };

function Report({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className={hl.ok} role="status" style={{ margin: "0 4px 10px", display: "grid", gap: 4 }}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

/** «العائلة»: checkboxes, one per child (grouped by family when there are several). */
function ChildChecks({ families, checked, onToggle }: { families: CopyFamily[]; checked: Set<string>; onToggle: (id: string) => void }) {
  return (
    <>
      {families.map((f) => (
        <div key={f.id} style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "center", margin: "4px 0" }}>
          {families.length > 1 && <span className={hl.muted} style={{ flexBasis: "100%", fontSize: 12 }}>{f.name}</span>}
          {f.children.map((c) => (
            <label key={c.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={checked.has(c.id)} onChange={() => onToggle(c.id)} />
              {c.name}
            </label>
          ))}
        </div>
      ))}
    </>
  );
}

function useChecks(initial: string[] = []) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initial));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { checked, toggle };
}

/** «نسخ الجدول إلى…» / «نسخ جدولي إلى…»: her current items to the children she picks. */
function CopyTracker({
  families,
  own,
  childName,
  pending,
  onCopy,
}: {
  families: CopyFamily[];
  own: boolean;
  childName?: string;
  pending: boolean;
  onCopy: (childIds: string[], after: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const { checked, toggle } = useChecks();
  const [problem, setProblem] = useState<string | null>(null);
  const label = own ? "نسخ جدولي إلى…" : "نسخ الجدول إلى…";
  return (
    <>
      <div className={hl.sectionTitle}>
        <span>{own ? "نسخ جدولي" : "نسخ الجدول"}</span>
        {!open && (
          <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => setOpen(true)}>
            {label}
          </button>
        )}
      </div>
      {open && (
        <div className={hl.section}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{own ? "نسخ البنود الحالية في جدولي إلى:" : `نسخ البنود الحالية في جدول ${childName ?? "الطفل"} إلى:`}</div>
          <ChildChecks families={families} checked={checked} onToggle={toggle} />
          <p className={hl.muted} style={{ margin: "8px 0" }}>
            تُنسخ البنود الحالية فقط، ولا يُنسخ بند يوجد في جدول الطفل بالاسم نفسه. وبعد النسخ يصبح كل بند مستقلًّا.
          </p>
          {problem && <div className={hl.err}>{problem}</div>}
          <div className={hl.actionsRow}>
            <button
              type="button"
              className={`${hl.primaryBtn} pressable`}
              disabled={pending}
              onClick={() => {
                if (checked.size === 0) return setProblem("يُرجى اختيار طفل واحد على الأقل");
                setProblem(null);
                onCopy([...checked], () => setOpen(false));
              }}
            >
              {pending ? "جارٍ النسخ…" : "نسخ"}
            </button>
            <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => setOpen(false)} disabled={pending}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ItemForm({
  initial = { title: "", value: 1, days: EVERY_DAY, slots: [] },
  submitLabel,
  agenda = false,
  place = null,
  pending,
  onSubmit,
  onCancel,
  targets,
  hereId,
}: {
  initial?: { title: string; value: number; days: number; slots: SlotRow[] };
  submitLabel: string;
  // «الجدول اليومي» on: the item's schedule too
  agenda?: boolean;
  place?: PrayerLocation | null;
  pending: boolean;
  onSubmit: (fields: ItemFields, childIds?: string[]) => void;
  onCancel: () => void;
  // «العائلة»: «إضافة إلى:» — her family's children (this one checked first)
  targets?: { id: string; name: string; gender: "MALE" | "FEMALE" }[];
  hereId?: string;
}) {
  const [title, setTitle] = useState(initial.title);
  const to = useChecks(hereId ? [hereId] : []);
  const [value, setValue] = useState(initial.value);
  const [days, setDays] = useState(initial.days);
  const time = useTimeFields(initial.slots);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className={hl.section}
      onSubmit={(e) => {
        e.preventDefault();
        const ids = targets ? [...to.checked] : undefined;
        if (ids && ids.length === 0) return setProblem("يُرجى اختيار طفل واحد على الأقل");
        if (!agenda) {
          setProblem(null);
          return onSubmit({ title, value, days }, ids);
        }
        const t = time.read();
        if ("error" in t) return setProblem(t.error);
        setProblem(null);
        onSubmit({ title, value, days, schedule: t.schedule }, ids);
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
      {targets && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>إضافة إلى:</span>
          <ChildChecks families={[{ id: "f", name: "", children: targets }]} checked={to.checked} onToggle={to.toggle} />
        </div>
      )}
      {problem && <div className={hl.err}>{problem}</div>}
      <div className={hl.actionsRow}>
        <button type="submit" className={`${hl.primaryBtn} pressable`} disabled={pending}>
          {pending ? "جارٍ الحفظ…" : submitLabel}
        </button>
        <button type="button" className={`${hl.ghostBtn} pressable`} onClick={onCancel} disabled={pending}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

function ItemRow({ item, run, pending, agenda, place, scope }: { item: Item; run: Run; pending: boolean; agenda: boolean; place: PrayerLocation | null; scope: RafiqScope }) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const t = useGuideTarget();
  const toggle = (m: typeof mode) => setMode(mode === m ? "view" : m);
  // «العائلة»: an adult's item is the child's to tick, not to change; a view-only adult changes nothing
  const editable = scopeCan(scope).record && !(scope.viewer === "child" && item.adultAdded);
  const adder = item.addedBy ? scope.adults?.[item.addedBy] : undefined;
  return (
    <CompactRow
      title={item.title}
      points={item.value}
      days={item.days}
      time={agenda ? scheduleLabel(item.slots) : undefined}
      onEdit={editable ? () => toggle("edit") : undefined}
      onDelete={editable ? () => toggle("remove") : undefined}
      target={t("tracker.itemRow")}
    >
      {scope.viewer !== "self" && item.adultAdded && (
        <div className={hl.muted} style={{ fontSize: 12, marginTop: 4 }}>
          {scope.viewer === "child" ? "🔒 " : ""}
          {adder ? `من ${adder.name}` : "من أحد البالغين"}
        </div>
      )}
      {mode === "edit" && (
        <div className={itemStyles.rowPanel}>
          <ItemForm
            initial={item}
            agenda={agenda}
            place={place}
            submitLabel="حفظ"
            pending={pending}
            onCancel={() => setMode("view")}
            onSubmit={(fields) => run(() => updateItemAction(item.id, { ...fields, subjectId: scope.subjectId }), () => setMode("view"))}
          />
        </div>
      )}
      {mode === "remove" && (
        <div className={itemStyles.confirm}>
          <span>حذف هذا البند؟ تبقى درجاته في الأيام السابقة.</span>
          <button type="button" className={`${styles.dangerBtn} pressable`} disabled={pending} onClick={() => run(() => removeItemAction(item.id, scope.subjectId))}>
            نعم، حذف
          </button>
          <button type="button" className={`${hl.ghostBtn} pressable`} onClick={() => setMode("view")}>
            تراجع
          </button>
        </div>
      )}
    </CompactRow>
  );
}

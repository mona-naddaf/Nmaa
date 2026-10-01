"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import styles from "@/components/student-work/work.module.css";
import { ValuePicker, WeekdayPicker } from "@/components/student-work/TrackerControls";
import { useToday } from "@/lib/calendar/useToday";
import { gregorianLabel } from "@/lib/calendar/hijri";
import { addDays, dayScore, daysLabel, EVERY_DAY, isComplete, TRACKER_LIMITS, weekdayOf, weekDays, WEEKDAY_SHORT, localDayOf, withLocalDays } from "@/lib/tracker/rules";
import type { GroupTracker, PendingItem, StaffTrackerItem } from "@/lib/tracker/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import {
  approveTrackerItemAction,
  archiveTrackerItemAction,
  createTrackerItemAction,
  rejectTrackerItemAction,
  updateTrackerItemAction,
} from "./actions";

export interface TrackerGroup {
  id: string;
  name: string;
  gender: GroupGender;
  pending: number;
}

export function TrackerStaffView({
  groups,
  group,
  queue,
  overview,
  items,
  students,
}: {
  groups: TrackerGroup[];
  group: TrackerGroup;
  queue: PendingItem[];
  overview: GroupTracker;
  items: StaffTrackerItem[];
  students: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const g = group.gender;
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const active = items.filter((i) => !i.archived);
  const archived = items.filter((i) => i.archived);

  return (
    <div>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle}>جدول المتابعة</h1>
      </div>

      {groups.length > 1 && (
        <div className={styles.pills} style={{ marginBottom: 14 }} role="navigation" aria-label="المجموعة">
          {groups.map((gr) => (
            <Link key={gr.id} href={`/tracker?group=${gr.id}`} className={`${styles.pill} ${gr.id === group.id ? styles.sel : ""}`}>
              {gr.name}
              {gr.pending > 0 && <span className={styles.tag}>{gr.pending}</span>}
            </Link>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <>
          <div className={hl.sectionTitle}>بانتظار الاعتماد ({queue.length})</div>
          <div className={hl.section}>
            {queue.map((q) => (
              <PendingRow key={q.id} q={q} />
            ))}
          </div>
        </>
      )}

      <div className={hl.sectionTitle}>متابعة الأسبوع — {group.name}</div>
      <div className={hl.section}>
        <GroupOverview data={overview} gender={g} />
      </div>

      <div className={hl.sectionTitle}>
        <span>
          بنود المجموعة ({active.length})
        </span>
        {!adding && (
          <button type="button" className={hl.primaryBtn} onClick={() => setAdding(true)}>
            + بند جديد
          </button>
        )}
      </div>
      {adding && <NewItem group={group} students={students} onDone={() => setAdding(false)} />}
      <div className={hl.section}>
        {active.length === 0 ? (
          <div className={hl.empty}>لا توجد بنود بعد — {p("أضف", "أضيفي")} بندًا مثل «الورد اليومي» أو «أذكار الصباح».</div>
        ) : (
          active.map((item) => <ItemRow key={item.id} item={item} gender={g} />)
        )}
      </div>

      {archived.length > 0 && (
        <details>
          <summary className={hl.sectionTitle} style={{ cursor: "pointer" }}>
            بنود مؤرشفة ({archived.length})
          </summary>
          <div className={hl.section}>
            {archived.map((item) => (
              <ItemRow key={item.id} item={item} gender={g} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else after?.();
    });
  };
  return { error, pending, run };
}

function PendingRow({ q }: { q: PendingItem }) {
  const today = useToday();
  const [value, setValue] = useState(1);
  const { error, pending, run } = useAction();
  return (
    <div className={styles.itemRow} style={{ display: "block" }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{q.title}</div>
      <div className={styles.meta}>
        <span>
          {q.student.name} · {q.student.groupName}
        </span>
        <span>{daysLabel(q.days)}</span>
        {today && <span>اقتُرح {gregorianLabel(localDayOf(q.createdAt))}</span>}
      </div>
      <div className={styles.fieldLabel} style={{ marginTop: 10 }}>
        الدرجة عند الاعتماد
      </div>
      <ValuePicker value={value} onChange={setValue} />
      <div className={hl.actionsRow}>
        <button type="button" className={hl.primaryBtn} disabled={pending} onClick={() => run(() => approveTrackerItemAction(q.id, value))}>
          اعتماد بدرجة {value}
        </button>
        <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => rejectTrackerItemAction(q.id))}>
          عدم الاعتماد
        </button>
      </div>
      {error && <div className={hl.err}>{error}</div>}
    </div>
  );
}

function GroupOverview({ data, gender: g }: { data: GroupTracker; gender: GroupGender }) {
  const today = useToday();
  const [offset, setOffset] = useState(0);
  if (!today) return <div className={hl.empty}>…</div>;
  if (data.students.length === 0) return <div className={hl.empty}>لا يوجد {pickByGroup(g, { m: "طلاب", f: "طالبات" })} في هذه المجموعة.</div>;

  const days = weekDays(addDays(today, offset * 7));
  const itemsById = new Map(withLocalDays(data.items).map((i) => [i.id, i]));

  return (
    <div>
      <div className={styles.toolbar} style={{ marginBottom: 8 }}>
        <div className={hl.muted}>
          من {gregorianLabel(days[0])} إلى {gregorianLabel(days[6])} · لكل يوم: المحقَّق/الممكن
        </div>
        <div className={styles.pills}>
          <button type="button" className={`${styles.pill} ${offset === -1 ? styles.sel : ""}`} onClick={() => setOffset(-1)}>
            الأسبوع الماضي
          </button>
          <button type="button" className={`${styles.pill} ${offset === 0 ? styles.sel : ""}`} onClick={() => setOffset(0)}>
            هذا الأسبوع
          </button>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>الاسم</th>
              {days.map((d) => (
                <th key={d} title={gregorianLabel(d)}>
                  {WEEKDAY_SHORT[weekdayOf(d)]}
                </th>
              ))}
              <th>الأسبوع</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => {
              const items = (data.itemIds[s.id] ?? []).map((id) => itemsById.get(id)!).filter(Boolean);
              const scores = days.map((d) => (d > today ? null : dayScore(items, new Set(data.checks[s.id]?.[d] ?? []), d)));
              const earned = scores.reduce((n, x) => n + (x?.earned ?? 0), 0);
              const possible = scores.reduce((n, x) => n + (x?.possible ?? 0), 0);
              return (
                <tr key={s.id}>
                  <td>
                    <Link href={`/students/${s.id}`} style={{ color: "var(--ink)", fontWeight: 700 }}>
                      {s.name}
                    </Link>
                  </td>
                  {scores.map((x, i) => (
                    <td key={days[i]} className={x && isComplete(x) ? styles.cellFull : x && x.possible === 0 ? styles.cellNone : undefined}>
                      {x ? (x.possible === 0 ? "—" : `${x.earned}/${x.possible}`) : ""}
                    </td>
                  ))}
                  <td>
                    <b>
                      {earned}/{possible}
                    </b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewItem({ group, students, onDone }: { group: TrackerGroup; students: { id: string; name: string }[]; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState(1);
  const [days, setDays] = useState(EVERY_DAY);
  const [kind, setKind] = useState<"GROUP" | "STUDENTS">("GROUP");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { error, pending, run } = useAction();
  const p = (m: string, f: string) => pickByGroup(group.gender, { m, f });

  function save(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        createTrackerItemAction(
          { title, value, days },
          kind === "GROUP" ? { kind: "GROUP", groupId: group.id } : { kind: "STUDENTS", studentIds: [...picked] },
        ),
      onDone,
    );
  }

  return (
    <form className={hl.section} onSubmit={save}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 12px" }}>
        بند جديد
      </div>
      <div className={styles.field}>
        <label htmlFor="ti-title">اسم البند</label>
        <input
          id="ti-title"
          className={styles.input}
          value={title}
          maxLength={TRACKER_LIMITS.titleMax}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: أذكار الصباح"
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
      <div className={styles.field}>
        <span className={styles.fieldLabel}>لمن البند؟</span>
        <div className={styles.pills}>
          <button type="button" className={`${styles.pill} ${kind === "GROUP" ? styles.sel : ""}`} onClick={() => setKind("GROUP")}>
            المجموعة كاملة
          </button>
          <button type="button" className={`${styles.pill} ${kind === "STUDENTS" ? styles.sel : ""}`} onClick={() => setKind("STUDENTS")}>
            {p("طلاب محدّدون", "طالبات محدّدات")}
          </button>
        </div>
      </div>
      {kind === "STUDENTS" && (
        <div className={styles.field}>
          <div className={styles.picker}>
            {students.map((s) => (
              <label key={s.id} className={styles.pickRow}>
                <input
                  type="checkbox"
                  checked={picked.has(s.id)}
                  onChange={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
          <div className={styles.hint}>المختار: {picked.size}</div>
        </div>
      )}
      {error && <div className={hl.err}>{error}</div>}
      <div className={hl.actionsRow}>
        <button type="submit" className={hl.primaryBtn} disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" className={hl.ghostBtn} onClick={onDone} disabled={pending}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

function ItemRow({ item, gender: g }: { item: StaffTrackerItem; gender: GroupGender }) {
  const [mode, setMode] = useState<"view" | "edit" | "archive">("view");
  const [title, setTitle] = useState(item.title);
  const [value, setValue] = useState(item.value ?? 1);
  const [days, setDays] = useState(item.days);
  const { error, pending, run } = useAction();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  let target: string;
  if (item.target.kind === "GROUP") target = "المجموعة كاملة";
  else if (item.target.kind === "OWN") target = `${p("بند خاص اقترحه", "بند خاص اقترحته")} ${item.target.student.name}`;
  else target = item.target.students.map((s) => s.name).join("، ") || "—";

  return (
    <div className={styles.itemRow} style={{ display: "block", opacity: item.archived ? 0.7 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className={styles.valueBadge}>{item.value}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{item.title}</div>
          <div className={styles.meta}>
            <span>{daysLabel(item.days)}</span>
            <span>{target}</span>
            {item.target.kind !== "OWN" && <span>أنشأه: {item.creatorName ?? "الإشراف"}</span>}
            {item.archived && <span className={`${styles.tag} ${styles.grey}`}>مؤرشف</span>}
          </div>
        </div>
      </div>

      {mode === "edit" && (
        <div style={{ marginTop: 12 }}>
          <div className={styles.field}>
            <label>اسم البند</label>
            <input className={styles.input} value={title} maxLength={TRACKER_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>الدرجة</span>
            <ValuePicker value={value} onChange={setValue} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>الأيام</span>
            <WeekdayPicker days={days} onChange={setDays} />
          </div>
          <div className={styles.hint}>تُحسب الدرجات دائمًا بالقيم الحالية للبند، بما فيها الأيام السابقة.</div>
        </div>
      )}

      {item.canEdit && !item.archived && (
        <div className={styles.cardActions}>
          {mode === "view" && (
            <>
              <button type="button" className={hl.ghostBtn} onClick={() => setMode("edit")}>
                تعديل
              </button>
              <button type="button" className={styles.dangerBtn} onClick={() => setMode("archive")}>
                أرشفة
              </button>
            </>
          )}
          {mode === "edit" && (
            <>
              <button
                type="button"
                className={hl.primaryBtn}
                disabled={pending}
                onClick={() => run(() => updateTrackerItemAction(item.id, { title, value, days }), () => setMode("view"))}
              >
                {pending ? "جارٍ الحفظ…" : "حفظ"}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")} disabled={pending}>
                إلغاء
              </button>
            </>
          )}
          {mode === "archive" && (
            <>
              <span className={hl.muted} style={{ alignSelf: "center" }}>
                يتوقف احتسابه من اليوم، وتبقى درجات الأيام السابقة. أرشفة البند؟
              </span>
              <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => archiveTrackerItemAction(item.id))}>
                {pending ? "جارٍ الأرشفة…" : "نعم، أرشفة"}
              </button>
              <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")} disabled={pending}>
                إلغاء
              </button>
            </>
          )}
        </div>
      )}
      {error && <div className={hl.err}>{error}</div>}
    </div>
  );
}

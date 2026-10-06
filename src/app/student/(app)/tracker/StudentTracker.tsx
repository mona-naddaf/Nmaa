"use client";

import { useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "@/components/student-work/work.module.css";
import { WeekdayPicker } from "@/components/student-work/TrackerControls";
import { TrackerDaySheet } from "@/components/student-work/TrackerDaySheet";
import { useToday } from "@/lib/calendar/useToday";
import { daysBetween } from "@/lib/calendar/hijri";
import { daysLabel, EVERY_DAY, TRACKER_LIMITS, withLocalDays } from "@/lib/tracker/rules";
import type { TrackerItemView, TrackerSheet } from "@/lib/tracker/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { addOwnTrackerItemAction, deleteOwnTrackerItemAction, renameOwnTrackerItemAction, setTrackerCheckAction } from "./actions";

export function StudentTracker({ sheet, groupGender: g }: { sheet: TrackerSheet; groupGender: GroupGender }) {
  const today = useToday();
  if (!today) return <div className={hl.empty}>…</div>;

  // items exist from her local creation day (not the UTC one)
  const allItems = withLocalDays(sheet.items);

  // D8: «لم يُعتمد» shows for a week after the decision, then disappears
  const ownWaiting = allItems.filter(
    (i) =>
      i.own &&
      i.archivedDay === null &&
      (i.status === "PENDING" || (i.status === "REJECTED" && i.reviewedDay !== null && daysBetween(i.reviewedDay, today) <= TRACKER_LIMITS.rejectedShowDays)),
  );

  return (
    <div>
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>✅ جدول المتابعة</span>
      </div>

      <TrackerDaySheet sheet={sheet} groupGender={g} today={today} onTick={setTrackerCheckAction} />

      <OwnItems items={ownWaiting} g={g} />
    </div>
  );
}

function OwnItems({ items, g }: { items: TrackerItemView[]; g: GroupGender }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(EVERY_DAY);
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

  return (
    <>
      <div className={hl.sectionTitle}>
        <span>بنودي الخاصة</span>
        {!adding && (
          <button type="button" className={hl.primaryBtn} onClick={() => setAdding(true)}>
            + بند خاص
          </button>
        )}
      </div>
      {adding && (
        <form
          className={hl.section}
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addOwnTrackerItemAction({ title, days }),
              () => {
                setAdding(false);
                setTitle("");
                setDays(EVERY_DAY);
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
      {items.length > 0 && (
        <div className={hl.section}>
          {items.map((i) => (
            <OwnRow key={i.id} item={i} run={run} pending={pending} />
          ))}
          {error && !adding && <div className={hl.err}>{error}</div>}
        </div>
      )}
    </>
  );
}

function OwnRow({
  item,
  run,
  pending,
}: {
  item: TrackerItemView;
  run: (fn: () => Promise<{ error?: string }>, after?: () => void) => void;
  pending: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [title, setTitle] = useState(item.title);
  const waiting = item.status === "PENDING";

  return (
    <div className={styles.itemRow} style={{ display: "block" }}>
      {mode === "edit" ? (
        <input className={styles.input} value={title} maxLength={TRACKER_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} aria-label="اسم البند" />
      ) : (
        <div style={{ fontWeight: 800, fontSize: 15 }}>{item.title}</div>
      )}
      <div className={styles.meta}>
        <span className={`${styles.tag} ${waiting ? "" : styles.grey}`}>{waiting ? "بانتظار الاعتماد" : "لم يُعتمد"}</span>
        <span>{daysLabel(item.days)}</span>
      </div>
      <div className={styles.cardActions}>
        {mode === "view" && (
          <>
            {waiting && (
              <button type="button" className={hl.ghostBtn} onClick={() => setMode("edit")}>
                تعديل الاسم
              </button>
            )}
            <button type="button" className={styles.dangerBtn} onClick={() => setMode("delete")}>
              حذف
            </button>
          </>
        )}
        {mode === "edit" && (
          <>
            <button type="button" className={hl.primaryBtn} disabled={pending} onClick={() => run(() => renameOwnTrackerItemAction(item.id, title), () => setMode("view"))}>
              حفظ
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
              إلغاء
            </button>
          </>
        )}
        {mode === "delete" && (
          <>
            <span className={hl.muted} style={{ alignSelf: "center" }}>
              حذف هذا البند؟
            </span>
            <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => deleteOwnTrackerItemAction(item.id))}>
              نعم، حذف
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
              تراجع
            </button>
          </>
        )}
      </div>
    </div>
  );
}

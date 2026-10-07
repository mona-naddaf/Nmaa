"use client";

import { useState, useTransition } from "react";
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
import { addItemAction, removeItemAction, setCheckAction, updateItemAction } from "./actions";

type Item = RafiqTrackerData["active"][number];
type Run = (fn: () => Promise<{ error?: string }>, after?: () => void) => void;

const marksLabel = (n: number) => (n === 1 ? "درجة" : n === 2 ? "درجتان" : n <= 10 ? `${n} درجات` : `${n} درجة`);

// Her «جدول المتابعة»: the shared today/yesterday sheet, then her own items,
// which she creates and edits herself (no approval).
export function RafiqTracker({ data, g }: { data: RafiqTrackerData; g: GroupGender }) {
  const today = useToday();
  const router = useRouter();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
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

  return (
    <div>
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>✅ جدول المتابعة</span>
      </div>

      {data.active.length === 0 && data.sheet.items.length === 0 ? (
        <div className={hl.section}>
          <div className={hl.empty}>
            {p("أضف", "أضيفي")} بنودًا يومية {p("تتابعها", "تتابعينها")} بنفسك (مثل: ورد المراجعة، أذكار الصباح)، لكل بند درجته
            وأيامه.
          </div>
        </div>
      ) : (
        <TrackerDaySheet sheet={data.sheet} groupGender={g} today={today} onTick={setCheckAction} />
      )}

      <div className={hl.sectionTitle}>
        <span>بنودي</span>
        {!adding && (
          <button type="button" className={hl.primaryBtn} onClick={() => setAdding(true)} disabled={full}>
            + بند جديد
          </button>
        )}
      </div>
      {full && <div className={hl.err} style={{ margin: "0 4px 10px" }}>يضم الجدول {RAFIQ_TRACKER_MAX_ITEMS} بندًا، وهو الحدّ الأقصى.</div>}
      {adding && (
        <ItemForm
          submitLabel="إضافة البند"
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
      {data.active.length > 0 && (
        <div className={hl.section}>
          {data.active.map((item) => (
            <ItemRow key={item.id} item={item} run={run} pending={pending} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemForm({
  initial = { title: "", value: 1, days: EVERY_DAY },
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; value: number; days: number };
  submitLabel: string;
  pending: boolean;
  onSubmit: (fields: { title: string; value: number; days: number }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [value, setValue] = useState(initial.value);
  const [days, setDays] = useState(initial.days);
  return (
    <form
      className={hl.section}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, value, days });
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

function ItemRow({ item, run, pending }: { item: Item; run: Run; pending: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  if (mode === "edit") {
    return (
      <ItemForm
        initial={item}
        submitLabel="حفظ"
        pending={pending}
        onCancel={() => setMode("view")}
        onSubmit={(fields) => run(() => updateItemAction(item.id, fields), () => setMode("view"))}
      />
    );
  }
  return (
    <div className={styles.itemRow} style={{ display: "block" }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{item.title}</div>
      <div className={styles.meta}>
        <span className={styles.tag}>{marksLabel(item.value)}</span>
        <span>{daysLabel(item.days)}</span>
      </div>
      <div className={styles.cardActions}>
        {mode === "view" ? (
          <>
            <button type="button" className={hl.ghostBtn} onClick={() => setMode("edit")}>
              تعديل
            </button>
            <button type="button" className={styles.dangerBtn} onClick={() => setMode("remove")}>
              حذف
            </button>
          </>
        ) : (
          <>
            <span className={hl.muted} style={{ alignSelf: "center" }}>
              حذف هذا البند؟ تبقى درجاته في الأيام السابقة.
            </span>
            <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => removeItemAction(item.id))}>
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

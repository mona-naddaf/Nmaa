"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "../resources/bank.module.css";
import work from "@/components/student-work/work.module.css";
import { ValuePicker, WeekdayPicker } from "@/components/student-work/TrackerControls";
import { daysLabel, EVERY_DAY, TRACKER_LIMITS } from "@/lib/tracker/rules";
import { TEMPLATE_LIMITS, type TemplateItemInput } from "@/lib/rafiq/template-rules";
import { createSuggestedTemplateAction, deleteTemplateAction, dismissTemplateReportsAction } from "./actions";

type Template = {
  id: string;
  title: string;
  description: string | null;
  suggested: boolean;
  hidden: boolean;
  useCount: number;
  date: string;
  items: TemplateItemInput[];
  reports: { id: string; reason: string | null; date: string }[];
};

export function TemplateModeration({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) return setError(result.error);
      after?.();
      router.refresh();
    });
  }

  const reported = templates.filter((t) => t.reports.length > 0);

  const row = (t: Template) => (
    <div key={t.id} className={styles.modRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800 }}>
          {t.title} {t.suggested && <span className={`${work.tag} ${work.green}`}>مقترح</span>}{" "}
          {t.hidden && <span className={`${work.tag} ${work.grey}`}>مخفيّ</span>}
        </div>
        {t.description && <div className={styles.hint}>{t.description}</div>}
        <div className={styles.hint}>
          {t.items.map((it) => `${it.title} (${it.value} · ${daysLabel(it.days)})`).join("، ")}
        </div>
        <div className={styles.hint}>
          نُشر <bdi dir="ltr">{t.date}</bdi> · استُخدم {t.useCount}
        </div>
        {t.reports.length > 0 && (
          <ul className={styles.reportList}>
            {t.reports.map((r) => (
              <li key={r.id}>
                <bdi dir="ltr">{r.date}</bdi> — {r.reason ?? "بدون سبب"}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.buttons}>
        {t.reports.length > 0 && (
          <button type="button" className={styles.secondaryBtn} disabled={pending} onClick={() => run(() => dismissTemplateReportsAction(t.id))}>
            رفض البلاغات وإظهاره
          </button>
        )}
        {confirmDelete === t.id ? (
          <>
            <button type="button" className={styles.primaryBtn} disabled={pending} onClick={() => run(() => deleteTemplateAction(t.id), () => setConfirmDelete(null))}>
              تأكيد الحذف
            </button>
            <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(null)}>
              تراجع
            </button>
          </>
        ) : (
          <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(t.id)}>
            حذف
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {error && (
        <div className={styles.err} role="alert">
          {error}
        </div>
      )}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>الجداول المُبلَّغ عنها ({reported.length})</div>
        {reported.length === 0 ? <div className={styles.hint}>لا توجد بلاغات مفتوحة.</div> : reported.map(row)}
      </section>

      <NewSuggested run={run} pending={pending} />

      <section className={styles.section}>
        <div className={styles.sectionTitle}>كل الجداول ({templates.length})</div>
        {templates.length === 0 ? <div className={styles.hint}>لا توجد جداول بعد.</div> : templates.map(row)}
      </section>
    </div>
  );
}

const emptyItem = (): TemplateItemInput => ({ title: "", value: 1, days: EVERY_DAY });

function NewSuggested({ run, pending }: { run: (a: () => Promise<{ error?: string }>, after?: () => void) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<TemplateItemInput[]>([emptyItem()]);
  const set = (i: number, patch: Partial<TemplateItemInput>) => setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  if (!open) {
    return (
      <section className={styles.section}>
        <button type="button" className={styles.primaryBtn} onClick={() => setOpen(true)}>
          + جدول مقترح جديد
        </button>
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>جدول مقترح جديد</div>
      <div className={work.field}>
        <label htmlFor="sug-title">العنوان</label>
        <input id="sug-title" className={work.input} value={title} maxLength={TEMPLATE_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className={work.field}>
        <label htmlFor="sug-desc">الوصف (اختياري)</label>
        <textarea id="sug-desc" className={work.input} rows={3} value={description} maxLength={TEMPLATE_LIMITS.descriptionMax} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {items.map((it, i) => (
        <div key={i} className={work.itemRow} style={{ display: "block" }}>
          <div className={work.field}>
            <label htmlFor={`sug-item-${i}`}>البند {i + 1}</label>
            <input id={`sug-item-${i}`} className={work.input} value={it.title} maxLength={TRACKER_LIMITS.titleMax} onChange={(e) => set(i, { title: e.target.value })} />
          </div>
          <div className={work.field}>
            <span className={work.fieldLabel}>الدرجة</span>
            <ValuePicker value={it.value} onChange={(value) => set(i, { value })} />
          </div>
          <div className={work.field}>
            <span className={work.fieldLabel}>الأيام</span>
            <WeekdayPicker days={it.days} onChange={(days) => set(i, { days })} />
          </div>
          {items.length > 1 && (
            <button type="button" className={styles.linkBtn} onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}>
              إزالة البند
            </button>
          )}
        </div>
      ))}
      {items.length < TEMPLATE_LIMITS.itemsMax && (
        <button type="button" className={styles.secondaryBtn} onClick={() => setItems((prev) => [...prev, emptyItem()])}>
          + بند
        </button>
      )}
      <div className={styles.inlineRow} style={{ marginTop: 12 }}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={pending}
          onClick={() =>
            run(
              () => createSuggestedTemplateAction({ title, description, items }),
              () => {
                setOpen(false);
                setTitle("");
                setDescription("");
                setItems([emptyItem()]);
              },
            )
          }
        >
          نشر الجدول المقترح
        </button>
        <button type="button" className={styles.linkBtn} onClick={() => setOpen(false)}>
          إلغاء
        </button>
      </div>
    </section>
  );
}

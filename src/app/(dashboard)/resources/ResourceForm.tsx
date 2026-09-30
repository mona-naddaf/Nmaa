"use client";

import { useState, useTransition } from "react";
import styles from "./bank.module.css";
import { TagsInput } from "./TagInput";
import { createResourceAction, reportResourceAction, updateResourceAction } from "./actions";

export const LIMITS = { ageMin: 1, ageMax: 25, tagsMax: 8 } as const;

export type FormResource = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  ageFrom: number;
  ageTo: number;
  typeId: string;
  tags: { name: string }[];
};

export function ResourceForm({
  types,
  editing,
  onClose,
  onSaved,
}: {
  types: { id: string; name: string }[];
  editing: FormResource | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(editing?.url ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [ageFrom, setAgeFrom] = useState(editing ? String(editing.ageFrom) : "");
  const [ageTo, setAgeTo] = useState(editing ? String(editing.ageTo) : "");
  const [typeId, setTypeId] = useState(editing?.typeId ?? "");
  const [tags, setTags] = useState<string[]>(editing?.tags.map((t) => t.name) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const from = Number(ageFrom);
    const to = Number(ageTo);
    if (ageFrom && ageTo && to < from) return setError("يجب ألّا يقلّ «إلى عمر» عن «من عمر»");
    if (!typeId) return setError("يُرجى اختيار نوع الوسيلة");
    const input = { url, title, description, ageFrom: from, ageTo: to, typeId, tags };
    startTransition(async () => {
      const result = editing ? await updateResourceAction(editing.id, input) : await createResourceAction(input);
      if (result.error) return setError(result.error);
      onSaved();
    });
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="resource-form-title">
      <form className={styles.dialog} onSubmit={save}>
        <div className={styles.dialogTitle} id="resource-form-title">
          {editing ? "تعديل الوسيلة" : "إضافة وسيلة إلى البنك"}
        </div>

        <div className={styles.field}>
          <label htmlFor="res-url">الرابط</label>
          <input
            id="res-url"
            className={styles.input}
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <div className={styles.hint}>
            تُشارَك الوسيلة على هيئة رابط (يمكنك رفع النشاط على Google Drive أو Telegram ثم مشاركة رابطه هنا).
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="res-title">العنوان</label>
          <input id="res-title" className={styles.input} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className={styles.field}>
          <label htmlFor="res-desc">الوصف (اختياري)</label>
          <textarea
            id="res-desc"
            className={styles.input}
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={`${styles.field} ${styles.row2}`}>
          <div>
            <label htmlFor="res-from" style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 5 }}>
              من عمر
            </label>
            <input
              id="res-from"
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={LIMITS.ageMin}
              max={LIMITS.ageMax}
              value={ageFrom}
              onChange={(e) => setAgeFrom(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="res-to" style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 5 }}>
              إلى عمر
            </label>
            <input
              id="res-to"
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={LIMITS.ageMin}
              max={LIMITS.ageMax}
              value={ageTo}
              onChange={(e) => setAgeTo(e.target.value)}
              required
            />
          </div>
        </div>

        <div className={styles.field}>
          <label>النوع</label>
          <div className={styles.typePills} role="radiogroup" aria-label="النوع">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={typeId === t.id}
                className={`${styles.typePill} ${typeId === t.id ? styles.sel : ""}`}
                onClick={() => setTypeId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label>الوسوم (اختياري، حتى {LIMITS.tagsMax})</label>
          <TagsInput value={tags} onChange={setTags} max={LIMITS.tagsMax} />
          <div className={styles.hint}>تظهر الوسوم المستخدمة سابقًا أثناء الكتابة؛ ويُفضَّل اختيار أحدها بدل إنشاء وسم مشابه.</div>
        </div>

        {error && <div className={styles.err}>{error}</div>}
        <div className={styles.buttons}>
          <button type="submit" className={styles.primaryBtn} disabled={pending}>
            {pending ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "إضافة الوسيلة"}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={pending}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

export function ReportDialog({
  resource,
  onClose,
  onDone,
}: {
  resource: { id: string; title: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await reportResourceAction(resource.id, reason);
      if (result.error) return setError(result.error);
      setSent(true);
    });
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className={styles.dialog}>
        <div className={styles.dialogTitle} id="report-title">
          الإبلاغ عن «{resource.title}»
        </div>
        {sent ? (
          <>
            <div className={styles.hint} style={{ fontSize: 13 }}>
              شكرًا لكم، وصل البلاغ وستراجعه إدارة الموقع.
            </div>
            <div className={styles.buttons}>
              <button type="button" className={styles.primaryBtn} onClick={onDone}>
                إغلاق
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <label htmlFor="report-reason">سبب البلاغ (اختياري)</label>
              <textarea
                id="report-reason"
                className={styles.input}
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: الرابط لا يعمل، أو المحتوى غير مناسب"
              />
            </div>
            {error && <div className={styles.err}>{error}</div>}
            <div className={styles.buttons}>
              <button type="button" className={styles.primaryBtn} onClick={send} disabled={pending}>
                {pending ? "جارٍ الإرسال…" : "إرسال البلاغ"}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={pending}>
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

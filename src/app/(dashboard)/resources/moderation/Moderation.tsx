"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "../bank.module.css";
import { deleteResourceAction } from "../actions";
import { resourcesCount } from "@/lib/resources/normalize";
import { addResourceTypeAction, dismissReportsAction, mergeTagsAction, renameTagAction } from "./actions";

type Reported = {
  id: string;
  url: string;
  host: string;
  title: string;
  hidden: boolean;
  creator: string;
  reports: { id: string; reason: string | null; date: string }[];
};

export function Moderation({
  reported,
  types,
  tags,
}: {
  reported: Reported[];
  types: { id: string; name: string; count: number }[];
  tags: { id: string; name: string; count: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newType, setNewType] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [merging, setMerging] = useState<{ id: string; target: string } | null>(null);
  const [tagQuery, setTagQuery] = useState("");

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) return setError(result.error);
      after?.();
      router.refresh();
    });
  }

  const shownTags = tagQuery.trim() ? tags.filter((t) => t.name.includes(tagQuery.trim())) : tags;

  return (
    <div>
      {error && (
        <div className={styles.err} role="alert">
          {error}
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>الوسائل المُبلَّغ عنها ({reported.length})</div>
        {reported.length === 0 && <div className={styles.hint}>لا توجد بلاغات مفتوحة.</div>}
        {reported.map((r) => (
          <div key={r.id} className={styles.modRow}>
            <div className={styles.cardTop}>
              <b>{r.title}</b>
              {r.hidden && <span className={styles.flag}>مخفية تلقائيًا</span>}
            </div>
            <div className={styles.host}>
              <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">
                {r.host} ↗
              </a>
            </div>
            <div className={styles.ownerLine} style={{ marginTop: 6 }}>
              أضافها: {r.creator}
            </div>
            <ol className={styles.reportList}>
              {r.reports.map((x) => (
                <li key={x.id}>
                  {x.date} — {x.reason ?? "دون ذكر سبب"}
                </li>
              ))}
            </ol>
            <div className={styles.inlineRow}>
              <button type="button" className={styles.secondaryBtn} disabled={pending} onClick={() => run(() => dismissReportsAction(r.id))}>
                رفض البلاغات{r.hidden ? " وإظهار الوسيلة" : ""}
              </button>
              {confirmDelete === r.id ? (
                <>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={pending}
                    onClick={() => run(() => deleteResourceAction(r.id), () => setConfirmDelete(null))}
                  >
                    تأكيد حذف الوسيلة
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(null)}>
                    تراجع
                  </button>
                </>
              ) : (
                <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(r.id)}>
                  حذف الوسيلة
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>أنواع الوسائل</div>
        <div className={styles.tags} style={{ marginBottom: 10 }}>
          {types.map((t) => (
            <span key={t.id} className={styles.tagChip} style={{ cursor: "default" }}>
              {t.name} ({t.count})
            </span>
          ))}
        </div>
        <form
          className={styles.inlineRow}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addResourceTypeAction(newType), () => setNewType(""));
          }}
        >
          <input
            className={`${styles.input} ${styles.small}`}
            placeholder="اسم نوع جديد"
            maxLength={30}
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            aria-label="اسم نوع جديد"
          />
          <button type="submit" className={styles.primaryBtn} disabled={pending || !newType.trim()}>
            إضافة النوع
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>الوسوم ({tags.length})</div>
        <div className={styles.hint} style={{ marginBottom: 8 }}>
          لتنظيف التكرار: إعادة تسمية الوسم، أو دمجه في وسم آخر فتنتقل وسائله إليه ويُحذف.
        </div>
        <input
          className={styles.input}
          style={{ marginBottom: 8 }}
          placeholder="بحث في الوسوم…"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          aria-label="بحث في الوسوم"
        />
        {shownTags.map((t) => (
          <div key={t.id} className={styles.tagRow}>
            {renaming?.id === t.id ? (
              <>
                <input
                  className={`${styles.input} ${styles.small}`}
                  value={renaming.name}
                  maxLength={30}
                  onChange={(e) => setRenaming({ id: t.id, name: e.target.value })}
                  aria-label="الاسم الجديد"
                />
                <button type="button" className={styles.primaryBtn} disabled={pending} onClick={() => run(() => renameTagAction(t.id, renaming.name), () => setRenaming(null))}>
                  حفظ
                </button>
                <button type="button" className={styles.linkBtn} onClick={() => setRenaming(null)}>
                  إلغاء
                </button>
              </>
            ) : merging?.id === t.id ? (
              <>
                <span>
                  دمج «{t.name}» في:
                </span>
                <select
                  className={`${styles.input} ${styles.small}`}
                  value={merging.target}
                  onChange={(e) => setMerging({ id: t.id, target: e.target.value })}
                  aria-label="الوسم الذي يُدمَج فيه"
                >
                  <option value="">اختيار وسم…</option>
                  {tags
                    .filter((x) => x.id !== t.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} ({x.count})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={pending || !merging.target}
                  onClick={() => run(() => mergeTagsAction(t.id, merging.target), () => setMerging(null))}
                >
                  دمج
                </button>
                <button type="button" className={styles.linkBtn} onClick={() => setMerging(null)}>
                  إلغاء
                </button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>
                  {t.name} <small style={{ color: "var(--ink-soft)" }}>({t.count ? resourcesCount(t.count) : "غير مستخدم"})</small>
                </span>
                <button type="button" className={styles.linkBtn} onClick={() => setRenaming({ id: t.id, name: t.name })}>
                  إعادة تسمية
                </button>
                <button type="button" className={styles.linkBtn} onClick={() => setMerging({ id: t.id, target: "" })}>
                  دمج
                </button>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

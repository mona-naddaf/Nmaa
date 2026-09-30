"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./bank.module.css";
import { TagFilterInput } from "./TagInput";
import { ReportDialog, ResourceForm, type FormResource } from "./ResourceForm";
import { deleteResourceAction } from "./actions";

type Card = {
  id: string;
  url: string;
  host: string;
  title: string;
  description: string | null;
  ageFrom: number;
  ageTo: number;
  typeId: string;
  typeName: string;
  tags: { name: string; key: string }[];
  mine: boolean;
  editable: boolean;
  hidden: boolean;
  creator?: string;
  openReports?: number;
};

type Filters = { q: string; type: string; tag: string; age: string; mine: boolean; page: number };

export function ResourceBank({
  cards,
  hasMore,
  types,
  filters,
  isOwner,
}: {
  cards: Card[];
  hasMore: boolean;
  types: { id: string; name: string }[];
  filters: Filters;
  isOwner: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startNav] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [age, setAge] = useState(filters.age);
  const [form, setForm] = useState<{ editing: FormResource | null } | null>(null);
  const [reporting, setReporting] = useState<Card | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // filters live in the URL, so they survive reloads and back/forward
  function go(next: Partial<Filters>) {
    const f = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (f.q.trim()) params.set("q", f.q.trim());
    if (f.type) params.set("type", f.type);
    if (f.tag) params.set("tag", f.tag);
    if (f.age) params.set("age", f.age);
    if (f.mine) params.set("mine", "1");
    if (f.page > 1) params.set("page", String(f.page));
    const qs = params.toString();
    startNav(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const anyFilter = !!(filters.q || filters.type || filters.tag || filters.age);

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteResourceAction(id);
      if (result.error) setError(result.error);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <h1>بنك الوسائل</h1>
          <p>وسائل مشتركة بين جميع الدورات، تُعرض دون اسم من أضافها أو دورته.</p>
        </div>
        <div className={styles.headButtons}>
          {isOwner && (
            <Link href="/resources/moderation" className={styles.secondaryBtn}>
              🛡 إدارة البنك
            </Link>
          )}
          <button type="button" className={styles.primaryBtn} onClick={() => setForm({ editing: null })}>
            + إضافة وسيلة
          </button>
        </div>
      </div>

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={!filters.mine} className={`${styles.tab} ${!filters.mine ? styles.active : ""}`} onClick={() => go({ mine: false })}>
          كل الوسائل
        </button>
        <button type="button" role="tab" aria-selected={filters.mine} className={`${styles.tab} ${filters.mine ? styles.active : ""}`} onClick={() => go({ mine: true })}>
          وسائلي
        </button>
      </div>

      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          go({ q, age });
        }}
      >
        <input
          className={styles.input}
          type="search"
          placeholder="بحث في العنوان والوصف…"
          aria-label="بحث"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => q !== filters.q && go({ q, age })}
        />
        <select className={styles.input} aria-label="النوع" value={filters.type} onChange={(e) => go({ type: e.target.value, q, age })}>
          <option value="">كل الأنواع</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <TagFilterInput key={filters.tag} value={filters.tag} onCommit={(tag) => go({ tag, q, age })} />
        <input
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={1}
          max={25}
          placeholder="العمر"
          aria-label="مناسبة لعمر"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          onBlur={() => age !== filters.age && go({ q, age })}
        />
        {anyFilter && (
          <button
            type="button"
            className={styles.clearFilters}
            onClick={() => {
              setQ("");
              setAge("");
              go({ q: "", type: "", tag: "", age: "" });
            }}
          >
            × إزالة عوامل التصفية
          </button>
        )}
      </form>

      {error && <div className={styles.err}>{error}</div>}

      {cards.length === 0 ? (
        <div className={styles.empty}>
          {filters.mine ? "لم تُضَف من حسابك أي وسيلة بعد." : anyFilter ? "لا توجد وسائل مطابقة." : "لا توجد وسائل في البنك بعد."}
        </div>
      ) : (
        <div className={styles.grid}>
          {cards.map((c) => (
            <article key={c.id} className={`${styles.card} ${c.hidden ? styles.hidden : ""}`}>
              <div className={styles.cardTop}>
                <span className={styles.typeBadge}>{c.typeName}</span>
                <span className={styles.ageBadge}>
                  {c.ageFrom === c.ageTo ? `عمر ${c.ageFrom}` : `من ${c.ageFrom} إلى ${c.ageTo} سنة`}
                </span>
                {c.mine && <span className={styles.flag}>من إضافتك</span>}
                {c.hidden && <span className={styles.flag}>مخفية قيد المراجعة</span>}
                {isOwner && !!c.openReports && <span className={styles.flag}>بلاغات: {c.openReports}</span>}
              </div>
              <div className={styles.cardTitle}>{c.title}</div>
              <div className={styles.host} title={c.url}>
                {c.host}
              </div>
              {c.description && <div className={styles.desc}>{c.description}</div>}
              {c.tags.length > 0 && (
                <div className={styles.tags}>
                  {c.tags.map((t) => (
                    <button key={t.key} type="button" className={styles.tagChip} onClick={() => go({ tag: t.name, q, age })}>
                      #{t.name}
                    </button>
                  ))}
                </div>
              )}
              {isOwner && c.creator && <div className={styles.ownerLine}>أضافها: {c.creator}</div>}
              <div className={styles.cardActions}>
                <a className={styles.openLink} href={c.url} target="_blank" rel="noopener noreferrer nofollow">
                  فتح الرابط ↗
                </a>
                {c.editable &&
                  (confirmDelete === c.id ? (
                    <>
                      <span style={{ fontSize: 12 }}>حذف الوسيلة نهائيًا؟</span>
                      <button type="button" className={`${styles.linkBtn} ${styles.danger}`} disabled={pending} onClick={() => remove(c.id)}>
                        تأكيد الحذف
                      </button>
                      <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(null)}>
                        تراجع
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.linkBtn} onClick={() => setForm({ editing: c })}>
                        تعديل
                      </button>
                      <button type="button" className={`${styles.linkBtn} ${styles.danger}`} onClick={() => setConfirmDelete(c.id)}>
                        حذف
                      </button>
                    </>
                  ))}
                {!c.mine && !c.hidden && (
                  <button type="button" className={styles.linkBtn} style={{ marginInlineStart: "auto" }} onClick={() => setReporting(c)}>
                    ⚑ إبلاغ
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {hasMore && (
        <button type="button" className={`${styles.secondaryBtn} ${styles.more}`} onClick={() => go({ page: filters.page + 1, q, age })}>
          عرض المزيد
        </button>
      )}

      {form && (
        <ResourceForm
          types={types}
          editing={form.editing}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            router.refresh();
          }}
        />
      )}
      {reporting && (
        <ReportDialog
          resource={reporting}
          onClose={() => setReporting(null)}
          onDone={() => {
            setReporting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

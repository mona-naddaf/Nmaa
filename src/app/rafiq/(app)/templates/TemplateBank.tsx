"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import styles from "@/components/student-work/work.module.css";
import { daysLabel } from "@/lib/tracker/rules";
import { itemsAfterNoun, TEMPLATE_LIMITS } from "@/lib/rafiq/template-rules";
import type { TemplateCard } from "@/lib/rafiq/templates";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { reportTemplateAction, unpublishTemplateAction, applyTemplateAction } from "./actions";

const itemsCount = (n: number) => (n === 1 ? "بند واحد" : n === 2 ? "بندان" : n <= 10 ? `${n} بنود` : `${n} بندًا`);
const marks = (n: number) => (n === 1 ? "درجة" : n === 2 ? "درجتان" : `${n} درجات`);
const timesUsed = (n: number) => (n === 0 ? "لم يُستخدم بعد" : n === 1 ? "استُخدم مرة واحدة" : n === 2 ? "استُخدم مرتين" : `استُخدم ${n} ${n <= 10 ? "مرات" : "مرة"}`);

// «بنك جداول المتابعة»: templates shared by other learners (never with the
// publisher's name), and the owner's suggested ones first.
export function TemplateBank({ cards, query, g }: { cards: TemplateCard[]; query: string; g: GroupGender }) {
  const router = useRouter();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [q, setQ] = useState(query);

  return (
    <div>
      <div className={hl.sectionTitle}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>📚 بنك جداول المتابعة</span>
        <Link href="/rafiq/tracker" className={hl.linkBtn}>
          → جدولي
        </Link>
      </div>
      <p className={hl.muted} style={{ margin: "0 4px 12px" }}>
        جداول متابعة شاركها غيرك. {p("استخدم", "استخدمي")} أيّ جدول لتُضاف بنوده إلى جدولك، ثم {p("عدّلها", "عدّليها")} كما{" "}
        {p("تشاء", "تشائين")} دون أن يتغيّر الأصل. لا يظهر اسم من نشر الجدول.
      </p>
      <form
        className={hl.section}
        style={{ display: "flex", gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          router.push(q.trim() ? `/rafiq/templates?q=${encodeURIComponent(q.trim())}` : "/rafiq/templates");
        }}
      >
        <input className={styles.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في العناوين والأوصاف..." aria-label="بحث" />
        <button type="submit" className={hl.primaryBtn}>
          بحث
        </button>
      </form>

      {cards.length === 0 ? (
        <div className={hl.section}>
          <div className={hl.empty}>{query ? "لا توجد جداول مطابقة للبحث." : "لا توجد جداول منشورة بعد."}</div>
        </div>
      ) : (
        cards.map((c) => <Card key={c.id} c={c} p={p} />)
      )}
    </div>
  );
}

function Card({ c, p }: { c: TemplateCard; p: (m: string, f: string) => string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "use" | "report" | "unpublish">("view");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string; added?: number }>, ok: (r: { added?: number }) => string) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) return setMsg({ ok: false, text: r.error });
      setMode("view");
      setMsg({ ok: true, text: ok(r) });
      router.refresh();
    });
  }

  return (
    <div className={hl.section}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{c.title}</div>
        {c.suggested && <span className={`${styles.tag} ${styles.green}`}>مقترح</span>}
        {c.own && <span className={styles.tag}>منشور من حسابك</span>}
        {c.hidden && <span className={`${styles.tag} ${styles.grey}`}>مخفيّ بسبب البلاغات، قيد المراجعة</span>}
      </div>
      {c.description && <p style={{ margin: "6px 0", fontSize: 13.5, lineHeight: 1.8 }}>{c.description}</p>}
      <div className={hl.muted}>
        {itemsCount(c.items.length)} · {timesUsed(c.useCount)}
      </div>

      <button type="button" className={hl.linkBtn} onClick={() => setOpen(!open)} aria-expanded={open} style={{ marginTop: 6 }}>
        {open ? "إخفاء البنود" : "عرض البنود"}
      </button>
      {open && (
        <ul style={{ margin: "8px 0", paddingInlineStart: 18, fontSize: 13.5, lineHeight: 1.9 }}>
          {c.items.map((it, i) => (
            <li key={i}>
              {it.title} — <span className={hl.muted}>{marks(it.value)} · {daysLabel(it.days)}</span>
            </li>
          ))}
        </ul>
      )}

      {msg && <div className={msg.ok ? hl.ok : hl.err} style={{ margin: "8px 0" }}>{msg.text}</div>}

      <div className={hl.actionsRow}>
        {mode === "view" && (
          <>
            <button type="button" className={hl.primaryBtn} onClick={() => setMode("use")}>
              استخدام الجدول
            </button>
            {c.own ? (
              <button type="button" className={hl.ghostBtn} onClick={() => setMode("unpublish")}>
                إلغاء النشر
              </button>
            ) : c.reportedByMe ? (
              <span className={hl.muted} style={{ alignSelf: "center" }}>
                {p("أبلغتَ", "أبلغتِ")} عنه، وهو قيد المراجعة
              </span>
            ) : (
              <button type="button" className={hl.ghostBtn} onClick={() => setMode("report")}>
                إبلاغ
              </button>
            )}
          </>
        )}
        {mode === "use" && (
          <>
            <span className={hl.muted} style={{ alignSelf: "center" }}>
              إضافة {itemsAfterNoun(c.items.length)} إلى جدولك؟
            </span>
            <button
              type="button"
              className={hl.primaryBtn}
              disabled={pending}
              onClick={() => run(() => applyTemplateAction(c.id), (r) => `تمت إضافة ${itemsAfterNoun(r.added ?? 0)} إلى جدولك ✓`)}
            >
              تأكيد
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
              إلغاء
            </button>
          </>
        )}
        {mode === "unpublish" && (
          <>
            <span className={hl.muted} style={{ alignSelf: "center" }}>
              إلغاء نشر هذا الجدول؟ لا يتأثر من استخدمه.
            </span>
            <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => unpublishTemplateAction(c.id), () => "تم إلغاء النشر ✓")}>
              نعم، إلغاء النشر
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
              تراجع
            </button>
          </>
        )}
      </div>
      {mode === "report" && (
        <div style={{ marginTop: 8 }}>
          <label className={styles.fieldLabel} htmlFor={`report-${c.id}`}>
            سبب البلاغ (اختياري)
          </label>
          <input
            id={`report-${c.id}`}
            className={styles.input}
            value={reason}
            maxLength={TEMPLATE_LIMITS.reportReasonMax}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className={hl.actionsRow}>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={pending}
              onClick={() => run(() => reportTemplateAction(c.id, reason), () => "شكرًا، وصل البلاغ وسيُراجَع ✓")}
            >
              إرسال البلاغ
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setMode("view")}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
